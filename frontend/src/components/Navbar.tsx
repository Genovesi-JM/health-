import { Link, useLocation } from 'react-router-dom';
import {
  Heart, Menu, X, ChevronDown, Users, Stethoscope, Video, HeartPulse,
  Building2, Briefcase, Ambulance, HelpCircle, Phone, Pill, MapPin, type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { getSession, getInitials } from '../api';
import { useT } from '../i18n/LanguageContext';
import LanguageSelector from './LanguageSelector';
import kayaLogo from '/kaya-logo.svg';

interface NavGroup {
  label: string;
  links: { to: string; label: string; sub?: string; icon: LucideIcon }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Para Pacientes',
    links: [
      { to: '/patients',      label: 'Pacientes',        sub: 'Consultas, receitas e historial',        icon: Users },
      { to: '/especialistas', label: 'Especialistas',    sub: 'Encontre o médico certo',               icon: Stethoscope },
      { to: '/telemedicina',  label: 'Teleconsulta',     sub: 'Consulta por vídeo',                    icon: Video },
      { to: '/chronic-care',  label: 'Cuidado Crónico',  sub: 'Hipertensão, diabetes, asma',           icon: HeartPulse },
      { to: '/mapa',          label: 'Mapa de Clínicas', sub: 'Clínicas, hospitais e laboratórios',    icon: MapPin },
    ],
  },
  {
    label: 'Para Parceiros',
    links: [
      { to: '/clinics',  label: 'Hospitais, clínicas e farmácias', sub: 'Receba pacientes e dispense receitas', icon: Building2 },
      { to: '/medicos',  label: 'Médicos',                         sub: 'Directório e candidatura',            icon: Pill },
      { to: '/empresas', label: 'Empresas',                        sub: 'Saúde ocupacional para equipas',      icon: Briefcase },
    ],
  },
  {
    label: 'Soluções',
    links: [
      { to: '/urgencia', label: 'Transporte & Urgência', sub: 'Agendado, assistido ou de emergência', icon: Ambulance },
      { to: '/pricing',  label: 'Planos e preços',       sub: 'Para pessoas, famílias e empresas',    icon: HelpCircle },
      { to: '/about',    label: 'Sobre a KAYA',          sub: 'A nossa missão e visão',               icon: Heart },
      { to: '/faq',      label: 'FAQ',                   sub: 'Perguntas frequentes',                 icon: HelpCircle },
      { to: '/contacto', label: 'Contacto',              sub: 'Fale com a equipa KAYA',               icon: Phone },
    ],
  },
];

export function Navbar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const session = getSession();
  const { t } = useT();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  const dashUrl = session?.role === 'admin' ? '/admin' : '/dashboard';
  const initials = session ? getInitials(session.name, session.email) : '';
  const displayName = session ? (session.name || session.email.split('@')[0]) : '';

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* ── Brand ── */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--text-primary)', flexShrink: 0 }}>
          <img src={kayaLogo} alt="KAYA" style={{ width: 36, height: 36, display: 'block' }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span className="nav-wordmark">KAYA</span>
            <span style={{ fontSize: '0.62rem', color: '#0d9488', fontWeight: 500 }}>Saúde na sua mão</span>
          </div>
        </Link>

        {/* ── Desktop nav ── */}
        <div className="navbar-desktop-nav">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="nav-group"
              onMouseEnter={() => setOpenGroup(group.label)}
              onMouseLeave={() => setOpenGroup(null)}
            >
              <button className={`nav-group__trigger${NAV_GROUPS.find(g => g.label === group.label)?.links.some(l => isActive(l.to)) ? ' nav-group__trigger--active' : ''}`}>
                {group.label} <ChevronDown size={13} className={`nav-chevron${openGroup === group.label ? ' nav-chevron--open' : ''}`} />
              </button>
              {openGroup === group.label && (
                <div className="nav-dropdown">
                  <span className="nav-dropdown__glow" aria-hidden="true" />
                  {group.links.map(l => (
                    <Link key={l.to} to={l.to} className={`nav-dropdown__item${isActive(l.to) ? ' nav-dropdown__item--active' : ''}`}>
                      <span className="nav-dropdown__chip"><l.icon size={17} /></span>
                      <span className="nav-dropdown__text">
                        <span className="nav-dropdown__label">{l.label}</span>
                        {l.sub && <span className="nav-dropdown__sub">{l.sub}</span>}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Right side ── */}
        <div className="navbar-actions">
          {session ? (
            <Link to={dashUrl}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.35rem 0.8rem 0.35rem 0.35rem',
                background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.25)',
                borderRadius: '40px', color: 'var(--text-primary)',
                fontSize: '0.85rem', fontWeight: 500, textDecoration: 'none',
              }}>
              <span style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'var(--gradient-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700, color: '#fff',
              }}>{initials}</span>
              <span style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName.split(' ')[0]}
              </span>
            </Link>
          ) : (
            <div className="navbar-auth-btns" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link to="/login" className="nav-link-text">{t('nav.portal')}</Link>
              <Link to="/choose-account-type" className="nav-cta">{t('nav.start_free')}</Link>
            </div>
          )}
          <LanguageSelector />

          {/* ── Mobile toggle ── */}
          <button onClick={() => setMobileOpen(!mobileOpen)}
            className="navbar-mobile-toggle"
            aria-label="Menu"
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '0.25rem' }}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <div className="navbar-mobile-menu">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mobile-group">
              <div className="mobile-group__label">{group.label}</div>
              {group.links.map(l => (
                <Link key={l.to} to={l.to}
                  className={`mobile-nav-link${isActive(l.to) ? ' mobile-nav-link--active' : ''}`}
                  onClick={() => setMobileOpen(false)}>
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
          <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: '0.5rem' }}>
            {session ? (
              <Link to={dashUrl} className="lp-cta lp-cta--primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMobileOpen(false)}>
                Portal
              </Link>
            ) : (
              <>
                <Link to="/login" className="lp-cta lp-cta--outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMobileOpen(false)}>Entrar</Link>
                <Link to="/choose-account-type" className="lp-cta lp-cta--primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMobileOpen(false)}>{t('nav.start_free')}</Link>
              </>
            )}
          </div>
        </div>
      )}

    </nav>
  );
}

