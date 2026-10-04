import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Sidebar } from './components/Sidebar';
import ChatWidget from './components/ChatWidget';
import { Activity, Calendar, Home, Menu, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useT } from './i18n/LanguageContext';
import LanguageSelector from './components/LanguageSelector';
import api from './api';
import { isPatientAccount, requiredPathRedirect } from './authRouting';

/** Consent types patients must accept before accessing the portal */
const REQUIRED_CONSENTS = [
  'terms_of_service',
  'privacy_policy',
  'medical_disclaimer',
  'health_data_processing',
  'telemedicine_consent',
];

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { t } = useT();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [consentAttempt, setConsentAttempt] = useState(0);
  const [consentResult, setConsentResult] = useState<{ identity: string; ok: boolean; error: boolean } | null>(null);
  const consentIdentity = `${user?.id ?? ''}:${user?.role ?? ''}:${location.pathname}:${consentAttempt}`;
  const needsConsent = !!user && isPatientAccount(user) && !location.pathname.startsWith('/onboarding/')
    && !['/settings', '/security', '/security/mfa', '/professional-verification', '/consent-gate', '/data-consent'].includes(location.pathname)
    && !requiredPathRedirect(user, location.pathname);
  const consentOk = !needsConsent ? true : consentResult?.identity === consentIdentity ? consentResult.ok : null;
  const consentError = needsConsent && consentResult?.identity === consentIdentity && consentResult.error;

  useEffect(() => {
    if (!needsConsent) return;
    let cancelled = false;

    api.get('/api/v1/compliance/consents')
      .then(r => {
        if (cancelled) return;
        const types: string[] = r.data.map((c: { consent_type: string }) => c.consent_type);
        const allAccepted = REQUIRED_CONSENTS.every(ct => types.includes(ct));
        setConsentResult({ identity: consentIdentity, ok: allAccepted, error: false });
      })
      .catch(() => {
        if (cancelled) return;
        setConsentResult({ identity: consentIdentity, ok: false, error: true });
      });
    return () => { cancelled = true; };
  }, [needsConsent, consentIdentity]);

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

  // Still checking consents — show spinner
  if (consentOk === null) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (consentError) {
    return (
      <div className="page-loading consent-check-error" role="alert">
        <p>{t('consent.check_error')}</p>
        <button className="btn btn-primary" type="button" onClick={() => setConsentAttempt(value => value + 1)}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  // Redirect to consent gate (except if already there)
  if (consentOk === false
    && location.pathname !== '/consent-gate'
    && location.pathname !== '/data-consent'
  ) {
    return <Navigate to="/consent-gate" state={{ from: location }} replace />;
  }

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
