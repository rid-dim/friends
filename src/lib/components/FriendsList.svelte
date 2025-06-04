<script context="module" lang="ts">
  export interface Friend {
    peerId: string;
    displayName: string;
    isConnected: boolean;
    unreadCount: number;
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let friends: Friend[] = [];
  export let selectedFriendId: string | null = null;
  export let myPeerId: string = '';
  export let myUsername: string = 'User';
  export let handshakeCountdowns: Record<string, number> = {};
  
  const dispatch = createEventDispatcher();
  
  let showAddFriend = false;
  let newFriendPeerId = '';
  let newFriendName = '';
  
  function selectFriend(peerId: string) {
    dispatch('selectFriend', peerId);
  }
  
  function addFriend() {
    if (!newFriendPeerId.trim() || !newFriendName.trim()) {
      return;
    }
    
    // Validate peer ID format (should be a long hex string)
    const peerIdRegex = /^[a-fA-F0-9]{64,}$/;
    if (!peerIdRegex.test(newFriendPeerId.trim())) {
      dispatch('notification', 'Invalid Peer ID format. Please enter a long hexadecimal string (64+ characters)');
      return;
    }
    
    dispatch('addFriend', {
      peerId: newFriendPeerId.trim(),
      displayName: newFriendName.trim()
    });
    
    // Reset form
    newFriendPeerId = '';
    newFriendName = '';
    showAddFriend = false;
  }
  
  function removeFriend(peerId: string) {
    if (confirm('Remove this friend?')) {
      dispatch('removeFriend', peerId);
    }
  }
  
  function copyMyPeerId() {
    navigator.clipboard.writeText(myPeerId);
    dispatch('notification', 'Peer ID copied!');
  }
</script>

<div class="friends-list">
  <div class="header">
    <h2>Friends</h2>
    <button class="add-button" on:click={() => showAddFriend = !showAddFriend}>
      {showAddFriend ? '✕' : '+'}
    </button>
  </div>
  
  {#if myPeerId || myUsername}
    <div class="my-info">
      <div class="my-username">
        <span class="label">Me:</span>
        <span class="username">{myUsername}</span>
      </div>
      {#if myPeerId}
        <div class="my-peer-id">
          <span class="label">ID:</span>
          <button class="peer-id" on:click={copyMyPeerId} title="Click to copy">
            {myPeerId.slice(0, 8)}...
          </button>
        </div>
      {/if}
    </div>
  {/if}
  
  {#if showAddFriend}
    <div class="add-friend-form">
      <div class="input-group">
        <label for="friend-peer-id">Friend's Peer ID (long hex string)</label>
        <input
          id="friend-peer-id"
          bind:value={newFriendPeerId}
          placeholder="e.g. b2bd8aa0d9be1abf2ced18973935e12a1a4a0c97..."
          on:keydown={(e) => e.key === 'Enter' && addFriend()}
          class="peer-id-input"
        />
        <small class="hint">Ask your friend to copy their Peer ID from the "ID:" section above</small>
      </div>
      
      <div class="input-group">
        <label for="friend-name">Display Name</label>
        <input
          id="friend-name"
          bind:value={newFriendName}
          placeholder="e.g. Alice, Bob, etc."
          on:keydown={(e) => e.key === 'Enter' && addFriend()}
        />
      </div>
      
      <button on:click={addFriend} disabled={!newFriendPeerId.trim() || !newFriendName.trim()}>
        Add Friend
      </button>
    </div>
  {/if}
  
  <div class="friends">
    {#if friends.length === 0}
      <div class="empty-state">
        <p>No friends yet</p>
        <p class="hint">Click + to add a friend</p>
      </div>
    {:else}
      {#each friends as friend}
        <div 
          class="friend-item"
          class:selected={selectedFriendId === friend.peerId}
          on:click={() => selectFriend(friend.peerId)}
        >
          <span class="status-dot" class:connected={friend.isConnected}></span>
          <span class="name">{friend.displayName}</span>
          {#if friend.unreadCount > 0}
            <span class="unread-badge">{friend.unreadCount}</span>
          {/if}
          {#if handshakeCountdowns[friend.peerId] !== undefined}
            <span class="countdown">{handshakeCountdowns[friend.peerId]}</span>
          {/if}
          <button 
            class="remove-button"
            on:click|stopPropagation={() => removeFriend(friend.peerId)}
            title="Remove friend"
          >
            ✕
          </button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .friends-list {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--foreground-color1);
    border-right: 1px solid var(--line-color);
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--line-color);
  }
  
  .header h2 {
    margin: 0;
    font-size: 1.2rem;
  }
  
  .add-button {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: var(--notification-color);
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
  }
  
  .add-button:hover {
    transform: scale(1.1);
  }
  
  .my-info {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--line-color);
    background: var(--background-color);
  }
  
  .my-username {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
    margin-bottom: 0.25rem;
  }
  
  .my-username .username {
    font-weight: 600;
  }
  
  .my-peer-id {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  
  .my-info .label {
    opacity: 0.7;
  }
  
  .peer-id {
    font-family: monospace;
    background: var(--background-color);
    border: 1px solid var(--line-color);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    font-size: 0.8rem;
  }
  
  .peer-id:hover {
    background: var(--foreground-color2);
  }
  
  .add-friend-form {
    padding: 1rem;
    border-bottom: 1px solid var(--line-color);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .add-friend-form .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .add-friend-form label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-color);
  }
  
  .add-friend-form input {
    padding: 0.5rem;
    border: 1px solid var(--line-color);
    border-radius: 4px;
    background: var(--background-color);
    color: inherit;
    font-size: 0.9rem;
  }
  
  .peer-id-input {
    font-family: monospace;
    font-size: 0.8rem !important;
  }
  
  .add-friend-form .hint {
    font-size: 0.75rem;
    color: var(--text-color-secondary);
    margin-top: 0.25rem;
  }
  
  .add-friend-form button {
    padding: 0.5rem;
    background: var(--notification-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  
  .add-friend-form button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .friends {
    flex: 1;
    overflow-y: auto;
  }
  
  .empty-state {
    text-align: center;
    padding: 2rem;
    opacity: 0.5;
  }
  
  .empty-state .hint {
    font-size: 0.85rem;
    margin-top: 0.5rem;
  }
  
  .friend-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    position: relative;
    transition: background 0.2s;
  }
  
  .friend-item:hover {
    background: var(--foreground-color2);
  }
  
  .friend-item.selected {
    background: var(--foreground-color2);
    border-left: 3px solid var(--notification-color);
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--notification-color);
    flex-shrink: 0;
  }
  
  .status-dot.connected {
    background: #198754;
  }
  
  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }
  
  .unread-badge {
    background: var(--notification-color);
    color: white;
    font-size: 0.7rem;
    padding: 0.125rem 0.375rem;
    border-radius: 12px;
    min-width: 1.25rem;
    text-align: center;
    flex-shrink: 0;
  }
  
  .countdown {
    font-size: 0.7rem;
    color: var(--text-color);
    background: var(--foreground-color1);
    padding: 0.125rem 0.375rem;
    border-radius: 12px;
    min-width: 1.25rem;
    text-align: center;
    flex-shrink: 0;
    opacity: 0.7;
    font-family: monospace;
  }
  
  .remove-button {
    background: none;
    border: none;
    color: var(--notification-color);
    cursor: pointer;
    font-size: 0.9rem;
    opacity: 0;
    transition: opacity 0.2s;
    padding: 0;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }
  
  .friend-item:hover .remove-button {
    opacity: 1;
  }
</style> 