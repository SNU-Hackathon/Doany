// User preferences service for managing app settings
// Handles language preference with AsyncStorage persistence

import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

const LANGUAGE_STORAGE_KEY = 'pref.language';

export type Language = 'ko' | 'en';

/**
 * Get current language preference
 * @returns Current language ('ko' or 'en')
 */
export async function getLanguage(): Promise<Language> {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage === 'ko' || savedLanguage === 'en') {
      return savedLanguage;
    }
  } catch (error) {
    console.warn('[UserPrefs] Failed to get language:', error);
  }
  return 'en';
}

/**
 * Set language preference
 * Persists to AsyncStorage and updates i18n immediately
 * @param language - Language to set ('ko' or 'en')
 */
export async function setLanguage(language: Language): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    await i18n.changeLanguage(language);
    console.log('[UserPrefs] Language changed to:', language);
  } catch (error) {
    console.error('[UserPrefs] Failed to set language:', error);
    throw error;
  }
}

/**
 * Get current language synchronously
 * @returns Current language from i18n instance
 */
export function getCurrentLanguage(): Language {
  const lang = i18n.language;
  return lang === 'ko' ? 'ko' : 'en';
}

