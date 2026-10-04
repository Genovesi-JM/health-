import { useContext } from 'react';
import { I18nContext } from './languageContextState';
export { I18nProvider } from './I18nProvider';
export { LANG_LABELS, LANG_FLAGS } from './translations';
export type { Lang } from './translations';

export function useT() { return useContext(I18nContext); }
