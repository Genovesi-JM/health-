import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { readMode, applyMode, type ThemeMode } from '../theme';

const LABEL: Record<ThemeMode, string> = { light: 'Claro', dark: 'Escuro' };

/* Switches between light and dark. The choice is kept per device and applied
   before first paint by a small script in index.html. */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>(() => (typeof window === 'undefined' ? 'light' : readMode()));
  const next: ThemeMode = mode === 'light' ? 'dark' : 'light';
  const toggle = () => { applyMode(next); setMode(next); };
  const Icon = mode === 'light' ? Moon : Sun;
  return (
    <button type="button" className="theme-toggle" onClick={toggle}
      aria-label={`Mudar para modo ${LABEL[next].toLowerCase()}`} title={`Modo ${LABEL[next].toLowerCase()}`}>
      <Icon />{!compact && <span>{LABEL[next]}</span>}
    </button>
  );
}
