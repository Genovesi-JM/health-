import { createContext } from 'react';
import type { Lang } from './translations';

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

export const I18nContext = createContext<I18nContextValue>({
  lang: 'pt',
  setLang: () => {},
  t: (k: string) => k,
});
