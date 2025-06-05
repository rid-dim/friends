<script lang="ts">
  import { downloadAttachment, formatFileSize, base64ToBlob } from './fileProcessor';
  import type { FileAttachment } from './types';
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n/i18n';

  // Props
  export let attachment: FileAttachment;
  export let inline: boolean = true; // Whether to show images/videos inline
  
  // Event dispatcher
  const dispatch = createEventDispatcher<{
    download: FileAttachment;
  }>();
  
  // Helper function to determine file type from MIME type or file extension
  function getFileType(attachment: FileAttachment): 'image' | 'video' | 'file' {
    // First check if type is already set correctly
    if (attachment.type === 'image' || attachment.type === 'video' || attachment.type === 'file') {
      return attachment.type as 'image' | 'video' | 'file';
    }
    
    // Otherwise, check MIME type
    const mimeType = attachment.mimeType || attachment.type || '';
    
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    }
    
    // Check file extension as fallback
    const extension = attachment.name.split('.').pop()?.toLowerCase();
    if (extension) {
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
      const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi'];
      
      if (imageExtensions.includes(extension)) {
        return 'image';
      } else if (videoExtensions.includes(extension)) {
        return 'video';
      }
    }
    
    return 'file';
  }
  
  // Computed properties
  $: fileType = getFileType(attachment);
  $: isImage = fileType === 'image';
  $: isVideo = fileType === 'video';
  $: isFile = fileType === 'file';
  $: isComplete = attachment.complete === true && (attachment.data !== undefined && attachment.data !== null);
  
  // Get proper MIME type
  $: mimeType = attachment.mimeType || attachment.type || 'application/octet-stream';
  
  // Handle image source - check if data is already a data URL
  $: imageSource = (() => {
    if (!isComplete || !isImage) return '';
    
    // If data already starts with 'data:', it's a complete data URL
    if (attachment.data.startsWith('data:')) {
      return attachment.data;
    }
    
    // Otherwise, construct the data URL
    return `data:${mimeType};base64,${attachment.data}`;
  })();
  
  $: videoSource = isComplete && isVideo ? URL.createObjectURL(base64ToBlob(attachment.data!, mimeType)) : '';
  
  // Truncate long filenames
  function truncateFilename(filename: string, maxLength: number = 20): string {
    if (filename.length <= maxLength) return filename;
    
    const extension = filename.includes('.') ? 
      filename.substring(filename.lastIndexOf('.')) : '';
    
    const nameWithoutExtension = filename.substring(0, filename.length - extension.length);
    
    // Truncate the name part and keep the extension
    return nameWithoutExtension.substring(0, maxLength - 3 - extension.length) + '...' + extension;
  }
  
  // Clean up video URLs when component is destroyed
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    if (videoSource) {
      URL.revokeObjectURL(videoSource);
    }
  });
  
  function handleDownload() {
    if (isComplete) {
      dispatch('download', attachment);
      downloadAttachment(attachment);
    }
  }
</script>

{#if !isComplete}
  <div class="attachment-placeholder">
    <div class="loading">
      <span>{$t('fileReceiving')} {truncateFilename(attachment.name)} ({formatFileSize(attachment.size)})</span>
      <div class="spinner"></div>
    </div>
  </div>
{:else if isImage && inline}
  <div class="image-attachment">
    <img src={imageSource} alt={attachment.name} loading="lazy" />
    <div class="attachment-info">
      <span class="attachment-name" title={attachment.name}>{truncateFilename(attachment.name)}</span>
      <span class="attachment-size">{formatFileSize(attachment.size)}</span>
      <button class="download-button" on:click={handleDownload}>{$t('fileDownload')}</button>
    </div>
  </div>
{:else if isVideo && inline}
  <div class="video-attachment">
    <video controls>
      <source src={videoSource} type={mimeType}>
      Your browser does not support this video format.
    </video>
    <div class="attachment-info">
      <span class="attachment-name" title={attachment.name}>{truncateFilename(attachment.name)}</span>
      <span class="attachment-size">{formatFileSize(attachment.size)}</span>
      <button class="download-button" on:click={handleDownload}>{$t('fileDownload')}</button>
    </div>
  </div>
{:else}
  <div class="file-attachment">
    <div class="file-icon">
      {#if isImage}
        🖼️
      {:else if isVideo}
        🎬
      {:else}
        📄
      {/if}
    </div>
    <div class="file-info">
      <span class="file-name" title={attachment.name}>{truncateFilename(attachment.name)}</span>
      <span class="file-size">{formatFileSize(attachment.size)}</span>
    </div>
    <button class="download-button" on:click={handleDownload}>{$t('fileDownload')}</button>
  </div>
{/if}

<style>
  .attachment-placeholder {
    border: 1px dashed var(--line-color);
    border-radius: 4px;
    padding: 0.5rem;
    margin: 0.5rem 0;
    background-color: var(--foreground-color1);
  }
  
  .loading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.9rem;
    color: var(--text-color-secondary);
  }
  
  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--foreground-color2);
    border-top: 2px solid var(--notification-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .image-attachment {
    margin: 0.5rem 0;
    border-radius: 8px;
    overflow: hidden;
    max-width: 400px;
    box-shadow: var(--shadow-sm);
  }
  
  .image-attachment img {
    max-width: 100%;
    height: auto;
    display: block;
    cursor: pointer;
  }
  
  .video-attachment {
    margin: 0.5rem 0;
    border-radius: 8px;
    overflow: hidden;
    max-width: 400px;
    box-shadow: var(--shadow-sm);
  }
  
  .video-attachment video {
    max-width: 100%;
    height: auto;
    display: block;
  }
  
  .attachment-info {
    background-color: var(--foreground-color1);
    padding: 0.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    gap: 0.5rem;
  }
  
  .attachment-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }
  
  .attachment-size {
    color: var(--text-color-secondary);
    flex-shrink: 0;
  }
  
  .file-attachment {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border: 1px solid var(--line-color);
    border-radius: 8px;
    background-color: var(--foreground-color1);
    margin: 0.5rem 0;
    gap: 0.75rem;
  }
  
  .file-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }
  
  .file-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    overflow: hidden;
  }
  
  .file-name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .file-size {
    font-size: 0.8rem;
    color: var(--text-color-secondary);
  }
  
  .download-button {
    padding: 0.25rem 0.75rem;
    background-color: var(--notification-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: opacity 0.2s;
    flex-shrink: 0;
  }
  
  .download-button:hover {
    opacity: 0.8;
  }
</style> 