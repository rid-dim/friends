<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let imageUrl: string = '';
  export let altText: string = 'Avatar';
  export let isOpen: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  function closeModal() {
    dispatch('close');
  }
  
  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }
</script>

{#if isOpen && imageUrl}
  <div class="avatar-modal-overlay" on:click={handleOverlayClick}>
    <div class="avatar-modal-content">
      <img src={imageUrl} alt={altText} class="avatar-modal-img" />
      <button class="avatar-modal-close" on:click={closeModal} title="Schließen">×</button>
    </div>
  </div>
{/if}

<style>
  .avatar-modal-overlay {
    position: fixed;
    top: 0; 
    left: 0; 
    right: 0; 
    bottom: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }
  
  .avatar-modal-content {
    position: relative;
    background: var(--background-color, #fff);
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    max-width: 80vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .avatar-modal-img {
    max-width: 75vw;
    max-height: 75vh;
    border-radius: 12px;
    object-fit: contain;
    background: #fff;
  }
  
  .avatar-modal-close {
    position: absolute;
    top: -0.5rem;
    right: -0.5rem;
    background: var(--background-color, #fff);
    border: 2px solid var(--line-color, #ddd);
    border-radius: 50%;
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1.5rem;
    color: var(--text-color, #222);
    cursor: pointer;
    transition: opacity 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  
  .avatar-modal-close:hover {
    opacity: 0.8;
  }
</style> 