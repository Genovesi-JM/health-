import { useState, useRef, useEffect } from 'react';
import { useT, LANG_FLAGS, LANG_LABELS, type Lang } from '../i18n/LanguageContext';
import { Globe } from 'lucide-react';

const LANGS: Lang[] = ['pt', 'en', 'fr'];

/**
 * Compact language selector — shows flag + Globe icon.
 * Dropdown with 3 languages: PT 🇵🇹 / EN 🇬🇧 / FR 🇫🇷
 */
export default function LanguageSelector() {
  const { lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', zIndex: 9999 }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Change language"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          padding: '0.35rem 0.65rem', borderRadius: '8px',
          background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.18)',
          color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.82rem',
          fontWeight: 500, transition: 'all 0.2s',
        }}
      >
        <Globe size={14} style={{ color: 'var(--accent-teal)' }} />
        <span>{LANG_FLAGS[lang]}</span>
        <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lang}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border)',
          borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          minWidth: '150px', overflow: 'hidden',
        }}>
          {LANGS.map(l => (
            <button
              key={l}
              onClick={() => { setLang(l); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                width: '100%', padding: '0.65rem 1rem', border: 'none',
                background: lang === l ? 'rgba(20,184,166,0.1)' : 'transparent',
                color: 'var(--text-primary)', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: lang === l ? 600 : 400,
                textAlign: 'left', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (lang !== l) (e.target as HTMLElement).style.background = 'rgba(20,184,166,0.05)'; }}
              onMouseLeave={e => { if (lang !== l) (e.target as HTMLElement).style.background = 'transparent'; }}
            >
              <span style={{ fontSize: '1.1rem' }}>{LANG_FLAGS[l]}</span>
              <span>{LANG_LABELS[l]}</span>
              {lang === l && <span style={{ marginLeft: 'auto', color: 'var(--accent-teal)', fontSize: '0.9rem' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
