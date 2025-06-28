<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { translations } from '../i18n/translations';
  import AttachmentView from '../file-handling/AttachmentView.svelte';
  import FileUploader from '../file-handling/FileUploader.svelte';
  import type { FileAttachment } from '../file-handling/types';
  
  export let messages: Array<{
    nick: string;
    text: string;
    timestamp: Date;
    isSelf: boolean;
    attachment?: FileAttachment;
  }> = [];
  
  export let myNick: string = 'User';
  export let isConnected: boolean = false;
  export let friendName: string = '';
  export let friendPeerId: string = '';
  export let friendScratchpadAddress: string = '';
  export let isLoadingScratchpad: boolean = false;
  export let scratchpadError: boolean = false;
  export let language: 'en' | 'de' = 'en';
  
  const dispatch = createEventDispatcher();
  
  let messageInput = '';
  let pendingAttachment: FileAttachment | null = null;
  let messagesContainer: HTMLDivElement;
  let showPeerIdInput = false;
  let newPeerId = '';
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
  
  function sendMessage() {
    if (!isConnected || (!messageInput.trim() && !pendingAttachment)) {
      return;
    }
    
    dispatch('sendMessage', {
      text: messageInput.trim(),
      attachment: pendingAttachment
    });
    
    // Clear input
    messageInput = '';
    pendingAttachment = null;
  }
  
  function scrollToBottom() {
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 10);
    }
  }
  
  function copyPeerId(peerId: string) {
    navigator.clipboard.writeText(peerId);
    dispatch('notification', translations[language].peerIdCopied);
  }
  
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
          type: file.type as any || 'application/octet-stream',
          size: file.size,
          data: dataUrl,
          complete: true
        };
        pendingAttachment = attachment;
        // Keine Benachrichtigung mehr anzeigen
        // dispatch('notification', `Attached: ${file.name}`);
      };
      reader.readAsDataURL(file);
      // Reset the input
      input.value = '';
    }
  }
  
  // Auto-scroll when new messages arrive
  $: if (messages.length) {
    scrollToBottom();
  }
  
  $: t = translations[language];
</script>

<div class="chat">
  <div class="chat-header">
    <div class="friend-info">
      <h2>{friendName || t.selectFriend}</h2>
      {#if friendName}
        {#if isLoadingScratchpad}
          <div class="loading-scratchpad">
            <div class="small-spinner"></div>
            <span>Creating communication channel...</span>
          </div>
        {:else if scratchpadError}
          <div class="scratchpad-error">
            <span>Error creating communication channel</span>
          </div>
        {:else if friendScratchpadAddress}
          <div class="friend-contact-id">
            <span class="label">Contact ID to share with {friendName}:</span>
            <button class="peer-id" on:click={() => copyPeerId(friendScratchpadAddress)} title="Click to copy">
              {friendScratchpadAddress.slice(0, 8)}...
            </button>
          </div>
          {#if friendPeerId}
            <div class="friend-peer-id">
              <span class="label">{friendName}'s Contact ID shared with us:</span>
              <button class="peer-id" on:click={() => copyPeerId(friendPeerId)} title="Click to copy">
                {friendPeerId.slice(0, 8)}...
              </button>
            </div>
          {:else}
            {#if !showPeerIdInput}
              <button class="add-peer-id" on:click={() => showPeerIdInput = true} title="Add friend's contact ID">
                + Add Contact ID
              </button>
            {/if}
            {#if showPeerIdInput}
              <div class="peer-id-input">
                <input
                  type="text"
                  bind:value={newPeerId}
                  placeholder="Enter friend's contact ID"
                />
                <button on:click={() => {
                  if (newPeerId.trim()) {
                    dispatch('updatePeerId', { peerId: newPeerId.trim() });
                    showPeerIdInput = false;
                    newPeerId = '';
                  }
                }}>Save</button>
                <button on:click={() => {
                  showPeerIdInput = false;
                  newPeerId = '';
                }}>Cancel</button>
              </div>
            {/if}
          {/if}
        {/if}
      {/if}
    </div>
    <div class="connection-indicator">
      <span class="status-dot" class:connected={isConnected}></span>
      <span>{isConnected ? t.connected : t.notConnected}</span>
    </div>
  </div>
  
  <div class="messages" bind:this={messagesContainer}>
    {#if messages.length === 0}
      <div class="empty-chat">
        <p>{t.noMessages}</p>
      </div>
    {:else}
      {#each messages as message}
        <div class="message" class:self={message.isSelf}>
          <div class="message-header">
            <span class="nick">{message.nick}</span>
            <span class="time">{message.timestamp.toLocaleTimeString()}</span>
          </div>
          <div class="message-body">
            {#if message.text}
              <div class="message-text">{message.text}</div>
            {/if}
            
            {#if message.attachment}
              <div class="attachment-container">
                <AttachmentView attachment={message.attachment} />
              </div>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
  
  <div class="input-area">
    <div class="input-row">
      <textarea
        bind:value={messageInput}
        on:keydown={handleKeydown}
        placeholder={isConnected ? t.typeMessage : t.connectFirst}
        rows="2"
      ></textarea>
      
      <div class="input-controls">
        <FileUploader 
          on:fileSelected={({detail}) => {
            pendingAttachment = detail.attachment;
          }}
          on:error={({detail}) => {
            dispatch('notification', detail);
          }}
        />
        
        {#if pendingAttachment}
          <div class="pending-attachment">
            <span class="attachment-name">{pendingAttachment.name}</span>
            <button class="remove-attachment" on:click={() => pendingAttachment = null}>✕</button>
          </div>
        {/if}
        
        <button
          on:click={sendMessage}
          disabled={!isConnected || (!messageInput.trim() && !pendingAttachment)}
          class="send-button"
          class:active={isConnected && (messageInput.trim() || pendingAttachment)}
          title={!isConnected ? t.waitForFriendOnline : ''}
        >
          {t.send}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .chat {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  
  .chat-header {
    padding: 1rem;
    border-bottom: 1px solid var(--line-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .friend-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .chat-header h2 {
    margin: 0;
    font-size: 1.2rem;
  }
  
  .friend-peer-id {
    font-size: 0.8rem;
    color: var(--foreground-color2);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  .friend-peer-id .label {
    color: var(--text-color);
    opacity: 1;
  }
  
  .friend-peer-id .peer-id {
    font-family: monospace;
    background: var(--background-color);
    border: 1px solid var(--line-color);
    border-radius: 4px;
    padding: 0.125rem 0.375rem;
    cursor: pointer;
    font-size: 0.75rem;
    transition: background 0.2s;
  }
  
  .friend-peer-id .peer-id:hover {
    background: var(--foreground-color1);
  }
  
  .connection-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--notification-color);
  }
  
  .status-dot.connected {
    background: #198754;
  }
  
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .empty-chat {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--foreground-color2);
  }
  
  .message {
    background: var(--foreground-color1);
    padding: 1rem;
    border-radius: 12px;
    max-width: 80%;
    align-self: flex-start;
  }
  
  .message.self {
    align-self: flex-end;
    background: var(--foreground-color2);
  }
  
  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    gap: 1rem;
  }
  
  .nick {
    font-weight: 600;
  }
  
  .time {
    opacity: 0.7;
    white-space: nowrap;
  }
  
  .message-text {
    line-height: 1.4;
    white-space: pre-wrap;
  }
  
  .attachment-container {
    margin-top: 0.75rem;
    border-top: 1px solid var(--line-color);
    padding-top: 0.75rem;
  }
  
  .input-area {
    padding: 1rem;
    border-top: 1px solid var(--line-color);
  }
  
  .input-row {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
  }
  
  .input-row textarea {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--line-color);
    border-radius: 8px;
    resize: none;
    font-family: inherit;
    font-size: 0.9rem;
    background: var(--background-color);
    color: inherit;
  }
  
  .input-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-end;
  }
  
  .pending-attachment {
    display: flex;
    align-items: center;
    background: var(--foreground-color1);
    border: 1px solid var(--line-color);
    border-radius: 6px;
    padding: 0.5rem;
    font-size: 0.85rem;
    max-width: 200px;
  }
  
  .attachment-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 0.5rem;
  }
  
  .remove-attachment {
    background: none;
    border: none;
    color: var(--notification-color);
    cursor: pointer;
    font-size: 1rem;
    padding: 0;
    width: 20px;
    height: 20px;
  }
  
  .send-button {
    padding: 0.75rem 1.5rem;
    background: var(--foreground-color2);
    color: var(--background-color);
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .send-button.active {
    background: var(--notification-color);
  }
  
  .send-button:hover:not(:disabled) {
    opacity: 0.8;
  }
  
  .send-button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  
  .friend-contact-id {
    font-size: 0.8rem;
    color: var(--foreground-color2);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  .friend-contact-id .label {
    color: var(--text-color);
    opacity: 1;
  }
  
  .friend-contact-id .peer-id {
    font-family: monospace;
    background: var(--background-color);
    border: 1px solid var(--line-color);
    border-radius: 4px;
    padding: 0.125rem 0.375rem;
    cursor: pointer;
    font-size: 0.75rem;
    transition: background 0.2s;
  }
  
  .friend-contact-id .peer-id:hover {
    background: var(--foreground-color1);
  }
  
  .add-peer-id {
    background: var(--notification-color);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .add-peer-id:hover {
    opacity: 0.8;
  }
  
  .peer-id-input {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    width: 100%;
  }
  
  .peer-id-input input {
    flex: 1;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--line-color);
    border-radius: 4px;
    background: var(--background-color);
    color: inherit;
    font-size: 0.8rem;
  }
  
  .peer-id-input button {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .peer-id-input button:first-of-type {
    background: var(--notification-color);
    color: white;
  }
  
  .peer-id-input button:last-of-type {
    background: var(--foreground-color2);
    color: var(--text-color);
  }
  
  .peer-id-input button:hover {
    opacity: 0.8;
  }
  
  .loading-scratchpad {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--foreground-color2);
  }
  
  .small-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--foreground-color1);
    border-top-color: var(--notification-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .scratchpad-error {
    font-size: 0.8rem;
    color: var(--notification-color);
  }
</style> 