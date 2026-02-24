import { Link, useLocation } from 'react-router-dom';
import { Heart, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { getSession, getInitials } from '../api';

/**
 * Public navbar — equivalent to GeoVision's .navbar on every public page.
 * If user is logged in, shows avatar dropdown instead of "Portal" button.
 */
export function Navbar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const session = getSession();

  const navLinks = [
    { to: '/', label: 'Início' },
    { to: '/about', label: 'Sobre' },
    { to: '/services', label: 'Serviços' },
  ];

  const isActive = (path: string) => location.pathname === path;
  const dashUrl = session?.role === 'admin' ? '/admin' : '/dashboard';
  const initials = session ? getInitials(session.name, session.email) : '';
  const displayName = session ? (session.name || session.email.split('@')[0]) : '';

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', textDecoration: 'none', color: 'var(--text-primary)' }}>
          <Heart size={28} style={{ color: 'var(--accent-teal)' }} />
          <span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.15em' }}>HEALTH PLATFORM</span>
        </Link>

        <div style={{
          display: mobileOpen ? 'flex' : undefined,
          ...(mobileOpen ? {
            flexDirection: 'column' as const, position: 'absolute' as const, top: '100%', right: 0,
            background: '#0b1428', border: '1px solid var(--border)', borderRadius: '12px',
            padding: '0.5rem 0', minWidth: '200px', zIndex: 9999,
            boxShadow: '0 14px 36px rgba(0,0,0,0.8)',
          } : {}),
        }}
          className={mobileOpen ? '' : 'navbar-desktop-nav'}
        >
          {navLinks.map(l => (
            <Link key={l.to} to={l.to}
              onClick={() => setMobileOpen(false)}
              style={{
                color: isActive(l.to) ? 'var(--accent-teal)' : 'var(--text-secondary)',
                textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500,
                padding: mobileOpen ? '0.9rem 1.4rem' : '0.5rem 0',
                ...(mobileOpen ? { borderBottom: '1px solid var(--border)' } : {}),
                transition: 'color 0.2s',
              }}>
              {l.label}
            </Link>
          ))}
          {session ? (
            <Link to={dashUrl} onClick={() => setMobileOpen(false)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.35rem 0.8rem 0.35rem 0.35rem',
                background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.25)',
                borderRadius: '40px', color: 'var(--text-primary)',
                fontSize: '0.85rem', fontWeight: 500, textDecoration: 'none',
              }}>
              <span style={{
                width: '30px', height: '30px', borderRadius: '50%',
                background: 'var(--gradient-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700, color: '#020617',
              }}>{initials}</span>
              <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName.split(' ')[0]}
              </span>
            </Link>
          ) : (
            <Link to="/login" onClick={() => setMobileOpen(false)}
              style={{
                padding: '0.6rem 1.4rem', borderRadius: '8px',
                background: 'var(--gradient-primary)', color: '#020617',
                fontWeight: 600, textDecoration: 'none', fontSize: '0.85rem',
                display: 'inline-block',
              }}>
              Portal
            </Link>
          )}
        </div>

        <button onClick={() => setMobileOpen(!mobileOpen)}
          className="navbar-mobile-toggle"
          aria-label="Menu"
          style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <style>{`
        .navbar-desktop-nav {
          display: flex; align-items: center; gap: 2.5rem;
        }
        @media (max-width: 768px) {
          .navbar-desktop-nav { display: none !important; }
          .navbar-mobile-toggle { display: block !important; }
        }
      `}</style>
    </nav>
  );
}
