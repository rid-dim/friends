<script context="module" lang="ts">
  export interface Friend {
    peerId?: string;
    scratchpadAddress?: string;
    displayName: string;
    isConnected: boolean;
    unreadCount: number;
    isLoadingScratchpad?: boolean;
    scratchpadError?: boolean;
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { translations } from '../i18n/translations';
  
  export let friends: Friend[] = [];
  export let selectedFriendId: string | null = null;
  export let profileId: string = '';
  export let myUsername: string = 'User';
  export let handshakeCountdowns: Record<string, number> = {};
  export let language: 'en' | 'de' = 'en';
  
  const dispatch = createEventDispatcher();
  
  let showAddFriend = false;
  let newFriendPeerId = '';
  let newFriendName = '';
  
  function handleAddFriend() {
    if (!newFriendName.trim()) {
      dispatch('notification', 'Please enter a friend name');
      return;
    }
    
    dispatch('addFriend', {
      peerId: newFriendPeerId.trim() || undefined,
      displayName: newFriendName.trim()
    });
    
    // Reset form
    newFriendPeerId = '';
    newFriendName = '';
    showAddFriend = false;
  }
  
  function handleRemoveFriend(friend: Friend) {
    const id = friend.peerId || friend.displayName;
    if (confirm(translations[language].removeFriend + '?')) {
      dispatch('removeFriend', id);
    }
  }
  
  function handleSelectFriend(friend: Friend) {
    // Use peerId if available, otherwise use displayName
    const id = friend.peerId || friend.displayName;
    dispatch('selectFriend', id);
  }
  
  function copyMyPeerId() {
    navigator.clipboard.writeText(profileId);
    dispatch('notification', translations[language].peerIdCopied);
  }
  
  $: t = translations[language];
</script>

<div class="friends-list">
  <div class="my-info">
    <div class="my-name">{myUsername}</div>
    <button class="peer-id" on:click={copyMyPeerId} title="Click to copy">
      {profileId.slice(0, 8)}...
    </button>
  </div>
  
  <div class="friends">
    {#each friends as friend (friend.displayName)}
      <div
        class="friend"
        class:selected={selectedFriendId === friend.peerId || selectedFriendId === friend.displayName}
        class:disconnected={!friend.isConnected}
        on:click={() => handleSelectFriend(friend)}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && handleSelectFriend(friend)}
      >
        <div class="friend-info">
          <div class="friend-name">{friend.displayName}</div>
          {#if friend.peerId && handshakeCountdowns[friend.peerId] !== undefined}
            <div class="countdown">{handshakeCountdowns[friend.peerId]}s</div>
          {/if}
        </div>
        
        <div class="friend-status">
          <span class="status-dot" class:connected={friend.isConnected}></span>
          {#if friend.unreadCount > 0}
            <span class="unread-count">{friend.unreadCount}</span>
          {/if}
          <button
            class="remove-friend"
            on:click={(e) => {
              e.stopPropagation();
              handleRemoveFriend(friend);
            }}
            title={t.removeFriend}
          >
            ✕
          </button>
        </div>
      </div>
    {/each}
  </div>
  
  <div class="add-friend-section">
    {#if showAddFriend}
      <div class="add-friend-form">
        <input
          type="text"
          bind:value={newFriendName}
          placeholder={t.enterFriendName}
        />
        <input
          type="text"
          bind:value={newFriendPeerId}
          placeholder={t.enterPeerId + ' (optional)'}
        />
        <div class="form-buttons">
          <button
            class="cancel"
            on:click={() => showAddFriend = false}
          >
            ✕
          </button>
          <button
            class="confirm"
            on:click={handleAddFriend}
            disabled={!newFriendName.trim()}
          >
            ✓
          </button>
        </div>
      </div>
    {:else}
      <button
        class="add-friend-button"
        on:click={() => showAddFriend = true}
      >
        + {t.addFriend}
      </button>
    {/if}
  </div>
</div>

<style>
  .friends-list {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background-color);
    border-right: 1px solid var(--line-color);
  }
  
  .my-info {
    padding: 1rem;
    border-bottom: 1px solid var(--line-color);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .my-name {
    font-weight: 600;
    font-size: 1.1rem;
  }
  
  .peer-id {
    font-family: monospace;
    background: var(--background-color);
    border: 1px solid var(--line-color);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.2s;
    width: fit-content;
  }
  
  .peer-id:hover {
    background: var(--foreground-color1);
  }
  
  .friends {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .friend {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    border-radius: 8px;
    background: var(--background-color);
    border: 1px solid var(--line-color);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }
  
  .friend.selected {
    background: var(--foreground-color1);
    border-color: var(--notification-color);
  }
  
  .friend.disconnected {
    opacity: 0.7;
  }
  
  .friend.disconnected .friend-name {
    color: var(--foreground-color2);
  }
  
  .friend-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .friend-name {
    font-weight: 500;
  }
  
  .countdown {
    font-size: 0.8rem;
    opacity: 0.7;
    font-family: monospace;
  }
  
  .friend-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 2px solid var(--notification-color);
    background: transparent;
  }
  
  .status-dot.connected {
    background: var(--notification-color);
    border: none;
  }
  
  .unread-count {
    background: var(--notification-color);
    color: white;
    font-size: 0.8rem;
    padding: 0.125rem 0.375rem;
    border-radius: 12px;
    min-width: 1.5rem;
    text-align: center;
  }
  
  .remove-friend {
    background: none;
    border: none;
    color: var(--notification-color);
    cursor: pointer;
    padding: 0.25rem;
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  .friend:hover .remove-friend {
    opacity: 1;
  }
  
  .add-friend-section {
    padding: 1rem;
    border-top: 1px solid var(--line-color);
  }
  
  .add-friend-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .add-friend-form input {
    padding: 0.5rem;
    border: 1px solid var(--line-color);
    border-radius: 4px;
    font-size: 0.9rem;
  }
  
  .form-buttons {
    display: flex;
    gap: 0.5rem;
  }
  
  .form-buttons button {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .form-buttons .cancel {
    background: var(--foreground-color2);
    color: var(--text-color);
  }
  
  .form-buttons .confirm {
    background: var(--notification-color);
    color: white;
  }
  
  .form-buttons button:hover:not(:disabled) {
    opacity: 0.8;
  }
  
  .form-buttons button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .add-friend-button {
    width: 100%;
    padding: 0.75rem;
    background: var(--notification-color);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .add-friend-button:hover {
    opacity: 0.8;
  }
</style> 