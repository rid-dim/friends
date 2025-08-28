<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { buildDataUrl as buildImageDataUrl } from '../utils/imageUrl';

  export let dataMapHex: string;
  export let mimeType: string;
  export let caption: string = '';
  export let backendUrl: string = '';
  export let senderName: string = '';
  export let receivedAt: Date | string | number | null = null;

  const dispatch = createEventDispatcher();

  $: url = buildImageDataUrl(dataMapHex, backendUrl || undefined);

  // Type guards
  $: isImage = mimeType?.startsWith('image/');
  $: isVideo = mimeType?.startsWith('video/');
  $: isAudio = mimeType?.startsWith('audio/');

  function getExtensionFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav'
    };
    return map[mime] || (mime?.split('/')?.[1] || 'bin');
  }

  function sanitizeBaseName(name: string): string {
    return (name || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_');
  }

  function buildFileBase(): string {
    const tsMs = receivedAt instanceof Date
      ? receivedAt.getTime()
      : typeof receivedAt === 'number'
        ? receivedAt
        : receivedAt
          ? Date.parse(receivedAt)
          : Date.now();
    const unix = Math.floor((isNaN(tsMs as number) ? Date.now() : (tsMs as number)) / 1000);
    const base = `${senderName || 'friend'}_${unix}`;
    return sanitizeBaseName(base);
  }

  async function handleDownload(event?: Event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    try {
      const response = await fetch(url, { method: 'GET' });
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = buildFileBase();
      const ext = getExtensionFromMime(mimeType);
      a.href = objectUrl;
      a.download = `${base}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
      dispatch('download', { success: true });
    } catch (e) {
      // Fallback: try plain link with download attr
      const a = document.createElement('a');
      const base = buildFileBase();
      const ext = getExtensionFromMime(mimeType);
      a.href = url;
      a.download = `${base}.${ext}`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      dispatch('download', { success: false, error: e instanceof Error ? e.message : 'download-fallback' });
    }
  }

  // Cleanup not needed (no object URLs created here)
  onDestroy(() => {});
</script>

{#if isImage}
  <div class="remote-image">
    <img src={url} alt={caption || 'image'} loading="lazy" />
    {#if caption}
      <div class="caption">{caption}</div>
    {/if}
    <div class="actions">
      <button class="download" on:click|preventDefault|stopPropagation={handleDownload}>{'Download'}</button>
    </div>
  </div>
{:else if isVideo}
  <div class="remote-video">
    <video controls>
      <source src={url} type={mimeType} />
    </video>
    {#if caption}
      <div class="caption">{caption}</div>
    {/if}
    <div class="actions">
      <button class="download" on:click|preventDefault|stopPropagation={handleDownload}>{'Download'}</button>
    </div>
  </div>
{:else if isAudio}
  <div class="remote-audio">
    <audio controls>
      <source src={url} type={mimeType} />
    </audio>
    {#if caption}
      <div class="caption">{caption}</div>
    {/if}
    <div class="actions">
      <button class="download" on:click|preventDefault|stopPropagation={handleDownload}>{'Download'}</button>
    </div>
  </div>
{:else}
  <div class="remote-file">
    <div class="file-icon">📄</div>
    <div class="file-info">
      <div class="file-name" title={caption || dataMapHex}>{caption || dataMapHex.slice(0, 12) + '...'}</div>
      <div class="file-mime">{mimeType || 'application/octet-stream'}</div>
    </div>
    <button class="download" on:click|preventDefault|stopPropagation={handleDownload}>{'Download'}</button>
  </div>
{/if}

<style>
  .remote-image, .remote-video, .remote-audio {
    margin: 0.5rem 0;
    border-radius: 8px;
    overflow: hidden;
    max-width: 400px;
    box-shadow: var(--shadow-sm);
    background-color: var(--foreground-color1);
  }
  .remote-image img { max-width: 100%; display: block; }
  .remote-video video { max-width: 100%; display: block; }
  .remote-audio audio { width: 100%; display: block; }
  .caption { padding: 0.5rem; font-size: 0.9rem; color: var(--text-color); }
  .actions { padding: 0.5rem; border-top: 1px solid var(--line-color); display: flex; justify-content: flex-end; }
  .download { padding: 0.25rem 0.75rem; background-color: var(--notification-color); color: white; border-radius: 4px; text-decoration: none; font-size: 0.85rem; border: none; cursor: pointer; }
  .remote-file { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border: 1px solid var(--line-color); border-radius: 8px; background-color: var(--foreground-color1); margin: 0.5rem 0; }
  .file-icon { font-size: 1.5rem; }
  .file-info { flex: 1; overflow: hidden; }
  .file-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
  .file-mime { font-size: 0.8rem; color: var(--text-color-secondary); }
</style>


