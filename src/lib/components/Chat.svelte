<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { translations } from '../../i18n/translations';
  import AttachmentRemoteView from '../file-handling/AttachmentRemoteView.svelte';
  import FileUploader from '../file-handling/FileUploader.svelte';
  import type { Friend } from '../types';
  import { onMount } from 'svelte';
  import { tick } from 'svelte';
  import AvatarModal from './AvatarModal.svelte';

  export let friend: Friend | undefined = undefined;
  export let messages: Array<{
    nick: string;
    text: string;
    timestamp: Date;
    isSelf: boolean;
  }> = [];
  
  export let myNick: string = 'User';
  export let isConnected: boolean = false;
  export let friendName: string = '';
  export let friendPeerId: string = '';
  export let friendScratchpadAddress: string = '';
  export let isLoadingScratchpad: boolean = false;
  export let scratchpadError: boolean = false;
  export let language: 'en' | 'de' = 'en';
  export let debug: boolean = false;
  export let backendUrl: string = '';
  export let requestSent: boolean = false; // True if we sent a friend request but haven't received approval yet
  
  const dispatch = createEventDispatcher();
  
  let messageInput = '';
  // Remote-Referenz-Parsing
  type RemoteMeta = { caption: string; dataMapHex: string; mimeType: string };
  function parseRemoteAttachment(text: string | undefined | null): RemoteMeta | null {
    if (!text) return null;
    const re = /\[(.*?)\]\(([0-9a-fA-F]+)\+([a-zA-Z0-9!#$&^_+\.-]+\/[a-zA-Z0-9!#$&^_+\.-]+)\)/;
    const m = text.match(re);
    if (!m) return null;
    return { caption: m[1] || '', dataMapHex: m[2], mimeType: m[3] };
  }
  // Cache nach stabiler Message-Identität, um Index-Kollisionen zu vermeiden
  const parsedCache = new Map<string, RemoteMeta | null>();
  function getParsedFor(message: { nick: string; text: string; timestamp: Date }, fallbackKey: number): RemoteMeta | null {
    const key = `${message.nick}|${message.timestamp?.toISOString?.() || ''}|${message.text ?? ''}|${fallbackKey}`;
    if (!parsedCache.has(key)) {
      parsedCache.set(key, parseRemoteAttachment(message.text));
    }
    return parsedCache.get(key) ?? null;
  }

  // Pending Upload (vom Uploader)
  type PendingUpload = { dataMapHex: string; mimeType: string; fileName: string; size: number } | null;
  let pendingUpload: PendingUpload = null;
  let messagesContainer: HTMLDivElement;
  let showPeerIdInput = false;
  let newPeerId = '';
  let isEditingName = false;
  let editedName = '';
  let avatarUrl: string | null = null;
  let showAvatarModal = false;

  import { buildDataUrl } from '../utils/imageUrl';
  $: {
    avatarUrl = friend?.profileImage ? buildDataUrl(friend.profileImage, backendUrl) : null;
    console.log('Constructed avatar URL:', avatarUrl);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
  
  function sendMessage() {
    if (!isConnected || (!messageInput.trim() && !pendingUpload)) {
      return;
    }
    
    let textToSend = messageInput.trim();
    if (pendingUpload) {
      // Verpacke die Nachricht in unsere Referenzsyntax
      const caption = textToSend; // ganze Nachricht als caption
      textToSend = `[${caption}](${pendingUpload.dataMapHex}+${pendingUpload.mimeType})`;
    }
    
    dispatch('sendMessage', { text: textToSend });
    
    // Clear input
    messageInput = '';
    pendingUpload = null;
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
  
  // Kein globales Re-Parsing nötig – wird pro Nachricht on-demand gecached
  
  // Auto-scroll when new messages arrive
  $: if (messages.length) {
    scrollToBottom();
  }
  
  $: t = translations[language] as Record<string, string>;
  $: welcomeTitle = language === 'de' ? 'Willkommen!' : 'Welcome!';
  $: welcomeTip = language === 'de' ? '⬅️  Füge links über "+ Freund" neue Kontakte hinzu' : '⬅️  Use "+ Add Friend" on the left to add contacts';

  function editDisplayName() {
    dispatch('editDisplayName');
  }

  function startEdit() {
    if (!friendName) return;
    editedName = friendName;
    isEditingName = true;
    tick().then(() => {
      const input = document.getElementById('editNameInput') as HTMLInputElement;
      input?.focus();
    });
  }

  function saveName() {
    const newName = editedName.trim();
    if (newName && newName !== friendName) {
      dispatch('renameFriend', { newName });
    }
    isEditingName = false;
  }

  function handleNameInputKey(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveName();
    } else if (event.key === 'Escape') {
      isEditingName = false;
    }
  }

  function openAvatarModal() {
    if (avatarUrl) showAvatarModal = true;
  }
  function closeAvatarModal() {
    showAvatarModal = false;
  }
</script>

<div class="chat">
  {#if friendName}
    <div class="chat-header">
      {#if friend?.profileImage}
        <img class="friend-avatar" src={avatarUrl} alt={friend?.displayName ?? ''} on:click={openAvatarModal} style="cursor: pointer;" />
      {:else}
        <div class="friend-avatar placeholder">
          {friendName.charAt(0).toUpperCase()}
        </div>
      {/if}
      <div class="header-main">
        <div class="name-row">
          {#if isEditingName}
            <input id="editNameInput" bind:value={editedName} class="name-input" on:keydown={handleNameInputKey} />
            <button class="save-btn" title="Save" on:click={saveName}>✓</button>
          {:else}
            <h2>{friend?.displayName || friendName}</h2>
            <button class="edit-btn" on:click={startEdit} title="Edit">✏️</button>
          {/if}
        </div>
        {#if debug}
        <div class="contact-info">
          {#if friendScratchpadAddress}
            <div class="friend-contact-id">
              <span class="label">Contact ID shared with {friendName}:</span>
              <button class="peer-id" on:click={() => copyPeerId(friendScratchpadAddress)}>{friendScratchpadAddress.slice(0, 8)}...</button>
            </div>
          {/if}
          {#if friendPeerId}
            <div class="friend-peer-id">
              <span class="label">{friendName}'s Contact ID shared with us:</span>
              <button class="peer-id" on:click={() => copyPeerId(friendPeerId)}>{friendPeerId.slice(0, 8)}...</button>
            </div>
          {/if}
        </div>
        {/if}
      </div>
    </div>
    <AvatarModal 
      imageUrl={avatarUrl || ''}
      altText={friend?.displayName ?? 'Avatar'}
      isOpen={showAvatarModal}
      on:close={closeAvatarModal}
    />
  {:else}
    <div class="welcome-screen">
      <h2>{welcomeTitle}</h2>
      <p>{welcomeTip}</p>
    </div>
  {/if}
  
  {#if friendName}
  <div class="messages" bind:this={messagesContainer}>
    {#if requestSent}
      <div class="request-status">
        <div class="status-icon">📤</div>
        <div class="status-text">
          <h3>{t.friendRequestSent || 'Friend request sent'}</h3>
          <p>{t.waitingForResponse || 'Waiting for response...'}</p>
        </div>
      </div>
    {:else if messages.length === 0}
      <div class="empty-chat">
        <p>{t.noMessages}</p>
      </div>
    {:else}
      {#each messages as message, i}
        <div class="message" class:self={message.isSelf}>
          <div class="message-header">
            <span class="nick">{message.nick}</span>
            <span class="time">{message.timestamp.toLocaleTimeString()}</span>
          </div>
          <div class="message-body">
            {#if getParsedFor(message, i)}
              <AttachmentRemoteView 
                dataMapHex={getParsedFor(message, i)!.dataMapHex}
                mimeType={getParsedFor(message, i)!.mimeType}
                caption={getParsedFor(message, i)!.caption}
                backendUrl={backendUrl}
                senderName={message.nick}
                receivedAt={message.timestamp}
              />
            {:else if message.text}
              <div class="message-text">{message.text}</div>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
  {/if}
  
  {#if friendName}
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
          {backendUrl}
          on:uploadReady={({detail}) => {
            pendingUpload = {
              dataMapHex: detail.dataMapHex,
              mimeType: detail.mimeType,
              fileName: detail.fileName,
              size: detail.size
            };
          }}
          on:error={({detail}) => {
            dispatch('notification', detail);
          }}
        />
        {#if pendingUpload}
          <div class="pending-attachment">
            <span class="attachment-name">{pendingUpload.fileName}</span>
            <button class="remove-attachment" on:click={() => pendingUpload = null}>✕</button>
          </div>
        {/if}

        <button
          on:click={sendMessage}
          disabled={!isConnected || (!messageInput.trim() && !pendingUpload)}
          class="send-button"
          class:active={isConnected && (messageInput.trim() || pendingUpload)}
          title={!isConnected ? t.waitForFriendOnline : ''}
        >
          {t.send}
        </button>
      </div>
    </div>
  </div>
  {/if}
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
  
  .request-status {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--text-color);
    gap: 1rem;
    background: var(--foreground-color1);
    border-radius: 12px;
    padding: 2rem;
    margin: 1rem;
    border: 1px solid var(--line-color);
  }
  
  .status-icon {
    font-size: 2.5rem;
    opacity: 1;
  }
  
  .status-text h3 {
    margin: 0 0 0.5rem 0;
    color: var(--notification-color);
    font-size: 1.2rem;
    font-weight: 600;
  }
  
  .status-text p {
    margin: 0;
    color: var(--text-color);
    opacity: 1;
    font-size: 1rem;
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

  .welcome-screen {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    color: var(--foreground-color2);
    text-align: center;
    gap: 1rem;
  }

  .friend-avatar {
    width: 72px;
    height: 72px;
    border-radius: 12px;
    object-fit: cover;
    margin-right: 1rem;
    transition: box-shadow 0.2s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .friend-avatar:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  }
  .friend-avatar.placeholder {
    background: var(--foreground-color2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: var(--text-color);
    border-radius: 12px;
  }
  .header-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .edit-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-color);
    font-size: 1rem;
    padding: 0;
  }
  .edit-btn:hover {
    opacity: 0.8;
  }
  .contact-info {
    font-size: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .name-input {
    font-size: 1.1rem;
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--line-color);
    border-radius: 4px;
    background: var(--background-color);
    color: inherit;
  }
  .save-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-color);
    font-size: 1.2rem;
  }
  .save-btn:hover { opacity:0.8; }
</style> 