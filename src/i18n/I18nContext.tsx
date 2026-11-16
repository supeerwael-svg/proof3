import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { translations, type Lang, type TranslationKey } from './translations';
import { SettingsService } from '@/services';

interface I18nContextType {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ar');

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    SettingsService.get().then(s => {
      if (s?.language) setLangState(s.language);
    });
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    SettingsService.update({ language: l });
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const t = (key: TranslationKey): string => translations[lang][key] ?? key;

  return (
    <I18nContext.Provider value={{ lang, dir, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be inside I18nProvider');
  return ctx;
}
