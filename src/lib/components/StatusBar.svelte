<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let appTitle: string = 'Friends';
  export let connectionStatus: string = 'Disconnected';
  export let handshakeStatus: string = '';
  export let handshakeCountdown: string = '';
  export let notificationStatus: string = '';
  export let username: string = '';
  
  const dispatch = createEventDispatcher();
  
  function openSettings() {
    dispatch('openSettings');
  }
</script>

<div class="status-bar">
  <div class="username-container">
    {#if username}
      <span class="username">{username}</span>
      <button class="settings-button" on:click={openSettings} title="Account Settings">
        ⚙️
      </button>
    {/if}
  </div>
  
  <h1>{appTitle}
    <sub class="dweb-app-sub">
      <a href="https://codeberg.org/happybeing/dweb" target="_blank" rel="noopener noreferrer" class="dweb-app-link">a dweb app</a>
    </sub>
  </h1>
  
  <div class="status-info">
    <div class="connection-status">
      <span class="label">Status:</span>
      <span class="value">{connectionStatus}</span>
    </div>
    
    {#if handshakeStatus}
      <div class="handshake-status">
        <span class="label">Handshake:</span>
        <span class="value">{handshakeStatus}</span>
        {#if handshakeCountdown}
          <span class="countdown">{handshakeCountdown}</span>
        {/if}
      </div>
    {/if}
    
    {#if notificationStatus}
      <div class="notification-status">
        <span class="label">🔔</span>
        <span class="value">{notificationStatus}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .status-bar {
    display: grid;
    grid-template-columns: minmax(100px, auto) 1fr minmax(100px, auto);
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
  
  .username {
    font-weight: 600;
    color: var(--text-color);
    overflow: hidden;
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
  
  .status-info {
    display: flex;
    gap: 1rem;
    font-size: 0.9rem;
    justify-self: end;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
  }
  
  .connection-status,
  .handshake-status,
  .notification-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
  }
  
  .label {
    opacity: 0.7;
  }
  
  .value {
    font-weight: 500;
  }
  
  .countdown {
    font-family: monospace;
    background: var(--background-color);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  @media (max-width: 980px) {
    .status-info {
      font-size: 0.8rem;
      gap: 0.75rem;
    }
  }

  @media (max-width: 768px) {
    .status-bar {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto;
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
    
    .status-info {
      justify-self: center;
      order: 3;
      margin-top: 0.5rem;
      width: 100%;
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .status-info {
      flex-direction: column;
      gap: 0.5rem;
      align-items: center;
    }
    
    .connection-status,
    .handshake-status,
    .notification-status {
      justify-content: center;
    }
  }
</style> 