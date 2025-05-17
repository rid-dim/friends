<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { t, language } from './i18n/i18n';
  import LanguageSelector from './i18n/LanguageSelector.svelte';
  
  // Import file handling components and utilities
  import FileUploader from './lib/file-handling/FileUploader.svelte';
  import AttachmentView from './lib/file-handling/AttachmentView.svelte';
  import type { FileAttachment, AttachmentChunk, AttachmentMessage } from './lib/file-handling/types';
  import { reassembleChunks } from './lib/file-handling/fileProcessor';
  
  // Define a safe constant for WebSocket.OPEN that works during SSR
  const WEBSOCKET_OPEN = browser ? WebSocket.OPEN : undefined;
  
  let ws: WebSocket | null = null;
  // Extended message type to include attachments
  let messages: Array<{
    nick: string, 
    text: string, 
    timestamp: Date, 
    isSelf: boolean,
    attachment?: FileAttachment,
    pendingChunks?: boolean,
    receivedChunks?: AttachmentChunk[]
  }> = [];
  
  // File attachment related variables
  let pendingAttachment: FileAttachment | null = null;
  let pendingChunks: AttachmentChunk[] | null = null;
  let incomingAttachments: Record<string, { 
    attachment: FileAttachment, 
    chunks: AttachmentChunk[],
    messageIndex: number 
  }> = {};
  
  let config = {
    proxy: '127.0.0.1:17017',
    target: '0.0.0.0:17171',
    encryptionKey: '1234567890',
    nick: 'rid'
  };
  let messageInput = '';
  let connectionStatus = $t('wsDisconnected');
  let peerConnectionStatus = $t('peerNoConnection');
  let reconnectAttempts = 0;
  let maxReconnectAttempts = 5;
  let reconnectInterval: ReturnType<typeof setTimeout> | null = null;
  let udpConnectionInfo = '';
  let notification = '';
  
  let configWidth = 220;
  let isDragging = false;
  
  // Referenz auf den Nachrichten-Container für Auto-Scroll
  let messagesContainer: HTMLDivElement;
  
  let showConfig = true;
  
  let isDarkMode = false;
  
  // Check localStorage for dark mode preference
  if (browser) {
    const storedTheme = localStorage.getItem('theme');
    isDarkMode = storedTheme === 'dark';
  }
  
  function toggleTheme(newValue?: boolean) {
    if (newValue !== undefined) {
      isDarkMode = newValue === true;
    } else {
      isDarkMode = !isDarkMode;
    }
    
    if (browser) {
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
      console.log('Theme changed to:', isDarkMode ? 'dark' : 'light');
    }
  }
  
  // Automatisch zum Ende des Chats scrollen
  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
  
  // Funktion zum Abrufen der WebSocket-Info
  async function fetchWebSocketInfo() {
    if (!browser) return;
    
    try {
      const response = await fetch(`http://${config.proxy.split(':')[0]}:${config.proxy.split(':')[1]}/v0/ws/info`);
      if (response.ok) {
        const data = await response.json();
        udpConnectionInfo = data.udp_connection_info.replace('udp://', '');
        console.log('UDP-Verbindungsinfo abgerufen:', udpConnectionInfo);
      } else {
        console.error('Fehler beim Abrufen der WebSocket-Info:', response.statusText);
      }
    } catch (error) {
      console.error('Fehler beim Abrufen der WebSocket-Info:', error);
    }
  }
  
  function connect() {
    if (!browser) {
      console.log('WebSocket connection skipped during SSR.');
      return;
    }
    
    if (!config.proxy || !config.target || !config.encryptionKey || !config.nick) {
      alert($t('fillAllFields'));
      return;
    }
    
    reconnectAttempts = 0;
    
    if (reconnectInterval) {
      clearTimeout(reconnectInterval);
      reconnectInterval = null;
    }
        
    const wsUrl = `ws://${config.proxy.split(':')[0]}:${config.proxy.split(':')[1]}/v0/ws/proxy?remote_host=${encodeURIComponent(config.target.split(':')[0])}&remote_port=${encodeURIComponent(config.target.split(':')[1])}&encryption_key=${encodeURIComponent(config.encryptionKey)}`;
    console.log(`Verbinde mit ${wsUrl}`);
    
    if (ws) {
      ws.close();
    }
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      connectionStatus = $t('wsConnected');
      console.log("WebSocket-Verbindung hergestellt, readyState:", ws ? ws.readyState : "kein ws");
    };
    
    ws.onclose = (event) => {
      connectionStatus = $t('wsDisconnected');
      console.log(`WebSocket geschlossen: Code ${event.code}, Grund: ${event.reason}`);
      
      if (event.code !== 1000) {
        attemptReconnect();
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const messageType = data.type;
        
        if (messageType === 'status') {
          const status = data.status;
          const statusMessage = data.message || '';
          
          peerConnectionStatus = translateStatus(status, statusMessage);
          console.log(`Verbindungsstatus: ${status} - ${statusMessage}`);
        } 
        else if (messageType === 'data') {
          const messageText = data.data || '';
          console.log("Empfangene Rohdaten:", messageText);
          
          const colonIndex = messageText.indexOf(':');
          
          if (colonIndex > 0) {
            const nick = messageText.substring(0, colonIndex);
            const content = messageText.substring(colonIndex + 1);
            
            console.log(`Empfangene Nachricht von ${nick}, vollständiger Inhalt:`, content);
            
            const structuredMessage = parseStructuredMessage(content);
            console.log("Parsing-Ergebnis:", structuredMessage);
            
            if (structuredMessage && structuredMessage.isAttachmentChunk && structuredMessage.attachmentChunk) {
              handleAttachmentChunk(nick, structuredMessage.attachmentChunk);
              return;
            }
            
            let initialDisplayText = content;
            
            if (structuredMessage && structuredMessage.original) {
              initialDisplayText = structuredMessage.original;
            }
            
            const messageIndex = messages.length;
            const attachment = structuredMessage?.attachment;
            
            let displayText = "";
            if (structuredMessage && structuredMessage.original && structuredMessage.original.trim()) {
              displayText = structuredMessage.original;
            } else if (!attachment) {
              displayText = initialDisplayText;
            }
            
            if (attachment && !displayText.trim()) {
              displayText = "";
            }
            
            messages = [...messages, {
              nick,
              text: displayText,
              timestamp: new Date(),
              isSelf: false,
              attachment: attachment,
              pendingChunks: attachment?.chunks && attachment.chunks > 1 ? true : false
            }];
            setTimeout(scrollToBottom, 10);
            
            if (structuredMessage && structuredMessage.original) {
              handleStructuredMessage(nick, structuredMessage, messageIndex);
            } else if (!structuredMessage?.attachment) {
              console.log("Normale Textnachricht erkannt");
              updateMessage(messageIndex, {
                text: content
              });
              setTimeout(scrollToBottom, 10);
            }
          } else {
            messages = [...messages, {
              nick: 'Unbekannt',
              text: messageText,
              timestamp: new Date(),
              isSelf: false
            }];
            
            setTimeout(scrollToBottom, 10);
          }
        }
        else if (messageType === 'error') {
          const errorMessage = data.message || 'Unbekannter Fehler';
          console.error(`WebSocket Fehler: ${errorMessage}`);
          alert(`Fehler: ${errorMessage}`);
        }
      } catch (e) {
        console.error('Fehler beim Verarbeiten der Nachricht:', e);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket Fehler:', error);
      connectionStatus = 'Fehler';
    };
  }
  
  $: if ($t) {
    if (connectionStatus === 'Verbunden' || connectionStatus === $t('wsConnected')) {
      connectionStatus = $t('wsConnected');
    } else if (connectionStatus === 'Getrennt' || connectionStatus === $t('wsDisconnected')) {
      connectionStatus = $t('wsDisconnected');
    } else if (connectionStatus === 'Fehler' || connectionStatus === $t('wsError')) {
      connectionStatus = $t('wsError');
    }
    
    if (peerConnectionStatus === $t('peerNoConnection') || peerConnectionStatus === 'Getrennt') {
      peerConnectionStatus = $t('peerNoConnection');
    } else if (peerConnectionStatus.includes('Warten auf WebSocket') || peerConnectionStatus.includes('Waiting for WebSocket')) {
      peerConnectionStatus = $t('peerWaitingWs');
    } else if (peerConnectionStatus.includes('Warten auf UDP') || peerConnectionStatus.includes('Waiting for UDP')) {
      peerConnectionStatus = $t('peerWaitingUdp');
    } else if (peerConnectionStatus === 'Verbunden' || peerConnectionStatus === $t('peerConnectionActive')) {
      peerConnectionStatus = $t('peerConnectionActive');
    } else if (peerConnectionStatus.includes('Fehler:') || peerConnectionStatus.includes('Error:')) {
      const errorMsg = peerConnectionStatus.split(':')[1].trim();
      peerConnectionStatus = $t('peerConnectionError') + errorMsg;
    } else if (peerConnectionStatus.includes('Unbekannter Status:') || peerConnectionStatus.includes('Unknown status:')) {
      const status = peerConnectionStatus.split(':')[1].trim();
      peerConnectionStatus = $t('peerStatusUnknown') + status;
    }
  }
  
  function translateStatus(status: string, message: string): string {
    switch (status) {
      case 'CONNECTED':
        return $t('peerWaitingWs');
      case 'UDP_WAITING':
        return $t('peerWaitingUdp');
      case 'UDP_ESTABLISHED':
        return $t('peerConnectionActive');
      case 'ERROR':
        return $t('peerConnectionError') + message;
      default:
        return $t('peerStatusUnknown') + status;
    }
  }
  
  function attemptReconnect() {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.log(`Maximale Anzahl an Wiederverbindungsversuchen (${maxReconnectAttempts}) erreicht.`);
      return;
    }
    
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
    
    console.log(`Versuche Wiederverbindung in ${delay}ms (Versuch ${reconnectAttempts}/${maxReconnectAttempts})...`);
    
    reconnectInterval = setTimeout(() => {
      if (browser) {
        console.log("Versuche Wiederverbindung...");
        connect();
      }
    }, delay);
  }
  
  function sendMessage() {
    if (!browser || (!messageInput.trim() && !pendingAttachment) || !ws || connectionStatus !== $t('wsConnected')) return;
    
    const originalMessage = sanitizeForJson(messageInput.trim());
    const attachment = pendingAttachment;
    const chunks = pendingChunks;
    
    const messageIndex = messages.length;
    
    messages = [...messages, {
      nick: config.nick,
      text: originalMessage,
      timestamp: new Date(),
      isSelf: true,
      attachment: attachment || undefined
    }];
    
    messageInput = '';
    pendingAttachment = null;
    pendingChunks = null;
    
    setTimeout(scrollToBottom, 10);
    
    if (attachment && chunks && chunks.length > 1) {
      const structuredContent = createStructuredMessage(
        originalMessage, 
        undefined,
        undefined, 
        {
          ...attachment,
          data: undefined
        }
      );
      
      sendFormattedMessage(structuredContent);
      
      chunks.forEach((chunk, i) => {
        setTimeout(() => {
          const chunkMessage = createStructuredMessage("", undefined, undefined, undefined, chunk);
          sendFormattedMessage(chunkMessage);
          console.log(`Chunk ${i+1}/${chunks.length} gesendet für Anhang ${attachment.id}`);
        }, i * 100);
      });
      
      return;
    }
    
    const structuredContent = createStructuredMessage(originalMessage, undefined, undefined, attachment);
    sendFormattedMessage(structuredContent);
  }
  
  function sendFormattedMessage(messageText: string) {
    const userMessage = `${config.nick}:${messageText}`;
    
    const jsonPayload = JSON.stringify({
      type: "data",
      data: userMessage
    });
    
    console.log("Sende Payload:", jsonPayload);
    
    try {
      if (ws) {
        ws.send(jsonPayload);
        console.log("Nachricht erfolgreich gesendet");
      }
    } catch (error) {
      console.error("Fehler beim Senden der Nachricht:", error);
      showNotification($t('messageError'));
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
  
  function disconnect() {
    if (ws) {
      ws.close(1000, "Deliberate disconnection");
      ws = null;
    }
    
    if (reconnectInterval) {
      clearTimeout(reconnectInterval);
      reconnectInterval = null;
    }
    
    connectionStatus = $t('wsDisconnected');
    peerConnectionStatus = $t('peerNoConnection');
  }
  
  function isWsOpen(websocket: WebSocket | null): boolean {
    if (!browser || !websocket) return false;
    const isOpen = websocket.readyState === WebSocket.OPEN;
    console.log("isWsOpen prüft:", isOpen, "readyState:", websocket.readyState, "WebSocket.OPEN:", WebSocket.OPEN);
    return isOpen;
  }
  
  function showNotification(message: string) {
    notification = message;
    setTimeout(() => {
      notification = '';
    }, 1500);
  }
  
  function copyUdpInfo() {
    if (udpConnectionInfo) {
      navigator.clipboard.writeText(udpConnectionInfo).then(() => {
        showNotification($t('infoCopied'));
      }).catch(err => {
        console.error('Fehler beim Kopieren:', err);
      });
    }
  }
  
  function startResize(event: MouseEvent) {
    isDragging = true;
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
    event.preventDefault();
  }
  
  function resize(event: MouseEvent) {
    if (isDragging) {
      const newWidth = Math.max(150, Math.min(400, event.clientX));
      configWidth = newWidth;
    }
  }
  
  function stopResize() {
    isDragging = false;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
  }
  
  function toggleConfig() {
    showConfig = !showConfig;
  }
  
  $: if (browser && config.proxy && config.proxy.split(':').length > 1) {
    fetchWebSocketInfo();
  }
  
  $: if (messages.length) {
    setTimeout(scrollToBottom, 10);
  }
  
  interface StructuredMessage {
    version: number;
    original: string;
    attachment?: FileAttachment;
    isAttachmentChunk?: boolean;
    attachmentChunk?: AttachmentChunk;
  }
  
  function createStructuredMessage(original: string, translation?: string, targetLang?: string, attachment?: FileAttachment | null, chunk?: AttachmentChunk): string {
    const safeOriginal = sanitizeForJson(original);
    
    const structured: StructuredMessage = {
      version: 1,
      original: safeOriginal
    };
    
    if (attachment) {
      structured.attachment = attachment;
    }
    
    if (chunk) {
      structured.isAttachmentChunk = true;
      structured.attachmentChunk = chunk;
    }
    
    const result = JSON.stringify(structured);
    console.log("Erstellte strukturierte Nachricht:", result);
    return result;
  }
  
  function parseStructuredMessage(content: string): StructuredMessage | null {
    if (!content || content.trim() === '') {
      console.log("Leerer Content, nichts zu parsen");
      return null;
    }
    
    try {
      console.log("Vollständiger zu parsender Inhalt:", content);
      
      let contentToParse = content.trim();
      
      if (contentToParse.startsWith('"') && contentToParse.endsWith('"')) {
        contentToParse = contentToParse.slice(1, -1);
        console.log("Quotes entfernt:", contentToParse);
      }
      
      if (contentToParse.includes('\\"')) {
        contentToParse = contentToParse.replace(/\\"/g, '"');
        console.log("Unescaped Content:", contentToParse);
      }
      
      if (!contentToParse.startsWith('{') || !contentToParse.endsWith('}')) {
        console.log("Kein JSON-Objekt Format:", contentToParse);
        return null;
      }
      
      try {
        console.log("Versuche direktes Parsen von:", contentToParse);
        const parsed = JSON.parse(contentToParse);
        console.log("Erfolgreich geparst als:", parsed);
        
        if (parsed && typeof parsed === 'object' && 'version' in parsed && 'original' in parsed) {
          console.log("Gültige strukturierte Nachricht erkannt mit Originaltext:", parsed.original);
          return parsed as StructuredMessage;
        }
        
        console.log("Keine gültige strukturierte Nachricht (fehlende Felder)");
        return null;
      } catch (directParseError) {
        console.error("Direktes Parsen fehlgeschlagen:", directParseError);
        
        try {
          const startIndex = contentToParse.indexOf('{');
          const endIndex = contentToParse.lastIndexOf('}');
          
          if (startIndex >= 0 && endIndex > startIndex) {
            const cleanedJson = contentToParse.substring(startIndex, endIndex + 1);
            console.log("Bereinigter JSON-String:", cleanedJson);
            
            const parsed = JSON.parse(cleanedJson);
            console.log("Geparst nach Bereinigung:", parsed);
            
            if (parsed && typeof parsed === 'object' && 'version' in parsed && 'original' in parsed) {
              console.log("Gültige strukturierte Nachricht nach Bereinigung:", parsed);
              return parsed as StructuredMessage;
            }
          }
        } catch (cleanupError) {
          console.error("Auch bereinigtes Parsen fehlgeschlagen:", cleanupError);
        }
        
        return null;
      }
    } catch (e) {
      console.error("Fehler beim Parsen der strukturierten Nachricht:", e);
      console.log("Content, der den Fehler verursachte:", content);
      return null;
    }
  }
  
  function updateMessage(index: number, updatedMessage: Partial<typeof messages[0]>) {
    messages = messages.map((msg, i) => {
      if (i === index) {
        return { ...msg, ...updatedMessage };
      }
      return msg;
    });
  }
  
  function sanitizeForJson(text: string): string {
    return text.replace(/"/g, "'");
  }
  
  function handleStructuredMessage(nick: string, structuredMessage: StructuredMessage, messageIndex: number) {
    console.log("Strukturierte Nachricht erkannt:", structuredMessage);
    
    const originalText = structuredMessage.original;
    
    updateMessage(messageIndex, {
      text: originalText
    });
    
    setTimeout(scrollToBottom, 10);
  }
  
  function handleAttachmentChunk(nick: string, chunk: AttachmentChunk) {
    const { attachmentId, chunkIndex, totalChunks, data } = chunk;
    
    if (!incomingAttachments[attachmentId]) {
      console.warn(`Chunk empfangen für unbekannten Anhang ${attachmentId}`);
      return;
    }
    
    incomingAttachments[attachmentId].chunks.push(chunk);
    
    console.log(`Chunk ${chunkIndex + 1}/${totalChunks} empfangen für Anhang ${attachmentId}`);
    
    if (incomingAttachments[attachmentId].chunks.length === totalChunks) {
      const { attachment, chunks, messageIndex } = incomingAttachments[attachmentId];
      
      const completeAttachment = reassembleChunks(attachment, chunks);
      
      updateMessage(messageIndex, {
        attachment: completeAttachment,
        pendingChunks: false
      });
      
      console.log(`Anhang ${attachmentId} vollständig empfangen`);
      
      delete incomingAttachments[attachmentId];
      
      setTimeout(scrollToBottom, 10);
    }
  }
  
  onMount(() => {
    fetchWebSocketInfo();
    
    return () => {
      disconnect();
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResize);
    };
  });
</script>

<main class={isDarkMode ? 'dark' : 'light'}>
  <div class="container">
    <div class="burger-menu" on:click={toggleConfig}>
      ☰
    </div>

    {#if showConfig}
      <div class="config" style="width: {configWidth}px;">
        <h2>{$t('settings')}</h2>
        <LanguageSelector />
        <div class="input-group">
          <label for="proxy">{$t('proxy')}</label>
          <input id="proxy" bind:value={config.proxy} placeholder="127.0.0.1:17017">
        </div>
        <div class="input-group">
          <label for="target">{$t('partner')}</label>
          <input id="target" bind:value={config.target} placeholder="0.0.0.0:17171">
        </div>
        <div class="input-group">
          <label for="encryptionKey">{$t('encryptionKey')}</label>
          <input id="encryptionKey" bind:value={config.encryptionKey} placeholder="1234567890" type="password">
        </div>
        <div class="input-group">
          <label for="nick">{$t('nickname')}</label>
          <input id="nick" bind:value={config.nick} placeholder="rid">
        </div>
        <div class="input-group">
          <label for="theme">{$t('theme')}</label>
          <select id="theme" on:change={(e: Event) => {
            const target = e.target as HTMLSelectElement;
            toggleTheme(target.value === 'true');
          }}>
            <option value="false" selected={!isDarkMode}>{$t('lightMode')}</option>
            <option value="true" selected={isDarkMode}>{$t('darkMode')}</option>
          </select>
        </div>
        <div class="button-group">
          <button
            on:click={connect}
            disabled={!browser || isWsOpen(ws)}
            class="connect-button"
          >
            {!browser ? $t('loading') : (isWsOpen(ws) ? $t('connected') : $t('connect'))}
          </button>
          <button
            on:click={disconnect}
            disabled={!browser || !ws}
            class="disconnect-button"
          >
            {$t('disconnect')}
          </button>
        </div>
      </div>
    {/if}
    
    <div class="resizer" on:mousedown={startResize} style="display: {showConfig ? 'block' : 'none'};"></div>
    
    <div class="chat">
      <div class="status">
        <span class="socket-status">{$t('wsStatus')} {connectionStatus}</span>
        <div class="udp-info-container">
          {#if udpConnectionInfo}
            <span class="udp-info">{$t('meInfo')} {udpConnectionInfo}
              <button 
                class="copy-button" 
                on:click={copyUdpInfo}
                title={$t('infoCopied')}
              >
                📄
              </button>
            </span>
          {/if}
        </div>
        <span class="peer-status">{$t('peerStatus')} {peerConnectionStatus}</span>
      </div>
      
      <div class="messages" bind:this={messagesContainer}>
        {#each messages as message, i}
          <div class="message {message.isSelf ? 'self' : ''}">
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
                  {#if message.pendingChunks}
                    <div class="attachment-loading">
                      <div class="spinner"></div>
                      <span>{$t('fileReceiving')} {message.attachment.name}</span>
                    </div>
                  {:else}
                    <AttachmentView attachment={message.attachment} />
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      
      <div class="input">
        <textarea
          bind:value={messageInput}
          on:keydown={handleKeydown}
          placeholder={$t('messagePlaceholder')}
          disabled={connectionStatus !== $t('wsConnected') || !ws}
        ></textarea>
        
        <div class="attachment-controls">
          <FileUploader 
            disabled={connectionStatus !== $t('wsConnected') || !ws}
            on:fileSelected={({detail}) => {
              pendingAttachment = detail.attachment;
              pendingChunks = detail.chunks || null;
              showNotification($t('fileSelected') + detail.attachment.name);
            }}
            on:error={({detail}) => showNotification(detail)}
          />
          
          {#if pendingAttachment}
            <div class="pending-attachment">
              <span class="attachment-name">{pendingAttachment.name}</span>
              <button class="remove-attachment" on:click={() => {
                pendingAttachment = null;
                pendingChunks = null;
              }}>✕</button>
            </div>
          {/if}
        </div>
        
        <button
          on:click={sendMessage}
          disabled={connectionStatus !== $t('wsConnected') || !ws || (!messageInput.trim() && !pendingAttachment)}
          class="send-button {messageInput.trim() || pendingAttachment ? 'active' : ''}"
        >
          {$t('send')}
        </button>
      </div>
    </div>
  </div>

  <div class="notification" class:visible={notification}>
    {notification}
  </div>
</main>

<style>
  main {
    height: 100vh;
    display: flex;
    overflow: hidden;
    margin: 0;
    padding: 0;
  }
  
  .container {
    display: flex;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 0.5rem;
    gap: 0;
    font-family: Arial, sans-serif;
    overflow: hidden;
  }
  
  .burger-menu {
    display: block;
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    font-size: 1.5rem;
    cursor: pointer;
    z-index: 1000;
  }
  
  .config {
    min-width: 150px;
    padding: 0.75rem;
    background: #f5f5f5;
    border-radius: 8px 0 0 8px;
    overflow-y: auto;
    max-height: 100%;
    flex-shrink: 0;
  }
  
  .input-group {
    margin-bottom: 0.5rem;
    margin-right: 0.75rem;
  }
  
  .input-group label {
    display: block;
    margin-bottom: 0.2rem;
    font-weight: bold;
    font-size: 0.85rem;
  }
  
  .input-group input {
    width: 100%;
    padding: 0.3rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.85rem;
  }
  
  .button-group {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  
  .connect-button, .disconnect-button {
    flex: 1;
    font-size: 0.85rem;
    padding: 0.3rem 0;
  }
  
  .connect-button {
    background: #4CAF50;
  }
  
  .disconnect-button {
    background: #f44336;
  }
  
  .chat {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 0 8px 8px 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    height: 100%;
    overflow: hidden;
    position: relative;
  }
  
  .status {
    padding: 0.5rem;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-size: 0.85rem;
    padding-left: 2rem;
  }
  
  .status > * {
    margin-bottom: 0.5rem;
  }
  
  .udp-info-container {
    order: -1;
  }
  
  @media (min-width: 800px) {
    .status {
      flex-direction: row;
    }
    
    .status > * {
      margin-bottom: 0;
    }
    
    .udp-info-container {
      order: 0;
    }
  }
  
  .socket-status {
    font-weight: bold;
    white-space: nowrap;
  }
  
  .udp-info-container {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
  }
  
  .udp-info {
    background-color: #e3f2fd;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: bold;
    color: #1976d2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  
  .peer-status {
    font-weight: bold;
    white-space: nowrap;
    text-align: left;
  }
  
  .copy-button {
    background: none;
    border: none;
    padding: 0;
    margin-left: 0.25rem;
    cursor: pointer;
    font-size: 1.2rem;
    color: #666;
  }
  
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-height: 0;
    height: 0;
  }
  
  .message {
    background: #f1f1f1;
    padding: 0.5rem;
    border-radius: 8px;
    max-width: 80%;
    align-self: flex-start;
  }
  
  .message.self {
    align-self: flex-end;
    background: #dcf8c6;
  }
  
  .message-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }
  
  .nick {
    font-weight: bold;
  }
  
  .time {
    font-size: 0.8rem;
    color: #666;
  }
  
  .message-body {
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .input {
    padding: 0.5rem;
    border-top: 1px solid #ddd;
    display: flex;
    gap: 0.5rem;
    min-height: 50px;
    max-height: 70px;
  }
  
  textarea {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    resize: none;
    height: auto;
    min-height: 38px;
    max-height: 60px;
    overflow-y: auto;
  }
  
  button {
    padding: 0.4rem 0.8rem;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .input button {
    align-self: center;
    height: 38px;
  }
  
  button:hover:not(:disabled) {
    filter: brightness(0.9);
  }
  
  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .notification {
    position: fixed;
    top: 1rem;
    right: 1rem;
    background-color: #4CAF50;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
    z-index: 1000;
  }

  .notification.visible {
    opacity: 1;
  }

  h2 {
    font-size: 1.2rem;
    margin-top: 0;
    margin-bottom: 0.75rem;
    margin-left: 2rem;
  }
  
  .resizer {
    width: 5px;
    background-color: #ddd;
    cursor: col-resize;
    transition: background-color 0.2s;
  }
  
  .resizer:hover {
    background-color: #aaa;
  }

  .send-button {
    background-color: #9e9e9e;
    transition: background-color 0.2s;
  }
  
  .send-button.active {
    background-color: #2196F3;
  }

  @media (max-width: 800px) {
    .burger-menu {
      display: block;
    }

    .config {
      display: none;
    }
  }
  
  .message-text {
    margin-bottom: 0.5rem;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.2;
  }
  
  .attachment-container {
    margin-top: 0.5rem;
    border-top: 1px solid #f0f0f0;
    padding-top: 0.5rem;
  }
  
  .attachment-loading {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    background-color: #f9f9f9;
    border: 1px dashed #ccc;
    border-radius: 4px;
  }
  
  .attachment-loading .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-right: 0.75rem;
  }
  
  .attachment-controls {
    display: flex;
    align-items: center;
    margin-right: 0.5rem;
  }
  
  .pending-attachment {
    display: flex;
    align-items: center;
    margin-left: 0.5rem;
    background-color: #e8f4fc;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
  }
  
  .attachment-name {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .remove-attachment {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0 0 0 0.35rem;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Dark mode styles */
  .dark {
    background-color: #121212;
    color: #ffffff;
  }
  .dark .container {
    background-color: #1e1e1e;
  }
  .dark .message {
    background-color: #2e2e2e;
  }
  .dark .message.self {
    background-color: #3e3e3e;
  }
  .dark .config {
    background-color: #1e1e1e;
  }
  .dark .status {
    background-color: #1e1e1e;
  }
  .dark .input {
    background-color: #1e1e1e;
  }
  .dark textarea {
    background-color: #2e2e2e;
    color: #ffffff;
  }
  .dark button {
    background-color: #3e3e3e;
    color: #ffffff;
  }
  .dark .notification {
    background-color: #333333;
  }
  .dark .attachment-loading {
    background-color: #2e2e2e;
  }
  .dark .pending-attachment {
    background-color: #2e2e2e;
  }
  .dark .udp-info {
    background-color: #333333;
  }
  .dark .peer-status {
    color: #ffffff;
  }
  .dark .socket-status {
    color: #ffffff;
  }
  .dark .burger-menu {
    color: #ffffff;
  }
  .dark .copy-button {
    color: #ffffff;
  }
  .dark .input-group input {
    background-color: #2e2e2e;
    color: #ffffff;
  }
  .dark .chat {
    background-color: #1e1e1e;
  }
</style> 