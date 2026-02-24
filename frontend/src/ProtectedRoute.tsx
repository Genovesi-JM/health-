import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Sidebar } from './components/Sidebar';
import ChatWidget from './components/ChatWidget';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { useT } from './i18n/LanguageContext';
import LanguageSelector from './components/LanguageSelector';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
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

  /* Map route path to a breadcrumb label */
  const { t } = useT();
  const crumbs: Record<string, string> = {
    '/dashboard': t('topbar.overview'),
    '/patient/profile': t('topbar.my_profile'),
    '/triage': t('topbar.triage'),
    '/consultations': t('topbar.consultations'),
    '/self-care': t('topbar.self_care'),
    '/consents': t('topbar.consents'),
    '/doctor/profile': t('topbar.doctor_profile'),
    '/doctor/queue': t('topbar.queue'),
    '/admin': t('topbar.admin_dashboard'),
    '/admin/doctors': t('topbar.verify_doctors'),
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
