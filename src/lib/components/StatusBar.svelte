<script lang="ts">
  export let appTitle: string = 'Friends';
  export let connectionStatus: string = 'Disconnected';
  export let handshakeStatus: string = '';
  export let handshakeCountdown: string = '';
</script>

<div class="status-bar">
  <h1>{appTitle}</h1>
  
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
  </div>
</div>

<style>
  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--foreground-color1);
    border-bottom: 1px solid var(--line-color);
  }
  
  h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }
  
  .status-info {
    display: flex;
    gap: 2rem;
    font-size: 0.9rem;
  }
  
  .connection-status,
  .handshake-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
</style> 