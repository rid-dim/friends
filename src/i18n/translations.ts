// Definiere den Typ für Übersetzungsschlüssel
export type TranslationKey =
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
  // Neue Übersetzungen für Dateianhänge
  | 'attachFile'
  | 'fileSelected'
  | 'fileDownload'
  | 'fileReceiving'
  | 'fileTooLarge'
  | 'theme'
  | 'lightMode'
  | 'darkMode'
  | 'welcome'
  | 'noFriendSelected';

// Definiere den Typ für die Sprachen
export type Language = 'en' | 'de' | 'fr' | 'es' | 'bg' | 'ja' | 'ko' | 'zh';

// Definiere den Typ für die Übersetzungstabelle
export type Translations = {
  [key in Language]: {
    [key in TranslationKey]: string;
  };
};

// Die Übersetzungen für alle unterstützten Sprachen
export const translations: Translations = {
  // Englisch
  en: {
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
    welcome: 'Welcome to P2P Chat!',
    noFriendSelected: 'Select a friend on the left to start chatting.'
  },
  
  // Deutsch
  de: {
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
    welcome: 'Willkommen bei P2P Chat!',
    noFriendSelected: 'Wähle links einen Freund aus, um den Chat zu starten.'  
  },
  
  // Französisch
  fr: {
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
    welcome: '',
    noFriendSelected: ''
  },
  
  // Spanisch
  es: {
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
    welcome: '',
    noFriendSelected: ''
  },
  
  // Bulgarisch
  bg: {
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
    welcome: '',
    noFriendSelected: ''
  },
  
  // Japanisch
  ja: {
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
    welcome: '',
    noFriendSelected: ''
  },
  
  // Koreanisch
  ko: {
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
    welcome: '',
    noFriendSelected: ''
  },
  
  // Mandarin
  zh: {
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
    welcome: '',
    noFriendSelected: ''
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

// Führe die Validierung während der Entwicklung aus
if (import.meta.env.DEV) {
  const errors = validateTranslations();
  if (errors.length > 0) {
    console.error('Translation validation errors:');
    errors.forEach(error => console.error(error));
  }
} 