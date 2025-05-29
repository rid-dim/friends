<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  // Import file handling components and utilities
  import FileUploader from './lib/file-handling/FileUploader.svelte';
  import AttachmentView from './lib/file-handling/AttachmentView.svelte';
  import type { FileAttachment } from './lib/file-handling/types';
  
  // Backend and account package related types and variables
  interface AccountPackage {
    username: string;
    profileImage?: string; // datamap address
    themeUrl?: string; // theme URL or identifier
  }
  
  // Backend related state
  let backendUrl = '';
  let accountName = ''; // Optional account name from query params
  let isLoadingAccountPackage = false;
  let accountPackage: AccountPackage | null = null;
  let showAccountCreation = false;
  let accountCreationForm = {
    username: '',
    profileImage: '',
    themeUrl: 'default'
  };
  let accountCreationError = '';
  
  // Public scratchpad for peer communication
  let myPeerId = ''; // scratchpad_address from public scratchpad
  let isLoadingPeerId = false;
  
  // WebRTC related variables
  let peerConnection: RTCPeerConnection | null = null;
  let dataChannel: RTCDataChannel | null = null;
  let isInitiator = false;
  
  // Simple heartbeat system for keeping connection alive
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let lastHeartbeatReceived = 0;
  let connectionCheckInterval: ReturnType<typeof setInterval> | null = null;
  let heartbeatsReceived = 0;
  let isTabVisible = true; // Track if tab is in foreground
  
  // WebAssembly heartbeat system - always active, much more efficient
  let wasmModule: WebAssembly.WebAssemblyInstantiatedSource | null = null;
  let wasmHeartbeatActive = false;
  let wasmHeartbeatCallback: ((timestamp: number) => void) | null = null;
  let wasmTimeoutId: ReturnType<typeof setTimeout> | null = null;
  
  let HEARTBEAT_INTERVAL = 5000; // Send heartbeat every 5 seconds (variable now)
  const CONNECTION_TIMEOUT = 15000; // Consider connection dead after 15 seconds without heartbeat
  
  // Connection states
  type ConnectionState = 'disconnected' | 'creating-offer' | 'waiting-for-answer' | 'waiting-for-offer' | 'processing-answer' | 'connecting' | 'connected' | 'failed';
  let connectionState: ConnectionState = 'disconnected';
  
  // Offer/Answer handling
  let localOffer = '';
  let remoteAnswer = '';
  let remoteOffer = '';
  let localAnswer = '';
  let showOfferAnswer = false;
  let offerRefreshInterval: ReturnType<typeof setInterval> | null = null;
  let offerCreatedAt = 0;
  
  // Chat messages
  let messages: Array<{
    nick: string, 
    text: string, 
    timestamp: Date, 
    isSelf: boolean, 
    attachment?: FileAttachment
  }> = [];
  
  // File attachment related variables
  let pendingAttachment: FileAttachment | null = null;
  let incomingFiles: Record<string, {
    messageIndex: number;
    chunks: string[];
    totalChunks: number;
    attachment: FileAttachment;
  }> = {};
  
  // UI state
  let config = {
    nick: 'User'
  };
  
  // Update nickname when account package is loaded
  $: if (accountPackage && accountPackage.username) {
    config.nick = accountPackage.username;
  }
  let messageInput = '';
  let notification = '';
  let themeUrl = 'default';
  let showConfig = true;
  let configWidth = 220;
  let isDragging = false;
  let messagesContainer: HTMLDivElement;
  
  // Notification support for background messages
  let notificationsEnabled = false;
  
  // Check localStorage for theme preference
  if (browser) {
    const storedTheme = localStorage.getItem('themeUrl');
    themeUrl = storedTheme || 'default';
  }
  
  // Parse backend URL from query parameters
  function parseBackendUrl(): string {
    if (!browser) return '';
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('backend') || '';
  }
  
  // Parse account name from query parameters
  function parseAccountName(): string {
    if (!browser) return '';
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('accountname') || '';
  }
  
  // Build scratchpad URL with optional object_name parameter
  function buildScratchpadUrl(): string {
    if (!backendUrl) return '';
    
    const baseUrl = `${backendUrl}/ant-0/scratchpad-private`;
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
    if (!backendUrl) return '';
    
    const objectName = buildCommObjectName();
    return `${backendUrl}/ant-0/scratchpad-public?object_name=${encodeURIComponent(objectName)}`;
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
  
  // Fetch account package from backend
  async function fetchAccountPackage(): Promise<AccountPackage | null> {
    if (!backendUrl) {
      console.log('🚫 No backend URL - skipping fetch');
      return null;
    }
    
    const url = buildScratchpadUrl();
    console.log('🌐 Fetching account package from:', url);
    if (accountName) {
      console.log('👤 Using account name:', accountName);
    }
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Ant-App-ID': 'friends'
        }
      });
      
      console.log('📡 Response status:', response.status, response.statusText);
      
      if (response.status === 404) {
        console.log('📭 Account package not found (404) - will offer creation');
        return null; // Account package doesn't exist yet
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const scratchpadData = await response.json();
      console.log('📦 Raw scratchpad data:', scratchpadData);
      
      // Extract account package from scratchpad format
      // Check if it's a single object (not array) or array format
      let chunk = null;
      if (Array.isArray(scratchpadData) && scratchpadData.length > 0) {
        // Array format
        chunk = scratchpadData[0];
        console.log('📦 Using array format, first chunk:', chunk);
      } else if (scratchpadData && scratchpadData.dweb_type === "PrivateScratchpad") {
        // Single object format
        chunk = scratchpadData;
        console.log('📦 Using single object format:', chunk);
      }
      
      if (chunk && chunk.unencrypted_data && Array.isArray(chunk.unencrypted_data)) {
        try {
          const accountPackage = byteArrayToJson(chunk.unencrypted_data);
          console.log('✅ Successfully extracted account package:', accountPackage);
          return accountPackage as AccountPackage;
        } catch (error) {
          console.error('❌ Error parsing unencrypted_data:', error);
          return null;
        }
      } else {
        console.warn('⚠️ No valid unencrypted_data found in scratchpad');
        console.warn('⚠️ Chunk structure:', chunk);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching account package:', error);
      
      // Check if this is likely an HTTPS certificate error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (backendUrl.startsWith('https://') && 
          (errorMessage.includes('Failed to fetch') || 
           errorMessage.includes('NetworkError') ||
           errorMessage.includes('SEC_ERROR') ||
           errorMessage.includes('SSL') ||
           errorMessage.includes('certificate'))) {
        
        console.log('🔒 Detected potential HTTPS certificate issue');
        
        // Set a special error state to show certificate acceptance dialog
        accountCreationError = `HTTPS certificate error detected. Please click here to accept the self-signed certificate: ${backendUrl}`;
        showAccountCreation = true;
        return null;
      }
      
      showNotification('Error fetching account package: ' + errorMessage);
      return null;
    }
  }
  
  // Create account package on backend
  async function createAccountPackage(accountData: AccountPackage): Promise<boolean> {
    if (!backendUrl) return false;
    
    console.log('💾 Creating account package:', accountData);
    
    try {
      // Convert account data to JSON string, then to byte array
      const accountJson = JSON.stringify(accountData);
      const accountBytes = jsonToByteArray(accountJson);
      
      // Wrap in scratchpad format
      const scratchpadPayload = {
        counter: 0,
        data_encoding: 0,
        dweb_type: "PrivateScratchpad",
        encryped_data: [0],
        scratchpad_address: "string",
        unencrypted_data: accountBytes
      };
      
      console.log('💾 Scratchpad payload:', scratchpadPayload);
      console.log('💾 Account bytes length:', accountBytes.length);
      
      const response = await fetch(buildScratchpadUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Ant-App-ID': 'friends'
        },
        body: JSON.stringify(scratchpadPayload)
      });
      
      console.log('📡 Create response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Create failed with response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('✅ Account package created successfully');
      return true;
    } catch (error) {
      console.error('❌ Error creating account package:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      accountCreationError = 'Error creating account: ' + errorMessage;
      return false;
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
      themeUrl: accountCreationForm.themeUrl.trim() || 'default'
    };
    
    const success = await createAccountPackage(accountData);
    
    if (success) {
      accountPackage = accountData;
      showAccountCreation = false;
      showNotification('Account package created successfully!');
    }
    
    isLoadingAccountPackage = false;
  }
  
  // Cancel account creation
  function cancelAccountCreation() {
    showAccountCreation = false;
    accountCreationForm = { username: '', profileImage: '', themeUrl: 'default' };
    accountCreationError = '';
  }
  
  // Initialize backend integration
  async function initializeBackend() {
    console.log('🔧 Initializing backend integration...');
    backendUrl = parseBackendUrl();
    accountName = parseAccountName();
    console.log('🔧 Parsed backend URL:', backendUrl || 'None provided');
    console.log('🔧 Parsed account name:', accountName || 'None provided');
    
    if (!backendUrl) {
      console.log('✅ No backend URL provided, using P2P mode only');
      return;
    }
    
    console.log('🔧 Backend URL detected:', backendUrl);
    console.log('🔄 Starting to fetch account package...');
    isLoadingAccountPackage = true;
    
    try {
      const fetchedPackage = await fetchAccountPackage();
      console.log('📦 Fetch result:', fetchedPackage);
      
      if (fetchedPackage) {
        accountPackage = fetchedPackage;
        
        // Load theme from account package if available
        if (fetchedPackage.themeUrl) {
          themeUrl = fetchedPackage.themeUrl;
          loadTheme(fetchedPackage.themeUrl);
          console.log('🎨 Loaded theme from account package:', fetchedPackage.themeUrl);
        }
        
        showNotification(`Welcome back, ${fetchedPackage.username}!`);
        console.log('✅ Account package loaded successfully:', fetchedPackage);
      } else {
        console.log('⚠️ No account package found (404 or error) - showing creation dialog');
        // 404 or error - offer to create account package
        showAccountCreation = true;
      }
    } catch (error) {
      console.error('❌ Error during backend initialization:', error);
    } finally {
      isLoadingAccountPackage = false;
      console.log('🔧 Backend initialization complete');
    }
    
    // Initialize peer communication after account package setup
    if (backendUrl) {
      await initializePeerCommunication();
    }
  }
  
  // Update account package on backend
  async function updateAccountPackage(updatedData: Partial<AccountPackage>): Promise<boolean> {
    if (!backendUrl || !accountPackage) return false;
    
    console.log('🔄 Updating account package with:', updatedData);
    
    // Merge updated data with existing account package
    const newAccountData: AccountPackage = {
      ...accountPackage,
      ...updatedData
    };
    
    try {
      // Convert account data to JSON string, then to byte array
      const accountJson = JSON.stringify(newAccountData);
      const accountBytes = jsonToByteArray(accountJson);
      
      // Wrap in scratchpad format
      const scratchpadPayload = {
        counter: 0,
        data_encoding: 0,
        dweb_type: "PrivateScratchpad",
        encryped_data: [0],
        scratchpad_address: "string",
        unencrypted_data: accountBytes
      };
      
      // Use PUT for updating existing scratchpad
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
      
      // Update local account package
      accountPackage = newAccountData;
      console.log('✅ Account package updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating account package:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showNotification('Error updating account package: ' + errorMessage);
      return false;
    }
  }
  
  function loadTheme(url: string) {
    // Remove existing theme link if any
    const existingThemeLink = document.getElementById('dynamic-theme');
    if (existingThemeLink) {
      existingThemeLink.remove();
    }
    
    // Remove friends class when removing themes
    document.documentElement.classList.remove('friends');
    
    if (url === 'default') {
      // No external theme, use built-in light theme
      return;
    }
    
    // Determine full URL for theme loading
    let themeFullUrl: string;
    if (url.startsWith('http')) {
      // Full URL provided
      themeFullUrl = url;
    } else {
      // Datamap address - construct URL using backend
      themeFullUrl = `${backendUrl}/ant-0/data/${url}`;
    }
    
    // Create and append new theme link
    const themeLink = document.createElement('link');
    themeLink.id = 'dynamic-theme';
    themeLink.rel = 'stylesheet';
    themeLink.href = themeFullUrl;
    
    themeLink.onload = () => {
      console.log('✅ Theme loaded successfully:', themeFullUrl);
      // Apply friends class for external themes
      document.documentElement.classList.add('friends');
      
      // Initialize theme background if theme defines one - now that CSS is fully loaded
      initializeThemeBackground();
      
      showNotification('Theme loaded successfully');
    };
    
    themeLink.onerror = () => {
      console.error('❌ Failed to load theme:', themeFullUrl);
      showNotification('Failed to load theme: ' + themeFullUrl);
    };
    
    document.head.appendChild(themeLink);
  }
  
  function handleThemeChange() {
    loadTheme(themeUrl);
    
    // Save theme to account package if available
    if (accountPackage && backendUrl) {
      updateAccountPackage({ themeUrl: themeUrl });
      console.log('🎨 Saved theme to account package:', themeUrl);
    }
    
    // Also save to localStorage as fallback
    if (browser) {
      localStorage.setItem('themeUrl', themeUrl);
    }
  }
  
  // Set theme background image dynamically
  function setThemeBackground(datamapAddress: string) {
    if (!browser) return;
    
    // Construct the full URL using backend address
    let backgroundUrl: string;
    if (datamapAddress.startsWith('http')) {
      // Full URL provided
      backgroundUrl = datamapAddress;
    } else {
      // Datamap address - construct full URL
      backgroundUrl = `${backendUrl}/ant-0/data/${datamapAddress}`;
    }
    
    // Set CSS custom property for theme background
    document.documentElement.style.setProperty(
      '--theme-background-url', 
      `url('${backgroundUrl}')`
    );
    
    console.log('🌌 Theme background set to:', backgroundUrl);
  }

  // Initialize theme background on load
  function initializeThemeBackground() {
    if (!browser) return;
    
    // Read datamap address from CSS custom property
    const rootStyle = getComputedStyle(document.documentElement);
    const datamapAddress = rootStyle.getPropertyValue('--theme-background-datamap').trim().replace(/['"]/g, '');
    
    if (datamapAddress && datamapAddress !== '') {
      console.log('📄 Reading theme background datamap from CSS:', datamapAddress);
      setThemeBackground(datamapAddress);
    } else {
      console.log('⚠️ No theme background datamap found in CSS');
    }
  }
  
  function scrollToBottom() {
    if (messagesContainer) {
      setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 10);
    }
  }
  
  // WebRTC Configuration optimized for localhost testing
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      // Only use reliable STUN servers for localhost
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
    // Removed iceTransportPolicy to allow both STUN and host candidates
  };
  
  // Initialize WebRTC peer connection
  function initializePeerConnection() {
    if (!browser) return;
    
    console.log('Initializing PeerConnection with config:', rtcConfig);
    peerConnection = new RTCPeerConnection(rtcConfig);
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      console.log('ICE candidate event:', event);
      if (event.candidate) {
        console.log('New ICE Candidate:', event.candidate);
      } else {
        console.log('ICE gathering completed');
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state changed to:', peerConnection?.connectionState);
      switch (peerConnection?.connectionState) {
        case 'connected':
          connectionState = 'connected';
          showNotification('WebRTC connected!');
          break;
        case 'disconnected':
        case 'failed':
          connectionState = 'failed';
          console.error('WebRTC connection failed or disconnected');
          showNotification('WebRTC disconnected');
          break;
        case 'connecting':
          connectionState = 'connecting';
          console.log('WebRTC connecting...');
          break;
      }
    };
    
    // Handle ICE connection state changes (more detailed than connectionState)
    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection?.iceConnectionState;
      console.log('ICE connection state:', iceState);
      
      switch (iceState) {
        case 'connected':
        case 'completed':
          console.log('ICE connection established/optimized successfully!');
          break;
        case 'disconnected':
          console.warn('ICE connection temporarily disconnected - may recover');
          // Don't immediately fail, give it a chance to reconnect
          setTimeout(() => {
            if (peerConnection?.iceConnectionState === 'disconnected') {
              console.error('ICE connection remained disconnected - connection likely dead');
              connectionState = 'failed';
              showNotification('Connection lost. ICE connection failed.');
              stopConnectionMonitoring();
            }
          }, 10000); // Wait 10 seconds before declaring it dead
          break;
        case 'failed':
          console.error('ICE connection failed permanently!');
          console.error('- Firewall is blocking WebRTC');
          console.error('- No TURN server available for relay');
          console.error('- Check about:webrtc in Firefox for details');
          showNotification('ICE connection failed. Check firewall settings or try a different browser.');
          connectionState = 'failed';
          stopConnectionMonitoring();
          break;
        case 'closed':
          console.log('ICE connection closed');
          connectionState = 'disconnected';
          stopConnectionMonitoring();
          break;
      }
    };
    
    // Handle signaling state changes
    peerConnection.onsignalingstatechange = () => {
      console.log('Signaling state:', peerConnection?.signalingState);
    };
    
    // Handle incoming data channel (for receiver)
    peerConnection.ondatachannel = (event) => {
      console.log('Incoming data channel:', event.channel);
      const channel = event.channel;
      setupDataChannel(channel);
    };
    
    return peerConnection;
  }
  
  // Setup data channel for messaging
  function setupDataChannel(channel: RTCDataChannel) {
    dataChannel = channel;
    
    channel.onopen = () => {
      console.log('Data channel opened');
      connectionState = 'connected';
      startConnectionMonitoring();
    };
    
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleIncomingMessage(data);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    
    channel.onclose = () => {
      console.log('Data channel closed');
      connectionState = 'failed';
      showNotification('Connection lost. DataChannel closed.');
      stopConnectionMonitoring();
    };
    
    channel.onerror = (error) => {
      console.error('Data channel error:', error);
      connectionState = 'failed';
      showNotification('Connection error occurred.');
      stopConnectionMonitoring();
    };
    
    // Monitor buffered amount to detect congestion
    setInterval(() => {
      if (channel.readyState === 'open' && channel.bufferedAmount > 0) {
        console.log('DataChannel buffered amount:', channel.bufferedAmount);
      }
    }, 10000);
  }
  
  // Start WebRTC native connection monitoring (no manual heartbeats needed!)
  function startConnectionMonitoring() {
    console.log('🔗 Starting WebRTC native connection monitoring');
    
    if (!peerConnection) {
      console.warn('No peer connection available for monitoring');
      return;
    }
    
    // Monitor ICE connection state changes
    peerConnection.addEventListener('iceconnectionstatechange', () => {
      const iceState = peerConnection?.iceConnectionState;
      console.log(`🧊 ICE Connection State: ${iceState}`);
      
      switch (iceState) {
        case 'connected':
        case 'completed':
          connectionState = 'connected';
          console.log('✅ WebRTC connection established');
          break;
          
        case 'disconnected':
          console.warn('⚠️ WebRTC connection temporarily disconnected');
          connectionState = 'connecting'; // Don't immediately fail, might reconnect
          showNotification('Connection temporarily lost, trying to reconnect...');
          break;
          
        case 'failed':
          console.error('❌ WebRTC connection failed');
          connectionState = 'failed';
          showNotification('Connection failed. Please reload page.');
          stopConnectionMonitoring();
          break;
          
        case 'closed':
          console.log('🔒 WebRTC connection closed');
          connectionState = 'failed';
          stopConnectionMonitoring();
          break;
      }
    });
    
    // Monitor overall connection state (newer API, more reliable)
    peerConnection.addEventListener('connectionstatechange', () => {
      const connState = peerConnection?.connectionState;
      console.log(`🔗 Overall Connection State: ${connState}`);
      
      switch (connState) {
        case 'connected':
          connectionState = 'connected';
          console.log('✅ WebRTC peer connection fully established');
          break;
          
        case 'disconnected':
          console.warn('⚠️ WebRTC peer connection disconnected');
          connectionState = 'connecting';
          showNotification('Connection lost, attempting to reconnect...');
          break;
          
        case 'failed':
          console.error('❌ WebRTC peer connection failed');
          connectionState = 'failed';
          showNotification('Connection failed. Please reload page.');
          stopConnectionMonitoring();
          break;
          
        case 'closed':
          console.log('🔒 WebRTC peer connection closed');
          connectionState = 'failed';
          stopConnectionMonitoring();
          break;
      }
    });
    
    // Optional: Check DataChannel state periodically (lightweight)
    if (connectionCheckInterval) clearInterval(connectionCheckInterval);
    connectionCheckInterval = setInterval(() => {
      checkDataChannelHealth();
    }, 5000);
  }
  
  // Stop connection monitoring
  function stopConnectionMonitoring() {
    console.log('🔗 Stopping WebRTC connection monitoring');
    
    if (connectionCheckInterval) {
      clearInterval(connectionCheckInterval);
      connectionCheckInterval = null;
    }
  }
  
  // Simple DataChannel health check (no manual heartbeats!)
  function checkDataChannelHealth() {
    if (!dataChannel) {
      console.warn('No DataChannel available');
      return;
    }
    
    const readyState = dataChannel.readyState;
    
    if (readyState !== 'open') {
      console.warn(`DataChannel not open: ${readyState}`);
      
      if (readyState === 'closed' || readyState === 'closing') {
        connectionState = 'failed';
        showNotification('DataChannel closed unexpectedly.');
        stopConnectionMonitoring();
      }
    }
    
    // Check for severe congestion (this is still useful)
    if (dataChannel.bufferedAmount > 10000) { // 10KB threshold
      console.warn(`DataChannel severely congested: ${dataChannel.bufferedAmount} bytes buffered`);
      showNotification('Connection experiencing congestion...');
    }
  }
  
  // Start as initiator (create offer)
  async function startAsInitiator() {
    if (!browser) return;
    
    isInitiator = true;
    showOfferAnswer = true;
    connectionState = 'creating-offer';
    
    const pc = initializePeerConnection();
    if (!pc) return;
    
    // Create data channel
    dataChannel = pc.createDataChannel('chat', {
      ordered: true
    });
    setupDataChannel(dataChannel);
    
    try {
      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
              resolve();
            }
          };
        }
      });
      
      localOffer = JSON.stringify(pc.localDescription);
      connectionState = 'waiting-for-answer';
      showNotification('Offer created! Share it with your peer.');
      
      offerCreatedAt = Date.now();
      startOfferRefresh();
      
    } catch (error) {
      console.error('Error creating offer:', error);
      connectionState = 'failed';
      showNotification('Error creating offer');
    }
  }
  
  // Start as receiver (wait for offer)
  function startAsReceiver() {
    isInitiator = false;
    showOfferAnswer = true;
    connectionState = 'waiting-for-offer';
    initializePeerConnection();
  }
  
  // Process received offer and create answer
  async function processOffer() {
    if (!peerConnection || !remoteOffer.trim()) return;
    
    try {
      connectionState = 'processing-answer';
      
      const offer = JSON.parse(remoteOffer);
      await peerConnection.setRemoteDescription(offer);
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (peerConnection!.iceGatheringState === 'complete') {
          resolve();
        } else {
          peerConnection!.onicegatheringstatechange = () => {
            if (peerConnection!.iceGatheringState === 'complete') {
              resolve();
            }
          };
        }
      });
      
      localAnswer = JSON.stringify(peerConnection.localDescription);
      connectionState = 'connecting';
      showNotification('Answer created! Share it with your peer.');
      
    } catch (error) {
      console.error('Error processing offer:', error);
      connectionState = 'failed';
      showNotification('Error processing offer');
    }
  }
  
  // Process received answer
  async function processAnswer() {
    if (!peerConnection || !remoteAnswer.trim()) return;
    
    try {
      const answer = JSON.parse(remoteAnswer);
      await peerConnection.setRemoteDescription(answer);
      
      connectionState = 'connecting';
      showNotification('Answer processed! Connecting...');
      stopOfferRefresh(); // Stop refresh since we're now connecting
      
    } catch (error) {
      console.error('Error processing answer:', error);
      connectionState = 'failed';
      showNotification('Error processing answer');
      stopOfferRefresh();
    }
  }
  
  // Send chat message
  function sendMessage() {
    if (!dataChannel || dataChannel.readyState !== 'open' || (!messageInput.trim() && !pendingAttachment)) {
      return;
    }
    
    const messageData = {
      type: 'chat',
      nick: config.nick,
      message: messageInput.trim(),
      attachment: pendingAttachment,
      timestamp: new Date().toISOString()
    };
    
    // Add to local messages immediately
    messages = [...messages, {
      nick: config.nick,
      text: messageInput.trim(),
      timestamp: new Date(),
      isSelf: true,
      attachment: pendingAttachment || undefined
    }];
    
    // Send via data channel
    try {
      const messageJson = JSON.stringify(messageData);
      
      // If message is small enough, send directly
      if (messageJson.length <= 15000) {
        dataChannel.send(messageJson);
        console.log('Message sent directly:', messageData);
      } 
      // If message is too large (due to attachment), send in chunks
      else if (pendingAttachment && pendingAttachment.data) {
        sendLargeFileInChunks(messageData, pendingAttachment);
      } 
      else {
        showNotification('Message too large to send');
      return;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showNotification('Error sending message: ' + error);
    }
    
    // Clear input
    messageInput = '';
    pendingAttachment = null;
    scrollToBottom();
  }
  
  // Send large files by chunking the base64 data
  function sendLargeFileInChunks(messageData: any, attachment: FileAttachment) {
    if (!dataChannel || !attachment.data) return;
    
    console.log('Sending large file in chunks:', attachment.name);
    
    // Calculate chunk size for base64 data (leave room for JSON overhead)
    const maxDataPerChunk = 12000; // ~12KB of base64 data per chunk
    const base64Data = attachment.data;
    const totalChunks = Math.ceil(base64Data.length / maxDataPerChunk);
    
    // Send file metadata first
    const metadataMessage = {
      type: 'file-start',
      nick: messageData.nick,
      message: messageData.message,
      attachment: {
        ...attachment,
        data: undefined, // Don't send data in metadata
        totalChunks: totalChunks
      },
      timestamp: messageData.timestamp
    };
    
    dataChannel.send(JSON.stringify(metadataMessage));
    console.log(`Starting file transfer: ${attachment.name} (${totalChunks} chunks)`);
    
    // Send chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * maxDataPerChunk;
      const end = Math.min(start + maxDataPerChunk, base64Data.length);
      const chunkData = base64Data.slice(start, end);
      
      const chunkMessage = {
        type: 'file-chunk',
        attachmentId: attachment.id,
        chunkIndex: i,
        totalChunks: totalChunks,
        data: chunkData,
        timestamp: new Date().toISOString()
      };
      
      // Send chunk with small delay to avoid overwhelming
      setTimeout(() => {
        if (dataChannel && dataChannel.readyState === 'open') {
          dataChannel.send(JSON.stringify(chunkMessage));
          console.log(`Sent chunk ${i + 1}/${totalChunks} for ${attachment.name}`);
        }
      }, i * 50); // 50ms delay between chunks
    }
    
    showNotification(`Sending file: ${attachment.name} (${totalChunks} chunks)`);
  }
  
  // Copy text to clipboard
  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showNotification('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      showNotification('Failed to copy');
    }
  }
  
  // Reset connection
  function resetConnection() {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (dataChannel) {
      dataChannel.close();
      dataChannel = null;
    }
    
    stopOfferRefresh(); // Stop any running offer refresh
    
    connectionState = 'disconnected';
    showOfferAnswer = false;
    localOffer = '';
    remoteAnswer = '';
    remoteOffer = '';
    localAnswer = '';
    offerCreatedAt = 0;
    messages = [];
    incomingFiles = {};
    
    // No more manual heartbeat tracking needed - using native WebRTC monitoring
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
  
  function showNotification(message: string) {
    notification = message;
    setTimeout(() => {
      notification = '';
    }, 3000);
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
      const newWidth = Math.max(200, Math.min(500, event.clientX));
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
  
  $: if (messages.length) {
    scrollToBottom();
  }
  
  // Start automatic offer refresh to keep NAT ports alive
  function startOfferRefresh() {
    console.log('Starting automatic offer refresh (every 45s) to prevent NAT timeouts');
    
    if (offerRefreshInterval) {
      clearInterval(offerRefreshInterval);
    }
    
    offerRefreshInterval = setInterval(async () => {
      if (connectionState === 'waiting-for-answer' && peerConnection) {
        const ageInSeconds = (Date.now() - offerCreatedAt) / 1000;
        console.log(`Refreshing offer after ${ageInSeconds.toFixed(0)}s to prevent NAT timeout`);
        
        try {
          // Create fresh offer with new ICE candidates
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          
          // Wait for ICE gathering to complete
          await new Promise<void>((resolve) => {
            if (peerConnection!.iceGatheringState === 'complete') {
              resolve();
      } else {
              peerConnection!.onicegatheringstatechange = () => {
                if (peerConnection!.iceGatheringState === 'complete') {
                  resolve();
                }
              };
            }
          });
          
          localOffer = JSON.stringify(peerConnection.localDescription);
          offerCreatedAt = Date.now();
          showNotification('Offer refreshed! Please share the new offer.');
          
        } catch (error) {
          console.error('Error refreshing offer:', error);
        }
      }
    }, 45000); // Refresh every 45 seconds
  }
  
  // Stop offer refresh
  function stopOfferRefresh() {
    if (offerRefreshInterval) {
      clearInterval(offerRefreshInterval);
      offerRefreshInterval = null;
      console.log('Stopped automatic offer refresh');
    }
  }
  
  // Handle page visibility changes - simplified version (native WebRTC monitoring)
  function handleVisibilityChange() {
    if (!browser) return;
    
    const wasVisible = isTabVisible;
    isTabVisible = !document.hidden;
    
    if (wasVisible && !isTabVisible) {
      console.log('🔄 Tab went to background - native WebRTC monitoring continues');
    } else if (!wasVisible && isTabVisible) {
      console.log('✅ Tab back to foreground - native WebRTC monitoring active');
    }
  }
  
  // Setup page visibility monitoring - simplified
  function setupVisibilityMonitoring() {
    if (!browser) return;
    
    // Initial state
    isTabVisible = !document.hidden;
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    console.log('📡 Page visibility monitoring enabled');
  }
  
  // WASM heartbeat functions - now simplified since we use native WebRTC monitoring
  async function initializeWasmHeartbeat() {
    console.log('🔗 Using native WebRTC connection monitoring instead of WASM heartbeat');
    return false; // Always return false to use native monitoring
  }
  
  // Start WebAssembly heartbeat system - no longer needed, using native WebRTC monitoring
  function startWasmHeartbeat() {
    console.log('🔗 Using native WebRTC connection monitoring instead of WASM heartbeat');
    // WASM heartbeat is no longer needed - WebRTC handles connection monitoring natively
  }
  
  // Stop WebAssembly heartbeat system
  function stopWasmHeartbeat() {
    console.log('🔗 Native WebRTC connection monitoring active');
    // No action needed - using native WebRTC connection state monitoring
  }
  
  // Handle incoming messages (no heartbeat handling needed anymore)
  function handleIncomingMessage(data: any) {
    if (data.type === 'chat') {
      messages = [...messages, {
        nick: data.nick,
        text: data.message,
        timestamp: new Date(),
        isSelf: false,
        attachment: data.attachment
      }];
      
      // Show desktop notification if tab is in background
      showDesktopNotification(data.nick, data.message, !!data.attachment);
      
      scrollToBottom();
    } else if (data.type === 'file-start') {
      // Handle file-start - create a new message with incomplete attachment
      const messageIndex = messages.length;
      messages = [...messages, {
        nick: data.nick,
        text: data.message,
        timestamp: new Date(),
        isSelf: false,
        attachment: { ...data.attachment, complete: false }
      }];
      
      // Show notification for file start
      showDesktopNotification(data.nick, data.message || 'Started sending a file', true);
      
      // Initialize file reception tracking
      incomingFiles[data.attachment.id] = {
        messageIndex,
        chunks: new Array(data.attachment.totalChunks),
        totalChunks: data.attachment.totalChunks,
        attachment: data.attachment
      };
      
      console.log(`Started receiving file: ${data.attachment.name} (${data.attachment.totalChunks} chunks)`);
      scrollToBottom();
    } else if (data.type === 'file-chunk') {
      // Handle file-chunk - collect chunks and update the message when complete
      const incomingFile = incomingFiles[data.attachmentId];
      if (!incomingFile) {
        console.warn('Received chunk for unknown file:', data.attachmentId);
        return;
      }
      
      // Store the chunk
      incomingFile.chunks[data.chunkIndex] = data.data;
      
      // Check if all chunks are received
      const receivedChunks = incomingFile.chunks.filter(chunk => chunk !== undefined).length;
      console.log(`Received chunk ${receivedChunks}/${incomingFile.totalChunks} for file ${incomingFile.attachment.name}`);
      
      // Update message to show progress
      messages = messages.map((msg, i) => {
        if (i === incomingFile.messageIndex) {
          return {
            ...msg,
            attachment: {
              ...incomingFile.attachment,
              complete: false,
              name: `${incomingFile.attachment.name} (${receivedChunks}/${incomingFile.totalChunks})`
            }
          };
        }
        return msg;
      });
      
      // If all chunks received, reassemble the file
      if (receivedChunks === incomingFile.totalChunks) {
        const completeData = incomingFile.chunks.join('');
        
        // Update the message with complete attachment
        messages = messages.map((msg, i) => {
          if (i === incomingFile.messageIndex) {
            return {
              ...msg,
              attachment: {
                ...incomingFile.attachment,
                data: completeData,
                complete: true
              }
            };
          }
          return msg;
        });
        
        delete incomingFiles[data.attachmentId];
        console.log(`File received completely: ${incomingFile.attachment.name}`);
        
        // Show notification when file is complete (only if tab is in background)
        if (!isTabVisible && notificationsEnabled) {
          showNotification(`📎 File received: ${incomingFile.attachment.name}`);
        }
        
        scrollToBottom();
      }
    }
  }
  
  // Request notification permission
  async function requestNotificationPermission() {
    if (!browser || !('Notification' in window)) {
      console.log('Browser does not support notifications');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      notificationsEnabled = true;
      return true;
    }
    
    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        notificationsEnabled = permission === 'granted';
        
        if (notificationsEnabled) {
          showNotification('🔔 Desktop notifications enabled!');
        } else {
          showNotification('⚠️ Desktop notifications blocked');
        }
        
        return notificationsEnabled;
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
      }
    }
    
    return false;
  }
  
  // Show desktop notification for new messages
  function showDesktopNotification(senderNick: string, messageText: string, hasAttachment: boolean = false) {
    if (!notificationsEnabled || !browser || isTabVisible) {
      return; // Don't show if notifications disabled, not in browser, or tab is visible
    }
    
    try {
      const title = `💬 New message from ${senderNick}`;
      let body = messageText;
      
      if (hasAttachment && !messageText.trim()) {
        body = '📎 Sent a file';
      } else if (hasAttachment && messageText.trim()) {
        body = `${messageText} 📎`;
      }
      
      // Limit body length for better display
      if (body.length > 100) {
        body = body.substring(0, 97) + '...';
      }
      
      const notificationOptions: NotificationOptions = {
        body: body,
        icon: '/favicon.png', // Use your app's favicon
        badge: '/favicon.png',
        tag: 'p2pchat-message', // Prevents spam by replacing previous notifications
        requireInteraction: false,
        silent: false
      };
      
      const desktopNotification = new Notification(title, notificationOptions);
      
      // Focus window when notification is clicked
      desktopNotification.onclick = () => {
        window.focus();
        desktopNotification.close();
      };
      
      // Auto-close after 5 seconds
      setTimeout(() => {
        desktopNotification.close();
      }, 5000);
      
      console.log(`🔔 Desktop notification shown: ${title}`);
      
    } catch (error) {
      console.error('Error showing desktop notification:', error);
    }
  }
  
  // Initialize public scratchpad for peer communication
  async function initializePeerCommunication(): Promise<void> {
    if (!backendUrl) {
      console.log('🚫 No backend URL - skipping peer communication setup');
      return;
    }
    
    const url = buildPublicScratchpadUrl();
    const commObjectName = buildCommObjectName();
    console.log('🌐 Initializing peer communication:', url);
    console.log('📡 Communication object name:', commObjectName);
    
    isLoadingPeerId = true;
    
    try {
      // Try to GET existing public scratchpad
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Ant-App-ID': 'friends'
        }
      });
      
      console.log('📡 Public scratchpad response status:', response.status);
      
      if (response.ok) {
        // Extract scratchpad_address from existing scratchpad
        const scratchpadData = await response.json();
        console.log('📦 Public scratchpad data:', scratchpadData);
        
        let chunk = null;
        if (Array.isArray(scratchpadData) && scratchpadData.length > 0) {
          chunk = scratchpadData[0];
        } else if (scratchpadData && scratchpadData.dweb_type === "PublicScratchpad") {
          chunk = scratchpadData;
        }
        
        if (chunk && chunk.scratchpad_address) {
          myPeerId = chunk.scratchpad_address;
          console.log('✅ Retrieved peer ID:', myPeerId);
        } else {
          console.warn('⚠️ No valid scratchpad_address found');
        }
      } else if (response.status === 404) {
        // Create new public scratchpad
        console.log('📭 Public scratchpad not found, creating new one...');
        await createPublicScratchpad();
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Error initializing peer communication:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showNotification('Error initializing peer communication: ' + errorMessage);
    } finally {
      isLoadingPeerId = false;
    }
  }
  
  // Create new public scratchpad for peer communication
  async function createPublicScratchpad(): Promise<void> {
    if (!backendUrl) return;
    
    const url = buildPublicScratchpadUrl();
    console.log('💾 Creating public scratchpad at:', url);
    
    try {
      // Create basic peer info data
      const peerInfo = {
        type: 'peer-communication',
        createdAt: new Date().toISOString(),
        accountName: accountName || null
      };
      
      const peerInfoJson = JSON.stringify(peerInfo);
      const peerInfoBytes = jsonToByteArray(peerInfoJson);
      
      // Wrap in public scratchpad format
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
      console.log('✅ Created public scratchpad:', createdScratchpad);
      
      // Extract scratchpad_address from created scratchpad
      if (createdScratchpad && createdScratchpad.scratchpad_address) {
        myPeerId = createdScratchpad.scratchpad_address;
        console.log('✅ New peer ID:', myPeerId);
      }
    } catch (error) {
      console.error('❌ Error creating public scratchpad:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showNotification('Error creating public scratchpad: ' + errorMessage);
    }
  }
  
  onMount(() => {
    // Initialize backend integration first
    initializeBackend();
    
    // Initialize background throttling countermeasures
    setupVisibilityMonitoring();
    
    // Load saved theme
    if (themeUrl && themeUrl !== 'default') {
      loadTheme(themeUrl);
    }
    
    // Check notification permissions on startup
    if (browser && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        notificationsEnabled = true;
        console.log('🔔 Desktop notifications are available');
      } else {
        console.log('🔔 Desktop notifications need permission');
      }
    }
    
    return () => {
      resetConnection();
      stopOfferRefresh();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResize);
    };
  });
</script>

<main>
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
              bind:value={accountCreationForm.username}
              placeholder="Enter your username"
              required
            >
          </div>
          
          <div class="input-group">
            <label for="create-profile-image">Profile Image (datamap address)</label>
            <input 
              id="create-profile-image"
              bind:value={accountCreationForm.profileImage}
              placeholder="Optional: datamap address for profile image"
            >
            {#if accountCreationForm.profileImage && backendUrl}
              <div class="profile-image-preview">
                <img 
                  src="{backendUrl}/ant-0/data/{accountCreationForm.profileImage}"
                  alt="Profile preview"
                  on:error={() => {
                    showNotification('Failed to load profile image');
                  }}
                />
              </div>
            {/if}
          </div>
          
          <div class="input-group">
            <label for="create-theme-url">Theme URL</label>
            <input 
              id="create-theme-url"
              bind:value={accountCreationForm.themeUrl}
              placeholder="Optional: theme URL"
            >
          </div>
          
          {#if accountCreationError}
            <div class="error-message">{accountCreationError}</div>
          {/if}
          
          <div class="modal-buttons">
            <button type="button" on:click={cancelAccountCreation} class="secondary-button">
              Cancel
            </button>
            <button type="submit" class="primary-button" disabled={isLoadingAccountPackage}>
              {isLoadingAccountPackage ? 'Creating...' : 'Create Account'}
            </button>
          </div>
          {/if}
        </form>
      </div>
    </div>
  {/if}

  <div class="container" class:blurred={isLoadingAccountPackage}>
    <div class="burger-menu" on:click={toggleConfig} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && toggleConfig()}>
      ☰
    </div>

    {#if showConfig}
      <div class="config" style="width: {configWidth}px;">
        <h2>Settings</h2>
        
        <!-- Account Package Info -->
        {#if accountPackage}
          <div class="account-package-info">
            <h3>Account Package</h3>
            <div class="account-details">
              <div class="account-field">
                <strong>Username:</strong> {accountPackage.username}
              </div>
              {#if accountPackage.profileImage}
                <div class="account-field">
                  <strong>Profile Image:</strong>
                  <div class="profile-image-display">
                    <img 
                      src="{backendUrl}/ant-0/data/{accountPackage.profileImage}"
                      alt="Profile"
                      on:error={() => {
                        showNotification('Failed to load profile image');
                      }}
                    />
                    <span class="datamap-address">{accountPackage.profileImage}</span>
                  </div>
                </div>
              {/if}
              {#if accountPackage.themeUrl}
                <div class="account-field">
                  <strong>Theme:</strong> {accountPackage.themeUrl}
                </div>
              {/if}
              {#if backendUrl}
                <div class="account-field">
                  <strong>Backend:</strong> {backendUrl}
                </div>
              {/if}
              {#if accountName}
                <div class="account-field">
                  <strong>Account Name:</strong> {accountName}
                </div>
              {/if}
            </div>
          </div>
        {:else if backendUrl}
          <div class="account-package-info">
            <h3>Account Package</h3>
            <p class="no-account">No account package configured</p>
            <button on:click={() => showAccountCreation = true} class="primary-button">
              Create Account Package
            </button>
          </div>
        {/if}

        <!-- User Profile Display -->
        {#if accountPackage}
          <div class="user-profile">
            <div class="profile-header">
              {#if accountPackage.profileImage && backendUrl}
                <img 
                  src="{backendUrl}/ant-0/data/{accountPackage.profileImage}"
                  alt="Profile"
                  class="profile-avatar"
                  on:error={() => {
                    showNotification('Failed to load profile image');
                  }}
                />
              {:else}
                <div class="profile-avatar-placeholder">
                  {accountPackage.username.charAt(0).toUpperCase()}
                </div>
              {/if}
              <div class="profile-info">
                <h3 class="profile-name">{accountPackage.username}</h3>
                <p class="profile-status">Connected via account package</p>
              </div>
            </div>
          </div>
        {:else}
          <div class="input-group">
            <label for="nick">Nickname</label>
            <input id="nick" bind:value={config.nick} placeholder="Your Name">
            {#if backendUrl}
              <small class="help-text">Will be replaced when account package is loaded</small>
            {/if}
          </div>
        {/if}
        
        <div class="input-group">
          <label for="theme">Theme</label>
          <input 
            id="theme" 
            type="text" 
            bind:value={themeUrl}
            on:change={handleThemeChange}
            placeholder="default, datamap-address, or http://..."
          />
          <small class="help-text">
            {#if accountPackage && backendUrl}
              Theme will be saved to your account package and synced across devices
            {:else}
              Enter 'default' for built-in theme, a datamap address, or a full HTTP URL
            {/if}
          </small>
        </div>
        
        <!-- Desktop Notifications Section -->
        <div class="notification-section">
          <h3>Desktop Notifications</h3>
          <div class="notification-status">
            {#if !browser || !('Notification' in window)}
              <span class="status-text">❌ Not supported in this browser</span>
            {:else if Notification.permission === 'granted'}
              <span class="status-text">✅ Enabled</span>
              <p class="help-text">You'll get notifications for new messages when this tab is in the background.</p>
            {:else if Notification.permission === 'denied'}
              <span class="status-text">🚫 Blocked</span>
              <p class="help-text">Please enable notifications in your browser settings.</p>
            {:else}
              <span class="status-text">⚪ Not enabled</span>
              <p class="help-text">Get desktop notifications for new messages when this tab is in the background.</p>
              <button on:click={requestNotificationPermission} class="primary-button notification-button">
                Enable Notifications
              </button>
            {/if}
          </div>
        </div>
        
        <div class="connection-section">
          <h3>WebRTC Connection</h3>
          
          <div class="connection-status">
            <span class="status-indicator status-{connectionState}"></span>
            <span class="status-text">
              {#if connectionState === 'disconnected'}
                Disconnected
              {:else if connectionState === 'creating-offer'}
                Creating offer...
              {:else if connectionState === 'waiting-for-answer'}
                Waiting for answer
              {:else if connectionState === 'waiting-for-offer'}
                Waiting for offer
              {:else if connectionState === 'processing-answer'}
                Processing answer...
              {:else if connectionState === 'connecting'}
                Connecting...
              {:else if connectionState === 'connected'}
                Connected
              {:else if connectionState === 'failed'}
                Connection failed
              {/if}
            </span>
          </div>
          
          {#if connectionState === 'disconnected' || connectionState === 'failed'}
        <div class="button-group">
              <button on:click={startAsInitiator} class="primary-button">
                Start Call
          </button>
              <button on:click={startAsReceiver} class="secondary-button">
                Receive Call
          </button>
        </div>
          {:else if connectionState === 'connected'}
            <button on:click={resetConnection} class="danger-button">
              Disconnect
            </button>
          {/if}
            </div>
            
        {#if showOfferAnswer}
          <div class="offer-answer-section">
            <h3>Connection Setup</h3>
            
            {#if isInitiator}
              {#if localOffer}
                <div class="step-section">
                  <h4>Step 1: Share your offer</h4>
                  <div class="code-block">
                    <textarea readonly bind:value={localOffer} rows="6"></textarea>
                    <button on:click={() => copyToClipboard(localOffer)} class="copy-button">
                      Copy
                    </button>
            </div>
            
                  {#if connectionState === 'waiting-for-answer'}
                    <div class="offer-refresh-info">
                      <small>💡 Offer will auto-refresh every 45s to prevent NAT timeouts</small>
            </div>
                  {/if}
                </div>
              {/if}
              
              {#if connectionState === 'waiting-for-answer'}
                <div class="step-section">
                  <h4>Step 2: Paste the answer you received</h4>
                  <div class="input-group">
                    <textarea bind:value={remoteAnswer} rows="6" placeholder="Paste answer here..."></textarea>
                    <button on:click={processAnswer} disabled={!remoteAnswer.trim()} class="primary-button">
                      Process Answer
                    </button>
                  </div>
                </div>
              {/if}
            {:else}
              <div class="step-section">
                <h4>Step 1: Paste the offer you received</h4>
                <div class="input-group">
                  <textarea bind:value={remoteOffer} rows="6" placeholder="Paste offer here..."></textarea>
                  <button on:click={processOffer} disabled={!remoteOffer.trim()} class="primary-button">
                    Process Offer
                  </button>
                </div>
            </div>
            
              {#if localAnswer}
                <div class="step-section">
                  <h4>Step 2: Share your answer</h4>
                  <div class="code-block">
                    <textarea readonly bind:value={localAnswer} rows="6"></textarea>
                    <button on:click={() => copyToClipboard(localAnswer)} class="copy-button">
                      Copy
                    </button>
                  </div>
                </div>
                {/if}
              {/if}
            </div>
          {/if}
      </div>
    {/if}
    
    <div class="resizer" on:mousedown={startResize} role="separator" style="display: {showConfig ? 'block' : 'none'};"></div>
    
    <div class="chat">
      <div class="chat-header" class:config-visible={showConfig}>
        <h1>WebRTC P2P Chat</h1>
        <div class="header-info">
          {#if myPeerId}
            <div class="peer-id-display">
              <span class="peer-id-label">My ID:</span>
              <button 
                class="peer-id-value" 
                on:click={() => copyToClipboard(myPeerId)}
                title="Click to copy peer ID"
              >
                {myPeerId}
              </button>
            </div>
          {:else if isLoadingPeerId}
            <div class="peer-id-display">
              <span class="peer-id-label">My ID:</span>
              <span class="peer-id-loading">Loading...</span>
            </div>
          {/if}
          
          <div class="connection-indicator">
            <span class="status-dot status-{connectionState}"></span>
            <span>{connectionState === 'connected' ? 'Connected' : 'Not Connected'}</span>
          </div>
        </div>
      </div>
      
      <div class="messages" bind:this={messagesContainer}>
        {#if messages.length === 0}
          <div class="empty-chat">
            <p>No messages yet. Start a conversation!</p>
            {#if connectionState !== 'connected'}
              <p class="help-text">Use the connection panel to establish a peer-to-peer connection.</p>
            {/if}
          </div>
        {/if}
        
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
                      <AttachmentView attachment={message.attachment} />
                  </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      
      <div class="input-area" class:disabled={connectionState !== 'connected'}>
        <div class="input-row">
        <textarea
          bind:value={messageInput}
          on:keydown={handleKeydown}
            placeholder={connectionState === 'connected' ? 'Type a message...' : 'Connect first to send messages'}
            disabled={connectionState !== 'connected'}
            rows="2"
        ></textarea>
        
          <div class="input-controls">
          <FileUploader 
              disabled={connectionState !== 'connected'}
            on:fileSelected={({detail}) => {
                console.log('File selected:', detail);
              pendingAttachment = detail.attachment;
                showNotification('File selected: ' + detail.attachment.name);
            }}
              on:error={({detail}) => {
                console.error('File upload error:', detail);
                showNotification(detail);
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
              disabled={connectionState !== 'connected' || (!messageInput.trim() && !pendingAttachment)}
              class="send-button {(messageInput.trim() || pendingAttachment) && connectionState === 'connected' ? 'active' : ''}"
        >
              Send
        </button>
          </div>
        </div>
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
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
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
    padding: 0.5rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #ddd;
  }
  
  .config {
    min-width: 200px;
    padding: 1rem 1rem 1rem 3.5rem; /* Add left padding for burger menu */
    background: #f8f9fa;
    border-radius: 8px 0 0 8px;
    overflow-y: auto;
    max-height: 100%;
    flex-shrink: 0;
    border: 1px solid #e9ecef;
  }
  
  .input-group {
    margin-bottom: 1rem;
  }
  
  .input-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    font-size: 0.9rem;
    color: #495057;
  }
  
  .input-group input, .input-group select, .input-group textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 0.9rem;
    background: white;
    box-sizing: border-box;
  }
  
  .connection-section {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #dee2e6;
  }
  
  .connection-section h3 {
    font-size: 1rem;
    margin-bottom: 1rem;
    color: #212529;
  }
  
  .connection-status {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: white;
    border-radius: 6px;
    border: 1px solid #dee2e6;
  }
  
  .status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 0.5rem;
    flex-shrink: 0;
  }
  
  .status-indicator.status-disconnected, .status-dot.status-disconnected { background: #6c757d; }
  .status-indicator.status-creating-offer, .status-dot.status-creating-offer { background: #ffc107; }
  .status-indicator.status-waiting-for-answer, .status-dot.status-waiting-for-answer { background: #fd7e14; }
  .status-indicator.status-waiting-for-offer, .status-dot.status-waiting-for-offer { background: #fd7e14; }
  .status-indicator.status-processing-answer, .status-dot.status-processing-answer { background: #0dcaf0; }
  .status-indicator.status-connecting, .status-dot.status-connecting { background: #0d6efd; }
  .status-indicator.status-connected, .status-dot.status-connected { background: #198754; }
  .status-indicator.status-failed, .status-dot.status-failed { background: #dc3545; }
  
  .status-text {
    font-size: 0.9rem;
    font-weight: 500;
  }
  
  .button-group {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  .primary-button, .secondary-button, .danger-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    flex: 1;
    min-width: 100px;
  }
  
  .primary-button {
    background: #0d6efd;
    color: white;
  }
  
  .primary-button:hover:not(:disabled) {
    background: #0b5ed7;
  }
  
  .primary-button:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
  
  .secondary-button {
    background: #6c757d;
    color: white;
  }
  
  .secondary-button:hover {
    background: #5c636a;
  }
  
  .danger-button {
    background: #dc3545;
    color: white;
  }
  
  .danger-button:hover {
    background: #bb2d3b;
  }
  
  .offer-answer-section {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #dee2e6;
  }
  
  .offer-answer-section h3 {
    font-size: 1rem;
    margin-bottom: 1rem;
    color: #212529;
  }
  
  .step-section {
    margin-bottom: 2rem;
  }
  
  .step-section h4 {
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
    color: #495057;
    font-weight: 600;
  }
  
  .code-block {
    position: relative;
  }
  
  .code-block textarea {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.8rem;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    resize: vertical;
  }
  
  .copy-button {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: #0d6efd;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
  }
  
  .copy-button:hover {
    background: #0b5ed7;
  }
  
  .offer-refresh-info {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: #e7f3ff;
    border: 1px solid #b6d7ff;
    border-radius: 4px;
    text-align: center;
  }
  
  .offer-refresh-info small {
    color: #0066cc;
    font-size: 0.8rem;
  }
  
  .chat {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 0 8px 8px 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    height: 100%;
    overflow: hidden;
    border: 1px solid #e9ecef;
  }
  
  .chat-header {
    padding: 1rem 1rem 1rem 3.5rem; /* Add left padding for burger menu */
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  /* Reset chat-header padding when config is visible */
  .chat-header.config-visible {
    padding-left: 0.75rem; /* Even less when config is visible on mobile */
  }
  
  .header-info {
    display: flex;
    flex-direction: row;
    gap: 1rem;
    align-items: center;
    justify-content: flex-end;
  }
  
  .peer-id-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  
  .peer-id-label {
    color: #495057;
    font-weight: 600;
  }
  
  .peer-id-value {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.8rem;
    background: #e7f3ff;
    color: #0066cc;
    border: 1px solid #b6d7ff;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .peer-id-value:hover {
    background: #d1ecf1;
    border-color: #bee5eb;
  }
  
  .peer-id-loading {
    color: #6c757d;
    font-style: italic;
    font-size: 0.8rem;
  }
  
  .connection-indicator {
    display: flex;
    align-items: center;
    font-size: 0.9rem;
    color: #495057;
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 0.5rem;
  }
  
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
  }
  
  .empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: #6c757d;
  }
  
  .empty-chat p {
    margin: 0.5rem 0;
    font-size: 1.1rem;
  }
  
  .help-text {
    font-size: 0.9rem !important;
    color: #adb5bd !important;
  }
  
  .message {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 12px;
    max-width: 80%;
    align-self: flex-start;
    border: 1px solid #e9ecef;
  }
  
  .message.self {
    align-self: flex-end;
    background: #d1ecf1;
    border-color: #bee5eb;
  }
  
  .message-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
  }
  
  .nick {
    font-weight: 600;
    color: #495057;
  }
  
  .time {
    color: #6c757d;
  }
  
  .message-body {
    word-break: break-word;
  }
  
  .message-text {
    line-height: 1.4;
    white-space: pre-wrap;
  }
  
  .attachment-container {
    margin-top: 0.75rem;
    border-top: 1px solid #dee2e6;
    padding-top: 0.75rem;
  }
  
  .input-area {
    padding: 1rem;
    border-top: 1px solid #dee2e6;
    background: #f8f9fa;
  }
  
  .input-area.disabled {
    opacity: 0.6;
  }
  
  .input-row {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
  }
  
  .input-row textarea {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ced4da;
    border-radius: 8px;
    resize: none;
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.4;
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
    background: #e7f3ff;
    border: 1px solid #b6d7ff;
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
    color: #6c757d;
    cursor: pointer;
    font-size: 1rem;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .send-button {
    padding: 0.75rem 1.5rem;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }
  
  .send-button.active {
    background: #0d6efd;
  }
  
  .send-button:hover:not(:disabled) {
    filter: brightness(0.9);
  }
  
  .send-button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  
  .resizer {
    width: 5px;
    background-color: #dee2e6;
    cursor: col-resize;
    transition: background-color 0.2s;
  }
  
  .resizer:hover {
    background-color: #adb5bd;
  }
  
  .notification {
    position: fixed;
    top: 1rem;
    right: 1rem;
    background: #198754;
    color: white;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
    z-index: 1000;
    max-width: 300px;
  }
  
  .notification.visible {
    opacity: 1;
  }
  
  h2 {
    font-size: 1.1rem;
    margin: 0 0 1rem 0;
    color: #212529;
    font-weight: 600;
  }
  
  @media (max-width: 768px) {
    .container {
      padding: 0.25rem;
    }
    
    .burger-menu {
      top: 0.25rem;
      left: 0.25rem;
    }
    
    .config {
      padding-left: 3rem; /* Less padding on mobile */
    }
    
    .chat-header {
      flex-direction: column;
      align-items: flex-start;
      padding-left: 3rem; /* Less padding on mobile */
    }
    
    .chat-header.config-visible {
      padding-left: 0.75rem; /* Even less when config is visible on mobile */
    }
    
    .input-row {
      flex-direction: column;
      align-items: stretch;
    }
    
    .input-controls {
      flex-direction: row;
      justify-content: space-between;
    align-items: center;
    }
    
    /* Mobile header layout overrides */
    .header-info {
      width: 100% !important;
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 0.5rem !important;
      justify-content: flex-start !important;
    }
    
    .peer-id-value {
      max-width: 120px !important;
    }
  }


  
  .background-warning {
    margin-top: 1rem;
    padding: 0.75rem;
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 6px;
    text-align: center;
  }
  
  .background-warning small {
    color: #856404;
    font-size: 0.8rem;
    line-height: 1.4;
  }
  
  .notification-section {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #dee2e6;
  }
  
  .notification-section h3 {
    font-size: 1rem;
    margin-bottom: 1rem;
    color: #212529;
  }
  
  .notification-status {
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    padding: 0.75rem;
  }
  
  .notification-status .status-text {
    font-weight: 600;
    font-size: 0.9rem;
    display: block;
    margin-bottom: 0.5rem;
  }
  
  .notification-status .help-text {
    font-size: 0.8rem;
    color: #6c757d;
    line-height: 1.4;
    margin: 0.5rem 0;
  }
  
  .notification-button {
    margin-top: 0.75rem;
    font-size: 0.85rem;
    padding: 0.5rem 0.75rem;
  }
  

  
  /* Loading overlay styles */
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  }
  
  .loading-content {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #0d6efd;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .blurred {
    filter: blur(2px);
    pointer-events: none;
  }
  
  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  }
  
  .modal-content {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  
  .modal-content h2 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #212529;
  }
  
  .modal-buttons {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    margin-top: 2rem;
  }
  
  .error-message {
    color: #dc3545;
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 6px;
    padding: 0.75rem;
    margin: 1rem 0;
    font-size: 0.9rem;
  }
  
  .profile-image-preview,
  .profile-image-display {
    margin-top: 0.5rem;
  }
  
  .profile-image-preview img,
  .profile-image-display img {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #dee2e6;
  }
  
  .datamap-address {
    display: block;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.8rem;
    color: #6c757d;
    margin-top: 0.25rem;
    word-break: break-all;
  }
  
  /* Account package info styles */
  .account-package-info {
    margin-bottom: 2rem;
    padding: 1rem;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
  }
  
  .account-package-info h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    color: #212529;
  }
  
  .account-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .account-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .account-field strong {
    font-size: 0.9rem;
    color: #495057;
  }
  
  .profile-image-display {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .no-account {
    color: #6c757d;
    font-style: italic;
    margin-bottom: 1rem;
  }
  

  
  /* User profile display styles */
  .user-profile {
    margin-bottom: 2rem;
    padding: 1rem;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
  }
  
  .profile-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .profile-avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #dee2e6;
  }
  
  .profile-avatar-placeholder {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: #0d6efd;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.2rem;
    border: 2px solid #dee2e6;
  }
  
  .profile-info {
    flex: 1;
  }
  
  .profile-name {
    margin: 0 0 0.25rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #212529;
  }
  
  .profile-status {
    margin: 0;
    font-size: 0.85rem;
    color: #6c757d;
  }
  
  /* Certificate error styles */
  .certificate-error {
    background: #fff3cd;
    border: 2px solid #ffc107;
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
    margin-bottom: 1rem;
  }
  
  .certificate-error p {
    margin: 0.5rem 0;
    line-height: 1.4;
  }
  
  .certificate-error strong {
    color: #856404;
    font-size: 1.1rem;
  }
  
  .certificate-link {
    display: inline-block;
    background: #0d6efd;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    text-decoration: none;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.9rem;
    margin: 1rem 0;
    word-break: break-all;
    transition: background-color 0.2s;
  }
  
  .certificate-link:hover {
    background: #0b5ed7;
    text-decoration: none;
  }
  
  .certificate-error small {
    color: #856404;
    font-style: italic;
  }
</style> 