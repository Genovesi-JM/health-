import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/**
 * PWA install prompt banner.
 * Appears once when the browser fires beforeinstallprompt (Android Chrome, Edge, etc.).
 * On iOS, shows a manual "Add to Home Screen" tip instead.
 * Dismissed state is persisted in localStorage so it doesn't nag users.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa_install_dismissed') === 'true'
  );

  useEffect(() => {
    if (dismissed) return;

    // Check if already installed (running in standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // iOS detection — no beforeinstallprompt, needs manual "Add to Home Screen"
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
      && !(window.navigator as unknown as { standalone?: boolean }).standalone;
    if (isIos) {
      setShowIosTip(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [dismissed]);

  const dismiss = () => {
    localStorage.setItem('pwa_install_dismissed', 'true');
    setDeferredPrompt(null);
    setShowIosTip(false);
    setDismissed(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') dismiss();
    else setDeferredPrompt(null);
  };

  if (dismissed || (!deferredPrompt && !showIosTip)) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: `calc(1rem + var(--safe-bottom, 0px))`,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9000,
      width: 'min(calc(100vw - 2rem), 420px)',
      background: '#fff',
      border: '1px solid var(--border, #e2e8f0)',
      borderRadius: '14px',
      boxShadow: '0 8px 32px rgba(15,23,42,0.16)',
      padding: '1rem 1.25rem',
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'center',
      animation: 'slideUp 0.25s ease',
    }}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: '10px', flexShrink: 0,
        background: 'var(--brand-primary, #0F766E)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Download size={20} color="#fff" />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary, #0f172a)',
          marginBottom: '0.15rem' }}>
          Install Health Platform
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', lineHeight: 1.4 }}>
          {showIosTip
            ? 'Tap the Share button, then "Add to Home Screen"'
            : 'Add to your home screen for a faster, app-like experience'}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        {!showIosTip && (
          <button
            onClick={install}
            style={{
              background: 'var(--brand-primary, #0F766E)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted, #94a3b8)', padding: '0.25rem',
            display: 'flex', alignItems: 'center',
          }}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
