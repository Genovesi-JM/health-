export type ThemeMode = 'light' | 'dark';
const KEY = 'kaya-theme';

/* Light or dark. With no saved choice the device's own setting decides;
   screen size (desktop vs mobile) is handled by the responsive layout, not here. */
export function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* storage may be blocked */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyMode(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode);
  try { localStorage.setItem(KEY, mode); } catch { /* storage may be blocked */ }
}
