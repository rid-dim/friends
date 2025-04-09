<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { processFile, createFileChunks } from './fileProcessor';
  import type { FileAttachment, AttachmentChunk } from './types';
  import { t } from '../../i18n/i18n';
  
  // Props
  export let disabled: boolean = false;
  export let maxSize: number = 50 * 1024 * 1024; // Default max 50MB
  export let acceptedTypes: string = ""; // File types to accept, e.g. "image/*,.pdf"
  
  // Event dispatcher
  const dispatch = createEventDispatcher<{
    fileSelected: { attachment: FileAttachment, chunks?: AttachmentChunk[] };
    error: string;
  }>();
  
  // State
  let uploading = false;
  let fileInput: HTMLInputElement;
  
  // Functions
  async function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files?.length) return;
    
    const file = target.files[0];
    
    // Check file size
    if (file.size > maxSize) {
      dispatch('error', $t('fileTooLarge') + (maxSize / (1024 * 1024)) + 'MB');
      // Reset the input
      fileInput.value = '';
      return;
    }
    
    uploading = true;
    
    try {
      // Process the file
      const attachment = await processFile(file);
      
      if (attachment.chunks && attachment.chunks > 1) {
        // For large files, create chunks
        const chunks = await createFileChunks(file, attachment.id);
        dispatch('fileSelected', { attachment, chunks });
      } else {
        // For small files, just send the attachment
        dispatch('fileSelected', { attachment });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      dispatch('error', 'Fehler beim Verarbeiten der Datei');
    } finally {
      uploading = false;
      // Reset the input to allow selecting the same file again
      fileInput.value = '';
    }
  }
  
  function triggerFileInput() {
    if (!disabled && !uploading) {
      fileInput.click();
    }
  }
</script>

<div class="file-uploader">
  <input
    type="file"
    bind:this={fileInput}
    on:change={handleFileChange}
    accept={acceptedTypes}
    class="file-input"
  />
  <button
    type="button"
    class="upload-button"
    on:click={triggerFileInput}
    disabled={disabled || uploading}
  >
    {#if uploading}
      <div class="spinner"></div>
    {:else}
      <span class="clip-icon">📎</span> {$t('attachFile')}
    {/if}
  </button>
</div>

<style>
  .file-uploader {
    display: inline-flex;
    align-items: center;
  }
  
  .file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
  
  .upload-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f0f0f0;
    color: #333;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 0.4rem 0.75rem;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .upload-button:hover:not(:disabled) {
    background-color: #e0e0e0;
  }
  
  .upload-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .clip-icon {
    margin-right: 0.35rem;
  }
  
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-top-color: #333;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 0.5rem;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style> 