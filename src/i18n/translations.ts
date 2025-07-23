// Definiere den Typ für Übersetzungsschlüssel
export type TranslationKey = 
  // Header translations
  | 'dwebApp'
  | 'status'
  | 'handshake'
  | 'accountSettings'
  | 'noConnections'
  | 'oneConnected'
  | 'multipleConnected'
  | 'notificationsActivated'
  | 'notificationsBlocked'
  | 'notificationsNotRequested'
  | 'notificationsNotSupported'
  | 'settings'
  | 'proxy'
  | 'partner'
  | 'encryptionKey'
  | 'nickname'
  | 'connect'
  | 'disconnect'
  | 'loading'
  | 'connected'
  | 'wsStatus'
  | 'peerStatus'
  | 'meInfo'
  | 'messagePlaceholder'
  | 'send'
  | 'wsConnected'
  | 'wsDisconnected'
  | 'wsError'
  | 'peerNoConnection'
  | 'peerWaitingWs'
  | 'peerWaitingUdp'
  | 'peerConnectionActive'
  | 'peerConnectionError'
  | 'peerStatusUnknown'
  | 'fillAllFields'
  | 'unknownError'
  | 'infoCopied'
  | 'messageError'
  | 'unknown'
  | 'ollamaConnect'
  | 'ollamaNoServer'
  | 'ollamaLiveTranslation'
  | 'ollamaModel'
  | 'ollamaShowOriginal'
  | 'ollamaTranslateOutgoing'
  | 'ollamaTargetLanguage'
  | 'showOriginalText'
  | 'originalMessage'
  | 'translatedMessage'
  | 'targetLanguageRequired'
  | 'translationError'
  // File attachment translations
  | 'attachFile'
  | 'fileSelected'
  | 'fileDownload'
  | 'fileReceiving'
  | 'fileTooLarge'
  | 'theme'
  | 'lightMode'
  | 'darkMode'
  | 'welcome'
  | 'noFriendSelected'
  // Account Settings
  | 'profileImage'
  | 'enterDatamapAddress'
  | 'themeUrl'
  | 'enterThemeUrl'
  | 'language'
  // Public identifier management
  | 'publicIdentifier'
  | 'enterPublicIdentifier'
  | 'publicIdentifierAdded'
  | 'publicNameTaken'
  // Account creation wizard
  | 'createFriendsAccount'
  | 'finishAccountCreation'
  | 'chooseDisplayName'
  | 'setProfileImageOptional'
  | 'choosePublicIdentifierOptional'
  | 'waitingProfileInitialization'
  | 'creatingPublicIdentifier'
  | 'noAccountPackageFoundQuestion'
  | 'settingsUpdated'
  // Friends
  | 'addFriend'
  | 'removeFriend'
  | 'friendPeerId'
  | 'enterPeerId'
  | 'friendName'
  | 'enterFriendName'
  | 'selectFriend'
  | 'peerIdCopied'
  | 'friendAdded'
  | 'friendRemoved'
  // Friend Requests
  | 'profileId'
  | 'enterProfileId'
  | 'profileIdOrPublicIdentifier'
  | 'enterIdOrIdentifier'
  | 'findFriend'
  | 'displayName'
  | 'enterDisplayName'
  | 'sendFriendRequest'
  | 'acceptFriendRequest'
  | 'friendRequestSent'
  | 'friendRequestAccepted'
  | 'waitingForResponse'
  | 'newFriendRequests'
  | 'sending'
  | 'back'
  | 'cancel'
  | 'addNewFriend'
  | 'loadProfile'
  | 'profilePreview'
  | 'profileNotFound'
  | 'errorLoadingProfile'
  | 'errorSendingRequest'
  | 'errorAcceptingRequest'
  // Chat
  | 'typeMessage'
  | 'connectFirst'
  | 'noMessages'
  | 'waitForFriendOnline'
  // Connection states
  | 'notConnected'
  | 'connecting'
  | 'initializing'
  | 'backendError'
  // Errors
  | 'connectionError'
  | 'invalidPeerId'
  | 'friendExists'
  // Notifications
  | 'notificationsEnabled'
  | 'notificationsDenied'
  | 'notificationsNotAvailable'
  | 'requestAgain'
  | 'pushNotifications'
  // Session management
  | 'sessionTransferred'
  | 'sessionDeactivatedMessage'
  | 'reload'
  ;

// Definiere den Typ für die Sprachen
export type Language = 'en' | 'de' | 'fr' | 'es' | 'bg' | 'ja' | 'ko' | 'zh';

// Definiere den Typ für die Übersetzungstabelle
export type Translations = {
  [lang in Language]: Partial<Record<TranslationKey, string>>;
};

// Die Übersetzungen für alle unterstützten Sprachen
export const translations: Translations = {
  // English
  en: {
    // Header translations
    dwebApp: 'a dweb app',
    status: 'Status',
    handshake: 'Handshake',
    accountSettings: 'Account Settings',
    noConnections: 'No connections',
    oneConnected: '1 friend connected',
    multipleConnected: '{count} friends connected',
    notificationsActivated: 'Activated',
    notificationsBlocked: 'Blocked',
    notificationsNotRequested: 'Not requested',
    notificationsNotSupported: 'Not supported',
    
    settings: 'Settings',
    proxy: 'Proxy:',
    partner: 'Partner:',
    encryptionKey: 'Encryption Key:',
    nickname: 'Nickname:',
    connect: 'Connect',
    disconnect: 'Disconnect',
    loading: 'Loading...',
    connected: 'Connected',
    wsStatus: 'Proxy:',
    peerStatus: 'Partner:',
    meInfo: 'Me:',
    messagePlaceholder: 'Write your message... (Enter to send, Shift+Enter for new line)',
    send: 'Send',
    wsConnected: 'Connected',
    wsDisconnected: 'Disconnected',
    wsError: 'Error',
    peerNoConnection: 'Disconnected',
    peerWaitingWs: 'Waiting for WebSocket',
    peerWaitingUdp: 'Waiting for UDP',
    peerConnectionActive: 'Connected',
    peerConnectionError: 'Error: ',
    peerStatusUnknown: 'Unknown status: ',
    fillAllFields: 'Please fill all fields',
    unknownError: 'Unknown error',
    infoCopied: 'Connection info copied!',
    messageError: 'Error sending message!',
    unknown: 'Unknown',
    ollamaConnect: 'Ollama Connect',
    ollamaNoServer: 'No local Ollama server available. Live translation not possible.',
    ollamaLiveTranslation: 'Enable live translation',
    ollamaModel: 'Ollama model:',
    ollamaShowOriginal: 'Always show original message',
    ollamaTranslateOutgoing: 'Translate outgoing messages',
    ollamaTargetLanguage: 'Target language:',
    showOriginalText: 'Show original text',
    originalMessage: 'Original:',
    translatedMessage: 'Automatic translation:',
    targetLanguageRequired: 'Target language is required for translation!',
    translationError: 'Translation failed',
    
    // File attachment translations
    attachFile: 'Attach file',
    fileSelected: 'File selected: ',
    fileDownload: 'Download',
    fileReceiving: 'Receiving file: ',
    fileTooLarge: 'File is too large. Maximum size: ',
    theme: 'Theme',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    
    // Account settings
    profileImage: 'Profile Image',
    enterDatamapAddress: 'Enter datamap address',
    themeUrl: 'Theme URL',
    enterThemeUrl: 'Enter theme URL',
    language: 'Language',
    
    // Public identifier management
    publicIdentifier: 'Public Identifier',
    enterPublicIdentifier: 'Enter public identifier',
    publicIdentifierAdded: 'Public identifier added',
    publicNameTaken: 'Public name already taken - please use a different name',
    
    // Account creation wizard
    createFriendsAccount: 'Create Friends Account',
    finishAccountCreation: 'Finish Account Creation',
    chooseDisplayName: 'Choose your display name',
    setProfileImageOptional: 'You can set a profile image here (optional)',
    choosePublicIdentifierOptional: 'Choose searchable public identifier (optional)',
    waitingProfileInitialization: 'Please wait while profile is being initialized',
    creatingPublicIdentifier: 'Creating public identifier...',
    noAccountPackageFoundQuestion: 'No account package found. Would you like to create one?',
    
    settingsUpdated: 'Settings updated successfully',
    
    // Friends
    addFriend: 'Add Friend',
    removeFriend: 'Remove Friend',
    friendPeerId: 'Friend\'s Peer ID',
    enterPeerId: 'Enter Peer ID',
    friendName: 'Friend\'s Name',
    enterFriendName: 'Enter name',
    selectFriend: 'Select a friend',
    peerIdCopied: 'Friend\'s Peer ID copied!',
    friendAdded: 'Friend added',
    friendRemoved: 'Friend removed',
    
    // Friend Requests
    profileId: 'Profile ID',
    enterProfileId: 'Enter friend\'s Profile ID',
    profileIdOrPublicIdentifier: 'Profile ID or public identifier',
    enterIdOrIdentifier: 'Enter Profile ID or public identifier',
    findFriend: 'Find Friend',
    displayName: 'Display Name',
    enterDisplayName: 'Enter display name for this contact',
    sendFriendRequest: 'Send Friend Request',
    acceptFriendRequest: 'Accept Friend Request',
    friendRequestSent: 'Friend request sent',
    friendRequestAccepted: 'Friend request accepted',
    waitingForResponse: 'Waiting for response...',
    newFriendRequests: 'New friend requests',
    sending: 'Sending...',
    back: 'Back',
    cancel: 'Cancel',
    addNewFriend: 'Add New Friend',
    loadProfile: 'Load Profile',
    profilePreview: 'Profile Preview',
    profileNotFound: 'Profile not found',
    errorLoadingProfile: 'Error loading profile',
    errorSendingRequest: 'Error sending friend request',
    errorAcceptingRequest: 'Error accepting friend request',
    
    // Chat
    typeMessage: 'Type a message...',
    connectFirst: 'Connect first to send messages',
    noMessages: 'No messages yet. Start a conversation!',
    waitForFriendOnline: 'Cannot send messages - waiting for friend to come online',
    
    // Connection states
    notConnected: 'Not Connected',
    connecting: 'Connecting...',
    initializing: 'Initializing...',
    backendError: 'Backend error',
    
    // Notifications
    notificationsEnabled: 'Push notifications enabled',
    notificationsDenied: 'Push notifications denied',
    notificationsNotAvailable: 'Push notifications not available',
    requestAgain: 'Request again',
    pushNotifications: 'Push Notifications',
    
    // Errors
    connectionError: 'Connection error',
    invalidPeerId: 'Invalid Peer ID',
    friendExists: 'Friend already exists',
    
    // Session management
    sessionTransferred: 'Session transferred to new app instance',
    sessionDeactivatedMessage: 'This app instance has been deactivated because another instance was opened.',
    reload: 'Reload',
    welcome: 'Welcome to P2P Chat!',
    noFriendSelected: 'Select a friend on the left to start chatting.'
  },
  
  // Deutsch
  de: {
    // Header translations
    dwebApp: 'eine dweb App',
    status: 'Status',
    handshake: 'Handshake',
    accountSettings: 'Kontoeinstellungen',
    noConnections: 'Keine Verbindungen',
    oneConnected: '1 Freund verbunden',
    multipleConnected: '{count} Freunde verbunden',
    notificationsActivated: 'Aktiviert',
    notificationsBlocked: 'Blockiert',
    notificationsNotRequested: 'Nicht angefragt',
    notificationsNotSupported: 'Nicht unterstützt',
    
    settings: 'Einstellungen',
    proxy: 'Proxy:',
    partner: 'Kommunikationspartner:',
    encryptionKey: 'Verschlüsselungsschlüssel:',
    nickname: 'Nickname:',
    connect: 'Verbinden',
    disconnect: 'Trennen',
    loading: 'Laden...',
    connected: 'Verbunden',
    wsStatus: 'Proxy:',
    peerStatus: 'Partner:', // communication partner
    meInfo: 'Ich:',
    messagePlaceholder: 'Schreibe deine Nachricht... (Enter zum Senden, Shift+Enter für neue Zeile)',
    send: 'Senden',
    wsConnected: 'Verbunden',
    wsDisconnected: 'Getrennt',
    wsError: 'Fehler',
    peerNoConnection: 'Getrennt',
    peerWaitingWs: 'Warten auf WebSocket',
    peerWaitingUdp: 'Warten auf UDP',
    peerConnectionActive: 'Verbunden',
    peerConnectionError: 'Fehler: ',
    peerStatusUnknown: 'Unbekannter Status: ',
    fillAllFields: 'Bitte fülle alle Felder aus',
    unknownError: 'Unbekannter Fehler',
    infoCopied: 'Verbindungsinfo kopiert!',
    messageError: 'Fehler beim Senden der Nachricht!',
    unknown: 'Unbekannt',
    ollamaConnect: 'Ollama-Verbindung',
    ollamaNoServer: 'Kein lokaler Ollama-Server verfügbar. Deshalb keine Live-Übersetzung möglich.',
    ollamaLiveTranslation: 'Live-Übersetzung aktivieren',
    ollamaModel: 'Ollama-Modell:',
    ollamaShowOriginal: 'Originalnachricht immer anzeigen',
    ollamaTranslateOutgoing: 'Ausgehende Nachrichten übersetzen',
    ollamaTargetLanguage: 'Zielsprache:',
    showOriginalText: 'Originaltext anzeigen',
    originalMessage: 'Original:',
    translatedMessage: 'Automatische Übersetzung:',
    targetLanguageRequired: 'Zielsprache ist für die Übersetzung erforderlich!',
    translationError: 'Übersetzung fehlgeschlagen',
    
    // File attachment translations
    attachFile: 'Datei anhängen',
    fileSelected: 'Datei ausgewählt: ',
    fileDownload: 'Herunterladen',
    fileReceiving: 'Datei wird empfangen: ',
    fileTooLarge: 'Datei ist zu groß. Maximale Größe: ',
    theme: 'Thema',
    lightMode: 'Heller Modus',
    darkMode: 'Dunkler Modus',
    
    // Account settings
    profileImage: 'Profilbild',
    enterDatamapAddress: 'Datamap-Adresse eingeben',
    themeUrl: 'Theme URL',
    enterThemeUrl: 'Theme URL eingeben',
    language: 'Sprache',
    
    // Public identifier management
    publicIdentifier: 'Öffentlicher Name',
    enterPublicIdentifier: 'Öffentlichen Namen eingeben',
    publicIdentifierAdded: 'Öffentlicher Name hinzugefügt',
    publicNameTaken: 'Öffentlicher Name bereits vergeben - bitte einen anderen wählen',
    
    // Account creation wizard
    createFriendsAccount: 'Friends-Konto erstellen',
    finishAccountCreation: 'Kontoeinrichtung abschließen',
    chooseDisplayName: 'Wähle deinen Anzeigenamen',
    setProfileImageOptional: 'Du kannst hier ein Profilbild einstellen (optional)',
    choosePublicIdentifierOptional: 'Wähle einen öffentlich suchbaren Namen (optional)',
    waitingProfileInitialization: 'Bitte warten, Profil wird initialisiert',
    creatingPublicIdentifier: 'Öffentlicher Name wird erstellt...',
    noAccountPackageFoundQuestion: 'Kein Account-Paket gefunden. Möchtest du eines erstellen?',
    
    settingsUpdated: 'Einstellungen erfolgreich aktualisiert',
    
    // Friends
    addFriend: 'Freund hinzufügen',
    removeFriend: 'Freund entfernen',
    friendPeerId: 'Peer ID des Freundes',
    enterPeerId: 'Peer ID eingeben',
    friendName: 'Name des Freundes',
    enterFriendName: 'Namen eingeben',
    selectFriend: 'Wähle einen Freund aus',
    peerIdCopied: 'Peer ID des Freundes kopiert!',
    friendAdded: 'Freund hinzugefügt',
    friendRemoved: 'Freund entfernt',
    
    // Friend Requests
    profileId: 'Profil-ID',
    enterProfileId: 'Profil-ID des Freundes eingeben',
    profileIdOrPublicIdentifier: 'Profil-ID oder öffentlicher Name',
    enterIdOrIdentifier: 'Profil-ID oder öffentlichen Namen eingeben',
    findFriend: 'Freund finden',
    displayName: 'Anzeigename',
    enterDisplayName: 'Anzeigenamen für diesen Kontakt eingeben',
    sendFriendRequest: 'Freundschaftsanfrage senden',
    acceptFriendRequest: 'Freundschaftsanfrage annehmen',
    friendRequestSent: 'Freundschaftsanfrage gesendet',
    friendRequestAccepted: 'Freundschaftsanfrage angenommen',
    waitingForResponse: 'Warte auf Antwort...',
    newFriendRequests: 'Neue Freundschaftsanfragen',
    sending: 'Sende...',
    back: 'Zurück',
    cancel: 'Abbrechen',
    addNewFriend: 'Neuen Freund hinzufügen',
    loadProfile: 'Profil laden',
    profilePreview: 'Profilvorschau',
    profileNotFound: 'Profil nicht gefunden',
    errorLoadingProfile: 'Fehler beim Laden des Profils',
    errorSendingRequest: 'Fehler beim Senden der Freundschaftsanfrage',
    errorAcceptingRequest: 'Fehler beim Annehmen der Freundschaftsanfrage',
    
    // Chat
    typeMessage: 'Nachricht eingeben...',
    connectFirst: 'Verbinde dich zuerst, um Nachrichten zu senden',
    noMessages: 'Noch keine Nachrichten. Starte eine Unterhaltung!',
    waitForFriendOnline: 'Nachrichten können nicht gesendet werden - warte bis der Freund online kommt',
    
    // Connection states
    notConnected: 'Nicht verbunden',
    connecting: 'Verbinde...',
    initializing: 'Initialisiere...',
    backendError: 'Backend-Fehler',
    
    // Notifications
    notificationsEnabled: 'Push-Notifications aktiviert',
    notificationsDenied: 'Push-Notifications wurden abgelehnt',
    notificationsNotAvailable: 'Push-Notifications nicht verfügbar',
    requestAgain: 'Erneut anfragen',
    pushNotifications: 'Push-Benachrichtigungen',
    
    // Errors
    connectionError: 'Verbindungsfehler',
    invalidPeerId: 'Ungültige Peer ID',
    friendExists: 'Freund existiert bereits',
    
    // Session management
    sessionTransferred: 'Session zu neuer App-Instanz übertragen',
    sessionDeactivatedMessage: 'Diese App-Instanz wurde deaktiviert, da eine andere Instanz geöffnet wurde.',
    reload: 'Neu laden',
    welcome: 'Willkommen bei P2P Chat!',
    noFriendSelected: 'Wähle links einen Freund aus, um zu chatten.'
  },
  
  // Französisch
  fr: {
    // Header translations
    dwebApp: 'une app dweb',
    status: 'État',
    handshake: 'Négociation',
    accountSettings: 'Paramètres du compte',
    noConnections: 'Pas de connexions',
    oneConnected: '1 ami connecté',
    multipleConnected: '{count} amis connectés',
    notificationsActivated: 'Activées',
    notificationsBlocked: 'Bloquées',
    notificationsNotRequested: 'Non demandées',
    notificationsNotSupported: 'Non supportées',
    
    settings: 'Paramètres',
    proxy: 'Proxy:',
    partner: 'Partenaire:',
    encryptionKey: 'Clé de chiffrement:',
    nickname: 'Surnom:',
    connect: 'Connecter',
    disconnect: 'Déconnecter',
    loading: 'Chargement...',
    connected: 'Connecté',
    wsStatus: 'Proxy:',
    peerStatus: 'Partenaire:',
    meInfo: 'Moi:',
    messagePlaceholder: 'Écrivez votre message... (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)',
    send: 'Envoyer',
    wsConnected: 'Connecté',
    wsDisconnected: 'Déconnecté',
    wsError: 'Erreur',
    peerNoConnection: 'Déconnecté',
    peerWaitingWs: 'En attente de WebSocket',
    peerWaitingUdp: 'En attente de UDP',
    peerConnectionActive: 'Connecté',
    peerConnectionError: 'Erreur: ',
    peerStatusUnknown: 'Statut inconnu: ',
    fillAllFields: 'Veuillez remplir tous les champs',
    unknownError: 'Erreur inconnue',
    infoCopied: 'Infos de connexion copiées!',
    messageError: 'Erreur lors de l\'envoi du message!',
    unknown: 'Inconnu',
    ollamaConnect: 'Connexion Ollama',
    ollamaNoServer: 'Aucun serveur Ollama local disponible. Traduction en direct impossible.',
    ollamaLiveTranslation: 'Activer la traduction en direct',
    ollamaModel: 'Modèle Ollama:',
    ollamaShowOriginal: 'Toujours afficher le message original',
    ollamaTranslateOutgoing: 'Traduire les messages sortants',
    ollamaTargetLanguage: 'Langue cible:',
    showOriginalText: 'Afficher le texte original',
    originalMessage: 'Original:',
    translatedMessage: 'Traduction automatique:',
    targetLanguageRequired: 'La langue cible est requise pour la traduction !',
    translationError: 'Échec de la traduction',
    
    // File attachment translations
    attachFile: 'Joindre un fichier',
    fileSelected: 'Fichier sélectionné: ',
    fileDownload: 'Télécharger',
    fileReceiving: 'Réception du fichier: ',
    fileTooLarge: 'Le fichier est trop volumineux. Taille maximale: ',
    theme: 'Thème',
    lightMode: 'Mode clair',
    darkMode: 'Mode sombre',
    
    // Account settings
    profileImage: 'Image de profil',
    enterDatamapAddress: 'Entrer l\'adresse datamap',
    themeUrl: 'URL du thème',
    enterThemeUrl: 'Entrer l\'URL du thème',
    language: 'Langue',
    settingsUpdated: 'Paramètres mis à jour avec succès',
    
    // Friends
    addFriend: 'Ajouter un ami',
    removeFriend: 'Supprimer l\'ami',
    friendPeerId: 'ID Peer de l\'ami',
    enterPeerId: 'Entrer l\'ID Peer',
    friendName: 'Nom de l\'ami',
    enterFriendName: 'Entrer le nom',
    selectFriend: 'Sélectionner un ami',
    
    welcome: 'Bienvenue sur P2P Chat!',
    noFriendSelected: 'Sélectionnez un ami à gauche pour commencer à discuter.'
  },
  
  // Spanisch
  es: {
    // Header translations
    dwebApp: 'una app dweb',
    status: 'Estado',
    handshake: 'Negociación',
    accountSettings: 'Configuración de la cuenta',
    noConnections: 'Sin conexiones',
    oneConnected: '1 amigo conectado',
    multipleConnected: '{count} amigos conectados',
    notificationsActivated: 'Activadas',
    notificationsBlocked: 'Bloqueadas',
    notificationsNotRequested: 'No solicitadas',
    notificationsNotSupported: 'No soportadas',
    
    settings: 'Configuraciones',
    proxy: 'Proxy:',
    partner: 'Compañero:',
    encryptionKey: 'Clave de cifrado:',
    nickname: 'Apodo:',
    connect: 'Conectar',
    disconnect: 'Desconectar',
    loading: 'Cargando...',
    connected: 'Conectado',
    wsStatus: 'Proxy:',
    peerStatus: 'Compañero:',
    meInfo: 'Yo:',
    messagePlaceholder: 'Escribe tu mensaje... (Enter para enviar, Shift+Enter para nueva línea)',
    send: 'Enviar',
    wsConnected: 'Conectado',
    wsDisconnected: 'Desconectado',
    wsError: 'Error',
    peerNoConnection: 'Desconectado',
    peerWaitingWs: 'Esperando WebSocket',
    peerWaitingUdp: 'Esperando UDP',
    peerConnectionActive: 'Conectado',
    peerConnectionError: 'Error: ',
    peerStatusUnknown: 'Estado desconocido: ',
    fillAllFields: 'Por favor, rellena todos los campos',
    unknownError: 'Error desconocido',
    infoCopied: '¡Información de conexión copiada!',
    messageError: '¡Error al enviar el mensaje!',
    unknown: 'Desconocido',
    ollamaConnect: 'Conexión Ollama',
    ollamaNoServer: 'No hay servidor Ollama local disponible. Traducción en vivo no posible.',
    ollamaLiveTranslation: 'Habilitar traducción en vivo',
    ollamaModel: 'Modelo Ollama:',
    ollamaShowOriginal: 'Mostrar siempre el mensaje original',
    ollamaTranslateOutgoing: 'Traducir mensajes salientes',
    ollamaTargetLanguage: 'Idioma de destino:',
    showOriginalText: 'Mostrar texto original',
    originalMessage: 'Original:',
    translatedMessage: 'Traducción automática:',
    targetLanguageRequired: 'Se requiere el idioma de destino para la traducción!',
    translationError: 'Traducción fallida',
    
    // File attachment translations
    attachFile: 'Adjuntar archivo',
    fileSelected: 'Archivo seleccionado: ',
    fileDownload: 'Descargar',
    fileReceiving: 'Recibiendo archivo: ',
    fileTooLarge: 'El archivo es demasiado grande. Tamaño máximo: ',
    theme: 'Tema',
    lightMode: 'Modo claro',
    darkMode: 'Modo oscuro',
    
    welcome: 'Bienvenido a P2P Chat!',
    noFriendSelected: 'Seleccione un amigo a la izquierda para comenzar a chatear.'
  },
  
  // Bulgarisch
  bg: {
    // Header translations
    dwebApp: 'dweb приложение',
    status: 'Статус',
    handshake: 'Установяване на връзка',
    accountSettings: 'Настройки на акаунта',
    noConnections: 'Няма връзки',
    oneConnected: '1 свързан приятел',
    multipleConnected: '{count} свързани приятели',
    notificationsActivated: 'Активирани',
    notificationsBlocked: 'Блокирани',
    notificationsNotRequested: 'Не са поискани',
    notificationsNotSupported: 'Не се поддържат',
    
    settings: 'Настройки',
    proxy: 'Прокси:',
    partner: 'Партньор:',
    encryptionKey: 'Ключ за криптиране:',
    nickname: 'Псевдоним:',
    connect: 'Свързване',
    disconnect: 'Прекъсване',
    loading: 'Зареждане...',
    connected: 'Свързан',
    wsStatus: 'Прокси:',
    peerStatus: 'Партньор:',
    meInfo: 'Аз:',
    messagePlaceholder: 'Напишете вашето съобщение... (Enter за изпращане, Shift+Enter за нов ред)',
    send: 'Изпращане',
    wsConnected: 'Свързан',
    wsDisconnected: 'Прекъснат',
    wsError: 'Грешка',
    peerNoConnection: 'Прекъснат',
    peerWaitingWs: 'Изчакване на WebSocket',
    peerWaitingUdp: 'Изчакване на UDP',
    peerConnectionActive: 'Свързан',
    peerConnectionError: 'Грешка: ',
    peerStatusUnknown: 'Неизвестен статус: ',
    fillAllFields: 'Моля, попълнете всички полета',
    unknownError: 'Неизвестна грешка',
    infoCopied: 'Информацията за връзката е копирана!',
    messageError: 'Грешка при изпращане на съобщението!',
    unknown: 'Неизвестен',
    ollamaConnect: 'Свързване с Ollama',
    ollamaNoServer: 'Няма наличен локален Ollama сървър. Превод на живо не е възможен.',
    ollamaLiveTranslation: 'Активиране на превод на живо',
    ollamaModel: 'Ollama модел:',
    ollamaShowOriginal: 'Винаги показвай оригиналното съобщение',
    ollamaTranslateOutgoing: 'Превеждане на изходящи съобщения',
    ollamaTargetLanguage: 'Целеви език:',
    showOriginalText: 'Показване на оригиналния текст',
    originalMessage: 'Оригинал:',
    translatedMessage: 'Автоматичен превод:',
    targetLanguageRequired: 'Целевият език е необходим за превод!',
    translationError: 'Превод не е успешен',
    
    // File attachment translations
    attachFile: 'Прикачи файл',
    fileSelected: 'Файл избран: ',
    fileDownload: 'Сваляне',
    fileReceiving: 'Сваляне на файл: ',
    fileTooLarge: 'Файлът е прекалено голям. Максимален размер: ',
    theme: 'Тема',
    lightMode: 'Светъл режим',
    darkMode: 'Тъмрен режим',
    
    welcome: 'Добре дошли в P2P Chat!',
    noFriendSelected: 'Изберете приятел отляво, за да започнете разговор.'
  },
  
  // Japanisch
  ja: {
    // Header translations
    dwebApp: 'dwebアプリ',
    status: '状態',
    handshake: 'ハンドシェイク',
    accountSettings: 'アカウント設定',
    noConnections: '接続なし',
    oneConnected: '1人のフレンドが接続中',
    multipleConnected: '{count}人のフレンドが接続中',
    notificationsActivated: '有効',
    notificationsBlocked: 'ブロック',
    notificationsNotRequested: '未要求',
    notificationsNotSupported: '非対応',
    
    settings: '設定',
    proxy: 'プロキシ:',
    partner: 'パートナー:',
    encryptionKey: '暗号キー:',
    nickname: 'ニックネーム:',
    connect: '接続',
    disconnect: '切断',
    loading: '読み込み中...',
    connected: '接続済み',
    wsStatus: 'プロキシ:',
    peerStatus: 'パートナー:',
    meInfo: '私:',
    messagePlaceholder: 'メッセージを入力してください... (Enterで送信、Shift+Enterで改行)',
    send: '送信',
    wsConnected: '接続済み',
    wsDisconnected: '切断済み',
    wsError: 'エラー',
    peerNoConnection: '切断済み',
    peerWaitingWs: 'WebSocketを待っています',
    peerWaitingUdp: 'UDPを待っています',
    peerConnectionActive: '接続済み',
    peerConnectionError: 'エラー: ',
    peerStatusUnknown: '不明なステータス: ',
    fillAllFields: 'すべてのフィールドに入力してください',
    unknownError: '不明なエラー',
    infoCopied: '接続情報がコピーされました！',
    messageError: 'メッセージの送信エラー！',
    unknown: '不明',
    ollamaConnect: 'Ollama接続',
    ollamaNoServer: 'ローカルOllamaサーバーがありません。ライブ翻訳はできません。',
    ollamaLiveTranslation: 'ライブ翻訳を有効にする',
    ollamaModel: 'Ollamaモデル:',
    ollamaShowOriginal: '常に元のメッセージを表示',
    ollamaTranslateOutgoing: '送信メッセージを翻訳',
    ollamaTargetLanguage: '対象言語:',
    showOriginalText: '原文を表示',
    originalMessage: '原文:',
    translatedMessage: '自動翻訳:',
    targetLanguageRequired: '翻訳のために対象言語が必要です！',
    translationError: '翻訳に失敗',
    
    // File attachment translations
    attachFile: 'ファイルを添付',
    fileSelected: 'ファイルが選択されました: ',
    fileDownload: 'ダウンロード',
    fileReceiving: 'ファイルを受信中: ',
    fileTooLarge: 'ファイルが大きすぎます。最大サイズ: ',
    theme: 'テーマ',
    lightMode: 'ライトモード',
    darkMode: 'ダークモード',
    
    welcome: 'P2P Chatへようこそ！',
    noFriendSelected: '左側の友達を選択して、チャットを開始してください。'
  },
  
  // Koreanisch
  ko: {
    // Header translations
    dwebApp: 'dweb 앱',
    status: '상태',
    handshake: '핸드셰이크',
    accountSettings: '계정 설정',
    noConnections: '연결 없음',
    oneConnected: '1명의 친구 연결됨',
    multipleConnected: '{count}명의 친구 연결됨',
    notificationsActivated: '활성화됨',
    notificationsBlocked: '차단됨',
    notificationsNotRequested: '요청되지 않음',
    notificationsNotSupported: '지원되지 않음',
    
    settings: '설정',
    proxy: '프록시:',
    partner: '파트너:',
    encryptionKey: '암호화 키:',
    nickname: '닉네임:',
    connect: '연결',
    disconnect: '연결 해제',
    loading: '로딩 중...',
    connected: '연결됨',
    wsStatus: '프록시:',
    peerStatus: '파트너:',
    meInfo: '나:',
    messagePlaceholder: '메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄 바꿈)',
    send: '전송',
    wsConnected: '연결됨',
    wsDisconnected: '연결 해제됨',
    wsError: '오류',
    peerNoConnection: '연결 해제됨',
    peerWaitingWs: 'WebSocket 대기 중',
    peerWaitingUdp: 'UDP 대기 중',
    peerConnectionActive: '연결됨',
    peerConnectionError: '오류: ',
    peerStatusUnknown: '알 수 없는 상태: ',
    fillAllFields: '모든 필드를 채워주세요',
    unknownError: '알 수 없는 오류',
    infoCopied: '연결 정보가 복사되었습니다!',
    messageError: '메시지 전송 오류!',
    unknown: '알 수 없음',
    ollamaConnect: 'Ollama 연결',
    ollamaNoServer: '로컬 Ollama 서버를 사용할 수 없습니다. 실시간 번역이 불가능합니다.',
    ollamaLiveTranslation: '실시간 번역 활성화',
    ollamaModel: 'Ollama 모델:',
    ollamaShowOriginal: '항상 원본 메시지 표시',
    ollamaTranslateOutgoing: '발신 메시지 번역',
    ollamaTargetLanguage: '대상 언어:',
    showOriginalText: '원본 텍스트 표시',
    originalMessage: '원본:',
    translatedMessage: '자동 번역:',
    targetLanguageRequired: '번역을 위해 대상 언어가 필요합니다!',
    translationError: '번역 실패',
    
    // File attachment translations
    attachFile: '파일 첨부',
    fileSelected: '파일이 선택되었습니다: ',
    fileDownload: '다운로드',
    fileReceiving: '파일을 받는 중: ',
    fileTooLarge: '파일이 너무 큽니다. 최대 크기: ',
    theme: '테마',
    lightMode: '라이트 모드',
    darkMode: '다크 모드',
    
    welcome: 'P2P Chat에 오신 것을 환영합니다!',
    noFriendSelected: '왼쪽에서 친구를 선택하여 채팅을 시작하세요.'
  },
  
  // Mandarin
  zh: {
    // Header translations
    dwebApp: 'dweb应用',
    status: '状态',
    handshake: '握手',
    accountSettings: '账户设置',
    noConnections: '无连接',
    oneConnected: '1个好友已连接',
    multipleConnected: '{count}个好友已连接',
    notificationsActivated: '已激活',
    notificationsBlocked: '已阻止',
    notificationsNotRequested: '未请求',
    notificationsNotSupported: '不支持',
    
    settings: '设置',
    proxy: '代理:',
    partner: '伙伴:',
    encryptionKey: '加密密钥:',
    nickname: '昵称:',
    connect: '连接',
    disconnect: '断开',
    loading: '加载中...',
    connected: '已连接',
    wsStatus: '代理:',
    peerStatus: '伙伴:',
    meInfo: '我:',
    messagePlaceholder: '输入您的消息...(按Enter发送，Shift+Enter换行)',
    send: '发送',
    wsConnected: '已连接',
    wsDisconnected: '已断开',
    wsError: '错误',
    peerNoConnection: '已断开',
    peerWaitingWs: '等待WebSocket',
    peerWaitingUdp: '等待UDP',
    peerConnectionActive: '已连接',
    peerConnectionError: '错误: ',
    peerStatusUnknown: '未知状态: ',
    fillAllFields: '请填写所有字段',
    unknownError: '未知错误',
    infoCopied: '已复制连接信息!',
    messageError: '发送消息错误!',
    unknown: '未知',
    ollamaConnect: 'Ollama连接',
    ollamaNoServer: '没有可用的本地Ollama服务器。无法进行实时翻译。',
    ollamaLiveTranslation: '启用实时翻译',
    ollamaModel: 'Ollama模型:',
    ollamaShowOriginal: '始终显示原始消息',
    ollamaTranslateOutgoing: '翻译发送消息',
    ollamaTargetLanguage: '目标语言:',
    showOriginalText: '显示原始文本',
    originalMessage: '原文:',
    translatedMessage: '自动翻译:',
    targetLanguageRequired: '翻译需要目标语言！',
    translationError: '翻译失败',
    
    // File attachment translations
    attachFile: '附件',
    fileSelected: '已选择文件: ',
    fileDownload: '下载',
    fileReceiving: '接收文件: ',
    fileTooLarge: '文件太大。最大大小: ',
    theme: '主题',
    lightMode: '亮模式',
    darkMode: '暗模式',
    
    welcome: '欢迎使用P2P聊天！',
    noFriendSelected: '选择左侧的朋友开始聊天。'
  }
};

// Sprachprüfungsfunktion: überprüft, ob alle Schlüssel in allen Sprachen existieren
export function validateTranslations(): string[] {
  const errors: string[] = [];
  
  // Erstelle ein Set aller Schlüssel, die in der Englischen Version vorkommen
  const englishKeys = Object.keys(translations.en) as TranslationKey[];
  
  // Überprüfe für jede Sprache, ob alle Schlüssel existieren
  for (const lang of Object.keys(translations) as Language[]) {
    const langKeys = Object.keys(translations[lang]);
    
    // Prüfe, ob es Schlüssel gibt, die in Englisch aber nicht in dieser Sprache existieren
    for (const key of englishKeys) {
      if (!langKeys.includes(key)) {
        errors.push(`Missing key '${key}' in language '${lang}'`);
      }
    }
    
    // Prüfe, ob es Schlüssel gibt, die in dieser Sprache aber nicht in Englisch existieren
    for (const key of langKeys) {
      if (!englishKeys.includes(key as TranslationKey)) {
        errors.push(`Extra key '${key}' in language '${lang}' that doesn't exist in English`);
      }
    }
  }
  
  return errors;
}

// Fallback-Funktion: liefert Übersetzung oder englischen Text wenn nicht vorhanden
export function getTranslation(lang: Language, key: TranslationKey): string {
  if (translations[lang] && translations[lang][key]) {
    return translations[lang][key] as string;
  }
  
  // Fallback auf Englisch
  return translations.en[key] as string;
}

// Führe die Validierung während der Entwicklung aus
if (import.meta.env.DEV) {
  const errors = validateTranslations();
  if (errors.length > 0) {
    console.error('Translation validation errors:');
    errors.forEach(error => console.error(error));
  }
}
