<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FileAttachment } from './types';
  
  // Props
  export let disabled: boolean = false;
  export let maxSize: number = 100 * 1024 * 1024; // 100MB max (generous limit to prevent memory issues)
  export let acceptedTypes: string = ""; // File types to accept, e.g. "image/*,.pdf"
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  // State
  let uploading = false;
  let fileInput: HTMLInputElement;
  
  // Functions
  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const attachmentId = Date.now().toString();
        const attachment: FileAttachment = {
          id: attachmentId,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          data: dataUrl,
          complete: true,
          mimeType: file.type || 'application/octet-stream'
        };
        dispatch('fileSelected', { attachment });
      };
      reader.onerror = () => {
        dispatch('error', 'Failed to read file');
      };
      reader.readAsDataURL(file);
      // Reset the input
      input.value = '';
    }
  }
  
  function triggerFileInput() {
    if (!disabled && !uploading) {
      fileInput.click();
    }
  }
</script>

<div class="file-uploader">
  <label class="upload-button" class:disabled>
    <input
      type="file"
      bind:this={fileInput}
      on:change={handleFileSelect}
      accept={acceptedTypes}
      {disabled}
    />
    <span class="icon">📎</span>
  </label>
</div>

<style>
  .file-uploader {
    display: inline-block;
  }
  
  .upload-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--foreground-color2);
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .upload-button:hover:not(.disabled) {
    opacity: 0.8;
  }
  
  .upload-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .upload-button input {
    display: none;
  }
  
  .icon {
    font-size: 1.2rem;
  }
</style> 