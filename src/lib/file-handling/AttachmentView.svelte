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
  
  // Computed properties
  $: isImage = attachment.type === 'image';
  $: isVideo = attachment.type === 'video';
  $: isFile = attachment.type === 'file';
  $: isComplete = attachment.complete === true && !!attachment.data;
  $: imageSource = isComplete && isImage ? `data:${attachment.mimeType};base64,${attachment.data}` : '';
  $: videoSource = isComplete && isVideo ? URL.createObjectURL(base64ToBlob(attachment.data!, attachment.mimeType)) : '';
  
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
    <img src={imageSource} alt={attachment.name} />
    <div class="attachment-info">
      <span class="attachment-name" title={attachment.name}>{truncateFilename(attachment.name)}</span>
      <span class="attachment-size">{formatFileSize(attachment.size)}</span>
      <button class="download-button" on:click={handleDownload}>{$t('fileDownload')}</button>
    </div>
  </div>
{:else if isVideo && inline}
  <div class="video-attachment">
    <video controls>
      <source src={videoSource} type={attachment.mimeType}>
      Dein Browser unterstützt dieses Videoformat nicht.
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
    border: 1px dashed #ccc;
    border-radius: 4px;
    padding: 0.5rem;
    margin: 0.5rem 0;
    background-color: #f9f9f9;
  }
  
  .loading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.9rem;
    color: #666;
  }
  
  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .image-attachment {
    margin: 0.5rem 0;
    border-radius: 4px;
    overflow: hidden;
    max-width: 100%;
  }
  
  .image-attachment img {
    max-width: 100%;
    height: auto;
    display: block;
  }
  
  .video-attachment {
    margin: 0.5rem 0;
    border-radius: 4px;
    overflow: hidden;
    max-width: 100%;
  }
  
  .video-attachment video {
    max-width: 100%;
    height: auto;
    display: block;
  }
  
  .attachment-info {
    background-color: #f5f5f5;
    padding: 0.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
  }
  
  .attachment-name {
    font-weight: bold;
    margin-right: 0.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 50%;
  }
  
  .attachment-size {
    color: #666;
    margin-right: 0.5rem;
    flex-shrink: 0;
  }
  
  .file-attachment {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background-color: #f9f9f9;
    margin: 0.5rem 0;
  }
  
  .file-icon {
    font-size: 1.5rem;
    margin-right: 0.75rem;
    flex-shrink: 0;
  }
  
  .file-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0; /* Wichtig für text-overflow: ellipsis */
  }
  
  .file-name {
    font-weight: bold;
    margin-bottom: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .file-size {
    font-size: 0.8rem;
    color: #666;
  }
  
  .download-button {
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.3rem 0.6rem;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background-color 0.2s;
    flex-shrink: 0;
    white-space: nowrap;
  }
  
  .download-button:hover {
    background-color: #45a049;
  }
  
  /* Dark Mode Styles */
  :global(.dark) .attachment-info {
    background-color: #333333;
    color: white;
  }
  
  :global(.dark) .attachment-placeholder {
    background-color: #333333;
    border-color: #555555;
  }
  
  :global(.dark) .loading {
    color: #cccccc;
  }
  
  :global(.dark) .attachment-size {
    color: #aaaaaa;
  }
  
  :global(.dark) .file-attachment {
    background-color: #333333;
    border-color: #555555;
    color: white;
  }
  
  :global(.dark) .file-size {
    color: #aaaaaa;
  }
  
  :global(.dark) .spinner {
    border-color: #555555;
    border-top-color: #3498db;
  }
</style> 