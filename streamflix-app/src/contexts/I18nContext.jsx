import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { STRINGS } from '../i18n/strings';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('sf_lang') || 'en');

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = STRINGS[lang]?.dir || 'ltr';
  }, [lang]);

  const setLang = useCallback((newLang) => {
    if (!STRINGS[newLang]) return;
    localStorage.setItem('sf_lang', newLang);
    setLangState(newLang);
  }, []);

  const t = useCallback((key) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir: STRINGS[lang]?.dir || 'ltr' }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
