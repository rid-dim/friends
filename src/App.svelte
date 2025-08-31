<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  // Import components
  import StatusBar from './lib/components/StatusBar.svelte';
  import FriendsList from './lib/components/FriendsList.svelte';
  import Chat from './lib/components/Chat.svelte';
  import type { Friend } from './lib/types';
  import AccountSettings from './lib/components/AccountSettings.svelte';
  import FriendRequestModal from './lib/components/FriendRequestModal.svelte';
  import FriendRequestNotification from './lib/components/FriendRequestNotification.svelte';
  import ProfileModal from './lib/components/ProfileModal.svelte';
  import AccountCreationWizard from './lib/components/AccountCreationWizard.svelte';
  import SettingsModal from './lib/components/SettingsModal.svelte';
  import PaymentFailureModal from './lib/components/PaymentFailureModal.svelte';
  
  // Import WebRTC and file handling
  import { ConnectionManager } from './lib/webrtc/ConnectionManager';
  import type { FileAttachment } from './lib/file-handling/types';
  import { FriendRequestManager } from './lib/webrtc/FriendRequestManager';
  import type { FriendRequest, ProfileData } from './lib/webrtc/FriendRequestManager';
  
  // Import styles
  import './lib/styles/theme.css';
  
  // Import translations
  import { t, language as langStore, changeLanguage } from './i18n/i18n';
  import { translations, type Language, getTranslation } from './i18n/translations';
  import { createLastSeenText } from './lib/utils/presence';
  
  // DWeb Service und gemeinsame Secrets
  import { getDwebService } from './lib/utils/dwebService';
  import { DwebService } from './lib/utils/dweb/DwebService';
  import { FRIENDS_SHARED_GLOBAL_SECRET } from './lib/webrtc/FriendRequestManager';
  import { deriveDeterministicRsaFromScratchpadAddress } from './lib/utils/crypto/deterministicRsa';
  
  // Zentrale Versionskonstante für das Account-Package
  const ACCOUNT_PACKAGE_VERSION = 6;
  // Backend and account package related types
  interface AccountPackage {
    version: number; // Version of the account package format
    username: string;
    profileImage?: string; // datamap address
    themeUrl?: string; // theme URL
    language?: Language;
    friends?: Array<{
      peerId?: string; // Optional - can be added later
      displayName: string;
      scratchpadAddress?: string; // The scratchpad address for this friend
      targetProfileId?: string; // Store the target profile ID for matching approvals
    }>;
    activeSession?: {
      sessionId: string;
      timestamp: number; // Unix timestamp in milliseconds
    };
    publicIdentifiers?: string[];
    /** RSA PKCS8 Private Key (PEM) */
    privateKeyPem?: string;
  }
  
  // Application state
  let accountPackage: AccountPackage | null = null;
  let backendUrl = '';
  let accountName = '';
  let profileId = '';
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
  // Drafts pro Freund (Text + optional PendingUpload-Metadaten)
  type PendingUpload = { dataMapHex: string; mimeType: string; fileName: string; size: number } | null;
  let chatDrafts: Record<string, { text: string; pendingUpload: PendingUpload }> = {};
  
  // Connection management
  let connectionManager: ConnectionManager;
  // Handshake server URL is no longer needed - using DwebConnector with scratchpads
  let handshakeStatus = '';
  let handshakeCountdown = '';
  // Map für Status-Informationen eines Freundes
  // 1. string  → "last seen ..."
  // 2. number  → Countdown in Sekunden (Legacy)
  // 3. object  → Details für Verbindung (Legacy)
  let handshakeCountdowns: Record<string, string | number | {
    text: string;
    dots?: string;
    seconds?: number;
    isConnecting?: boolean;
    isLastSeen?: boolean;
    relativeText?: string;
    absoluteText?: string;
  }> = {};

  // Speichert den Timestamp (ms) der letzten Presence-Nachricht pro Peer
  let lastSeenTimestamps: Record<string, number> = {};
  let handshakeLoopRunning = false;
  
  // UI state
  let notification = '';
  let connectionStatus = '';
  let notificationStatus = '';
  let showSettingsModal = false;
  
  // Friend Request state
  let friendRequestManager: FriendRequestManager | null = null;
  // In-Memory Private Key (nie im Account-Package oder LocalStorage speichern)
  let myPrivateKeyPem: string | undefined = undefined;
  let showFriendRequestModal = false;
  let showProfileModal = false;
  let showPaymentFailureModal = false;
  // Migration v6 Hinweis-Dialog
  let showMigrationNotice = false;
  let pendingFriendRequests: FriendRequest[] = [];
  let selectedFriendRequest: FriendRequest | null = null;
  let selectedProfileData: ProfileData | null = null;
  let friendRequestCheckInterval: ReturnType<typeof setInterval> | null = null;
  
  // Session management
  let currentSessionId = '';
  let sessionCheckInterval: ReturnType<typeof setInterval> | null = null;
  let isSessionActive = true;
  let lastSessionCheck = 0;
  let sessionStartTimestamp = 0;
  
  // Language state
  let language: Language = 'en';
  
  // Debug flag via ?debug=true
  let debugMode: boolean = false;
  
  // Update language when account package changes
  $: if (accountPackage?.language) {
    language = accountPackage.language;
    changeLanguage(language);
  }
  
  // Initialize central i18n store when local language changes
  $: if (language) {
    changeLanguage(language);
  }
  
  // Get translations for current language
  $: currentTranslations = translations[language] as any;
  
  // Update connectionStatus when language changes
  $: connectionStatus = connectionStatus || (currentTranslations.initializing || 'Initializing...');
  
  // Initialize connection manager
  onMount(() => {
    const rtcConfig: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun1.l.google.com:19302' }
      ]
    };
    connectionManager = new ConnectionManager({
      onMessage: handleIncomingMessage,
      onConnectionStateChange: handleConnectionStateChange,
      onError: handleConnectionError,
      onPresenceUpdate: handlePresenceUpdate
    });
    
    // Parse URL parameters
    backendUrl = parseBackendUrl();
    accountName = parseAccountName();
    
    // Request notification permission for push notifications
    requestNotificationPermission();
    
    // Initialize backend integration
    initializeBackend();
    
    // Log debug info
    console.log('🚀 Friends App Started');
    console.log('📦 Debug info available at: sessionStorage.friendsDebugInfo');
    console.log('🔍 To view: JSON.parse(sessionStorage.getItem("friendsDebugInfo"))');
    
    // Start countdown updates
    setInterval(updateCountdowns, 1000);
    
    // Start handshake loop with smokesigns integration
    startHandshakeLoop();
    
    // after other state variables definitions
    // ... in onMount parse debug
    debugMode = parseDebugFlag();
    
    return () => {
      // Cleanup
      connectionManager.closeAllConnections();
      handshakeLoopRunning = false;
      
      // Stop session monitoring
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
      }
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
    const baseUrl = backendUrl ? `${backendUrl}/dweb-0/scratchpad-private` : '/dweb-0/scratchpad-private';
    if (accountName) {
      return `${baseUrl}?tries=3&object_name=${encodeURIComponent(accountName)}`;
    }
    return `${baseUrl}?tries=3`;
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
    const baseUrl = backendUrl ? `${backendUrl}/dweb-0/scratchpad-public` : '/dweb-0/scratchpad-public';
    return `${baseUrl}?tries=3&object_name=${encodeURIComponent(objectName)}`;
  }
  
  // Build friend-specific scratchpad URL
  function buildFriendScratchpadUrl(friendProfileId: string): string {
    if (!profileId) {
      throw new Error('profileId not initialised yet');
    }
    const objectName = `${friendProfileId}comm${profileId}`;
    const baseUrl = backendUrl ? `${backendUrl}/dweb-0/scratchpad-public` : '/dweb-0/scratchpad-public';
    return `${baseUrl}?tries=3&object_name=${encodeURIComponent(objectName)}`;
  }
  
  // Create or get friend scratchpad
  async function createOrGetFriendScratchpad(friendProfileId: string): Promise<string> {
    const objectName = `${friendProfileId}comm${profileId}`;
    const service = getDwebService(backendUrl || null, 'friends');
    try {
      const existing = await service.publicScratchpad.readScratchpad(objectName);
      if (existing) {
        const address = existing.scratchpad_address || existing.network_address;
        if (address) {
          return address;
        }
      }
      const peerInfo = {
        type: 'friend-communication',
        createdAt: new Date().toISOString(),
        friendProfileId,
        myProfileId: profileId
      };
      const createdOk = await service.publicScratchpad.create(objectName, peerInfo);
      if (!createdOk) throw new Error('Failed to create friend scratchpad');
      const created = await service.publicScratchpad.readScratchpad(objectName);
      const address = created?.scratchpad_address || created?.network_address || '';
      if (!address) throw new Error('Missing scratchpad address after creation');
      return address;
    } catch (error) {
      console.error('❌ Error with friend scratchpad:', error);
      throw error;
    }
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
  
  // Generate a unique session ID
  function generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Initialize session management
  function initializeSession() {
    if (!accountPackage) return;

    // Generate new session ID
    currentSessionId = generateSessionId();
    sessionStartTimestamp = Date.now();

    console.log('🔐 Initializing session:', currentSessionId, 'at timestamp:', sessionStartTimestamp);

    // The new instance takes over - update account package with new session (async)
    // This will cause the old instance to detect the change and shut down
    updateAccountPackageAsync({
      activeSession: {
        sessionId: currentSessionId,
        timestamp: sessionStartTimestamp
      }
    });

    console.log('🔐 Session initialized and registered');

    // Start session monitoring immediately (don't wait for the async update)
    startSessionMonitoring();
  }
  
  // Start monitoring for other sessions
  function startSessionMonitoring() {
    // Clear any existing interval
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
    }
    
    // Check every 30 seconds (less aggressive to avoid race conditions)
    sessionCheckInterval = setInterval(async () => {
      lastSessionCheck = Date.now();
      await checkForActiveSession();
    }, 30000);
    
    console.log('👁️ Session monitoring started (30s intervals)');
  }
  
  // Check if another session has taken over
  async function checkForActiveSession() {
    if (!isSessionActive || !accountPackage) return;
    
    try {
      // Fetch latest account package
      const latestPackage = await fetchAccountPackage();
      
      if (latestPackage?.activeSession) {
        const currentTimestamp = Date.now();
        const timeDiff = currentTimestamp - latestPackage.activeSession.timestamp;
        
        console.log(`🔍 Session check - Current: ${currentSessionId} (started: ${sessionStartTimestamp}), Remote: ${latestPackage.activeSession.sessionId} (timestamp: ${latestPackage.activeSession.timestamp}), TimeDiff: ${timeDiff}ms`);
        
        // If another session is newer than our session start time and it's not us
        if (latestPackage.activeSession.timestamp > sessionStartTimestamp && latestPackage.activeSession.sessionId !== currentSessionId) {
          console.log('⚠️ Newer session detected, shutting down this instance');
          await handleSessionTransfer();
        }
        // Don't update timestamp - sessions should only register once at startup
      }
    } catch (error) {
      console.error('Error checking active session:', error);
    }
  }
  
  // Handle session transfer to another instance
  async function handleSessionTransfer() {
    isSessionActive = false;
    
    // Close all connections
    connectionManager?.closeAllConnections();
    
    // Stop all intervals
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
      sessionCheckInterval = null;
    }
    
    // Stop handshake loop
    handshakeLoopRunning = false;
    
    // Update UI
    connectionStatus = currentTranslations.sessionTransferred;
    showNotification(currentTranslations.sessionTransferred);
    
    // Disable all interactive elements
    friends = friends.map(f => ({ ...f, isConnected: false }));
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
          // 1) Dubletten in der Friend-Liste des Account-Pakets bereinigen (Key = displayName)
          const dedupedFriendsData: Array<{peerId?: string, displayName: string, scratchpadAddress?: string, targetProfileId?: string}> = [];
          for (const f of fetchedPackage.friends) {
            if (!dedupedFriendsData.some(e => e.displayName === f.displayName)) {
              dedupedFriendsData.push(f);
            }
          }

          // Wenn wir Einträge entfernt haben, Account-Pakete im Hintergrund aktualisieren
          if (dedupedFriendsData.length !== fetchedPackage.friends.length) {
            console.log('🧹 Duplicate friends removed from account package:', fetchedPackage.friends.length - dedupedFriendsData.length);
            updateAccountPackageAsync({ friends: dedupedFriendsData });
          }

          friends = dedupedFriendsData.map(f => ({
            peerId: f.peerId,
            displayName: f.displayName,
            scratchpadAddress: f.scratchpadAddress,
            targetProfileId: f.targetProfileId,
            isConnected: false,
            unreadCount: 0
          }));
          
          // Automatically select first friend if there are any
          if (friends.length > 0) {
            console.log('🔍 Automatically selecting first friend:', friends[0].displayName);
            // Use peerId if available, otherwise use displayName
            selectedFriendId = friends[0].peerId || friends[0].displayName;
          }
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

        // Initialize session management (now async in background)
        initializeSession();
      } else {
        // No account package found - offer to create one
        showAccountCreation = true;
      }
    } catch (error) {
      console.error('❌ Error during backend initialization:', error);
      connectionStatus = currentTranslations.backendError;
    } finally {
      isLoadingAccountPackage = false;
    }
    
    // Initialize peer communication only if session is active
    if (isSessionActive) {
      // initializePeerCommunication entfernt – comm-Scratchpad wird nicht mehr verwendet
      if (accountPackage) {
        friendRequestManager = new FriendRequestManager(backendUrl, '', accountName, myPrivateKeyPem);
        const result = await friendRequestManager.initializeProfileWithErrorDetails();
        if (result.success) {
          profileId = friendRequestManager.getProfileId();
        } else {
          // Check if it's a payment failure error
          if (result.error?.isPaymentFailure) {
            showPaymentFailureModal = true;
          } else {
            showNotification(currentTranslations.connectionError);
          }
        }
        if (accountPackage.profileImage) {
          await friendRequestManager.updateProfileImage(accountPackage.profileImage);
        }
        // Stelle sicher, dass ein RSA-Schlüsselpaar existiert und PublicKey im Profil gespeichert ist
        await ensureKeyPair();
        await ensureFriendRequestLink();
        startFriendRequestCheck();
      }
    }
    
    // Update debug info
    updateSessionStorageDebugInfo();
    
    // Start auto-reconnect for all friends only if session is active
    if (isSessionActive) {
      startAutoReconnect();
    }
  }
  
  // Fetch account package from backend
  async function fetchAccountPackage(): Promise<AccountPackage | null> {
    // Verwende DwebService private scratchpad
    try {
      const service = getDwebService(backendUrl || null, 'friends');
      // Wenn kein accountName gesetzt ist, wird ohne object_name gelesen (default Scratchpad)
      const result = await service.privateScratchpad.readScratchpad<AccountPackage>(accountName || '');
      const accountPkg = result?.data;
      if (!accountPkg) return null;

      // Migration wie zuvor (gegen die zentrale Versionskonstante)
      if (!accountPkg.version || accountPkg.version < ACCOUNT_PACKAGE_VERSION) {
        console.log(`🔄 Migrating account package from version ${accountPkg.version || 0} to version ${ACCOUNT_PACKAGE_VERSION}`);

        // Ab v6: Freunde leeren und alle Public Identifiers entfernen
        if ((accountPkg as any).version < 6) {
          // 1) Freunde im Account-Package zurücksetzen
          (accountPkg as any).friends = [];
          // 2) Public Identifiers lokal und im Account-Package zurücksetzen
          try {
            if (Array.isArray((accountPkg as any).publicIdentifiers)) {
              const ids: string[] = [...(accountPkg as any).publicIdentifiers];
              if (ids.length > 0) {
                // Versuche, alle zugehörigen Pointer zu löschen
                const service = new DwebService(backendUrl || null, 'friends', FRIENDS_SHARED_GLOBAL_SECRET);
                for (const id of ids) {
                  try {
                    await service.pointer.delete(id);
                  } catch (e) {
                    console.warn('⚠️ Konnte Pointer nicht löschen:', id, e);
                  }
                }
              }
            }
          } catch (e) {
            console.warn('⚠️ Fehler beim Entfernen der Public Identifiers während Migration', e);
          }
          (accountPkg as any).publicIdentifiers = [];

          // Übersetzter Hinweis + Dialog
          showNotification(currentTranslations.migrationNoticeTitle);
          showMigrationNotice = true;
        }

        (accountPkg as any).version = ACCOUNT_PACKAGE_VERSION;
        await ensureKeyPair(true);
      }

      console.log('✅ Successfully loaded account package via DwebService');
      return accountPkg as AccountPackage;
    } catch (error) {
      console.error('❌ Error fetching account package:', error);
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
      const service = getDwebService(backendUrl || null, 'friends');
      // Wenn accountName leer ist, erstellen wir das Default-Scratchpad (ohne object_name)
      const ok = await service.privateScratchpad.create(accountName || '', accountData);
      if (!ok) throw new Error('create private scratchpad failed');
      console.log('✅ Account package created successfully (DwebService)');
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
      const service = getDwebService(backendUrl || null, 'friends');
      // Wenn accountName leer ist, wird das Default-Scratchpad aktualisiert (ohne object_name)
      const ok = await service.privateScratchpad.update(accountName || '', newAccountData);
      if (!ok) throw new Error('update private scratchpad failed');
      accountPackage = newAccountData;
      console.log('✅ Account package updated successfully (DwebService)');
      return true;
    } catch (error) {
      console.error('❌ Error updating account package:', error);
      showNotification('Error updating account package: ' + error);
      return false;
    }
  }

  // Background version of updateAccountPackage - no await, runs asynchronously
  function updateAccountPackageAsync(updatedData: Partial<AccountPackage>): void {
    if (!accountPackage) return;

    console.log('🔄 Updating account package (async) with:', updatedData);

    const newAccountData: AccountPackage = {
      ...accountPackage,
      ...updatedData
    };

    // Update local state immediately for better UX
    accountPackage = newAccountData;

    // Run the update in background without blocking
    (async () => {
      try {
        const service = getDwebService(backendUrl || null, 'friends');
        const ok = await service.privateScratchpad.update(accountName || '', newAccountData);
        if (ok) {
          console.log('✅ Account package updated successfully (async)');
        } else {
          console.warn('⚠️ Account package update failed (async)');
          // Revert local state on failure
          accountPackage = { ...accountPackage };
        }
      } catch (error) {
        console.error('❌ Error updating account package (async):', error);
        // Revert local state on failure
        accountPackage = { ...accountPackage };
      }
    })();
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
        encrypted_data: [0],
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
      console.log('📦 Server response for public scratchpad creation:', createdScratchpad);
      
      // Prüfe beide möglichen Felder: scratchpad_address oder network_address
      if (createdScratchpad) {
        const address = createdScratchpad.scratchpad_address || createdScratchpad.network_address;
        if (address) {
          profileId = address;
          console.log('✅ New profile ID:', profileId);
        }
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
    
    // Generate session for new account
    currentSessionId = generateSessionId();
    sessionStartTimestamp = Date.now();
    
    const accountData: AccountPackage = {
      version: ACCOUNT_PACKAGE_VERSION, // Version des Account-Package-Formats
      username: accountCreationForm.username.trim(),
      profileImage: accountCreationForm.profileImage.trim() || undefined,
      themeUrl: accountCreationForm.themeUrl.trim() || 'default',
      language: accountCreationForm.language,
      friends: [],
      activeSession: {
        sessionId: currentSessionId,
        timestamp: sessionStartTimestamp
      }
    };
    
    const success = await createAccountPackage(accountData);
    
    if (success) {
      accountPackage = accountData;
      showAccountCreation = false;
      showNotification('Account package created successfully!');
      
      // Start session monitoring
      startSessionMonitoring();
      
      // initializePeerCommunication entfällt – comm-Scratchpad wird nicht mehr verwendet
      
      // Initialize Friend Request Manager (erstellt/verifiziert Profil-Scratchpad)
      if (accountPackage) {
        friendRequestManager = new FriendRequestManager(backendUrl, '', accountName, myPrivateKeyPem);
        const result = await friendRequestManager.initializeProfileWithErrorDetails();

        if (result.success) {
          profileId = friendRequestManager.getProfileId();
        } else {
          // Check if it's a payment failure error
          if (result.error?.isPaymentFailure) {
            showPaymentFailureModal = true;
          } else {
            showNotification(currentTranslations.connectionError);
          }
        }

        // Update profile image if available
        if (accountPackage.profileImage) {
          await friendRequestManager.updateProfileImage(accountPackage.profileImage);
        }

        // Stelle sicher, dass ein RSA-Schlüsselpaar existiert und PublicKey im Profil gespeichert ist
        await ensureKeyPair();
        await ensureFriendRequestLink();
        startFriendRequestCheck();
      }
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
      themeFullUrl = backendUrl ? `${backendUrl}/dweb-0/data/${url}` : `/dweb-0/data/${url}`;
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
          `url("${backendUrl}/dweb-0/data/${cleanDatamap}")` : 
          `url("/dweb-0/data/${cleanDatamap}")`;
        document.documentElement.style.setProperty('--theme-background-url', backgroundUrl);
        
        // Apply background to body
        document.body.style.background = `${backgroundUrl} no-repeat center center fixed`;
        document.body.style.backgroundSize = 'cover';
      }
    };
    
    document.head.appendChild(themeLink);
  }
  
  // Handle incoming messages from peers
  // Wird von ConnectionManager aufgerufen, wenn smokesigns einen Presence-Timestamp meldet
  function handlePresenceUpdate(peerId: string, ts: number) {
    lastSeenTimestamps[peerId] = ts;
  }

  function handleIncomingMessage(peerId: string, data: any) {
    console.log(`📨 Incoming message from ${peerId}:`, data.type);
    
    // Only check session if it's been more than 30 seconds since last check
    // to avoid too frequent checks that could cause race conditions
    const now = Date.now();
    if (isSessionActive && (!lastSessionCheck || now - lastSessionCheck > 30000)) {
      console.log('💭 Triggering session check due to incoming message');
      lastSessionCheck = now;
      checkForActiveSession();
    }
    
    // Don't process messages if session is not active
    if (!isSessionActive) {
      console.log('⚠️ Session not active, ignoring message');
      return;
    }
    
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

        // Show push notification if:
        // 1. App is in background (tab not visible), OR
        // 2. App is in foreground but the sender's chat is not currently selected
        const shouldShowNotification = (
          document.hidden || // App in background
          selectedFriendId !== peerId // Different chat is selected
        );

        if (shouldShowNotification && data.nick && data.message) {
          const friendName = getFriendName(peerId);
          showBrowserNotification(friendName, data.message, peerId);
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
        
      case 'presence':
        // Update Last-Seen-Information
        if (typeof data.timestamp === 'number') {
          lastSeenTimestamps[peerId] = data.timestamp;
        }
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
      
      // Clear countdown for this friend
      delete handshakeCountdowns[peerId];
    } else if (state === 'failed' || state === 'disconnected') {
      console.log(`[${peerId}] Disconnected`);
      showNotification(`Disconnected from ${getFriendName(peerId)}`);
      
      // Initialize status display for this friend again
      startAutoReconnectForFriend(peerId);
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
  
  // Update overall connection status - now reactive to language changes
  $: {
    const connectedCount = friends.filter(f => f.isConnected).length;
    
    if (connectedCount === 0) {
      connectionStatus = translations[language]?.noConnections || 'No connections';
    } else if (connectedCount === 1) {
      connectionStatus = translations[language]?.oneConnected || '1 friend connected';
    } else {
      connectionStatus = translations[language]?.multipleConnected?.replace('{count}', String(connectedCount)) || `${connectedCount} friends connected`;
    }
  }
  
  // Legacy function kept for compatibility
  function updateConnectionStatus() {
    // This is now handled by the reactive statement above
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
    const friend = friends.find(f => 
      (f.peerId && f.peerId === event.detail) || 
      (!f.peerId && f.displayName === event.detail)
    );
    if (friend) {
      friend.unreadCount = 0;
      friends = friends;
    }

    // Load profile image for newly selected friend, if necessary.
    if (selectedFriend) {
      loadProfileImage(selectedFriend);
    }
  }

  async function loadProfileImage(friendObj: Friend) {
    console.log('loadProfileImage called, friendRequestManager:', !!friendRequestManager);
    if (!friendRequestManager) return;
    if (!friendObj.targetProfileId) return;
    try {
      const prof = await friendRequestManager.readProfile(friendObj.targetProfileId!);
      if (prof && prof.profileImage) {
        console.log('Loaded profile data:', prof);
        const idx = friends.findIndex(f => f === friendObj);
        if (idx !== -1) {
          friends[idx] = { ...friends[idx], profileImage: prof.profileImage };
          friends = [...friends];
        }
      }
    } catch (e) {
      console.error('Error loading profile image', e);
    }
  }
  
  // Handle adding a new friend
  async function handleAddFriend(event: CustomEvent<{peerId: string | undefined, displayName: string}>) {
    const { peerId, displayName } = event.detail;
    
    // Check if friend already exists by display name
    if (friends.some(f => f.displayName === displayName)) {
      showNotification('Friend with this name already exists');
      return;
    }
    
    // Add new friend immediately with loading state
    const newFriend: Friend = {
      peerId,
      displayName,
      scratchpadAddress: undefined, // Will be set after creation
      isConnected: false,
      unreadCount: 0,
      isLoadingScratchpad: true // Add loading state
    };
    
    friends = [...friends, newFriend];
    
    // Always select the new friend to show the loading state
    // and to make it easier for users to interact with the new friend
    selectedFriendId = peerId || displayName;
    
    // Save to localStorage immediately (without scratchpad address)
    saveFriends();
    
    // Create or get friend scratchpad in background
    try {
      const scratchpadAddress = await createOrGetFriendScratchpad(displayName);
      
      // Update friend with scratchpad address
      const friendIndex = friends.findIndex(f => f.displayName === displayName);
      if (friendIndex !== -1) {
        friends[friendIndex] = {
          ...friends[friendIndex],
          scratchpadAddress,
          isLoadingScratchpad: false
        };
        friends = [...friends];
        
        // Save again with scratchpad address
        saveFriends();
        
        showNotification(`Friend ${displayName} added successfully`);
        
        // If friend has peerId, start connection attempt immediately
        if (peerId) {
          console.log(`[${peerId}] Starting connection attempt for new friend`);
          // Direkter Aufruf von startHandshakeForFriend anstatt startAutoReconnectForFriend
          startHandshakeForFriend(peerId);
        }
      }
    } catch (error) {
      console.error('Error creating friend scratchpad:', error);
      
      // Update friend to show error state
      const friendIndex = friends.findIndex(f => f.displayName === displayName);
      if (friendIndex !== -1) {
        friends[friendIndex] = {
          ...friends[friendIndex],
          isLoadingScratchpad: false,
          scratchpadError: true
        };
        friends = [...friends];
      }
      
      showNotification('Error creating friend scratchpad');
    }
  }
  
  // Handle removing a friend
  function handleRemoveFriend(event: CustomEvent<string>) {
    const id = event.detail;
    
    // Find friend by peerId or displayName
    const friend = friends.find(f => 
      (f.peerId && f.peerId === id) || 
      (!f.peerId && f.displayName === id)
    );
    
    if (!friend) return;
    
    // Close connection if peerId exists
    if (friend.peerId) {
      connectionManager.closeConnection(friend.peerId);
      
      // Clear status display for this friend
      delete handshakeCountdowns[friend.peerId];
      
      // Clear chat messages
      delete chatMessages[friend.peerId];
    }
    
    // Remove from friends list
    friends = friends.filter(f => f !== friend);
    
    // Clear selection if this friend was selected
    if (selectedFriendId === id) {
      // If there are other friends, select the first one
      if (friends.length > 0) {
        console.log('🔍 Auto-selecting another friend after removal');
        selectedFriendId = friends[0].peerId || friends[0].displayName;
      } else {
        selectedFriendId = null;
      }
    }
    
    // Save to localStorage
    saveFriends();
    
    showNotification('Friend removed');
  }
  
  // Handle updating peer ID for a friend
  async function handleUpdatePeerId(event: CustomEvent<{peerId: string}>) {
    if (!selectedFriend) return;
    
    const { peerId } = event.detail;
    
    // Update the friend's peerId
    const friendIndex = friends.findIndex(f => f.displayName === selectedFriend!.displayName);
    if (friendIndex !== -1) {
      friends[friendIndex] = {
        ...friends[friendIndex],
        peerId
      };
      friends = [...friends];
      
      // Update selection to use the new peerId, so the view refreshes
      selectedFriendId = peerId;
      
      // Save to localStorage and account package
      saveFriends();
      
      // Start connection attempt immediately
      console.log(`[${peerId}] Starting connection attempt after updating peer ID`);
      // Direkter Aufruf von startHandshakeForFriend anstatt startAutoReconnectForFriend
      startHandshakeForFriend(peerId);
      
      showNotification(`Peer ID updated for ${selectedFriend.displayName}`);
    }
  }
  
  // Save friends to localStorage
  function saveFriends() {
    if (!browser) return;
    
    const friendsData = friends.map(f => ({
      peerId: f.peerId,
      displayName: f.displayName,
      scratchpadAddress: f.scratchpadAddress,
      targetProfileId: f.targetProfileId
    }));
    
    localStorage.setItem('friends', JSON.stringify(friendsData));
    
    // Also update account package if available
    if (accountPackage) {
      updateAccountPackageFriends(friendsData);
    }
  }
  
  // Update account package with friends list
  async function updateAccountPackageFriends(friendsData: Array<{peerId?: string, displayName: string, scratchpadAddress?: string, targetProfileId?: string}>) {
    const success = await updateAccountPackage({ friends: friendsData });
    if (success) {
      console.log('✅ Friends list saved to account package');
    }
  }
  
  // Handle sending a message
  function handleSendMessage(event: CustomEvent<{text: string, attachment: FileAttachment | null}>) {
    if (!selectedFriend) return;
    
    // Check if session is still active
    if (!isSessionActive) {
      showNotification(currentTranslations.sessionTransferred);
      return;
    }
    
    const { text, attachment } = event.detail;
    
    // Create message object
    const message = {
      nick: accountPackage?.username || 'User',
      text,
      timestamp: new Date(),
      isSelf: true,
      attachment: attachment || undefined
    };
    
    // Use peerId if available, otherwise use displayName as key
    const messageKey = selectedFriend.peerId || selectedFriend.displayName;
    
    // Add to local messages
    if (!chatMessages[messageKey]) {
      chatMessages[messageKey] = [];
    }
    chatMessages[messageKey] = [...chatMessages[messageKey], message];
    // Draft für diesen Freund zurücksetzen
    chatDrafts[messageKey] = { text: '', pendingUpload: null };
    
    // Only send via WebRTC if friend has peerId
    if (selectedFriend.peerId) {
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
        connectionManager.sendLargeFileInChunks(selectedFriend.peerId, messageData, attachment);
      } else {
        connectionManager.sendMessage(selectedFriend.peerId, messageData);
      }
    } else {
      // If no peerId, show message that friend needs to add their peer ID
      showNotification('Friend needs to add their peer ID to receive messages');
    }
  }

  // Draft-Updates vom Chat entgegennehmen
  function handleDraftUpdate(event: CustomEvent<{ text: string; pendingUpload: PendingUpload }>) {
    if (!selectedFriend) return;
    const key = selectedFriend.peerId || selectedFriend.displayName;
    chatDrafts[key] = { text: event.detail.text, pendingUpload: event.detail.pendingUpload };
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
  function showBrowserNotification(title: string, body: string, peerId?: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, { 
        body, 
        icon: '/favicon.png',
        tag: peerId || 'general', // Prevent duplicate notifications from same sender
        requireInteraction: false // Auto-close after a few seconds
      });
      
      // Make notification clickable to focus the app and select the chat
      notification.onclick = () => {
        window.focus(); // Focus the browser window/tab
        
        if (peerId) {
          // Select the friend's chat
          selectedFriendId = peerId;
          
          // Clear unread count
          const friend = friends.find(f => f.peerId === peerId);
          if (friend) {
            friend.unreadCount = 0;
            friends = friends;
          }
        }
        
        notification.close();
      };
    }
  }
  
  // Anfrage nur, wenn der Browser noch nicht gefragt hat ("default")
  async function requestNotificationPermission() {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        updateNotificationStatus();
        if (permission === 'granted') {
          showNotification(currentTranslations.notificationsEnabled);
        } else if (permission === 'denied') {
          showNotification(currentTranslations.notificationsDenied);
        }
      } else {
        updateNotificationStatus();
      }
    } else {
      notificationStatus = currentTranslations.notificationsNotSupported;
    }
  }
  
  // Erneut anfragen – wird über Einstellungsdialog aufgerufen
  async function reRequestNotificationPermission() {
    if ('Notification' in window) {
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        updateNotificationStatus();
        if (permission === 'granted') {
          showNotification(currentTranslations.notificationsEnabled);
        } else if (permission === 'denied') {
          showNotification(currentTranslations.notificationsDenied);
        }
      } else {
        updateNotificationStatus();
      }
    } else {
      notificationStatus = currentTranslations.notificationsNotSupported;
    }
  }
  
  // Update notification status display (reactive to language changes)
  $: if (language && browser) {
    if ('Notification' in window) {
      switch (Notification.permission) {
        case 'granted':
          notificationStatus = translations[language].notificationsActivated || 'Activated';
          break;
        case 'denied':
          notificationStatus = translations[language].notificationsBlocked || 'Blocked';
          break;
        case 'default':
          notificationStatus = translations[language].notificationsNotRequested || 'Not requested';
          break;
      }
    } else {
      notificationStatus = translations[language].notificationsNotSupported || 'Not supported';
    }
  }
  
  // Legacy function for manual updates (now mostly unused)
  function updateNotificationStatus() {
    // This function is now mostly handled by the reactive statement above
    // but keeping it for compatibility with existing calls
  }
  
  // Test function for push notifications (for development/debugging)
  function testPushNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
      showBrowserNotification('Test Nachricht', 'Dies ist eine Test-Push-Notification!');
      console.log('Test-Push-Notification gesendet');
    } else {
      console.log('Push-Notifications nicht verfügbar oder nicht erlaubt');
      showNotification(currentTranslations.notificationsNotAvailable);
    }
  }
  
  // Make test function available globally for debugging
  if (browser && typeof window !== 'undefined') {
    (window as any).testPushNotification = testPushNotification;
  }
  
  // Get current chat messages
  $: currentChatMessages = selectedFriend 
    ? (chatMessages[selectedFriend.peerId || selectedFriend.displayName] || []) 
    : [];
  // Helper: aktueller Friend-Key
  $: currentFriendKey = selectedFriend ? (selectedFriend.peerId || selectedFriend.displayName) : '';
  // Drafts für aktuellen Freund
  $: currentDraft = currentFriendKey ? (chatDrafts[currentFriendKey] || { text: '', pendingUpload: null }) : { text: '', pendingUpload: null };
  
  // Get selected friend
  $: selectedFriend = friends.find(f => 
    (f.peerId && f.peerId === selectedFriendId) || 
    (!f.peerId && f.displayName === selectedFriendId)
  );
  
  // Update session storage debug info
  function updateSessionStorageDebugInfo() {
    if (!browser) return;
    
    try {
      const debugInfo = {
        accountPackage,
        backendUrl,
        accountName,
        profileId,
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
  
  // Update status display für jeden Freund
  // (dotCount / Animation nicht mehr benötigt)
  
  
  function updateCountdowns() {
    // Anzeige des "last seen"-Status je Freund
    const nowMs = Date.now();

    friends.forEach(friend => {
      if (!friend.peerId) return;

      // Entferne Status für verbundene Freunde
      if (friend.isConnected) {
        if (handshakeCountdowns[friend.peerId] !== undefined) {
          delete handshakeCountdowns[friend.peerId];
        }
        return;
      }

      const lastSeen = lastSeenTimestamps[friend.peerId];
      if (lastSeen) {
        handshakeCountdowns[friend.peerId] = createLastSeenText(lastSeen, { lang: language, t: (key) => getTranslation(language, key as any), nowMs });
      } else {
        handshakeCountdowns[friend.peerId] = getTranslation(language, 'lastSeenUnknown' as any);
      }
    });

    // Reaktivität auslösen
    handshakeCountdowns = { ...handshakeCountdowns };
  }
  
  // Start display loop for connection status
  async function startHandshakeLoop() {
    if (handshakeLoopRunning) return;
    handshakeLoopRunning = true;
    
    // Start the countdown update interval
    const intervalId = setInterval(updateCountdowns, 500);
    
    while (handshakeLoopRunning) {
      // Check if all friends are connected
      const disconnectedFriends = friends.filter(f => !f.isConnected && f.peerId);
      if (disconnectedFriends.length === 0) {
        // All friends are connected, stop the loop
        handshakeLoopRunning = false;
        clearInterval(intervalId);
        console.log('All friends connected, stopping status display loop');
        break;
      }
      
      // Sleep for 1s before next check
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Initialize status display and connections for all friends
  function startAutoReconnect() {
    // Only initialize status for disconnected friends with peerId
    friends.forEach(friend => {
      // If friend is already connected, don't interfere
      if (friend.isConnected) {
        return;
      }
      
      // Skip friends without peerId
      if (!friend.peerId) {
        return;
      }
      
      // Initialize connection for this friend
      startHandshakeForFriend(friend.peerId);
    });
    
    // Start the handshake loop if not already running
    if (!handshakeLoopRunning) {
      startHandshakeLoop();
    }
  }
  
  // Initialize status display and connection for a specific friend
  function startAutoReconnectForFriend(peerId: string) {
    // Check current connection state
    const connection = connectionManager.getConnection(peerId);
    if (connection && connection.isConnected) {
      console.log(`[${peerId}] Already connected, not showing status`);
      return;
    }
    
    // Initialize status display
    console.log(`[${peerId}] Initializing connection status display`);
    
    // Start the connection attempt
    startHandshakeForFriend(peerId);
    
    // Start the handshake loop if not already running
    if (!handshakeLoopRunning) {
      startHandshakeLoop();
    }
  }
  
  // Start handshake for a specific friend
  async function startHandshakeForFriend(peerId: string) {
    if (!profileId || !peerId) return;
    
    // Check if we're already trying to connect to this peer
    const existingConnection = connectionManager.getConnection(peerId);
    if (existingConnection && (existingConnection.isConnecting || existingConnection.isConnected)) {
      console.log(`[${peerId}] Connection already ${existingConnection.isConnected ? 'established' : 'in progress'}`);
      return;
    }
    
    try {
      // Find the friend to get their scratchpad address
      const friend = friends.find(f => f.peerId === peerId);
      if (!friend || !friend.scratchpadAddress) {
        console.error(`No scratchpad address found for friend ${peerId}`);
        return;
      }
      
      // Determine priority based on contact ID comparison (friend-specific)
      const isHighPriority = calculateFriendPriority(friend);
      
      // Ensure we have valid addresses (non-undefined)
      const myAddress = friend.scratchpadAddress;
      if (!myAddress) {
        console.error(`[${peerId}] Missing my scratchpad address for connection`);
        return;
      }
      
      // PublicKey des Freundes auslesen (falls vorhanden)
      let friendPublicKeyPem: string | undefined;
      if (friendRequestManager && friend?.targetProfileId) {
        try {
          const friendProfile = await friendRequestManager.readProfile(friend.targetProfileId!);
          friendPublicKeyPem = friendProfile?.publicKeyPem;
        } catch (e) {
          console.warn('⚠️ Konnte PublicKey des Freundes nicht lesen', e);
        }
      }
      
      console.log(`[${peerId}] Using smokesigns for connection with priority: ${isHighPriority ? 'true (initiator)' : 'false (responder)'}`);
      console.log(`[${peerId}] Using addresses: read=${peerId}, write=${myAddress}`);
      
      // Create new connection using smokesigns integration with DwebConnector
      // @ts-ignore  – optionale RSA-Schlüssel können undefined sein
      connectionManager.createConnectionUsingSigns(
        peerId,
        myAddress, // my write address
        peerId,    // their read address
        isHighPriority,
        backendUrl,
        profileId, // my profileId
        friend.targetProfileId || '', // their profileId
        myPrivateKeyPem,
        friendPublicKeyPem
      );
      
      // Für Debugging-Zwecke: Füge einen Timeout hinzu, der nach 35 Sekunden prüft, ob die Verbindung erfolgreich war
      setTimeout(() => {
        const conn = connectionManager.getConnection(peerId);
        if (conn && !conn.isConnected) {
          console.log(`[${peerId}] Connection check after 35s: Not connected. Role: ${isHighPriority ? 'Initiator' : 'Responder'}`);
        } else if (conn && conn.isConnected) {
          console.log(`[${peerId}] Connection check after 35s: Successfully connected!`);
        }
      }, 35000);
      
    } catch (error) {
      console.error(`[${peerId}] Handshake failed:`, error);
      updateFriendConnectionStatus(peerId, false);
    }
  }
  
  // Validate that contact ID is in correct handshake server format (96-char hex)
  function validateHandshakeAddress(contactId: string): boolean {
    const hexPattern = /^[a-f0-9]{96}$/;
    return hexPattern.test(contactId);
  }

  // Check if we have the necessary data to start a handshake
  function canStartHandshake(peerId: string): boolean {
    if (!profileId || !peerId) return false;
    
    const friend = friends.find(f => f.peerId === peerId);
    return !!(friend && friend.scratchpadAddress);
  }

  // Calculate priority for a specific friend based on contact IDs
  function calculateFriendPriority(friend: any): boolean {
    if (!friend.scratchpadAddress) return false;
    
    const myContactId = friend.scratchpadAddress; // My contact ID for this friend
    const theirPeerId = friend.peerId; // Their peer ID (their contact ID for me)
    
    // Convert IDs to numbers for comparison
    // Use a simple hash of the first 16 hex characters
    const myValue = parseInt(myContactId.substring(0, 16), 16);
    const theirValue = parseInt(theirPeerId.substring(0, 16), 16);
    
    // Higher value has priority and creates the offer
    const isHighPriority = myValue > theirValue;
    
    // Add detailed logging to diagnose connection issues
    console.log(`[${friend.peerId}] Priority calculation:`);
    console.log(`  My contact ID: ${myContactId.substring(0, 16)}... = ${myValue}`);
    console.log(`  Their peer ID: ${theirPeerId.substring(0, 16)}... = ${theirValue}`);
    console.log(`  I have priority (will initiate): ${isHighPriority}`);
    
    return isHighPriority;
  }

  // Friend Request Event Handlers
  function handleShowFriendRequestModal() {
    showFriendRequestModal = true;
  }
  
  function handleCloseFriendRequestModal() {
    showFriendRequestModal = false;
  }
  
  async function handleSendFriendRequest(event: CustomEvent<{ profileId: string; displayName: string }>) {
    const { profileId, displayName } = event.detail;
    
    if (!friendRequestManager) {
      showNotification(currentTranslations.errorSendingRequest);
      return;
    }
    
    try {
      // Create or get friend scratchpad for handshake
      const scratchpadAddress = await createOrGetFriendScratchpad(profileId);
      
      // Send friend request with handshake address
      await friendRequestManager.sendFriendRequest(profileId, scratchpadAddress, displayName);
      
      // Add friend to local list (without peerId yet)
      const newFriend: Friend = {
        displayName,
        isConnected: false,
        unreadCount: 0,
        scratchpadAddress: scratchpadAddress, // Our handshake address for this friend
        targetProfileId: profileId // Store the target profile ID for matching approvals
      };
      
      // Prüfe, ob bereits ein Friend mit gleichem displayName existiert
      const existingIdx = friends.findIndex(f => f.displayName === displayName);
      if (existingIdx >= 0) {
        // Freund aktualisieren statt neu hinzuzufügen
        console.log('⚠️ Found existing friend with same name in send request:', friends[existingIdx]);
        console.log('🔄 New request data:', newFriend);
        
        // Wichtig: Nur vorhandene Werte übernehmen
        const updatedFriend = {
          ...friends[existingIdx],
          // scratchpadAddress nur überschreiben, wenn newFriend.scratchpadAddress vorhanden ist
          ...(newFriend.scratchpadAddress ? { scratchpadAddress: newFriend.scratchpadAddress } : {}),
          // targetProfileId nur überschreiben, wenn newFriend.targetProfileId vorhanden ist
          ...(newFriend.targetProfileId ? { targetProfileId: newFriend.targetProfileId } : {})
        };
        
        console.log('✅ Updated friend from request:', updatedFriend);
        friends[existingIdx] = updatedFriend;
        friends = [...friends]; // Svelte-Update triggern
      } else {
        friends = [...friends, newFriend];
      }
      
      // Automatically select the newly added friend
      selectedFriendId = newFriend.peerId || newFriend.displayName;
      
      // Update account package
      if (accountPackage) {
        const updatedPackage = {
          ...accountPackage,
          friends: friends.map(f => ({
            peerId: f.peerId,
            displayName: f.displayName,
            scratchpadAddress: f.scratchpadAddress,
            targetProfileId: f.targetProfileId
          }))
        };
        await updateAccountPackage(updatedPackage);
      }
      
      showNotification(currentTranslations.friendRequestSent || 'Friend request sent');
      showFriendRequestModal = false;
    } catch (error) {
      console.error('Error sending friend request:', error);
      showNotification(currentTranslations.errorSendingRequest);
    }
  }
  
  function handleShowFriendRequests() {
    if (pendingFriendRequests.length > 0) {
      selectedFriendRequest = pendingFriendRequests[0];
      loadProfileForRequest(selectedFriendRequest);
      showProfileModal = true;
    }
  }
  
  async function loadProfileForRequest(request: FriendRequest) {
    if (!friendRequestManager || !request.profileId) return;
    
    try {
      const profileData = await friendRequestManager.readProfile(request.profileId!);
      selectedProfileData = profileData;
    } catch (error) {
      console.error('Error loading profile:', error);
      selectedProfileData = null;
    }
  }
  
  function handleCloseProfileModal() {
    showProfileModal = false;
    selectedFriendRequest = null;
    selectedProfileData = null;
  }
  
  async function handleAcceptFriendRequest(event: CustomEvent<{ displayName: string }>) {
    const { displayName } = event.detail;
    
    // Save current request to avoid it being cleared by close handler
    const currentRequest = selectedFriendRequest;
    
    if (!friendRequestManager || !currentRequest) {
      showNotification('Error accepting request');
      return;
    }
    
    try {
      // Create or get friend scratchpad for handshake
      const scratchpadAddress = await createOrGetFriendScratchpad(currentRequest.profileId);
      
      // Send approval with our handshake address
      await friendRequestManager.acceptFriendRequest(currentRequest.profileId, scratchpadAddress);
      
      // Add friend to local list with their handshake address as peerId
      const newFriend: Friend = {
        peerId: currentRequest.request, // Their handshake address from the request
        displayName,
        isConnected: false,
        unreadCount: 0,
        scratchpadAddress: scratchpadAddress, // Our handshake address for this friend
        targetProfileId: currentRequest.profileId // Store their profile ID
      };
      
      // Prüfe, ob bereits ein Friend mit gleichem displayName existiert
      const existingIdx = friends.findIndex(f => f.displayName === displayName);
      if (existingIdx >= 0) {
        // Freund aktualisieren statt neu hinzuzufügen
        console.log('⚠️ Found existing friend with same name, updating:', friends[existingIdx]);
        console.log('🔄 New data:', newFriend);
        
        // Wichtig: peerId immer übernehmen, wenn vorhanden!
        const updatedFriend = {
          ...friends[existingIdx],
          // peerId nur überschreiben, wenn newFriend.peerId vorhanden ist
          ...(newFriend.peerId ? { peerId: newFriend.peerId } : {}),
          // scratchpadAddress nur überschreiben, wenn newFriend.scratchpadAddress vorhanden ist
          ...(newFriend.scratchpadAddress ? { scratchpadAddress: newFriend.scratchpadAddress } : {}),
          // targetProfileId nur überschreiben, wenn newFriend.targetProfileId vorhanden ist
          ...(newFriend.targetProfileId ? { targetProfileId: newFriend.targetProfileId } : {})
        };
        
        console.log('✅ Updated friend:', updatedFriend);
        friends[existingIdx] = updatedFriend;
        friends = [...friends]; // Svelte-Update triggern
      } else {
        friends = [...friends, newFriend];
      }
      
      // Automatically select the newly added friend
      selectedFriendId = newFriend.peerId || newFriend.displayName;
      
      // Update account package
      if (accountPackage) {
        const updatedPackage = {
          ...accountPackage,
          friends: friends.map(f => ({
            peerId: f.peerId,
            displayName: f.displayName,
            scratchpadAddress: f.scratchpadAddress,
            targetProfileId: f.targetProfileId
          }))
        };
        await updateAccountPackage(updatedPackage);
      }
      
      // Remove processed request from my friend request scratchpad
      await friendRequestManager.removeProcessedRequest(currentRequest.profileId);
      
      // Remove from pending requests
      pendingFriendRequests = pendingFriendRequests.filter(r => !(r.profileId === currentRequest.profileId && r.time === currentRequest.time));
      
      showNotification('Friend request accepted');
      handleCloseProfileModal();
      
      // Start connection attempt
      if (newFriend.peerId) {
        startAutoReconnectForFriend(newFriend.peerId);
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      showNotification('Error accepting request');
    }
  }
  
  // Start checking for friend requests
  function startFriendRequestCheck() {
    if (!friendRequestManager) return;
    if (friendRequestCheckInterval) {
      clearInterval(friendRequestCheckInterval);
      friendRequestCheckInterval = null;
    }
    
    // Check immediately
    checkFriendRequests();
    
    // Then check every minute
    friendRequestCheckInterval = setInterval(checkFriendRequests, 60000);
  }
  
  // Check for friend requests periodically
  async function checkFriendRequests() {
    if (!friendRequestManager) return;
    // Stelle sicher, dass der deterministische Private Key bereit ist
    if (!myPrivateKeyPem) {
      console.log('🔑 Private key not ready, deriving before checking friend requests...');
      await ensureKeyPair();
    }
    if ((checkFriendRequests as any)._running) return;
    (checkFriendRequests as any)._running = true;
    
    try {
      const requests = await friendRequestManager.checkPendingRequests();
      
      // Automatically approve requests from existing friends
      for (const request of requests) {
        const existingFriend = friends.find(f => 
          f.displayName === request.displayName || 
          f.targetProfileId === request.profileId
        );
        
        if (existingFriend) {
          console.log(`🔄 Auto-approving request from existing friend: ${existingFriend.displayName}`);
          
          // Send approval automatically
          await friendRequestManager.acceptFriendRequest(request.profileId, existingFriend.scratchpadAddress || '');
          
          // Remove the processed request
          await friendRequestManager.removeProcessedRequest(request.profileId);
          
          // Update friend with new peerId if we don't have one yet
          if (!existingFriend.peerId && request.request) {
            const friendIndex = friends.findIndex(f => f === existingFriend);
            if (friendIndex !== -1) {
              friends[friendIndex] = {
                ...friends[friendIndex],
                peerId: request.request
              };
              friends = [...friends];
              
              // Update account package
              if (accountPackage) {
                const updatedPackage = {
                  ...accountPackage,
                  friends: friends.map(f => ({
                    peerId: f.peerId,
                    displayName: f.displayName,
                    scratchpadAddress: f.scratchpadAddress,
                    targetProfileId: f.targetProfileId
                  }))
                };
                await updateAccountPackage(updatedPackage);
              }
              
              // Start connection attempt
              startAutoReconnectForFriend(request.request);
            }
          }
        }
      }
      
      // Update pending requests list (remove auto-approved ones)
      pendingFriendRequests = requests.filter(request => {
        const existingFriend = friends.find(f => 
          f.displayName === request.displayName || 
          f.targetProfileId === request.profileId
        );
        return !existingFriend; // Only keep requests from non-existing friends
      });
      
      // Check for received approvals
      const approvals = await friendRequestManager.checkReceivedApprovals();
      console.log('🔍 Approvals fetched:', approvals);
      
      for (const approval of approvals) {
        // Find the friend we sent a request to by matching the profile ID
        const friendIndex = friends.findIndex(f => {
          // Match by targetProfileId - this is the profile we sent the request to
          const match = f.targetProfileId === approval.profileId && !f.peerId;
          if (match) {
            console.log('✅ Found matching friend for approval', f.displayName);
          }
          return match;
        });
        
        if (friendIndex >= 0 && approval.approval) {
          // Update friend with their handshake address
          friends[friendIndex] = {
            ...friends[friendIndex],
            peerId: approval.approval // Their handshake address from the approval
          };
          
          // Update account package
          if (accountPackage) {
            const updatedPackage = {
              ...accountPackage,
              friends: friends.map(f => ({
                peerId: f.peerId,
                displayName: f.displayName,
                scratchpadAddress: f.scratchpadAddress,
                targetProfileId: f.targetProfileId
              }))
            };
            await updateAccountPackage(updatedPackage);
          }
          
          showNotification(`Friend request accepted by ${friends[friendIndex].displayName}`);
          
          // Start connection attempt
          startAutoReconnectForFriend(approval.approval);
          
          // Remove the processed approval from the scratchpad
          await friendRequestManager.removeProcessedApproval(approval.profileId);
        } else if (friendIndex === -1 && approval.approval) {
          // Kein passender Freund gefunden (evtl. wurde targetProfileId noch nicht gespeichert) -> neuen Friend anlegen
          console.log('➕ Creating new friend from approval for profile', approval.profileId);
          try {
            let displayName = approval.profileId.slice(0, 8) + '...';
            let scratchpadAddress: string | undefined = undefined;

            // Versuche Profil zu laden, um accountname zu bekommen
            if (friendRequestManager) {
              const profile = await friendRequestManager.readProfile(approval.profileId!);
              if (profile && profile.accountname) {
                displayName = profile.accountname;
              }
            }

            // Erstelle/ermittle eigenes Scratchpad für diesen Freund
            scratchpadAddress = await createOrGetFriendScratchpad(approval.profileId);

            const newFriend: Friend = {
              peerId: approval.approval,
              displayName,
              isConnected: false,
              unreadCount: 0,
              scratchpadAddress,
              targetProfileId: approval.profileId
            };
            
            // Prüfe auf bestehenden Freund mit gleichem Namen
            const existingIdx = friends.findIndex(f => f.displayName === displayName);
            if (existingIdx >= 0) {
              console.log('⚠️ Found existing friend with same name in approval handler:', friends[existingIdx]);
              console.log('🔄 New approval data:', newFriend);
              
              // Wichtig: peerId immer übernehmen, wenn vorhanden!
              const updatedFriend = {
                ...friends[existingIdx],
                // peerId nur überschreiben, wenn newFriend.peerId vorhanden ist
                ...(newFriend.peerId ? { peerId: newFriend.peerId } : {}),
                // scratchpadAddress nur überschreiben, wenn newFriend.scratchpadAddress vorhanden ist
                ...(newFriend.scratchpadAddress ? { scratchpadAddress: newFriend.scratchpadAddress } : {}),
                // targetProfileId nur überschreiben, wenn newFriend.targetProfileId vorhanden ist
                ...(newFriend.targetProfileId ? { targetProfileId: newFriend.targetProfileId } : {})
            };
            
            console.log('✅ Updated friend from approval:', updatedFriend);
            friends[existingIdx] = updatedFriend;
            friends = [...friends]; // Svelte-Update triggern
            } else {
              friends = [...friends, newFriend];
            }

            // Automatically select the newly added friend
            selectedFriendId = newFriend.peerId || newFriend.displayName;

            // Account Package aktualisieren
            if (accountPackage) {
              const updatedPackage = {
                ...accountPackage,
                friends: friends.map(f => ({
                  peerId: f.peerId,
                  displayName: f.displayName,
                  scratchpadAddress: f.scratchpadAddress,
                  targetProfileId: f.targetProfileId
                }))
              };
              await updateAccountPackage(updatedPackage);
            }

            showNotification(`Friend request accepted by ${displayName}`);
            startAutoReconnectForFriend(approval.approval);

            // Approval entfernen
            await friendRequestManager.removeProcessedApproval(approval.profileId);
          } catch (e) {
            console.error('Error creating friend from approval:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error checking friend requests:', error);
    } finally {
      (checkFriendRequests as any)._running = false;
    }
  }

  async function handleDeclineFriendRequest() {
    const req = selectedFriendRequest;
    if (!friendRequestManager || !req) return;
    try {
      await friendRequestManager.removeProcessedRequest(req.profileId);
      pendingFriendRequests = pendingFriendRequests.filter((r: FriendRequest) => !(r.profileId === req.profileId && r.time === req.time));
      showNotification('Friend request declined');
    } catch (error) {
      console.error('Error declining friend request:', error);
      showNotification('Error declining request');
    } finally {
      handleCloseProfileModal();
    }
  }

  // Add handler function near others
  function handleRenameFriend(event: CustomEvent<{newName: string}>) {
    const { newName } = event.detail;
    if (!selectedFriend) return;
    const friendIndex = friends.findIndex((f: Friend) => f === selectedFriend);
    if (friendIndex !== -1) {
      friends[friendIndex] = { ...friends[friendIndex], displayName: newName };
      friends = [...friends];
      // Update selection id if using displayName key
      if (!selectedFriend.peerId) {
        selectedFriendId = newName;
      }
      saveFriends();
    }
  }

  // add function
  function parseDebugFlag(): boolean {
    if (!browser) return false;
    const params = new URLSearchParams(window.location.search);
    const dbg = params.get('debug');
    return dbg !== null && dbg.toLowerCase() === 'true';
  }

  $: {
    if (friends.length > 0) {
      if (!selectedFriend) {
        selectedFriend = friends[0];
      }
      // Log debug info
      console.log('🚀 Friends App Started'); 
      console.log('📦 Debug info available at: sessionStorage.friendsDebugInfo');
      console.log('🔍 To view: JSON.parse(sessionStorage.getItem("friendsDebugInfo"))');
      sessionStorage.setItem('friendsDebugInfo', JSON.stringify({ friends, selectedFriend }));
    }
  }

  // ... existing code ...
  $: if (selectedFriend && !selectedFriend.profileImage && selectedFriend.targetProfileId && friendRequestManager) {
    console.log('Reactive loadProfileImage triggered for', selectedFriend.displayName);
    loadProfileImage(selectedFriend);
  }

  // NEW: Public identifier state
  let publicIdentifiers: string[] = [];
  let showAddPublicIdentifier = false;
  let newPublicIdentifier = '';
  // Lader-Status für Public-Identifier-Erstellung im Wizard
  let publicIdentifierLoading = false;

  // Temporär abgefangener Display-Name, falls das Account-Package noch nicht erstellt ist
  let pendingDisplayName: string | null = null;

  // Keep publicIdentifiers in sync with account package
  $: if (accountPackage && Array.isArray(accountPackage.publicIdentifiers)) {
    publicIdentifiers = [...accountPackage.publicIdentifiers];
  }

  // Helper: build pointer URL
  function buildPointerUrl(objectName: string): string {
    const baseUrl = backendUrl ? `${backendUrl}/dweb-0/pointer` : '/dweb-0/pointer';
    return `${baseUrl}?tries=3&object_name=${encodeURIComponent(objectName)}`;
  }

  // Create public identifier via pointer POST
  async function createPublicIdentifier(identifier: string): Promise<{ success: boolean; code?: 'taken' | 'payment' | 'error' | 'self' }> {
    if (!identifier || !profileId) {
      return { success: false, code: 'error' };
    }

    const service = new DwebService(backendUrl || null, 'friends', FRIENDS_SHARED_GLOBAL_SECRET);
    try {
      const existing = await service.pointer.readPointer(identifier);
      if (existing) {
        const addr = existing.chunk_target_address || existing.pointer_target_address || existing.scratchpad_target_address || '';
        if (addr === profileId) {
          publicIdentifiers = [...new Set([...publicIdentifiers, identifier])];
          if (accountPackage) {
            await updateAccountPackage({ ...accountPackage, publicIdentifiers });
          }
          showAddPublicIdentifier = false;
          newPublicIdentifier = '';
          showNotification(currentTranslations.publicIdentifierAdded);
          return { success: true };
        } else {
          return { success: false, code: 'taken' };
        }
      }

      const result = await service.pointer.createPointerWithErrorDetails(identifier, profileId);
      if (result.success) {
        publicIdentifiers = [...new Set([...publicIdentifiers, identifier])];
        if (accountPackage) {
          await updateAccountPackage({ ...accountPackage, publicIdentifiers });
        }
        showAddPublicIdentifier = false;
        newPublicIdentifier = '';
        showNotification(currentTranslations.publicIdentifierAdded);
        return { success: true };
      } else {
        // Check if it's a payment failure error
        if (result.error?.isPaymentFailure) {
          showPaymentFailureModal = true;
          return { success: false, code: 'payment' };
        }
        return { success: false, code: 'error' };
      }
    } catch (err) {
      console.error('Error creating public identifier', err);
      // Keine Notification hier, Aufrufer entscheidet
      return { success: false, code: 'error' };
    }
  }

  /* ================= Account-Creation-Wizard Handler ================= */
  async function handleWizardStart() {
    // Session anlegen
    currentSessionId = generateSessionId();
    sessionStartTimestamp = Date.now();

    // Display-Name aus Wizard verwenden, falls vorhanden
    const displayNameToUse = pendingDisplayName || 'User';

    const accountData: AccountPackage = {
      version: ACCOUNT_PACKAGE_VERSION,
      username: displayNameToUse,
      themeUrl: 'default',
      language,
      friends: [],
      activeSession: {
        sessionId: currentSessionId,
        timestamp: sessionStartTimestamp
      }
    };

    const success = await createAccountPackage(accountData);
    if (success) {
      accountPackage = accountData;
      startSessionMonitoring();
      // initializePeerCommunication entfällt – comm-Scratchpad wird nicht mehr verwendet

      // FriendRequestManager initialisieren (erstellt/verifiziert Profil-Scratchpad)
      if (accountPackage) {
        friendRequestManager = new FriendRequestManager(backendUrl, '', accountName, myPrivateKeyPem);
        const result = await friendRequestManager.initializeProfileWithErrorDetails();

        if (result.success) {
          profileId = friendRequestManager.getProfileId();
        } else {
          // Check if it's a payment failure error
          if (result.error?.isPaymentFailure) {
            showPaymentFailureModal = true;
          } else {
            showNotification(currentTranslations.connectionError);
          }
        }

        // Hinweis: Accountname im Profil erst setzen, wenn der Nutzer einen echten Namen gewählt hat

        // Update profile image if available
        if (accountPackage.profileImage) {
          await friendRequestManager.updateProfileImage(accountPackage.profileImage);
        }

        // Stelle sicher, dass ein RSA-Schlüsselpaar existiert und PublicKey im Profil gespeichert ist
        await ensureKeyPair();
        await ensureFriendRequestLink();
        startFriendRequestCheck();
      }
    }

    // Wir haben den Namen bereits verwendet, also zurücksetzen
    pendingDisplayName = null;
  }

  async function handleWizardSetDisplayName(e: CustomEvent<string>) {
    const name = e.detail;
    pendingDisplayName = name;
    if (accountPackage) {
      // Optimistische Aktualisierung, damit der Name sofort in der UI erscheint
      accountPackage = { ...accountPackage, username: name };
      const success = await updateAccountPackage({ ...accountPackage, username: name });
      if (success && friendRequestManager) {
        const profile = await friendRequestManager.readMyProfile();
        if (profile) {
          profile.accountname = name;
          delete (profile as any).accountName;
          await friendRequestManager.writeProfile(profile);
        }
      }
    } else {
      // Falls der Nutzer zuerst den Namen setzt, bevor das Package existiert:
      const accountData: AccountPackage = {
        version: ACCOUNT_PACKAGE_VERSION,
        username: name,
        themeUrl: 'default',
        language,
        friends: [],
        activeSession: {
          sessionId: currentSessionId,
          timestamp: sessionStartTimestamp
        }
      };
      const created = await createAccountPackage(accountData);
      if (created) {
        accountPackage = accountData;
        startSessionMonitoring();
        friendRequestManager = new FriendRequestManager(backendUrl, '', accountName, myPrivateKeyPem);
        const result = await friendRequestManager.initializeProfileWithErrorDetails();
        if (result.success) {
          profileId = friendRequestManager.getProfileId();
        } else {
          // Check if it's a payment failure error
          if (result.error?.isPaymentFailure) {
            showPaymentFailureModal = true;
          } else {
            showNotification(currentTranslations.connectionError);
          }
        }
        try {
            const p = await friendRequestManager.readMyProfile();
            if (p) {
              p.accountname = name;
              delete (p as any).accountName;
              await friendRequestManager.writeProfile(p);
            }
          } catch {}
        await ensureKeyPair();
        await ensureFriendRequestLink();
        startFriendRequestCheck();
      }
    }
  }

  async function handleWizardSetProfileImage(e: CustomEvent<string>) {
    const img = e.detail;
    if (accountPackage) {
      const ok = await updateAccountPackage({ ...accountPackage, profileImage: img });
      if (ok && friendRequestManager && img) {
        await friendRequestManager.updateProfileImage(img);
      }
    }
  }

  async function handleWizardAddPublicIdentifier(e: CustomEvent<string>) {
    publicIdentifierLoading = true;
    await createPublicIdentifier(e.detail);
    publicIdentifierLoading = false;
  }

  // Entfernen eines Public Identifiers
  async function removePublicIdentifier(identifier: string): Promise<boolean> {
    try {
      if (!identifier) return false;
      // Lokal entfernen
      publicIdentifiers = publicIdentifiers.filter(id => id !== identifier);
      if (accountPackage) {
        const ok = await updateAccountPackage({ ...accountPackage, publicIdentifiers });
        if (!ok) return false;
      }
      showNotification(currentTranslations.settingsUpdated || 'Settings updated');
      return true;
    } catch (e) {
      console.error('Failed to remove public identifier', e);
      return false;
    }
  }

  function handleWizardFinish() {
    showAccountCreation = false;
    showNotification(currentTranslations.settingsUpdated);

    // Sicherheits-Reinitialisierung: sicherstellen, dass Friend-Request-Scratchpad existiert
    if (friendRequestManager) {
      // Sicherstellen, dass das Profil korrekt initialisiert ist
      friendRequestManager.initializeProfile().then(async () => {
        // Sicherstellen, dass der Display-Name im Profil korrekt gesetzt ist
        if (accountPackage && profileId) {
          // Nur aktualisieren, wenn der Name nicht der Platzhalter 'User' ist
          if (accountPackage.username && accountPackage.username !== 'User') {
            const profile = await friendRequestManager?.readProfile(profileId!);
            if (profile && profile.accountname !== accountPackage.username) {
              console.log('🔄 Aktualisiere Display-Name im Profil:', accountPackage.username);
              profile.accountname = accountPackage.username;
              delete (profile as any).accountName; // Altes Feld entfernen
              await friendRequestManager?.writeProfile(profile);
            }
          }
        }
      });
    }
  }

  // Debounced Display-Name-Speicherung
  let displayNameDraft = '';
  let displayNameSaveTimeout: ReturnType<typeof setTimeout> | null = null;

  $: if (accountPackage) {
    displayNameDraft = accountPackage.username;
  }

  function scheduleDisplayNameSave(name: string) {
    if (displayNameSaveTimeout) clearTimeout(displayNameSaveTimeout);
    displayNameSaveTimeout = setTimeout(() => {
      saveDisplayName(name.trim());
    }, 1000);
  }

  async function saveDisplayName(name: string) {
    if (!accountPackage || !name || name === accountPackage.username) return;
    const success = await updateAccountPackage({ ...accountPackage, username: name });
    if (success && friendRequestManager && profileId) {
      const profile = await friendRequestManager.readMyProfile();
      if (profile) {
        profile.accountname = name;
        delete (profile as any).accountName;
        await friendRequestManager.writeProfile(profile);
      }
    }
    showNotification(currentTranslations.settingsUpdated);
  }

  // Namensabgleich erfolgt nun direkt in ensureKeyPair(), kein separater reaktiver Guard mehr nötig

  // Stellt sicher, dass im Profil ein Friend-Request-Scratchpad verlinkt ist
  async function ensureFriendRequestLink() {
    if (!friendRequestManager || !profileId) return;
    try {
      console.log('🔍 ensureFriendRequestLink() called');
      // Verwende die neue Methode im FriendRequestManager
      const success = await friendRequestManager.ensureFriendRequestLink();
      if (success) {
        console.log('✅ Friend-Request-Scratchpad-Link erfolgreich gesichert');
      } else {
        console.warn('⚠️ Konnte Friend-Request-Scratchpad-Link nicht sicherstellen');
      }
    } catch (e) {
      console.error('Error ensuring friend request link', e);
    }
  }

  // Nachdem das Account-Package angelegt wurde, evtl. wartenden Display-Name übernehmen
  $: if (accountPackage && pendingDisplayName && accountPackage.username !== pendingDisplayName) {
      accountPackage = { ...accountPackage, username: pendingDisplayName };
      // Backend-Update asynchron starten (kein await in reactive block)
      updateAccountPackage({ ...accountPackage, username: pendingDisplayName });
      if (friendRequestManager && profileId) {
        friendRequestManager?.readProfile(profileId!).then(p => {
          if (p) {
            p.accountname = pendingDisplayName!;
            delete (p as any).accountName;
            friendRequestManager?.writeProfile(p);
          }
        });
      }
      pendingDisplayName = null;
  }

  // Connection status is now updated reactively above

  // Stelle sicher, dass ein RSA-Schlüsselpaar existiert und PublicKey im Profil gespeichert ist
  async function ensureKeyPair(force: boolean = false) {
    if (!accountPackage || !friendRequestManager) return;

    // Hilfsfunktionen
    function bufferToPem(buffer: ArrayBuffer, label: string): string {
      const binary = String.fromCharCode(...new Uint8Array(buffer));
      const base64 = btoa(binary);
      const lines = base64.match(/.{1,64}/g) || [];
      return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
    }

    // 1) Private Scratchpad-Adresse holen (Account-Package liegt dort)
    try {
      const service = getDwebService(backendUrl || null, 'friends');
      let address = '';
      if (accountName) {
        // Mit object_name arbeiten
        service.privateScratchpad.setObjectName(accountName);
        await service.privateScratchpad.readCurrent<AccountPackage>();
        address = service.privateScratchpad.getAddress();
      } else {
        // Default-Private-Scratchpad (ohne object_name)
        const res = await service.privateScratchpad.readScratchpad<AccountPackage>('');
        address = (res?.scratchpad_address || (res as any)?.network_address || '');
      }
      if (!address) {
        console.warn('⚠️ Keine private Scratchpad-Adresse verfügbar');
        return;
      }

      // 2) Deterministischen RSA-Key aus Adresse ableiten
      const { privateKeyPem, publicKeyPem } = await deriveDeterministicRsaFromScratchpadAddress(address);
      myPrivateKeyPem = privateKeyPem;
      friendRequestManager?.setPrivateKeyPem?.(privateKeyPem);

      // 3) Falls im Account-Package noch ein privateKeyPem liegt, entfernen und speichern
      if (accountPackage.privateKeyPem) {
        const cleaned: Partial<AccountPackage> = { ...accountPackage };
        delete (cleaned as any).privateKeyPem;
        const ok = await updateAccountPackage({ ...cleaned, privateKeyPem: undefined });
        if (ok) {
          accountPackage = { ...(accountPackage as AccountPackage) };
          delete (accountPackage as any).privateKeyPem;
          console.log('🧹 PrivateKey aus Account-Package entfernt');
        }
      }

      // 4) Public Key im Profil prüfen/korrigieren
      if (!profileId) {
        // Profil-ID kann hier nach initializeProfile erst gesetzt werden; wir versuchen zu lesen, wenn vorhanden
        try {
          const result = await friendRequestManager.initializeProfileWithErrorDetails();
          if (result.success) {
            profileId = friendRequestManager.getProfileId();
          } else {
            // Check if it's a payment failure error
            if (result.error?.isPaymentFailure) {
              showPaymentFailureModal = true;
            } else {
              showNotification(currentTranslations.connectionError);
            }
          }
        } catch (_) { /* ignore */ }
      }

      try {
        const prof = await friendRequestManager.readMyProfile();
        if (prof) {
          let changed = false;
          if (prof.publicKeyPem !== publicKeyPem) {
            prof.publicKeyPem = publicKeyPem;
            changed = true;
          }
          if (accountPackage?.username && prof.accountname !== accountPackage.username) {
            prof.accountname = accountPackage.username;
            delete (prof as any).accountName;
            changed = true;
          }
          if (changed) {
            await friendRequestManager.writeProfile(prof);
            console.log('✅ Profil aktualisiert (Key/Name konsistent)');
          }
        }
      } catch (e) {
        console.warn('⚠️ Konnte eigenes Profil nicht lesen/aktualisieren', e);
      }
    } catch (e) {
      console.error('❌ ensureKeyPair failed', e);
    }
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

  <!-- Account creation wizard -->
  {#if showAccountCreation}
    <AccountCreationWizard
      language={language}
      incomplete={false}
      profileInitializing={!profileId}
      publicIdentifierLoading={publicIdentifierLoading}
      publicIdentifiers={publicIdentifiers}
      backendUrl={backendUrl}
      on:start={handleWizardStart}
      on:setDisplayName={handleWizardSetDisplayName}
      on:setProfileImage={handleWizardSetProfileImage}
      on:addPublicIdentifier={handleWizardAddPublicIdentifier}
      on:finish={handleWizardFinish}
    />
  {/if}

  <div class="header-container">
    <StatusBar 
      appTitle="Friends"
      on:openSettings={() => showSettingsModal = true}
    />
    <div class="header-buttons" aria-label="header actions">
      <FriendRequestNotification
        pendingRequests={pendingFriendRequests.length}
        language={language}
        on:click={handleShowFriendRequests}
      />
    </div>
  </div>
  
  <div class="container">
    <div class="sidebar">
      <FriendsList
        {friends}
        {selectedFriendId}
        {profileId}
        myUsername={accountPackage?.username || 'User'}
        {handshakeCountdowns}
        language={language}
        profileImage={accountPackage?.profileImage || ''}
        {backendUrl}
        publicIdentifiers={publicIdentifiers}
        debug={debugMode}
        on:selectFriend={handleSelectFriend}
        on:addFriend={handleShowFriendRequestModal}
        on:removeFriend={handleRemoveFriend}
        on:notification={(e) => showNotification(e.detail)}
      />
        </div>
        
    <div class="main-content">
      {#if selectedFriend}
        <Chat
          friend={selectedFriend}
          messages={currentChatMessages}
          myNick={accountPackage?.username || 'User'}
          isConnected={selectedFriend.isConnected}
          friendName={selectedFriend.displayName}  
          friendPeerId={selectedFriend.peerId}
          friendScratchpadAddress={selectedFriend.scratchpadAddress}
          isLoadingScratchpad={selectedFriend.isLoadingScratchpad}
          scratchpadError={selectedFriend.scratchpadError}
          requestSent={!!selectedFriend.scratchpadAddress && !selectedFriend.peerId}
          language={language}
          debug={debugMode}
          backendUrl={backendUrl}
          friendKey={currentFriendKey}
          draftText={currentDraft.text}
          draftPendingUpload={currentDraft.pendingUpload}
          on:sendMessage={handleSendMessage}
          on:updatePeerId={handleUpdatePeerId}
          on:renameFriend={handleRenameFriend}
          on:draftUpdate={handleDraftUpdate}
        />
      {:else}
        <div class="no-friend-selected">
          <h2>{currentTranslations.welcome}</h2>
          <p>{currentTranslations.noFriendSelected}</p>
        </div>  
      {/if}
    </div>
  </div>
  
  {#if notification}
    <div class="notification">
      {notification}
                </div>
                  {/if}
  
  {#if !isSessionActive}
    <div class="session-overlay">
      <div class="session-message">
        <h2>⚠️ {currentTranslations.sessionTransferred}</h2>
        <p>{currentTranslations.sessionDeactivatedMessage}</p>
        <button class="primary-button" on:click={() => window.location.reload()}>
          {currentTranslations.reload}
        </button>
      </div>
    </div>
  {/if}

  {#if showMigrationNotice}
    <div class="session-overlay">
      <div class="session-message">
        <h2>⚠️ {currentTranslations.migrationNoticeTitle}</h2>
        <p>{currentTranslations.migrationNoticeMessage}</p>
        <button class="primary-button" on:click={() => (showMigrationNotice = false)}>
          {currentTranslations.migrationNoticeAcknowledge}
        </button>
      </div>
    </div>
  {/if}
  
  <!-- Settings Modal -->
  {#if showSettingsModal && accountPackage}
    <SettingsModal
      {accountPackage}
      {language}
      {backendUrl}
      {notificationStatus}
      {publicIdentifiers}
      {friendRequestManager}
      {changeLanguage}
      {updateAccountPackage}
      {loadTheme}
      {scheduleDisplayNameSave}
      {reRequestNotificationPermission}
      {createPublicIdentifier}
      {removePublicIdentifier}
      {showNotification}
      on:close={() => showSettingsModal = false}
    />
  {/if}
  
  <!-- Friend Request Modal -->
  {#if showFriendRequestModal}
    <FriendRequestModal
      {friendRequestManager}
      language={language}
      on:close={handleCloseFriendRequestModal}
      on:friendRequestSent={handleSendFriendRequest}
    />
  {/if}
  
  <!-- Profile Modal for incoming friend requests -->
  {#if showProfileModal && selectedFriendRequest}
    <ProfileModal
      friendRequest={selectedFriendRequest}
      profileData={selectedProfileData}
      {friendRequestManager}
      language={language}
      on:close={handleCloseProfileModal}
      on:decline={handleDeclineFriendRequest}
      on:accept={handleAcceptFriendRequest}
    />
  {/if}

  <!-- Payment Failure Modal -->
  <PaymentFailureModal
    language={language}
    visible={showPaymentFailureModal}
    onClose={() => (showPaymentFailureModal = false)}
  />
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
    position: relative;
  }
  
  .modal-content h2 {
    margin: 0 0 1rem 0;
  }
  
  .close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .close-button:hover {
    opacity: 1;
  }
  
  .settings-container {
    margin: 1.5rem 0;
  }
  
  .setting-group {
    margin-bottom: 1.5rem;
  }
  
  .setting-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  
  .setting-group input,
  .setting-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--line-color);
    border-radius: 6px;
    background: var(--background-color);
    color: inherit;
    font-size: 0.9rem;
  }
  
  .preview {
    margin-top: 0.5rem;
    max-width: 100px;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .preview img {
    width: 100%;
    height: auto;
    display: block;
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
  .secondary-button,
  .danger-button {
    padding: 0.6rem 1.2rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: opacity 0.2s;
  }
  
  .primary-button {
    background: var(--notification-color);
    color: #fff;
  }
  
  .secondary-button {
    background: var(--foreground-color2);
  }
  
  .danger-button {
    background: #dc3545;
    color: white;
  }
  
  .primary-button:hover,
  .secondary-button:hover,
  .danger-button:hover {
    opacity: 0.8;
  }
  
  .container {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  
  .sidebar {
    width: 280px;
    min-width: 220px;
    max-width: 400px;
    background: var(--foreground-color2);
    display: flex;
    flex-direction: column;
    resize: horizontal;
    overflow: auto;
    border-right: 1px solid var(--line-color);
  }
  
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--background-color);
  }
  
  .no-friend-selected {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-color);
    opacity: 0.6;
    text-align: center;
    padding: 2rem;
  }
  
  .notification {
    position: fixed;
    top: 16px;
    right: 16px;
    background: var(--notification-color);
    color: #fff;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    z-index: 2000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: min(420px, 80vw);
    word-break: break-word;
  }
  
  .session-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3000;
    backdrop-filter: blur(5px);
  }
  
  .session-message {
    background: var(--background-color);
    padding: 2rem;
    border-radius: 12px;
    text-align: center;
    max-width: 400px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }
  
  .header-container {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid var(--line-color);
  }
  
  .header-buttons {
    display: flex;
    align-items: center;
    margin-left: auto;
    padding: 0 0.75rem;
    background: var(--foreground-color1);
    height: 100%;
    min-height: 48px;
    border-bottom: 1px solid var(--line-color);
  }

  .public-identifiers {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0;
  }

  .public-identifiers li {
    background: var(--foreground-color2);
    padding: 0.5rem;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  .public-id-input {
    display: flex;
    gap: 0.5rem;
  }
  .public-id-input input { flex: 1; }
  .confirm-button {
    background: var(--notification-color);
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0 0.75rem;
    cursor: pointer;
  }
  .add-button {
    background: var(--foreground-color2);
    border: 1px solid var(--line-color);
    border-radius: 50%;
    width: 1.75rem;
    height: 1.75rem;
    cursor: pointer;
    font-size: 1.2rem;
    margin-top: 0.25rem;
  }
  .add-button:hover, .confirm-button:hover {
    opacity: 0.8;
  }
</style>