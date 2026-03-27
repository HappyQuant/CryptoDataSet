import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { zhCN, enUS, Locale, TranslationKeys } from './locales';

type Translations = typeof zhCN;

interface LanguageContextType {
  locale: Locale;
  t: TranslationKeys;
  setLocale: (locale: Locale) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'app-language';

const translations: Record<Locale, Translations> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return (saved as Locale) || 'zh-CN';
  });

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  const toggleLanguage = () => {
    setLocaleState(prev => prev === 'zh-CN' ? 'en-US' : 'zh-CN');
  };

  const value: LanguageContextType = {
    locale,
    t: translations[locale],
    setLocale,
    toggleLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const useTranslation = () => {
  const { t, locale } = useLanguage();
  return { t, locale };
};
