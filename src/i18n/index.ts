// i18n configuration for bilingual support (ko/en)
// Initializes i18next with device locale detection and AsyncStorage persistence

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation resources
import commonEn from './resources/en/common.json';
import commonKo from './resources/ko/common.json';

const LANGUAGE_STORAGE_KEY = 'pref.language';

// Get device locale (ko or en, fallback to en)
const getDeviceLocale = (): string => {
  const locale = Localization.getLocales()[0]?.languageCode;
  // Only support ko and en
  if (locale === 'ko') return 'ko';
  return 'en';
};

// Initialize i18next
i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4', // For React Native
    resources: {
      en: {
        common: commonEn,
      },
      ko: {
        common: commonKo,
      },
    },
    lng: getDeviceLocale(), // Will be overridden by saved preference
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false, // Disable suspense for React Native
    },
  });

// Load saved language preference
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then((savedLanguage) => {
    if (savedLanguage && (savedLanguage === 'ko' || savedLanguage === 'en')) {
      i18n.changeLanguage(savedLanguage);
    }
  })
  .catch((error) => {
    console.warn('[i18n] Failed to load language preference:', error);
  });

// Save language preference when changed
i18n.on('languageChanged', (lng) => {
  AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng).catch((error) => {
    console.warn('[i18n] Failed to save language preference:', error);
  });
});

export default i18n;

