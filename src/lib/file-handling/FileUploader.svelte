<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { ImmutableFileService } from '../utils/dweb/ImmutableFileService';

  // Props
  export let disabled: boolean = false;
  export let maxSize: number = 100 * 1024 * 1024; // 100MB max
  export let acceptedTypes: string = ""; // e.g. "image/*,.pdf"
  export let backendUrl: string = '';
  export let antAppId: string = 'friends';
  export let antOwnerSecret: string | null = null;

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // State
  let uploading = false;
  let fileInput: HTMLInputElement;

  function filenameWithoutExt(name: string): string {
    const i = name.lastIndexOf('.');
    return i > 0 ? name.substring(0, i) : name;
  }

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    input.value = '';

    if (file.size > maxSize) {
      dispatch('error', `File too large (max ${Math.round(maxSize / (1024*1024))}MB)`);
      return;
    }

    uploading = true;
    try {
      const service = new ImmutableFileService(backendUrl || null, antAppId, antOwnerSecret);
      const result = await service.uploadFile(file, file.name, file.type, false);
      dispatch('uploadReady', { 
        dataMapHex: result.dataMapHex,
        mimeType: file.type || 'application/octet-stream',
        fileName: file.name,
        size: file.size
      });
    } catch (e) {
      dispatch('error', e instanceof Error ? e.message : 'Upload failed');
    } finally {
      uploading = false;
    }
  }

  function triggerFileInput() {
    if (!disabled && !uploading) {
      fileInput.click();
    }
  }
</script>

<div class="file-uploader">
  <label class="upload-button" class:disabled={disabled || uploading} class:uploading={uploading} title={uploading ? 'Uploading…' : ''}>
    <input
      type="file"
      bind:this={fileInput}
      on:change={handleFileSelect}
      accept={acceptedTypes}
      {disabled}
    />
    {#if uploading}
      <span class="spinner" aria-live="polite" aria-label="Uploading"></span>
    {:else}
      <span class="icon">📎</span>
    {/if}
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

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--foreground-color2);
    border-top: 2px solid var(--notification-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style> 