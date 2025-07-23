<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { translations } from '../../i18n/translations';
  
  export let language: 'en' | 'de' | 'fr' | 'es' | 'bg' | 'ja' | 'ko' | 'zh' = 'en';
  export let pendingRequests: number = 0;
  
  const dispatch = createEventDispatcher();
  const t = translations[language];
  
  function handleClick() {
    dispatch('click');
  }
</script>

{#if pendingRequests > 0}
  <button 
    class="notification-button" 
    on:click={handleClick}
    title={t.newFriendRequests}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="8.5" cy="7" r="4"></circle>
      <line x1="20" y1="8" x2="20" y2="14"></line>
      <line x1="23" y1="11" x2="17" y2="11"></line>
    </svg>
    <span class="badge">{pendingRequests}</span>
  </button>
{/if}

<style>
  .notification-button {
    position: relative;
    background: none;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    color: var(--text-color);
    transition: opacity 0.2s;
  }
  
  .notification-button:hover {
    opacity: 0.8;
  }
  
  .badge {
    position: absolute;
    top: 0;
    right: 0;
    background: var(--notification-color);
    color: white;
    font-size: 0.75rem;
    font-weight: bold;
    padding: 0.125rem 0.375rem;
    border-radius: 10px;
    min-width: 1.25rem;
    text-align: center;
  }
</style> 