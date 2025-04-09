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
    originalText?: string, 
    translatedTextFromSender?: string,
    timestamp: Date, 
    isSelf: boolean, 
    showOriginal?: boolean, 
    isTranslated?: boolean,
    hasMultipleTranslations?: boolean,
    processingTranslation?: boolean,
    errorOccurred?: boolean,
    // New fields for attachments
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
  let udpConnectionInfo = ''; // Speichert die UDP-Verbindungsinformationen
  let notification = '';
  
  // Ollama integration
  let isOllamaAvailable = false;
  let ollamaModels: string[] = [];
  let selectedOllamaModel = '';
  let liveTranslation = false;
  let alwaysShowOriginal = false;
  let translateOutgoing = false;
  let targetLanguage = '';
  
  // Aktuelle App-Sprache für eingehende Übersetzungen
  $: currentLanguageCode = $language;
  
  let configWidth = 220; // Standardbreite für die Konfigurationsseite
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
    // Wenn ein Wert übergeben wurde, verwende diesen, sonst toggle
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
    
    // Reset reconnect counter
    reconnectAttempts = 0;
    
    // Clear any existing reconnect timer
    if (reconnectInterval) {
      clearTimeout(reconnectInterval);
      reconnectInterval = null;
    }
        
    // Build WebSocket URL with query parameters
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
      
      // Attempt to reconnect unless it was a deliberate close
      if (event.code !== 1000) {
        attemptReconnect();
      }
    };
    
    ws.onmessage = (event) => {
      try {
        // All messages from autoprox are JSON
        const data = JSON.parse(event.data);
        const messageType = data.type;
        
        if (messageType === 'status') {
          // Status update from the server
          const status = data.status;
          const statusMessage = data.message || '';
          
          peerConnectionStatus = translateStatus(status, statusMessage);
          console.log(`Verbindungsstatus: ${status} - ${statusMessage}`);
        } 
        else if (messageType === 'data') {
          // Data message from remote peer
          const messageText = data.data || '';
          console.log("Empfangene Rohdaten:", messageText);
          
          // Finde den ersten Doppelpunkt, der den Nicknamen vom Inhalt trennt
          const colonIndex = messageText.indexOf(':');
          
          if (colonIndex > 0) {
            const nick = messageText.substring(0, colonIndex);
            // Der Rest der Nachricht (nach dem ersten Doppelpunkt) ist der Inhalt
            const content = messageText.substring(colonIndex + 1);
            
            console.log(`Empfangene Nachricht von ${nick}, vollständiger Inhalt:`, content);
            
            // Versuche zu parsen, mit zusätzlichen Debug-Informationen
            console.log("Starte Parsing-Versuch für:", content);
            const structuredMessage = parseStructuredMessage(content);
            console.log("Parsing-Ergebnis:", structuredMessage);
            
            // Prüfe, ob es ein Anhang-Chunk ist
            if (structuredMessage && structuredMessage.isAttachmentChunk && structuredMessage.attachmentChunk) {
              handleAttachmentChunk(nick, structuredMessage.attachmentChunk);
              return;
            }
            
            // Versuche den Inhalt zu analysieren, um den menschenlesbaren Text für die erste Anzeige zu extrahieren
            let initialDisplayText = content;
            
            if (structuredMessage && structuredMessage.original) {
              initialDisplayText = structuredMessage.original;
            } else if (content.trim().startsWith('{') && content.trim().includes('"original"')) {
              try {
                // Vereinfachter Ansatz, um den Originaltext zu extrahieren, ohne vollständiges Parsing
                const match = content.match(/"original"\s*:\s*"([^"]+)"/);
                if (match && match[1]) {
                  // Ersetze Escapes für einfache Anzeige
                  initialDisplayText = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
                  console.log("Extrahierter Originaltext für initiale Anzeige:", initialDisplayText);
                }
              } catch (e) {
                console.log("Konnte keinen Text für die initiale Anzeige extrahieren:", e);
              }
            }
            
            // Zuerst die Nachricht hinzufügen, um sofortiges Feedback zu geben
            const messageIndex = messages.length;
            
            // Prüfe, ob die Nachricht einen Dateianhang enthält
            const attachment = structuredMessage?.attachment;
            
            // Bestimme den Anfangstextinhalt - bei reinen Bild-Nachrichten leer lassen
            let displayText = "";
            if (structuredMessage && structuredMessage.original && structuredMessage.original.trim()) {
              displayText = structuredMessage.original;
            } else if (!attachment) {
              // Nur bei Nachrichten ohne Anhang den Rohtext anzeigen
              displayText = initialDisplayText;
            }
            
            // Wenn der Originaltext leer ist und ein Anhang vorhanden ist, zeige keinen Text an
            if (attachment && !displayText.trim()) {
              displayText = "";
            }
            
            messages = [...messages, {
              nick,
              text: displayText,
              timestamp: new Date(),
              isSelf: false,
              processingTranslation: displayText.trim() !== "", // Nur Übersetzung starten, wenn Text vorhanden
              attachment: attachment,
              pendingChunks: attachment?.chunks && attachment.chunks > 1 ? true : false
            }];
            setTimeout(scrollToBottom, 10);
            
            // Wenn es ein Dateianhang ist, der in Chunks übertragen wird, bereite die Chunk-Sammlung vor
            if (attachment && attachment.chunks && attachment.chunks > 1) {
              console.log(`Erwarte ${attachment.chunks} Chunks für Anhang ${attachment.id}`);
              
              // Speichere die Informationen für diesen Anhang, um Chunks zu sammeln
              incomingAttachments[attachment.id] = {
                attachment,
                chunks: [],
                messageIndex
              };
              
              // Wenn es Originaltext oder Übersetzung gibt, verarbeite diese normal
              if (structuredMessage && (structuredMessage.original || structuredMessage.translation)) {
                handleStructuredMessage(nick, structuredMessage, messageIndex);
              } else {
                // Bei einer reinen Anhangsnachricht ohne Text, einfach die Verarbeitung beenden
                updateMessage(messageIndex, {
                  processingTranslation: false
                });
              }
              
              return;
            }
            
            // Normale Nachrichtenverarbeitung
            if (structuredMessage && structuredMessage.original) {
              handleStructuredMessage(nick, structuredMessage, messageIndex);
            } else if (!structuredMessage?.attachment) {
              // Keine strukturierte Nachricht erkannt und kein Anhang - als Klartext behandeln
              console.log("Normale Textnachricht erkannt");
              
              if (isOllamaAvailable && liveTranslation && selectedOllamaModel) {
                const languageMap: Record<string, string> = {
                  'en': 'English',
                  'de': 'German',
                  'fr': 'French',
                  'es': 'Spanish',
                  'bg': 'Bulgarian',
                  'ja': 'Japanese',
                  'ko': 'Korean',
                  'zh': 'Chinese'
                };
                
                const targetLang = languageMap[currentLanguageCode] || 'English';
                
                translateWithOllama(content, targetLang)
                  .then(translatedText => {
                    updateMessage(messageIndex, {
                      text: translatedText,
                      originalText: content,
                      processingTranslation: false,
                      showOriginal: alwaysShowOriginal
                    });
                    
                    setTimeout(scrollToBottom, 10);
                  })
                  .catch(error => {
                    console.error("Übersetzungsfehler:", error);
                    
                    // Bei Fehler den Originaltext anzeigen
                    updateMessage(messageIndex, {
                      text: content,
                      processingTranslation: false
                    });
                    
                    setTimeout(scrollToBottom, 10);
                  });
              } else {
                // Ohne Übersetzung den Originaltext anzeigen
                updateMessage(messageIndex, {
                  text: content,
                  processingTranslation: false
                });
                
                setTimeout(scrollToBottom, 10);
              }
            }
          } else {
            // No nick format, just display as is
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
          // Error message from the server
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
  
  // Aktualisiere die Statusübersetzungen, wenn sich die Sprache ändert
  $: if ($t) {
    // ConnectionStatus aktualisieren
    if (connectionStatus === 'Verbunden' || connectionStatus === $t('wsConnected')) {
      connectionStatus = $t('wsConnected');
    } else if (connectionStatus === 'Getrennt' || connectionStatus === $t('wsDisconnected')) {
      connectionStatus = $t('wsDisconnected');
    } else if (connectionStatus === 'Fehler' || connectionStatus === $t('wsError')) {
      connectionStatus = $t('wsError');
    }
    
    // PeerConnectionStatus aktualisieren
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
  
  // Funktion zum Übersetzen des Status basierend auf einem Statuscode
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
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000); // Exponential backoff, max 30s
    
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
    
    // Nachricht sofort zur lokalen Anzeige hinzufügen, bevor sie gesendet wird
    const messageIndex = messages.length;
    
    // Bestimme, ob Übersetzung notwendig ist
    const needsTranslation = !!(originalMessage.trim() && translateOutgoing && isOllamaAvailable && liveTranslation);
    
    messages = [...messages, {
      nick: config.nick,
      text: originalMessage,
      timestamp: new Date(),
      isSelf: true,
      processingTranslation: needsTranslation,
      attachment: attachment || undefined
    }];
    
    // Eingabefeld leeren und Anhang zurücksetzen
    messageInput = '';
    pendingAttachment = null;
    pendingChunks = null;
    
    setTimeout(scrollToBottom, 10);
    
    // Wenn ein Anhang vorhanden ist und aus Chunks besteht
    if (attachment && chunks && chunks.length > 1) {
      // Handle Übersetzung zuerst, falls Text vorhanden ist
      let translationPromise: Promise<string | undefined> = Promise.resolve(undefined);
      
      if (needsTranslation) {
        translationPromise = translateWithOllama(originalMessage, targetLanguage)
          .then(translatedText => {
            // Aktualisiere die lokale Nachricht mit der Übersetzung
            updateMessage(messageIndex, {
              originalText: originalMessage,
              text: translatedText, 
              isTranslated: true,
              processingTranslation: false
            });
            return translatedText;
          })
          .catch(error => {
            console.error('Übersetzungsfehler:', error);
            updateMessage(messageIndex, {
              processingTranslation: false,
              errorOccurred: true
            });
            return undefined;
          });
      }
      
      // Warte auf mögliche Übersetzung, dann sende die Nachricht mit Metadaten
      translationPromise.then(translatedText => {
        // Sende zuerst die Nachricht mit dem Anhang (ohne Daten)
        const structuredContent = createStructuredMessage(
          originalMessage, 
          translatedText,
          translatedText ? targetLanguage : undefined, 
          {
            ...attachment,
            data: undefined  // Wir senden das attachment ohne Daten, nur die Metadaten
          }
        );
        
        // Sende die Hauptnachricht
        sendFormattedMessage(structuredContent);
        
        // Dann sende jeden Chunk einzeln
        chunks.forEach((chunk, i) => {
          // Kurze Verzögerung zwischen Chunks, um Überlastung zu vermeiden
          setTimeout(() => {
            const chunkMessage = createStructuredMessage("", undefined, undefined, undefined, chunk);
            sendFormattedMessage(chunkMessage);
            console.log(`Chunk ${i+1}/${chunks.length} gesendet für Anhang ${attachment.id}`);
          }, i * 100); // 100ms Verzögerung zwischen den Chunks
        });
      });
      
      return;
    }
    
    // Wenn Übersetzung aktiviert ist
    if (isOllamaAvailable && liveTranslation && translateOutgoing && originalMessage) {
      // Prüfen, ob eine Zielsprache definiert ist
      if (!targetLanguage.trim()) {
        showNotification($t('targetLanguageRequired'));
        // Aktualisiere die Nachricht, um den Verarbeitungsstatus zu entfernen
        updateMessage(messageIndex, {
          processingTranslation: false
        });
        return;
      }
      
      // Übersetzung durchführen
      translateWithOllama(originalMessage, targetLanguage).then(translatedMessage => {
        // Strukturierte Nachricht erstellen
        const structuredContent = createStructuredMessage(originalMessage, translatedMessage, targetLanguage, attachment);
        
        // Nachricht senden
        sendFormattedMessage(structuredContent);
        
        // Aktualisiere die bereits angezeigte Nachricht
        updateMessage(messageIndex, {
          originalText: translatedMessage,
          isTranslated: true,
          processingTranslation: false
        });
        
        setTimeout(scrollToBottom, 10);
      }).catch(error => {
        console.error("Fehler bei der Übersetzung:", error);
        
        // Bei Fehler ohne Übersetzung senden
        const structuredContent = createStructuredMessage(originalMessage, undefined, undefined, attachment);
        sendFormattedMessage(structuredContent);
        
        // Aktualisiere die Nachricht, um den Fehler anzuzeigen
        updateMessage(messageIndex, {
          processingTranslation: false,
          errorOccurred: true
        });
        
        setTimeout(scrollToBottom, 10);
      });
    } 
    // Ohne Übersetzung
    else {
      // Auch hier strukturierte Nachricht senden, aber ohne Übersetzung
      const structuredContent = createStructuredMessage(originalMessage, undefined, undefined, attachment);
      sendFormattedMessage(structuredContent);
    }
  }
  
  // Funktion zum Senden einer formatierten Nachricht
  function sendFormattedMessage(messageText: string) {
    // Die Nachricht muss nicht mehr durch nick: eingeleitet werden, das passiert bereits beim Senden
    const userMessage = `${config.nick}:${messageText}`;
    
    // Create the JSON payload as required by autoprox
    const jsonPayload = JSON.stringify({
      type: "data",
      data: userMessage
    });
    
    console.log("Sende Payload:", jsonPayload);
    
    // Send via WebSocket
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
  
  // Helper function to check if WebSocket is in OPEN state
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
  
  // Reaktive Anweisung für Auto-Scroll bei neuen Nachrichten
  $: if (messages.length) {
    setTimeout(scrollToBottom, 10); // Leichte Verzögerung, um sicherzustellen, dass DOM aktualisiert ist
  }
  
  // Check if Ollama server is available and fetch available models
  async function checkOllamaAvailability() {
    if (!browser) return;
    
    try {
      const response = await fetch('http://localhost:11434/api/tags', { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        isOllamaAvailable = true;
        ollamaModels = data.models?.map((model: { name: string }) => model.name) || [];
        
        if (ollamaModels.length > 0) {
          selectedOllamaModel = ollamaModels[0];
        }
        
        console.log('Ollama verfügbar, Modelle:', ollamaModels);
      } else {
        isOllamaAvailable = false;
        console.log('Ollama-Server nicht verfügbar:', response.statusText);
      }
    } catch (error) {
      isOllamaAvailable = false;
      console.log('Fehler bei der Ollama-Verbindung:', error);
    }
  }
  
  // Function to translate text using Ollama
  async function translateWithOllama(text: string, targetLang: string = ''): Promise<string> {
    if (!isOllamaAvailable || !selectedOllamaModel) {
      return text;
    }
    
    try {
      const langPrompt = targetLang ? 
        `Translate the following text to ${targetLang} and only answer with the translation and no more text than only the translated text:\n` :
        'Translate the following text to the most appropriate language:\n';
        
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedOllamaModel,
          prompt: `${langPrompt}${text}`,
          stream: false
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.response || text;
      } else {
        console.error('Übersetzungsfehler:', response.statusText);
        return text;
      }
    } catch (error) {
      console.error('Fehler bei der Übersetzung:', error);
      return text;
    }
  }
  
  function toggleOriginalText(index: number) {
    messages = messages.map((message, i) => {
      if (i === index && message.originalText) {
        return { ...message, showOriginal: !message.showOriginal };
      }
      return message;
    });
  }
  
  // Funktion zum Verarbeiten vorübersetzter Nachrichten
  function handlePreTranslatedMessage(nick: string, content: string) {
    // Versuche, Original und Übersetzung zu extrahieren
    let originalText = "";
    let translatedText = "";
    
    // Zuerst versuchen wir die lokalisierte Variante zu parsen
    const localizedOriginalPrefix = $t('originalMessage');
    const localizedTranslationPrefix = $t('translatedMessage');
    
    if (content.includes(localizedOriginalPrefix) && content.includes(localizedTranslationPrefix)) {
      const origStart = content.indexOf(localizedOriginalPrefix) + localizedOriginalPrefix.length;
      const transStart = content.indexOf(localizedTranslationPrefix);
      
      if (origStart > 0 && transStart > origStart) {
        originalText = content.substring(origStart, transStart).trim();
        translatedText = content.substring(transStart + localizedTranslationPrefix.length).trim();
        
        console.log("Extrahierter Originaltext:", originalText);
        console.log("Extrahierte Übersetzung:", translatedText);
      }
    } 
    // Dann die englische Variante versuchen
    else if (content.includes("Original:") && content.includes("Automatic translation:")) {
      const origStart = content.indexOf("Original:") + "Original:".length;
      const transStart = content.indexOf("Automatic translation:");
      
      if (origStart > 0 && transStart > origStart) {
        originalText = content.substring(origStart, transStart).trim();
        translatedText = content.substring(transStart + "Automatic translation:".length).trim();
        
        console.log("Extrahierter Originaltext (EN):", originalText);
        console.log("Extrahierte Übersetzung (EN):", translatedText);
      }
    }
    
    // Wenn wir Original und Übersetzung extrahieren konnten
    if (originalText && translatedText) {
      // Wenn lokale Übersetzung aktiv ist, übersetzen wir auch das Original
      if (isOllamaAvailable && liveTranslation && selectedOllamaModel) {
        // Sprachcode in vollen Sprachnamen umwandeln
        const languageMap: Record<string, string> = {
          'en': 'English',
          'de': 'German',
          'fr': 'French',
          'es': 'Spanish',
          'bg': 'Bulgarian',
          'ja': 'Japanese',
          'ko': 'Korean',
          'zh': 'Chinese'
        };
        
        const targetLang = languageMap[currentLanguageCode] || 'English';
        
        // Original in die App-Sprache übersetzen
        translateWithOllama(originalText, targetLang).then(localTranslation => {
          messages = [...messages, {
            nick,
            text: localTranslation, // Lokale Übersetzung als Haupttext
            originalText: originalText, // Original zum Anzeigen
            translatedTextFromSender: translatedText, // Die Übersetzung des Senders
            timestamp: new Date(),
            isSelf: false,
            showOriginal: alwaysShowOriginal,
            hasMultipleTranslations: true
          }];
          
          setTimeout(scrollToBottom, 10);
        }).catch(error => {
          console.error("Übersetzungsfehler:", error);
          
          // Bei Fehler die Übersetzung des Senders verwenden
          messages = [...messages, {
            nick,
            text: translatedText,
            originalText: originalText,
            timestamp: new Date(),
            isSelf: false,
            showOriginal: alwaysShowOriginal
          }];
          
          setTimeout(scrollToBottom, 10);
        });
      } else {
        // Ohne lokale Übersetzung zeigen wir die Sender-Übersetzung an
        messages = [...messages, {
          nick,
          text: translatedText, // Die Übersetzung des Senders als Haupttext
          originalText: originalText, // Original zum Anzeigen
          timestamp: new Date(),
          isSelf: false,
          showOriginal: alwaysShowOriginal
        }];
        
        setTimeout(scrollToBottom, 10);
      }
    } else {
      // Fallback: Wenn wir das Format nicht erkennen konnten
      console.warn("Konnte vorübersetzte Nachricht nicht parsen:", content);
      handleRegularMessage(nick, content);
    }
  }
  
  // Funktion zum Verarbeiten regulärer Nachrichten
  function handleRegularMessage(nick: string, content: string) {
    // Wenn Live-Übersetzung aktiv ist, übersetzen wir die Nachricht
    if (isOllamaAvailable && liveTranslation && selectedOllamaModel) {
      // Sprachcode in vollen Sprachnamen umwandeln
      const languageMap: Record<string, string> = {
        'en': 'English',
        'de': 'German',
        'fr': 'French',
        'es': 'Spanish',
        'bg': 'Bulgarian',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese'
      };
      
      const targetLang = languageMap[currentLanguageCode] || 'English';
      
      translateWithOllama(content, targetLang).then(translatedText => {
        messages = [...messages, {
          nick,
          text: translatedText,
          originalText: content,
          timestamp: new Date(),
          isSelf: false,
          showOriginal: alwaysShowOriginal
        }];
        
        setTimeout(scrollToBottom, 10);
      }).catch(error => {
        console.error("Übersetzungsfehler:", error);
        
        // Bei Fehler die Originalnachricht anzeigen
        messages = [...messages, {
          nick,
          text: content,
          timestamp: new Date(),
          isSelf: false
        }];
        
        setTimeout(scrollToBottom, 10);
      });
    } else {
      // Ohne Übersetzung die Originalnachricht anzeigen
      messages = [...messages, {
        nick,
        text: content,
        timestamp: new Date(),
        isSelf: false
      }];
      
      setTimeout(scrollToBottom, 10);
    }
  }
  
  // Neues Interface für strukturierte Nachrichten
  interface StructuredMessage {
    version: number;        // Version des Nachrichtenformats für zukünftige Kompatibilität
    original: string;       // Originaltext (immer vorhanden)
    translation?: string;   // Übersetzung (optional)
    targetLanguage?: string; // Zielsprache der Übersetzung (optional)
    
    // Neue Felder für Dateianhänge
    attachment?: FileAttachment;
    isAttachmentChunk?: boolean;
    attachmentChunk?: AttachmentChunk;
  }
  
  // Aktualisierte Funktion zum Erstellen einer strukturierten Nachricht, die Escape-Probleme vermeidet
  function createStructuredMessage(original: string, translation?: string, targetLang?: string, attachment?: FileAttachment | null, chunk?: AttachmentChunk): string {
    // Stelle sicher, dass sowohl Original als auch Übersetzung für JSON sicher sind
    const safeOriginal = sanitizeForJson(original);
    const safeTranslation = translation ? sanitizeForJson(translation) : undefined;
    
    const structured: StructuredMessage = {
      version: 1,
      original: safeOriginal
    };
    
    if (safeTranslation) {
      structured.translation = safeTranslation;
      structured.targetLanguage = targetLang;
    }
    
    // Füge Dateianhang hinzu, wenn vorhanden
    if (attachment) {
      structured.attachment = attachment;
    }
    
    // Füge Chunk-Informationen hinzu, wenn es sich um einen Chunk handelt
    if (chunk) {
      structured.isAttachmentChunk = true;
      structured.attachmentChunk = chunk;
    }
    
    // JSON für den Versand erstellen - dies wird später noch einmal von sendFormattedMessage verarbeitet
    // und muss daher nicht escaped werden
    const result = JSON.stringify(structured);
    console.log("Erstellte strukturierte Nachricht:", result);
    return result;
  }
  
  // Verbesserte Funktion zum Parsen einer strukturierten Nachricht
  function parseStructuredMessage(content: string): StructuredMessage | null {
    // Wenn content ein leerer String ist, sofort zurückgeben
    if (!content || content.trim() === '') {
      console.log("Leerer Content, nichts zu parsen");
      return null;
    }
    
    try {
      // Komplettes Debug-Log des zu parsenden Inhalts
      console.log("Vollständiger zu parsender Inhalt:", content);
      
      // Versuche zuerst, Escaping-Probleme zu beheben, falls vorhanden
      let contentToParse = content.trim();
      
      // Wenn der String mit Quotes beginnt und endet, entferne sie
      if (contentToParse.startsWith('"') && contentToParse.endsWith('"')) {
        contentToParse = contentToParse.slice(1, -1);
        console.log("Quotes entfernt:", contentToParse);
      }
      
      // Wenn der String escaped JSON zu sein scheint, unescape es
      if (contentToParse.includes('\\"')) {
        contentToParse = contentToParse.replace(/\\"/g, '"');
        console.log("Unescaped Content:", contentToParse);
      }
      
      // Überprüfe, ob der String ein gültiges JSON-Format hat (beginnt mit { und endet mit })
      if (!contentToParse.startsWith('{') || !contentToParse.endsWith('}')) {
        console.log("Kein JSON-Objekt Format:", contentToParse);
        return null;
      }
      
      // Direktes Parsen ohne weitere Modifikation
      try {
        console.log("Versuche direktes Parsen von:", contentToParse);
        const parsed = JSON.parse(contentToParse);
        console.log("Erfolgreich geparst als:", parsed);
        
        // Überprüfen, ob es eine strukturierte Nachricht ist
        if (parsed && typeof parsed === 'object' && 'version' in parsed && 'original' in parsed) {
          console.log("Gültige strukturierte Nachricht erkannt mit Originaltext:", parsed.original);
          return parsed as StructuredMessage;
        }
        
        console.log("Keine gültige strukturierte Nachricht (fehlende Felder)");
        return null;
      } catch (directParseError) {
        console.error("Direktes Parsen fehlgeschlagen:", directParseError);
        
        // Letzter Versuch: Entferne mögliche ungültige Zeichen am Anfang/Ende
        try {
          // Suche nach dem ersten { und dem letzten }
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
  
  // Funktion zum Aktualisieren einer bestehenden Nachricht, anstatt sie zu ersetzen
  function updateMessage(index: number, updatedMessage: Partial<typeof messages[0]>) {
    messages = messages.map((msg, i) => {
      if (i === index) {
        return { ...msg, ...updatedMessage };
      }
      return msg;
    });
  }
  
  // 1. Funktion zum Ersetzen von doppelten durch einfache Anführungszeichen
  function sanitizeForJson(text: string): string {
    // Ersetze alle doppelten Anführungszeichen durch einfache
    return text.replace(/"/g, "'");
  }
  
  // Neue Funktion zum Verarbeiten von strukturierten Nachrichten
  function handleStructuredMessage(nick: string, structuredMessage: StructuredMessage, messageIndex: number) {
    console.log("Strukturierte Nachricht erkannt:", structuredMessage);
    
    // Original und ggf. vorhandene Übersetzung extrahieren
    const originalText = structuredMessage.original;
    const senderTranslation = structuredMessage.translation;
    
    // Wenn eine lokale Übersetzung möglich ist
    if (isOllamaAvailable && liveTranslation && selectedOllamaModel) {
      // In die aktuelle Sprache übersetzen
      const languageMap: Record<string, string> = {
        'en': 'English',
        'de': 'German',
        'fr': 'French',
        'es': 'Spanish',
        'bg': 'Bulgarian',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese'
      };
      
      const targetLang = languageMap[currentLanguageCode] || 'English';
      
      // Versuche, das Original zu übersetzen
      translateWithOllama(originalText, targetLang)
        .then(localTranslation => {
          // Aktualisiere die bestehende Nachricht anstatt eine neue hinzuzufügen
          updateMessage(messageIndex, {
            text: localTranslation,
            originalText: originalText,
            translatedTextFromSender: senderTranslation,
            processingTranslation: false,
            showOriginal: alwaysShowOriginal,
            hasMultipleTranslations: !!senderTranslation
          });
          
          setTimeout(scrollToBottom, 10);
        })
        .catch(error => {
          console.error("Übersetzungsfehler:", error);
          
          // Bei Fehler die passendste verfügbare Variante nehmen
          const bestText = senderTranslation || originalText;
          
          updateMessage(messageIndex, {
            text: bestText,
            originalText: originalText !== bestText ? originalText : undefined,
            processingTranslation: false,
            showOriginal: alwaysShowOriginal && originalText !== bestText
          });
          
          setTimeout(scrollToBottom, 10);
        });
    } 
    // Ohne Ollama-Server
    else {
      // Die beste verfügbare Version verwenden
      const bestText = senderTranslation || originalText;
      const hasOriginal = originalText !== bestText;
      
      updateMessage(messageIndex, {
        text: bestText,
        originalText: hasOriginal ? originalText : undefined,
        processingTranslation: false,
        showOriginal: alwaysShowOriginal && hasOriginal
      });
      
      setTimeout(scrollToBottom, 10);
    }
  }
  
  // Neue Funktion zum Verarbeiten von eingehenden Anhang-Chunks
  function handleAttachmentChunk(nick: string, chunk: AttachmentChunk) {
    const { attachmentId, chunkIndex, totalChunks, data } = chunk;
    
    // Prüfe, ob wir diesen Anhang bereits kennen
    if (!incomingAttachments[attachmentId]) {
      console.warn(`Chunk empfangen für unbekannten Anhang ${attachmentId}`);
      return;
    }
    
    // Füge den Chunk zum Anhang hinzu
    incomingAttachments[attachmentId].chunks.push(chunk);
    
    console.log(`Chunk ${chunkIndex + 1}/${totalChunks} empfangen für Anhang ${attachmentId}`);
    
    // Wenn wir alle Chunks haben, rekonstruiere den Anhang
    if (incomingAttachments[attachmentId].chunks.length === totalChunks) {
      const { attachment, chunks, messageIndex } = incomingAttachments[attachmentId];
      
      // Rekonstruiere den vollständigen Anhang
      const completeAttachment = reassembleChunks(attachment, chunks);
      
      // Aktualisiere die Nachricht mit dem vollständigen Anhang
      updateMessage(messageIndex, {
        attachment: completeAttachment,
        pendingChunks: false
      });
      
      console.log(`Anhang ${attachmentId} vollständig empfangen`);
      
      // Cleanup
      delete incomingAttachments[attachmentId];
      
      setTimeout(scrollToBottom, 10);
    }
  }
  
  onMount(() => {
    fetchWebSocketInfo(); // Abrufen der WebSocket-Info beim Laden der App
    checkOllamaAvailability(); // Prüfen, ob Ollama verfügbar ist
    
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
        
        <!-- Ollama Connection Section -->
        <div class="ollama-section">
          <h3>{$t('ollamaConnect')}</h3>
          
          {#if !isOllamaAvailable}
            <div class="ollama-status error">
              {$t('ollamaNoServer')}
            </div>
          {:else}
            <div class="checkbox-group">
              <input 
                type="checkbox" 
                id="liveTranslation" 
                bind:checked={liveTranslation} 
              >
              <label for="liveTranslation">{$t('ollamaLiveTranslation')}</label>
            </div>
            
            <div class="input-group">
              <label for="ollamaModel">{$t('ollamaModel')}</label>
              <select id="ollamaModel" bind:value={selectedOllamaModel} disabled={!liveTranslation}>
                {#each ollamaModels as model}
                  <option value={model}>{model}</option>
                {/each}
              </select>
            </div>
            
            <div class="checkbox-group">
              <input 
                type="checkbox" 
                id="alwaysShowOriginal" 
                bind:checked={alwaysShowOriginal}
                disabled={!liveTranslation}
              >
              <label for="alwaysShowOriginal">{$t('ollamaShowOriginal')}</label>
            </div>
            
            <div class="checkbox-group">
              <input 
                type="checkbox" 
                id="translateOutgoing" 
                bind:checked={translateOutgoing}
                disabled={!liveTranslation}
              >
              <label for="translateOutgoing">{$t('ollamaTranslateOutgoing')}</label>
            </div>
            
            <div class="input-group" class:disabled={!liveTranslation || !translateOutgoing}>
              <label for="targetLanguage">
                {$t('ollamaTargetLanguage')}
                {#if translateOutgoing && liveTranslation}
                  <span class="required">*</span>
                {/if}
              </label>
              <input 
                id="targetLanguage" 
                bind:value={targetLanguage} 
                disabled={!liveTranslation || !translateOutgoing}
                placeholder="English, Deutsch, Español..."
                class:error={translateOutgoing && liveTranslation && !targetLanguage.trim()}
              >
              {#if translateOutgoing && liveTranslation && !targetLanguage.trim()}
                <div class="field-error">{$t('targetLanguageRequired')}</div>
              {/if}
            </div>
          {/if}
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
          <div class="message {message.isSelf ? 'self' : ''} {message.processingTranslation ? 'processing' : ''} {message.errorOccurred ? 'error' : ''}">
            <div class="message-header">
              <span class="nick">{message.nick}</span>
              <span class="time">{message.timestamp.toLocaleTimeString()}</span>
            </div>
            <div class="message-body">
              {#if message.processingTranslation}
                <div class="processing-indicator">
                  {message.text}
                  <div class="loading-dots"><span>.</span><span>.</span><span>.</span></div>
                </div>
              {:else}
                {#if message.text}
                  <div class="message-text">{message.text}</div>
                  
                  {#if message.originalText && !message.showOriginal && !message.isSelf}
                    <!-- Eingehende Nachricht mit verfügbarer Übersetzung - zeige "Original anzeigen" Button -->
                    <button 
                      class="show-original-button" 
                      on:click={() => toggleOriginalText(i)}
                    >
                      {$t('showOriginalText')}
                    </button>
                  {:else if message.originalText && message.showOriginal && !message.isSelf}
                    <!-- Eingehende Nachricht mit angezeigtem Original -->
                    <div class="original-text">
                      {message.originalText}
                      {#if message.translatedTextFromSender && message.hasMultipleTranslations}
                        <div class="sender-translation">
                          <strong>{$t('translatedMessage')}</strong> {message.translatedTextFromSender}
                        </div>
                      {/if}
                      <button 
                        class="hide-original-button" 
                        on:click={() => toggleOriginalText(i)}
                      >
                        ✕
                      </button>
                    </div>
                  {:else if message.originalText && !message.showOriginal && message.isSelf && message.isTranslated}
                    <!-- Ausgehende Nachricht mit verfügbarer Übersetzung - zeige "Übersetzung anzeigen" Button -->
                    <button 
                      class="show-original-button" 
                      on:click={() => toggleOriginalText(i)}
                    >
                      {$t('translatedMessage')}
                    </button>
                  {:else if message.originalText && message.showOriginal && message.isSelf && message.isTranslated}
                    <!-- Ausgehende Nachricht mit angezeigter Übersetzung -->
                    <div class="original-text">
                      {message.originalText}
                      <button 
                        class="hide-original-button" 
                        on:click={() => toggleOriginalText(i)}
                      >
                        ✕
                      </button>
                    </div>
                  {/if}
                {/if}
                
                {#if message.errorOccurred}
                  <div class="translation-error">
                    {$t('translationError')}
                  </div>
                {/if}
                
                <!-- Anzeige von Dateianhängen -->
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
        
        <!-- Attachment button and info -->
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
    padding-left: 2rem; /* Platz für das Burger-Menü */
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
    height: 0; /* Wichtig für Flexbox-Layout */
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
  
  /* Ollama section styles */
  .ollama-section {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #ddd;
  }
  
  .ollama-section h3 {
    font-size: 1rem;
    margin-top: 0;
    margin-bottom: 0.75rem;
  }
  
  .ollama-status {
    font-size: 0.85rem;
    margin-bottom: 1rem;
    padding: 0.5rem;
    border-radius: 4px;
  }
  
  .ollama-status.error {
    background-color: #ffebee;
    color: #d32f2f;
  }
  
  .checkbox-group {
    display: flex;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .checkbox-group input[type="checkbox"] {
    margin-right: 0.5rem;
  }
  
  .checkbox-group label {
    font-size: 0.85rem;
  }
  
  .input-group.disabled {
    opacity: 0.5;
  }
  
  select {
    width: 100%;
    padding: 0.3rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.85rem;
  }
  
  .required {
    color: #d32f2f;
    margin-left: 0.25rem;
  }
  
  input.error {
    border-color: #d32f2f;
    background-color: #ffebee;
  }
  
  .field-error {
    color: #d32f2f;
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
  
  .show-original-button {
    background: none;
    border: none;
    color: #2196F3;
    padding: 0;
    font-size: 0.8rem;
    margin-top: 0.5rem;
    cursor: pointer;
    text-decoration: underline;
    display: block;
  }
  
  .hide-original-button {
    background: none;
    border: none;
    color: #999;
    font-size: 0.8rem;
    padding: 0;
    margin-left: 0.5rem;
    cursor: pointer;
    float: right;
  }
  
  .original-text {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: #f5f5f5;
    border-radius: 4px;
    font-size: 0.9rem;
    border-left: 3px solid #2196F3;
    position: relative;
  }

  .sender-translation {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #ddd;
    font-size: 0.9rem;
    color: #666;
  }

  .message.processing {
    opacity: 0.8;
    background-color: #f9f9f9;
  }
  
  .processing-indicator {
    display: flex;
    align-items: center;
    color: #777;
    font-style: italic;
  }
  
  .loading-dots {
    display: inline-flex;
    margin-left: 0.5rem;
  }
  
  .loading-dots span {
    animation: loadingDots 1.4s infinite ease-in-out both;
    margin-right: 2px;
    color: #555;
    font-weight: bold;
  }
  
  .loading-dots span:nth-child(1) {
    animation-delay: 0s;
  }
  
  .loading-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  .loading-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }
  
  @keyframes loadingDots {
    0%, 80%, 100% { 
      transform: scale(0.4);
      opacity: 0.5;
    }
    40% { 
      transform: scale(1.0);
      opacity: 1;
    }
  }
  
  .message.error {
    border-left: 3px solid #f44336;
  }
  
  .translation-error {
    color: #f44336;
    font-size: 0.8rem;
    margin-top: 0.5rem;
    font-style: italic;
  }

  .message-text {
    margin-bottom: 0.5rem;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.2; /* Reduziert den Zeilenabstand */
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
  .dark .ollama-status.error {
    background-color: #3e3e3e;
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
  .dark .show-original-button {
    color: #ffffff;
  }
  .dark .hide-original-button {
    color: #ffffff;
  }
  .dark .original-text {
    background-color: #2e2e2e;
  }
  .dark .sender-translation {
    color: #ffffff;
  }
  .dark .message.error {
    border-left: 3px solid #f44336;
  }
  .dark .translation-error {
    color: #f44336;
  }
  .dark .input-group input {
    background-color: #2e2e2e;
    color: #ffffff;
  }
  .dark .chat {
    background-color: #1e1e1e;
  }
</style> 