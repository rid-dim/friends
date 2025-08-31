import { writable, derived } from 'svelte/store';
import { translations, type Language } from './translations';
import type { TranslationKey } from './locales/keys';
import { browser } from '$app/environment';

// Sprachkürzel zu Sprachnamen-Mapping für die Sprachauswahl
export const languageNames: Record<Language, string> = {
  'en': 'English',
  'de': 'Deutsch',
  'fr': 'Français',
  'es': 'Español',
  'bg': 'Български',
  'ja': '日本語',
  'ko': '한국어',
  'zh': '中文'
};

// Standardsprache des Browsers ermitteln, falls verfügbar
function getBrowserLanguage(): Language {
  if (!browser) return 'en';
  
  const browserLang = navigator.language.split('-')[0];
  const supportedLanguages = Object.keys(languageNames) as Language[];
  
  return supportedLanguages.includes(browserLang as Language) 
    ? browserLang as Language 
    : 'en'; // Fallback auf Englisch
}

// Gespeicherte Sprache aus localStorage laden oder Browsersprache verwenden
function getInitialLanguage(): Language {
  if (!browser) return 'en';
  
  try {
    const stored = localStorage.getItem('language');
    if (stored && Object.keys(languageNames).includes(stored)) {
      return stored as Language;
    }
  } catch (e) {
    console.error('Error accessing localStorage:', e);
  }
  
  return getBrowserLanguage();
}

// Store für die aktuelle Sprache
export const language = writable<Language>(getInitialLanguage());

// Speichern der ausgewählten Sprache
language.subscribe(value => {
  if (browser) {
    try {
      localStorage.setItem('language', value);
    } catch (e) {
      console.error('Error saving language to localStorage:', e);
    }
  }
});

// Store für Übersetzungen abgeleitet von der aktuellen Sprache
export const t = derived(language, $language => {
  const translate = (key: TranslationKey): string => {
    if (translations[$language] && translations[$language][key]) {
      return translations[$language][key] as string;
    }
    
    // Fallback auf Englisch oder Schlüsselname
    return (translations.en[key] as string) || key;
  };
  
  return translate;
});

// Funktion zum Ändern der Sprache
export function changeLanguage(newLanguage: Language): void {
  language.set(newLanguage);
}

// Funktion zum Auflisten aller verfügbaren Sprachen
export function getAvailableLanguages(): { code: Language; name: string }[] {
  return Object.entries(languageNames).map(([code, name]) => ({
    code: code as Language,
    name
  }));
} 