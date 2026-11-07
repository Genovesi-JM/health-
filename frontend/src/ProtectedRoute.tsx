import { Outlet, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Menu, UserRound, X, IdCard, CalendarDays, ClipboardList, LogOut } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Sidebar } from './components/Sidebar';
import LanguageSelector from './components/LanguageSelector';
import ThemeToggle from './components/ThemeToggle';
import { useT } from './i18n/LanguageContext';
import { isPatientAccount, requiredPathRedirect } from './authRouting';
import kayaLogo from '/kaya-logo.svg';

/* Logged-in shell on the La Meva Salut pattern: pastel header with a menu
   drawer and a user pop-over, a plain white page, a sticky bottom action,
   the emergency band and a dark footer. */
export function ProtectedRoute() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useT();
  const [drawer, setDrawer] = useState(false);
  const [pop, setPop] = useState(false);

  if (loading) {
    return <div className="page-loading"><div className="spinner" /></div>;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  const accountRedirect = requiredPathRedirect(user, location.pathname);
  if (accountRedirect) return <Navigate to={accountRedirect} replace />;

  const displayName = user.name || user.email.split('@')[0];
  const role = user.role;
  const patient = isPatientAccount(user) && user.patient_onboarding_complete !== false;

  const bottomAction =
    patient ? { to: '/patient/profile', label: 'Cartão de saúde', icon: IdCard } :
    role === 'doctor' ? { to: '/doctor/agenda', label: 'Agenda de hoje', icon: CalendarDays } :
    role === 'nurse' ? { to: '/nurse', label: 'Fila de triagem', icon: ClipboardList } :
    null;

  const profileTo = role === 'doctor' ? '/doctor/profile' : patient ? '/patient/profile' : '/settings';
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="lms" key={`${user.id}:${user.role}`}>
      <header className="lms-header">
        <button className="lms-iconbtn" onClick={() => setDrawer(true)} aria-label="Menu"><Menu size={34} strokeWidth={1.6} /></button>
        <Link to={role === 'doctor' ? '/doctor/dashboard' : role === 'admin' ? '/admin' : role === 'nurse' ? '/nurse' : '/dashboard'} className="lms-brand">
          <img src={kayaLogo} alt="" width={34} height={34} />
          <span className="lms-brand__text">
            <span className="lms-brand__top">A minha</span>
            <span className="lms-brand__main">/<b>Saúde</b></span>
          </span>
        </Link>
        <div className="lms-header__right">
          <button className="lms-iconbtn" onClick={() => setPop(p => !p)} aria-label="Conta" aria-expanded={pop}>
            <UserRound size={34} strokeWidth={1.4} />
          </button>
          {pop && (
            <div className="lms-pop" role="dialog" aria-label="Conta">
              <div className="lms-pop__head">
                <span>{displayName}</span>
                <button className="lms-iconbtn" style={{ width: 44, height: 44 }} onClick={() => setPop(false)} aria-label="Fechar"><X size={28} strokeWidth={1.4} /></button>
              </div>
              <ul className="lms-pop__list">
                <li><Link to={profileTo} onClick={() => setPop(false)}>Dados pessoais</Link></li>
                <li><Link to="/settings" onClick={() => setPop(false)}>Gestão de notificações</Link></li>
                <li><Link to="/notifications" onClick={() => setPop(false)}>Notificações recebidas</Link></li>
                <li><Link to="/security" onClick={() => setPop(false)}>Segurança da conta</Link></li>
                <li style={{ display: 'flex', gap: '.6rem', alignItems: 'center', padding: '.6rem 0' }}><ThemeToggle /><LanguageSelector /></li>
              </ul>
              <button className="lms-pop__out" onClick={handleLogout}>{t('sidebar.logout')} <LogOut size={20} /></button>
            </div>
          )}
        </div>
      </header>

      <Sidebar open={drawer} onClose={() => setDrawer(false)} />

      <main className="lms-main">
        <Outlet />
      </main>

      {bottomAction && (
        <Link to={bottomAction.to} className="lms-cta"><bottomAction.icon size={26} strokeWidth={1.6} /> {bottomAction.label}</Link>
      )}

      <div className="lms-band">
        <div className="lms-band__row"><span className="lms-band__num">KAYA</span> <Link to="/urgencia" style={{ color: 'inherit', textDecoration: 'none' }}>Urgência e pré-alerta hospitalar</Link></div>
        <div className="lms-band__row"><span className="lms-band__num is-red">112</span> Emergências de risco de vida</div>
      </div>
      <footer className="lms-footer">
        <div className="lms-footer__brand">/Saúde <span style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '.12em' }}>KAYA</span></div>
        <div className="lms-footer__links">
          <Link to="/faq">Ajuda</Link> <span>|</span> <Link to="/terms">Aviso legal</Link> <span>|</span> <Link to="/privacy">Privacidade</Link>
        </div>
      </footer>
    </div>
  );
}
