<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  // Import components
  import StatusBar from './lib/components/StatusBar.svelte';
  import FriendsList from './lib/components/FriendsList.svelte';
  import Chat from './lib/components/Chat.svelte';
  import type { Friend } from './lib/components/FriendsList.svelte';
  import AccountSettings from './lib/components/AccountSettings.svelte';
  
  // Import WebRTC and file handling
  import { ConnectionManager } from './lib/webrtc/ConnectionManager';
  import type { FileAttachment } from './lib/file-handling/types';
  
  // Import styles
  import './lib/styles/theme.css';
  
  // Import translations
  import { translations } from './lib/i18n/translations';
  
  // Backend and account package related types
  interface AccountPackage {
    username: string;
    profileImage?: string; // datamap address
    themeUrl?: string; // theme URL
    language?: 'en' | 'de';
    friends?: Array<{
      peerId: string;
      displayName: string;
    }>;
  }
  
  // Application state
  let accountPackage: AccountPackage | null = null;
  let backendUrl = '';
  let accountName = '';
  let myPeerId = '';
  let isLoadingPeerId = false;
  let isLoadingAccountPackage = false;
  let showAccountCreation = false;
  let accountCreationForm = {
    username: '',
    profileImage: '',
    themeUrl: '',
    language: 'en' as const
  };
  let accountCreationError = '';
  
  // Friends and chat state
  let friends: Friend[] = [];
  let selectedFriendId: string | null = null;
  let chatMessages: Record<string, Array<{
    nick: string;
    text: string;
    timestamp: Date;
    isSelf: boolean;
    attachment?: FileAttachment;
  }>> = {};
  
  // Connection management
  let connectionManager: ConnectionManager;
  let handshakeServerUrl = 'https://handshake.autonomi.space';
  let handshakeIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  let handshakeStatus = '';
  let handshakeCountdown = '';
  let handshakeCountdowns: Record<string, number> = {};
  let handshakeLoopRunning = false;
  
  // UI state
  let notification = '';
  let connectionStatus = 'Initializing...';
  
  // Language state
  let language: 'en' | 'de' = 'en';
  
  // Update language when account package changes
  $: if (accountPackage?.language) {
    language = accountPackage.language;
  }
  
  // Get translations for current language
  $: t = translations[language];
  
  // Initialize connection manager
  onMount(() => {
    connectionManager = new ConnectionManager({
      onMessage: handleIncomingMessage,
      onConnectionStateChange: handleConnectionStateChange,
      onError: handleConnectionError
    });
    
    // Parse URL parameters
    backendUrl = parseBackendUrl();
    accountName = parseAccountName();
    
    // Initialize backend integration
    initializeBackend();
    
    // Log debug info
    console.log('🚀 Friends App Started');
    console.log('📦 Debug info available at: sessionStorage.friendsDebugInfo');
    console.log('🔍 To view: JSON.parse(sessionStorage.getItem("friendsDebugInfo"))');
    
    // Start countdown updates
    setInterval(updateCountdowns, 1000);
    
    // Start handshake loop
    startHandshakeLoop();
    
    return () => {
      // Cleanup
      connectionManager.closeAllConnections();
      handshakeIntervals.forEach(interval => clearInterval(interval));
      handshakeLoopRunning = false;
    };
  });
  
  // Parse backend URL from query parameters
  function parseBackendUrl(): string {
    if (!browser) return '';
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('backend') || ''; // Empty string means use relative URLs
  }
  
  // Parse account name from query parameters
  function parseAccountName(): string {
    if (!browser) return '';
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('accountname') || '';
  }
  
  // Build scratchpad URL with optional object_name parameter
  function buildScratchpadUrl(): string {
    const baseUrl = backendUrl ? `${backendUrl}/ant-0/scratchpad-private` : '/ant-0/scratchpad-private';
    if (accountName) {
      return `${baseUrl}?object_name=${encodeURIComponent(accountName)}`;
    }
    return baseUrl;
  }
  
  // Build communication object name for public scratchpad
  function buildCommObjectName(): string {
    if (accountName) {
      return `comm${accountName}`;
    }
    return 'comm';
  }
  
  // Build public scratchpad URL for peer communication
  function buildPublicScratchpadUrl(): string {
    const objectName = buildCommObjectName();
    const baseUrl = backendUrl ? `${backendUrl}/ant-0/scratchpad-public` : '/ant-0/scratchpad-public';
    return `${baseUrl}?object_name=${encodeURIComponent(objectName)}`;
  }
  
  // Convert JSON to byte array for scratchpad storage
  function jsonToByteArray(jsonString: string): number[] {
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(jsonString);
    return Array.from(uint8Array);
  }
  
  // Convert byte array back to JSON
  function byteArrayToJson(byteArray: number[]): any {
    const uint8Array = new Uint8Array(byteArray);
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(uint8Array);
    return JSON.parse(jsonString);
  }
  
  // Initialize backend integration
  async function initializeBackend() {
    console.log('🔧 Initializing backend integration...');
    console.log('🔧 Backend URL:', backendUrl || 'Using relative URLs');
    console.log('🔧 Account name:', accountName || 'None provided');
    
    isLoadingAccountPackage = true;
    
    try {
      // Fetch account package
      const fetchedPackage = await fetchAccountPackage();
      
      if (fetchedPackage) {
        accountPackage = fetchedPackage;
        
        // Load friends from account package
        if (fetchedPackage.friends) {
          friends = fetchedPackage.friends.map(f => ({
            peerId: f.peerId,
            displayName: f.displayName,
            isConnected: false,
            unreadCount: 0
          }));
        }
        
        // Load theme if available
        if (fetchedPackage.themeUrl) {
          loadTheme(fetchedPackage.themeUrl);
        }
        
        // Load language if available
        if (fetchedPackage.language) {
          language = fetchedPackage.language;
        }
        
        showNotification(`Welcome back, ${fetchedPackage.username}!`);
      } else {
        // No account package found - offer to create one
        showAccountCreation = true;
      }
    } catch (error) {
      console.error('❌ Error during backend initialization:', error);
      connectionStatus = 'Backend error';
    } finally {
      isLoadingAccountPackage = false;
    }
    
    // Initialize peer communication
    await initializePeerCommunication();
    
    // Update debug info
    updateSessionStorageDebugInfo();
    
    // Start auto-reconnect for all friends
    startAutoReconnect();
  }
  
  // Fetch account package from backend
  async function fetchAccountPackage(): Promise<AccountPackage | null> {
    const url = buildScratchpadUrl();
    console.log('🌐 Fetching account package from:', url);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Ant-App-ID': 'friends'
        }
      });
      
      if (response.status === 404) {
        console.log('📭 Account package not found (404)');
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const scratchpadData = await response.json();
      
      // Extract account package from scratchpad format
      let chunk = null;
      if (Array.isArray(scratchpadData) && scratchpadData.length > 0) {
        chunk = scratchpadData[0];
      } else if (scratchpadData && scratchpadData.dweb_type === "PrivateScratchpad") {
        chunk = scratchpadData;
      }
      
      if (chunk && chunk.unencrypted_data && Array.isArray(chunk.unencrypted_data)) {
        try {
          const accountPackage = byteArrayToJson(chunk.unencrypted_data);
          console.log('✅ Successfully loaded account package:', accountPackage);
          return accountPackage as AccountPackage;
        } catch (error) {
          console.error('❌ Error parsing account package:', error);
          return null;
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error fetching account package:', error);
      
      // Check for HTTPS certificate error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (backendUrl && backendUrl.startsWith('https://') && errorMessage.includes('Failed to fetch')) {
        accountCreationError = `HTTPS certificate error detected. Please click here to accept the self-signed certificate: ${backendUrl}`;
        showAccountCreation = true;
      }
      
      return null;
    }
  }
  
  // Create account package on backend
  async function createAccountPackage(accountData: AccountPackage): Promise<boolean> {
    console.log('💾 Creating account package:', accountData);
    
    try {
      const accountJson = JSON.stringify(accountData);
      const accountBytes = jsonToByteArray(accountJson);
      
      const scratchpadPayload = {
        counter: 0,
        data_encoding: 0,
        dweb_type: "PrivateScratchpad",
        encryped_data: [0],
        scratchpad_address: "string",
        unencrypted_data: accountBytes
      };
      
      const response = await fetch(buildScratchpadUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ant-App-ID': 'friends'
        },
        body: JSON.stringify(scratchpadPayload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('✅ Account package created successfully');
      return true;
    } catch (error) {
      console.error('❌ Error creating account package:', error);
      accountCreationError = 'Error creating account: ' + error;
      return false;
    }
  }
  
  // Update account package on backend
  async function updateAccountPackage(updatedData: Partial<AccountPackage>): Promise<boolean> {
    if (!accountPackage) return false;
    
    console.log('🔄 Updating account package with:', updatedData);
    
    const newAccountData: AccountPackage = {
      ...accountPackage,
      ...updatedData
    };
    
    try {
      const accountJson = JSON.stringify(newAccountData);
      const accountBytes = jsonToByteArray(accountJson);
      
      const scratchpadPayload = {
        counter: 0,
        data_encoding: 0,
        dweb_type: "PrivateScratchpad",
        encryped_data: [0],
        scratchpad_address: "string",
        unencrypted_data: accountBytes
      };
      
      const response = await fetch(buildScratchpadUrl(), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Ant-App-ID': 'friends'
        },
        body: JSON.stringify(scratchpadPayload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      accountPackage = newAccountData;
      console.log('✅ Account package updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating account package:', error);
      showNotification('Error updating account package: ' + error);
      return false;
    }
  }
  
  // Initialize public scratchpad for peer communication
  async function initializePeerCommunication(): Promise<void> {
    const url = buildPublicScratchpadUrl();
    console.log('🌐 Initializing peer communication:', url);
    
    isLoadingPeerId = true;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Ant-App-ID': 'friends'
        }
      });
      
      if (response.ok) {
        const scratchpadData = await response.json();
        
        let chunk = null;
        if (Array.isArray(scratchpadData) && scratchpadData.length > 0) {
          chunk = scratchpadData[0];
        } else if (scratchpadData && scratchpadData.dweb_type === "PublicScratchpad") {
          chunk = scratchpadData;
        }
        
        if (chunk && chunk.scratchpad_address) {
          myPeerId = chunk.scratchpad_address;
          console.log('✅ Retrieved peer ID:', myPeerId);
        }
      } else if (response.status === 404) {
        // Create new public scratchpad
        await createPublicScratchpad();
      }
    } catch (error) {
      console.error('❌ Error initializing peer communication:', error);
      showNotification('Error initializing peer communication');
    } finally {
      isLoadingPeerId = false;
      connectionStatus = 'Ready';
    }
  }
  
  // Create new public scratchpad for peer communication
  async function createPublicScratchpad(): Promise<void> {
    const url = buildPublicScratchpadUrl();
    console.log('💾 Creating public scratchpad at:', url);
    
    try {
      const peerInfo = {
        type: 'peer-communication',
        createdAt: new Date().toISOString(),
        accountName: accountName || null
      };
      
      const peerInfoJson = JSON.stringify(peerInfo);
      const peerInfoBytes = jsonToByteArray(peerInfoJson);
      
      const scratchpadPayload = {
        counter: 0,
        data_encoding: 0,
        dweb_type: "PublicScratchpad",
        encryped_data: [0],
        scratchpad_address: "string",
        unencrypted_data: peerInfoBytes
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ant-App-ID': 'friends'
        },
        body: JSON.stringify(scratchpadPayload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const createdScratchpad = await response.json();
      
      if (createdScratchpad && createdScratchpad.scratchpad_address) {
        myPeerId = createdScratchpad.scratchpad_address;
        console.log('✅ New peer ID:', myPeerId);
      }
    } catch (error) {
      console.error('❌ Error creating public scratchpad:', error);
    }
  }
  
  // Handle account creation form submission
  async function handleAccountCreation() {
    if (!accountCreationForm.username.trim()) {
      accountCreationError = 'Username is required';
      return;
    }
    
    accountCreationError = '';
    isLoadingAccountPackage = true;
    
    const accountData: AccountPackage = {
      username: accountCreationForm.username.trim(),
      profileImage: accountCreationForm.profileImage.trim() || undefined,
      themeUrl: accountCreationForm.themeUrl.trim() || 'default',
      language: accountCreationForm.language,
      friends: []
    };
    
    const success = await createAccountPackage(accountData);
    
    if (success) {
      accountPackage = accountData;
      showAccountCreation = false;
      showNotification('Account package created successfully!');
      
      // Initialize peer communication after account creation
      await initializePeerCommunication();
    }
    
    isLoadingAccountPackage = false;
  }
  
  // Cancel account creation
  function cancelAccountCreation() {
    showAccountCreation = false;
    accountCreationForm = { username: '', profileImage: '', themeUrl: '', language: 'en' as const };
    accountCreationError = '';
  }
  
  // Load theme from URL
  function loadTheme(url: string) {
    const existingThemeLink = document.getElementById('dynamic-theme');
    if (existingThemeLink) {
      existingThemeLink.remove();
    }
    
    if (url === 'default') {
      // Remove any custom background
      document.documentElement.style.removeProperty('--theme-background-url');
      return;
    }
    
    let themeFullUrl: string;
    if (url.startsWith('http')) {
      themeFullUrl = url;
    } else {
      // Use backendUrl for constructing theme URL, which defaults to relative if not set
      themeFullUrl = backendUrl ? `${backendUrl}/ant-0/data/${url}` : `/ant-0/data/${url}`;
    }
    
    const themeLink = document.createElement('link');
    themeLink.id = 'dynamic-theme';
    themeLink.rel = 'stylesheet';
    themeLink.href = themeFullUrl;
    
    // When theme loads, check for background datamap
    themeLink.onload = () => {
      const styles = getComputedStyle(document.documentElement);
      const backgroundDatamap = styles.getPropertyValue('--theme-background-datamap').trim();
      
      if (backgroundDatamap && backgroundDatamap !== '' && backgroundDatamap !== 'none') {
        // Remove quotes if present
        const cleanDatamap = backgroundDatamap.replace(/['"]/g, '');
        const backgroundUrl = backendUrl ? 
          `url("${backendUrl}/ant-0/data/${cleanDatamap}")` : 
          `url("/ant-0/data/${cleanDatamap}")`;
        document.documentElement.style.setProperty('--theme-background-url', backgroundUrl);
        
        // Apply background to body
        document.body.style.background = `${backgroundUrl} no-repeat center center fixed`;
        document.body.style.backgroundSize = 'cover';
      }
    };
    
    document.head.appendChild(themeLink);
  }
  
  // Handle incoming messages from peers
  function handleIncomingMessage(peerId: string, data: any) {
    // Initialize chat messages for this peer if needed
    if (!chatMessages[peerId]) {
      chatMessages[peerId] = [];
    }
    
    // Handle different message types
    switch (data.type) {
      case 'chat':
        const message = {
          nick: data.nick,
          text: data.message,
          timestamp: new Date(data.timestamp),
          isSelf: false,
          attachment: data.attachment
        };
        
        chatMessages[peerId] = [...chatMessages[peerId], message];
        
        // Update unread count if not selected
        if (selectedFriendId !== peerId) {
          const friend = friends.find(f => f.peerId === peerId);
          if (friend) {
            friend.unreadCount++;
            friends = friends;
          }
        }
        
        // Show notification if in background
        if (document.hidden && data.nick && data.message) {
          showBrowserNotification(data.nick, data.message);
        }
        break;
        
      case 'file-start':
        // Handle file transfer start
        handleFileStart(peerId, data);
        break;
        
      case 'file-chunk':
        // Handle file chunk
        handleFileChunk(peerId, data);
        break;
        
      case 'heartbeat':
        // Connection is alive
        console.log(`[${peerId}] Heartbeat received`);
        break;
    }
  }
  
  // Handle connection state changes
  function handleConnectionStateChange(peerId: string, state: RTCPeerConnectionState) {
    const isConnected = state === 'connected';
    updateFriendConnectionStatus(peerId, isConnected);
    
    if (isConnected) {
      console.log(`[${peerId}] Connected!`);
      showNotification(`Connected to ${getFriendName(peerId)}`);
      
      // Stop auto-reconnect for this specific friend - connection established
      const interval = handshakeIntervals.get(peerId);
      if (interval) {
        clearInterval(interval);
        handshakeIntervals.delete(peerId);
        console.log(`[${peerId}] Stopping auto-reconnect - connection established`);
      }
      
      // Clear countdown for this friend
      delete handshakeCountdowns[peerId];
    } else if (state === 'failed' || state === 'disconnected') {
      console.log(`[${peerId}] Disconnected`);
      showNotification(`Disconnected from ${getFriendName(peerId)}`);
      
      // Restart auto-reconnect for this specific friend - connection lost
      if (!handshakeIntervals.has(peerId)) {
        console.log(`[${peerId}] Starting auto-reconnect - connection lost`);
        startAutoReconnectForFriend(peerId);
      }
    }
    
    // Update debug info
    updateSessionStorageDebugInfo();
  }
  
  // Handle connection errors
  function handleConnectionError(peerId: string, error: Error) {
    console.error(`[${peerId}] Connection error:`, error);
    updateFriendConnectionStatus(peerId, false);
  }
  
  // Update friend connection status
  function updateFriendConnectionStatus(peerId: string, isConnected: boolean) {
    const friend = friends.find(f => f.peerId === peerId);
    if (friend) {
      friend.isConnected = isConnected;
      friends = friends;
    }
    
    updateConnectionStatus();
  }
  
  // Update overall connection status
  function updateConnectionStatus() {
    const connectedCount = friends.filter(f => f.isConnected).length;
    
    if (connectedCount === 0) {
      connectionStatus = 'No connections';
    } else if (connectedCount === 1) {
      connectionStatus = '1 friend connected';
    } else {
      connectionStatus = `${connectedCount} friends connected`;
    }
  }
  
  // Get friend display name
  function getFriendName(peerId: string): string {
    const friend = friends.find(f => f.peerId === peerId);
    return friend?.displayName || peerId.slice(0, 8) + '...';
  }
  
  // Handle friend selection
  function handleSelectFriend(event: CustomEvent<string>) {
    selectedFriendId = event.detail;
    
    // Clear unread count
    const friend = friends.find(f => f.peerId === event.detail);
    if (friend) {
      friend.unreadCount = 0;
      friends = friends;
    }
  }
  
  // Handle adding a new friend
  function handleAddFriend(event: CustomEvent<{peerId: string, displayName: string}>) {
    const { peerId, displayName } = event.detail;
    
    // Check if friend already exists
    if (friends.some(f => f.peerId === peerId)) {
      showNotification('Friend already exists');
      return;
    }
    
    // Add new friend
    const newFriend: Friend = {
      peerId,
      displayName,
      isConnected: false,
      unreadCount: 0
    };
    
    friends = [...friends, newFriend];
    
    // Save to localStorage
    saveFriends();
    
    // Start connection attempt with auto-reconnect
    startAutoReconnectForFriend(peerId);
    
    showNotification(`Added ${displayName} as friend`);
  }
  
  // Handle removing a friend
  function handleRemoveFriend(event: CustomEvent<string>) {
    const peerId = event.detail;
    
    // Close connection
    connectionManager.closeConnection(peerId);
    
    // Stop auto-reconnect for this friend
    const interval = handshakeIntervals.get(peerId);
    if (interval) {
      clearInterval(interval);
      handshakeIntervals.delete(peerId);
    }
    
    // Remove from friends list
    friends = friends.filter(f => f.peerId !== peerId);
    
    // Clear chat messages
    delete chatMessages[peerId];
    
    // Clear selection if this friend was selected
    if (selectedFriendId === peerId) {
      selectedFriendId = null;
    }
    
    // Save to localStorage
    saveFriends();
    
    showNotification('Friend removed');
  }
  
  // Save friends to localStorage
  function saveFriends() {
    if (!browser) return;
    
    const friendsData = friends.map(f => ({
      peerId: f.peerId,
      displayName: f.displayName
    }));
    
    localStorage.setItem('friends', JSON.stringify(friendsData));
    
    // Also update account package if available
    if (accountPackage) {
      updateAccountPackageFriends(friendsData);
    }
  }
  
  // Update account package with friends list
  async function updateAccountPackageFriends(friendsData: Array<{peerId: string, displayName: string}>) {
    const success = await updateAccountPackage({ friends: friendsData });
    if (success) {
      console.log('✅ Friends list saved to account package');
    }
  }
  
  // Handle sending a message
  function handleSendMessage(event: CustomEvent<{text: string, attachment: FileAttachment | null}>) {
    if (!selectedFriendId) return;
    
    const { text, attachment } = event.detail;
    
    // Create message object
    const message = {
      nick: accountPackage?.username || 'User',
      text,
      timestamp: new Date(),
      isSelf: true,
      attachment: attachment || undefined
    };
    
    // Add to local messages
    if (!chatMessages[selectedFriendId]) {
      chatMessages[selectedFriendId] = [];
    }
    chatMessages[selectedFriendId] = [...chatMessages[selectedFriendId], message];
    
    // Send via WebRTC
    const messageData = {
      type: 'chat',
      nick: message.nick,
      message: text,
      timestamp: message.timestamp.toISOString(),
      attachment: attachment ? {
        ...attachment,
        data: attachment.size > 50000 ? undefined : attachment.data
      } : undefined
    };
    
    if (attachment && attachment.size > 50000 && attachment.data) {
      // Send large files in chunks
      connectionManager.sendLargeFileInChunks(selectedFriendId, messageData, attachment);
    } else {
      connectionManager.sendMessage(selectedFriendId, messageData);
    }
  }
  
  // Handle file transfer start
  function handleFileStart(peerId: string, data: any) {
    console.log(`[${peerId}] Receiving file:`, data.attachment.name);
    
    // Initialize chat messages if needed
    if (!chatMessages[peerId]) {
      chatMessages[peerId] = [];
    }
    
    // Add placeholder message
    const message = {
      nick: data.nick,
      text: data.message || '',
      timestamp: new Date(data.timestamp),
      isSelf: false,
      attachment: {
        ...data.attachment,
        complete: false,
        progress: 0
      } as FileAttachment & { progress?: number }
    };
    
    chatMessages[peerId] = [...chatMessages[peerId], message];
    
    // Store file info for chunk assembly
    const messageIndex = chatMessages[peerId].length - 1;
    
    incomingFiles[data.attachment.id] = {
      messageIndex,
      chunks: [],
      totalChunks: data.attachment.totalChunks,
      attachment: data.attachment
    };
  }
  
  // Handle file chunk
  function handleFileChunk(peerId: string, data: any) {
    const fileInfo = incomingFiles[data.attachmentId];
    if (!fileInfo) {
      console.error(`[${peerId}] No file info for chunk:`, data.attachmentId);
      return;
    }
    
    // Store chunk
    fileInfo.chunks[data.chunkIndex] = data.data;
    
    // Update progress
    const progress = Math.round((fileInfo.chunks.filter(c => c !== undefined).length / fileInfo.totalChunks) * 100);
    
    // Update message attachment
    const messages = chatMessages[peerId];
    if (messages && messages[fileInfo.messageIndex]) {
      messages[fileInfo.messageIndex].attachment = {
        ...messages[fileInfo.messageIndex].attachment!,
        progress
      } as FileAttachment & { progress?: number };
      chatMessages[peerId] = [...messages];
    }
    
    // Check if complete
    if (fileInfo.chunks.filter(c => c !== undefined).length === fileInfo.totalChunks) {
      // Reassemble file
      const completeData = fileInfo.chunks.join('');
      
      // Update message with complete file
      if (messages && messages[fileInfo.messageIndex]) {
        messages[fileInfo.messageIndex].attachment = {
          ...fileInfo.attachment,
          data: completeData,
          complete: true,
          progress: 100
        } as FileAttachment & { progress?: number };
        chatMessages[peerId] = [...messages];
      }
      
      // Clean up
      delete incomingFiles[data.attachmentId];
      
      console.log(`[${peerId}] File complete:`, fileInfo.attachment.name);
    }
  }
  
  // Incoming files tracking
  let incomingFiles: Record<string, {
    messageIndex: number;
    chunks: string[];
    totalChunks: number;
    attachment: FileAttachment;
  }> = {};
  
  // Show notification
  function showNotification(message: string) {
    notification = message;
    setTimeout(() => {
      notification = '';
    }, 3000);
  }
  
  // Show browser notification
  function showBrowserNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.png' });
    }
  }
  
  // Request notification permission
  async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        showNotification('Notifications enabled');
      }
    }
  }
  
  // Get current chat messages
  $: currentChatMessages = selectedFriendId ? (chatMessages[selectedFriendId] || []) : [];
  
  // Get selected friend
  $: selectedFriend = friends.find(f => f.peerId === selectedFriendId);
  
  // Update session storage debug info
  function updateSessionStorageDebugInfo() {
    if (!browser) return;
    
    try {
      const debugInfo = {
        accountPackage,
        backendUrl,
        accountName,
        myPeerId,
        friends,
        selectedFriendId,
        connectionStatus,
        connectedPeers: connectionManager?.getConnectedPeers() || [],
        lastUpdated: new Date().toISOString()
      };
      
      sessionStorage.setItem('friendsDebugInfo', JSON.stringify(debugInfo, null, 2));
    } catch (error) {
      console.warn('Failed to update debug info:', error);
    }
  }
  
  // Update countdowns for each friend
  function updateCountdowns() {
    handshakeIntervals.forEach((interval, peerId) => {
      // Assuming interval is set to 60 seconds, we can't get the exact time left
      // But we can approximate based on when it was started
      if (!handshakeCountdowns[peerId]) {
        handshakeCountdowns[peerId] = 60;
      } else {
        handshakeCountdowns[peerId] = Math.max(0, handshakeCountdowns[peerId] - 1);
        if (handshakeCountdowns[peerId] === 0) {
          handshakeCountdowns[peerId] = 60; // Reset after reaching 0
        }
      }
    });
  }
  
  // Start handshake loop for continuous connection attempts
  async function startHandshakeLoop() {
    if (handshakeLoopRunning) return;
    handshakeLoopRunning = true;
    
    while (handshakeLoopRunning) {
      // Check if all friends are connected
      const disconnectedFriends = friends.filter(f => !f.isConnected);
      if (disconnectedFriends.length === 0) {
        // All friends are connected, stop the loop
        handshakeLoopRunning = false;
        console.log('All friends connected, stopping handshake loop');
        break;
      }
      
      // Get current time
      const now = new Date();
      const seconds = now.getSeconds();
      const milliseconds = now.getMilliseconds();
      
      // Check if we're close to a full minute (within 0.5s)
      const isCloseToFullMinute = seconds === 0 && milliseconds < 500;
      // Check if we're close to 3 seconds after full minute (within 0.5s)
      const isCloseToThreeSecondsAfter = seconds === 3 && milliseconds < 500;
      
      for (const friend of disconnectedFriends) {
        const peerId = friend.peerId;
        const connection = connectionManager.getConnection(peerId);
        
        if (connection && (connection.isConnected || connection.isConnecting)) {
          continue; // Skip friends who are already connected or connecting
        }
        
        // Determine priority based on peer ID comparison
        const isHighPriority = myPeerId.localeCompare(peerId) > 0;
        
        // Calculate time until next attempt
        let nextAttemptSeconds;
        if (isHighPriority) {
          nextAttemptSeconds = seconds === 0 ? 60 : 60 - seconds;
        } else {
          nextAttemptSeconds = seconds <= 3 ? 3 - seconds : 63 - seconds;
        }
        handshakeCountdowns[peerId] = nextAttemptSeconds;
        
        if (isHighPriority && isCloseToFullMinute) {
          // High priority: Create and post offer at full minute
          console.log(`[${peerId}] Close to full minute, creating offer`);
          startHandshakeForFriend(peerId);
        } else if (!isHighPriority && isCloseToThreeSecondsAfter) {
          // Low priority: Check for offer and post answer at 3 seconds after full minute
          console.log(`[${peerId}] Close to 3s after full minute, checking for offer`);
          startHandshakeForFriend(peerId);
        }
      }
      
      // Sleep for 0.5s before next check
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Start auto-reconnect for all friends
  function startAutoReconnect() {
    // Only start auto-reconnect for disconnected friends
    friends.forEach(friend => {
      // If friend is already connected, don't interfere
      if (friend.isConnected) {
      return;
    }
    
      // Initialize countdown
      handshakeCountdowns[friend.peerId] = 60;
    });
    
    // Start the handshake loop if not already running
    if (!handshakeLoopRunning) {
      startHandshakeLoop();
    }
  }
  
  // Start auto-reconnect for a specific friend
  function startAutoReconnectForFriend(peerId: string) {
    // Clear existing interval for this friend if it exists
    const existingInterval = handshakeIntervals.get(peerId);
    if (existingInterval) {
      clearInterval(existingInterval);
      handshakeIntervals.delete(peerId);
    }
    
    // Check current connection state
    const connection = connectionManager.getConnection(peerId);
    if (connection && connection.isConnected) {
      console.log(`[${peerId}] Already connected, skipping auto-reconnect`);
      return;
    }
    
    // Initialize countdown
    handshakeCountdowns[peerId] = 60;
    
    // Start the handshake loop if not already running
    if (!handshakeLoopRunning) {
      startHandshakeLoop();
    }
  }
  
  // Start handshake process for a specific friend
  async function startHandshakeForFriend(peerId: string) {
    if (!myPeerId || !peerId) return;
    
    // Check if we're already trying to connect to this peer
    const existingConnection = connectionManager.getConnection(peerId);
    if (existingConnection && (existingConnection.isConnecting || existingConnection.isConnected)) {
      console.log(`[${peerId}] Connection already ${existingConnection.isConnected ? 'established' : 'in progress'}`);
      return;
    }
    
    // Close any existing failed connection before creating a new one
    if (existingConnection) {
      connectionManager.closeConnection(peerId);
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const connection = connectionManager.createConnection(peerId);
    
    try {
      // Determine priority based on peer ID comparison
      // Use consistent string comparison to ensure both peers make the same decision
      const isHighPriority = myPeerId.localeCompare(peerId) > 0;
      
      console.log(`[${peerId}] Handshake role: ${isHighPriority ? 'Initiator (create offer)' : 'Responder (wait for offer)'}`);
      console.log(`[${peerId}] My ID: ${myPeerId}, Friend ID: ${peerId}`);
      
      if (isHighPriority) {
        // Create and post offer to MY handshake server location
        const offer = await connection.createOffer();
        await postHandshake(peerId, 'offer', offer);
        
        // Wait for answer from peer's handshake data
        pollForHandshake(peerId, 'answer');
      } else {
        // Wait for offer from peer's handshake data
        pollForHandshake(peerId, 'offer');
      }
        } catch (error) {
      console.error(`[${peerId}] Handshake failed:`, error);
      updateFriendConnectionStatus(peerId, false);
    }
  }
  
  // Post handshake data to server using peer IDs
  async function postHandshake(peerId: string, type: 'offer' | 'answer', data: RTCSessionDescriptionInit) {
    try {
      // Create a unique key for this handshake session to avoid conflicts
      const sessionKey = `${type}_${Date.now()}`;
      const timestamp = new Date().toISOString();
      
      // The handshake data structure
      const handshakeData = {
        from: myPeerId,
        to: peerId,
        type: type,
        data: JSON.stringify(data),
        timestamp: timestamp,
        sessionKey: sessionKey
      };
      
      // PUT handshake data to MY scratchpad address
      const success = await putHandshakeData(myPeerId, handshakeData);
      
      if (!success) {
        throw new Error(`Failed to post ${type}`);
      }
      
      console.log(`[${peerId}] Posted ${type} to handshake server at ${myPeerId} with timestamp ${timestamp}`);
    } catch (error) {
      console.error(`[${peerId}] Failed to post ${type}:`, error);
      throw error;
    }
  }

  // Get handshake data from server
  async function getHandshakeData(scratchpadAddress: string): Promise<any> {
    try {
      const response = await fetch(`${handshakeServerUrl}/${scratchpadAddress}`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        return null;
      }
      
      const binaryData = await response.arrayBuffer();
      if (binaryData.byteLength === 0) {
        return null;
      }
      
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(binaryData);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Error getting handshake data:', error);
      return null;
    }
  }

  // Put handshake data to server
  async function putHandshakeData(scratchpadAddress: string, data: any): Promise<boolean> {
    try {
      const jsonData = JSON.stringify(data);
      const encoder = new TextEncoder();
      const binaryData = encoder.encode(jsonData);
      
      const response = await fetch(`${handshakeServerUrl}/${scratchpadAddress}`, {
        method: 'PUT',
        body: binaryData,
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });
      
      return response.ok;
      } catch (error) {
      console.error('Error putting handshake data:', error);
        return false;
      }
    }
    
  // Poll for handshake data from server
  async function pollForHandshake(peerId: string, expectedType: 'offer' | 'answer') {
    const maxAttempts = 30; // 30 seconds timeout
    let attempts = 0;
    let lastProcessedTimestamp = '';
    
    const pollInterval = setInterval(async () => {
      if (attempts++ > maxAttempts) {
        clearInterval(pollInterval);
        console.log(`[${peerId}] Handshake timeout waiting for ${expectedType}`);
        updateFriendConnectionStatus(peerId, false);
        return;
    }
    
    try {
        // GET handshake data from FRIEND's scratchpad
        const data = await getHandshakeData(peerId);
        
        if (!data) {
          return; // No data yet
        }
        
        // Check if this is the expected type and for us
        if (data.type === expectedType && data.to === myPeerId && data.from === peerId) {
          // Check if the data is recent (not older than 45 seconds)
          const dataTimestamp = new Date(data.timestamp).getTime();
          const currentTime = new Date().getTime();
          if (currentTime - dataTimestamp > 45000) {
            console.log(`[${peerId}] Ignoring outdated ${expectedType} with timestamp ${data.timestamp}`);
            return;
          }
          
          // Check if we've already processed this (avoid duplicates)
          if (data.timestamp === lastProcessedTimestamp) {
      return;
    }
    
          clearInterval(pollInterval);
          lastProcessedTimestamp = data.timestamp;
          
          const handshakeData = JSON.parse(data.data);
          const connection = connectionManager.getConnection(peerId);
          
          if (!connection) {
            console.error(`[${peerId}] No connection found for handshake`);
            return;
          }
          
          if (expectedType === 'offer') {
            // We received an offer, create and send answer
            const answer = await connection.createAnswer(handshakeData);
            await postHandshake(peerId, 'answer', answer);
            console.log(`[${peerId}] Received offer, sent answer`);
        } else {
            // We received an answer, set it as remote description
            await connection.setRemoteAnswer(handshakeData);
            console.log(`[${peerId}] Received and set answer`);
          }
      }
    } catch (error) {
        console.error(`[${peerId}] Poll error:`, error);
      }
    }, 1000);
  }
</script>

<div class="app">
  <!-- Loading overlay for account package fetching -->
  {#if isLoadingAccountPackage}
    <div class="loading-overlay">
      <div class="loading-content">
        <div class="spinner"></div>
        <p>Fetching account package...</p>
      </div>
    </div>
  {/if}

  <!-- Account creation modal -->
  {#if showAccountCreation}
    <div class="modal-overlay">
      <div class="modal-content">
        <h2>Create Account Package</h2>
        <p>No account package found. Would you like to create one?</p>
        
        <form on:submit|preventDefault={handleAccountCreation}>
          <!-- Show certificate error with clickable link -->
          {#if accountCreationError.includes('HTTPS certificate error detected')}
            <div class="certificate-error">
              <p><strong>🔒 HTTPS Certificate Issue Detected</strong></p>
              <p>The backend uses a self-signed certificate. Please click the link below to accept it:</p>
              <a href={backendUrl} target="_blank" rel="noopener noreferrer" class="certificate-link">
                {backendUrl}
              </a>
              <p><small>After accepting the certificate, close this window and try again.</small></p>
              <div class="modal-buttons">
                <button type="button" on:click={cancelAccountCreation} class="secondary-button">
                  Close
                </button>
                <button type="button" on:click={() => {
                  accountCreationError = '';
                  initializeBackend();
                }} class="primary-button">
                  Try Again
                </button>
              </div>
            </div>
          {:else}
          <div class="input-group">
            <label for="create-username">Username</label>
            <input 
              id="create-username"
                type="text"
              bind:value={accountCreationForm.username}
              placeholder="Enter your username"
              required
              />
          </div>
          
          <div class="input-group">
              <label for="create-profile-image">Profile Image (optional)</label>
            <input 
              id="create-profile-image"
                type="text"
              bind:value={accountCreationForm.profileImage}
                placeholder="Datamap address or URL"
              />
          </div>
          
          <div class="input-group">
              <label for="create-theme">Theme</label>
              <select id="create-theme" bind:value={accountCreationForm.themeUrl}>
                <option value="default">Default</option>
              </select>
          </div>
          
            {#if accountCreationError && !accountCreationError.includes('HTTPS')}
              <div class="error-message">
                {accountCreationError}
              </div>
          {/if}
          
          <div class="modal-buttons">
            <button type="button" on:click={cancelAccountCreation} class="secondary-button">
              Cancel
            </button>
            <button type="submit" class="primary-button" disabled={isLoadingAccountPackage}>
                Create Account
            </button>
          </div>
          {/if}
        </form>
      </div>
    </div>
  {/if}

  <StatusBar 
    appTitle="Friends"
    {connectionStatus}
    {handshakeStatus}
    {handshakeCountdown}
  />
  
  <div class="container">
    <div class="sidebar">
      <AccountSettings
        profileImage={accountPackage?.profileImage || ''}
        themeUrl={accountPackage?.themeUrl || ''}
        {language}
        {backendUrl}
        on:update={async ({detail}) => {
          if (accountPackage) {
            const success = await updateAccountPackage({
              ...accountPackage,
              [detail.field]: detail.value
            });
            if (success) {
              showNotification(t.settingsUpdated);
            }
          }
        }}
      />
      
      <FriendsList
        {friends}
        {selectedFriendId}
        {myPeerId}
        myUsername={accountPackage?.username || 'User'}
        {handshakeCountdowns}
        {language}
        on:selectFriend={handleSelectFriend}
        on:addFriend={handleAddFriend}
        on:removeFriend={handleRemoveFriend}
        on:notification={(e) => showNotification(e.detail)}
      />
        </div>
        
    <div class="main-content">
      <Chat
        messages={currentChatMessages}
        myNick={accountPackage?.username || 'User'}
        isConnected={selectedFriend?.isConnected || false}
        friendName={selectedFriend?.displayName || ''}
        friendPeerId={selectedFriend?.peerId || ''}
        {language}
        on:sendMessage={handleSendMessage}
        on:notification={(e) => showNotification(e.detail)}
      />
              </div>
                </div>
  
  {#if notification}
    <div class="notification">
      {notification}
                </div>
                  {/if}
                </div>

<style>
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }
  
  .loading-content {
    background: var(--background-color);
    padding: 2rem;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--foreground-color1);
    border-top-color: var(--notification-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }
  
  .modal-content {
    background: var(--background-color);
    padding: 2rem;
    border-radius: 12px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }
  
  .modal-content h2 {
    margin: 0 0 1rem 0;
  }
  
  .input-group {
    margin-bottom: 1rem;
  }
  
  .input-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  
  .input-group input,
  .input-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--line-color);
    border-radius: 6px;
    background: var(--background-color);
    color: inherit;
    font-size: 0.9rem;
  }
  
  .certificate-error {
    background: var(--foreground-color1);
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }
  
  .certificate-link {
    display: inline-block;
    margin: 0.5rem 0;
    color: var(--notification-color);
    text-decoration: underline;
  }
  
  .error-message {
    color: var(--notification-color);
    margin-bottom: 1rem;
    padding: 0.5rem;
    background: rgba(255, 0, 0, 0.1);
    border-radius: 4px;
  }
  
  .modal-buttons {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }
  
  .primary-button,
  .secondary-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .primary-button {
    background: var(--notification-color);
    color: white;
  }
  
  .secondary-button {
    background: var(--foreground-color2);
    color: var(--text-color);
  }
  
  .primary-button:hover:not(:disabled),
  .secondary-button:hover {
    opacity: 0.8;
  }
  
  .primary-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--notification-color);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease-out;
    z-index: 1000;
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .sidebar {
    display: flex;
    flex-direction: column;
    width: 300px;
    border-right: 1px solid var(--line-color);
  }
</style> 