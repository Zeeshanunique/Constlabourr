import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupportedLanguage, LanguageOption, SUPPORTED_LANGUAGES, TranslationSchema } from './types';
import { en } from './locales/en';
import { hi } from './locales/hi';
import { bn } from './locales/bn';

const STORAGE_KEY = '@constlabour_language_code';

const translations: Record<SupportedLanguage, TranslationSchema> = {
  en,
  hi,
  bn,
};

export type TranslationKey =
  | `common.${keyof TranslationSchema['common']}`
  | `nav.${keyof TranslationSchema['nav']}`
  | `auth.${keyof TranslationSchema['auth']}`
  | `dashboard.${keyof TranslationSchema['dashboard']}`
  | `attendance.${keyof TranslationSchema['attendance']}`
  | `workers.${keyof TranslationSchema['workers']}`
  | `sites.${keyof TranslationSchema['sites']}`
  | `foremen.${keyof TranslationSchema['foremen']}`
  | `payroll.${keyof TranslationSchema['payroll']}`
  | `workerPortal.${keyof TranslationSchema['workerPortal']}`
  | `reports.${keyof TranslationSchema['reports']}`
  | `settings.${keyof TranslationSchema['settings']}`
  | `forms.${keyof TranslationSchema['forms']}`;

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: TranslationKey | string, params?: Record<string, string | number>) => string;
  supportedLanguages: LanguageOption[];
  currentLanguageOption: LanguageOption;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');

  useEffect(() => {
    loadSavedLanguage();
  }, []);

  const loadSavedLanguage = async () => {
    try {
      const savedLang = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedLang && (savedLang === 'en' || savedLang === 'hi' || savedLang === 'bn')) {
        setLanguageState(savedLang as SupportedLanguage);
      }
    } catch (e) {
      console.warn('Failed to load saved language preference:', e);
    }
  };

  const setLanguage = async (newLang: SupportedLanguage) => {
    try {
      setLanguageState(newLang);
      await AsyncStorage.setItem(STORAGE_KEY, newLang);
    } catch (e) {
      console.error('Failed to save language preference:', e);
    }
  };

  const currentLanguageOption = useMemo(() => {
    return (
      SUPPORTED_LANGUAGES.find((l) => l.code === language) ||
      SUPPORTED_LANGUAGES[0]
    );
  }, [language]);

  const t = (key: TranslationKey | string, params?: Record<string, string | number>): string => {
    const parts = key.split('.');
    const section = parts[0] as keyof TranslationSchema;
    const subKey = parts[1];

    let result = '';

    // 1. Try selected language
    const currentDict = translations[language];
    if (currentDict && currentDict[section] && (currentDict[section] as any)[subKey]) {
      result = (currentDict[section] as any)[subKey];
    }

    // 2. Fallback to Hindi if regional
    if (!result && language !== 'hi') {
      const hiDict = translations.hi;
      if (hiDict && hiDict[section] && (hiDict[section] as any)[subKey]) {
        result = (hiDict[section] as any)[subKey];
      }
    }

    // 3. Fallback to English
    if (!result) {
      const enDict = translations.en;
      if (enDict && enDict[section] && (enDict[section] as any)[subKey]) {
        result = (enDict[section] as any)[subKey];
      }
    }

    if (!result) {
      return key; // return key as ultimate fallback
    }

    // Interpolation (e.g., {name}, {count})
    if (params) {
      Object.entries(params).forEach(([paramKey, val]) => {
        result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
      });
    }

    return result;
  };

  const contextValue: LanguageContextType = {
    language,
    setLanguage,
    t,
    supportedLanguages: SUPPORTED_LANGUAGES,
    currentLanguageOption,
    isRtl: false,
  };

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}

export { SUPPORTED_LANGUAGES };
export type { SupportedLanguage, LanguageOption, TranslationSchema };
