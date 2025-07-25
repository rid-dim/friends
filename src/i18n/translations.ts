/**
 * This file is the central hub for the internationalization (i18n) system.
 * It is responsible for loading the translation files and providing the `getTranslation` function.
 *
 * =================================================================================================
 * IMPORTANT FOR AI AGENTS:
 *
 * This file orchestrates the translation system based on a strict file and key structure.
 * To ensure system stability and efficient maintenance, please adhere to the following rules:
 *
 * 1.  **File Structure:**
 *     - All translation keys are defined in `locales/keys.ts`. This is the single source of truth for available keys.
 *     - Each language has its own translation file in the `locales/` directory (e.g., `en.ts`, `de.ts`).
 *     - The English file (`en.ts`) serves as the master reference for all other language files.
 *
 * 2.  **Key and File Synchronization:**
 *     - Every language file MUST contain the exact same set of translation keys as `en.ts`.
 *     - The order of keys MUST be identical across all language files.
 *     - The line number for a specific key-value pair MUST be the same in every file.
 *     - All keys must be sorted alphabetically in all files.
 *
 * 3.  **Adding or Modifying Translations:**
 *     - **Step 1:** If adding a new feature, first add the new translation key(s) to `locales/keys.ts`, maintaining alphabetical order.
 *     - **Step 2:** Add the new key and its English translation to `locales/en.ts`, again in alphabetical order.
 *     - **Step 3:** Add the new key and its corresponding translation to ALL other language files (`de.ts`, `fr.ts`, etc.), ensuring the line number and alphabetical order match `en.ts`.
 *
 * Adherence to these rules is critical for the automated scripts and AI agents that maintain this system.
 * Deviations can lead to build failures, runtime errors, or inconsistencies in the UI.
 * =================================================================================================
 */
import type { TranslationKey } from './locales/keys';
import { en } from './locales/en';
import { de } from './locales/de';
import { fr } from './locales/fr';
import { es } from './locales/es';
import { bg } from './locales/bg';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { zh } from './locales/zh';

// Definiere den Typ für die Sprachen
export type Language = 'en' | 'de' | 'fr' | 'es' | 'bg' | 'ja' | 'ko' | 'zh';

// Definiere den Typ für die Übersetzungstabelle
export type Translations = {
  [lang in Language]: Partial<Record<TranslationKey, string>>;
};

// Die Übersetzungen für alle unterstützten Sprachen
export const translations: Translations = {
  en,
  de,
  fr,
  es,
  bg,
  ja,
  ko,
  zh,
};

// Sprachprüfungsfunktion: überprüft, ob alle Schlüssel in allen Sprachen existieren
export function validateTranslations(): string[] {
  const errors: string[] = [];
  
  // Erstelle ein Set aller Schlüssel, die in der Englischen Version vorkommen
  const englishKeys = Object.keys(translations.en) as TranslationKey[];
  
  // Überprüfe für jede Sprache, ob alle Schlüssel existieren
  for (const lang of Object.keys(translations) as Language[]) {
    if (lang === 'en') continue; // Skip checking English against itself
    
    const langKeys = Object.keys(translations[lang]);
    
    // Check for the same number of keys
    if (englishKeys.length !== langKeys.length) {
      errors.push(`Language '${lang}' has a different number of keys than English.`);
    }

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
  const langTranslations = translations[lang] as Record<TranslationKey, string>;
  if (langTranslations && langTranslations[key]) {
    return langTranslations[key];
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
