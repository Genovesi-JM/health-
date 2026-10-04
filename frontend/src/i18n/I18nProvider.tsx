import { useState, useCallback, type ReactNode } from 'react';
import translations, { type Lang } from './translations';
import { I18nContext } from './languageContextState';

const STORAGE_KEY = 'health_lang';

function getInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'pt' || saved === 'en' || saved === 'fr' || saved === 'es' || saved === 'zh') return saved;
  } catch { /* SSR / no localStorage */ }
  return 'pt';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    try { localStorage.setItem(STORAGE_KEY, newLang); } catch { /* ignore */ }
  }, []);

  const t = useCallback(
    (key: string): string => {
      const entry = translations[key];
      if (!entry) return key; // fallback: show key itself
      // Chinese (and any missing translation) falls back to English, then Portuguese.
      return entry[lang] ?? entry.en ?? entry.pt ?? key;
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}
