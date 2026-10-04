import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Sidebar } from './components/Sidebar';
import ChatWidget from './components/ChatWidget';
import { Activity, Calendar, Home, Menu, User } from 'lucide-react';
import { useState } from 'react';
import { useT } from './i18n/LanguageContext';
import LanguageSelector from './components/LanguageSelector';
import { isPatientAccount, requiredPathRedirect } from './authRouting';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { t } = useT();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const accountRedirect = requiredPathRedirect(user, location.pathname);
  if (accountRedirect) return <Navigate to={accountRedirect} replace />;

  /* Map route path to a breadcrumb label */
  const crumbs: Record<string, string> = {
    '/dashboard': t('topbar.overview'),
    '/patient/profile': t('topbar.my_profile'),
    '/triage': t('topbar.triage'),
    '/consultations': t('topbar.consultations'),
    '/self-care': t('topbar.self_care'),
    '/consents': t('topbar.consents'),
    '/consent-gate': t('topbar.consents'),
    '/data-consent': t('topbar.consents'),
    '/family': t('topbar.family'),
    '/notifications': t('topbar.notifications'),
    '/patient/readings': t('topbar.readings'),
    '/loja': t('topbar.store'),
    '/corporate': t('topbar.corporate'),
    // Doctor
    '/doctor/dashboard': t('topbar.doctor_dashboard'),
    '/doctor/agenda': t('topbar.agenda'),
    '/doctor/disponibilidade': t('topbar.availability'),
    '/doctor/pacientes': t('topbar.my_patients'),
    '/doctor/consultas': t('topbar.live_consults'),
    '/doctor/queue': t('topbar.queue'),
    '/doctor/prescricoes': t('topbar.pending_rx'),
    '/doctor/mensagens': t('topbar.messages'),
    '/doctor/financeiro': t('topbar.finance'),
    '/doctor/avaliacoes': t('topbar.reviews'),
    '/doctor/profile': t('topbar.public_profile'),
    // Nurse
    '/nurse': t('topbar.nurse'),
    // Admin
    '/admin': t('topbar.admin_dashboard'),
    '/admin/doctors': t('topbar.verify_doctors'),
    '/admin/patients': t('topbar.patients') !== 'topbar.patients' ? t('topbar.patients') : 'Pacientes',
    '/admin/applications': t('topbar.applications'),
    '/admin/credentials': t('topbar.credentials'),
    '/admin/compliance': t('admc.title'),
    '/admin/expiry': t('exp.title'),
    // Cross-role
    '/professional-verification': t('topbar.my_credentials'),
    '/pricing': t('topbar.subscription'),
    '/settings': t('topbar.settings'),
    '/security': t('sec.title'),
    '/security/mfa': t('mfa.title'),
    '/onboarding/organisation': t('org.title'),
    '/onboarding/caregiver': t('cg.title'),
  };
  const pageTitle = crumbs[location.pathname] || '';

  return (
    <div className="app-layout" key={`${user.id}:${user.role}`}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <header className="app-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="app-topbar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              <Menu size={22} />
            </button>
            <div className="app-topbar-title">{pageTitle}</div>
          </div>
          <LanguageSelector />
        </header>
        <main className="app-content">
          <Outlet />
        </main>
        {isPatientAccount(user) && user.patient_onboarding_complete !== false && (
          <nav className="patient-bottom-nav" aria-label="Navegação principal">
            <NavLink to="/dashboard"><Home size={20} /><span>{t('sidebar.overview')}</span></NavLink>
            <NavLink to="/triage"><Activity size={20} /><span>{t('sidebar.triage')}</span></NavLink>
            <NavLink to="/consultations"><Calendar size={20} /><span>{t('sidebar.consultations')}</span></NavLink>
            <NavLink to="/patient/profile"><User size={20} /><span>{t('sidebar.my_profile')}</span></NavLink>
          </nav>
        )}
      </div>
      <ChatWidget />
    </div>
  );
}
