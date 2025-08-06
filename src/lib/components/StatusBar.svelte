<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../i18n/i18n';

  export let appTitle: string = 'Friends';
  
  const dispatch = createEventDispatcher();
  
  function openSettings() {
    dispatch('openSettings');
  }
</script>

<div class="status-bar">
  <div class="username-container">
    <button class="settings-button" on:click={openSettings} title={$t('accountSettings')}>
      ⚙️
    </button>
  </div>
  
  <h1>{appTitle}
    <sub class="dweb-app-sub">
      <a href="https://codeberg.org/happybeing/dweb" target="_blank" rel="noopener noreferrer" class="dweb-app-link">{$t('dwebApp')}</a>
    </sub>
  </h1>
  

</div>

<style>
  .status-bar {
    display: grid;
    grid-template-columns: minmax(100px, auto) 1fr;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--foreground-color1);
    border-bottom: 1px solid var(--line-color);
    width: 100%;
    box-sizing: border-box;
  }
  
  .username-container {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: auto;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  

  
  .settings-button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .settings-button:hover {
    opacity: 1;
  }
  
  h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    text-align: center;
    justify-self: center;
    display: inline-block;
  }

  .dweb-app-sub {
    font-size: 0.7em;
    color: #888;
    font-weight: 400;
    margin-left: 0.4em;
    vertical-align: sub;
    letter-spacing: 0.01em;
    opacity: 0.85;
  }
  .dweb-app-link {
    color: #888;
    text-decoration: none;
    opacity: 0.85;
    transition: color 0.2s, text-decoration 0.2s;
    font-weight: 400;
  }
  .dweb-app-link:hover, .dweb-app-link:focus {
    color: #444;
    text-decoration: underline;
    opacity: 1;
  }
  


  @media (max-width: 768px) {
    .status-bar {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto;
      gap: 0.5rem;
      padding: 0.75rem;
    }
    
    .username-container {
      justify-self: center;
      order: 2;
    }
    
    h1 {
      order: 1;
      margin-bottom: 0.5rem;
    }
  }
</style> 