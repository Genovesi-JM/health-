import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Sidebar } from './components/Sidebar';
import ChatWidget from './components/ChatWidget';
import { Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useT } from './i18n/LanguageContext';
import LanguageSelector from './components/LanguageSelector';
import api from './api';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // null = checking, true = OK, false = needs consent
  const [consentOk, setConsentOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;

    // Doctors and admins are exempt from the patient consent gate
    if (user.role === 'doctor' || user.role === 'admin') {
      setConsentOk(true);
      return;
    }

    // Skip API call if already confirmed in this session
    if (sessionStorage.getItem('consents_accepted') === 'true') {
      setConsentOk(true);
      return;
    }

    // Don't check if we're already on the consent gate (avoid redirect loop)
    if (location.pathname === '/consent-gate' || location.pathname === '/data-consent') {
      setConsentOk(true);
      return;
    }

    api.get('/api/v1/compliance/consents')
      .then(r => {
        const types: string[] = r.data.map((c: { consent_type: string }) => c.consent_type);
        const allAccepted = REQUIRED_CONSENTS.every(ct => types.includes(ct));
        if (allAccepted) sessionStorage.setItem('consents_accepted', 'true');
        setConsentOk(allAccepted);
      })
      .catch(() => {
        // If the check fails (network error, non-patient), let through
        setConsentOk(true);
      });
  }, [user, location.pathname]);

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

  // Still checking consents — show spinner
  if (consentOk === null) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  // Redirect to consent gate (except if already there)
  if (consentOk === false
    && location.pathname !== '/consent-gate'
    && location.pathname !== '/data-consent'
  ) {
    return <Navigate to="/consent-gate" replace />;
  }

  /* Map route path to a breadcrumb label */
  const { t } = useT();
  const crumbs: Record<string, string> = {
    '/dashboard': t('topbar.overview'),
    '/patient/profile': t('topbar.my_profile'),
    '/triage': t('topbar.triage'),
    '/consultations': t('topbar.consultations'),
    '/self-care': t('topbar.self_care'),
    '/consents': t('topbar.consents'),
    '/consent-gate': 'Consents',
    '/data-consent': 'Data Consent',
    '/family': 'Família',
    '/notifications': 'Alertas',
    '/patient/readings': 'Minhas Medições',
    '/doctor/dashboard': 'Dashboard',
    '/doctor/agenda': 'Agenda',
    '/doctor/pacientes': 'Os Meus Pacientes',
    '/doctor/consultas': 'Consultas Ao Vivo',
    '/doctor/queue': 'Fila de Espera',
    '/doctor/prescricoes': 'Prescrições Pendentes',
    '/admin': t('topbar.admin_dashboard'),
    '/admin/doctors': t('topbar.verify_doctors'),
    '/admin/patients': 'Pacientes',
    '/settings': t('topbar.settings'),
  };
  const pageTitle = crumbs[location.pathname] || 'Dashboard';

  return (
    <div className="app-layout">
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
      </div>
      <ChatWidget />
    </div>
  );
}
