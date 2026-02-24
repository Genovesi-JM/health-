import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Sidebar } from './components/Sidebar';
import { Menu } from 'lucide-react';
import { useState } from 'react';

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
  const crumbs: Record<string, string> = {
    '/dashboard': 'Visão Geral',
    '/patient/profile': 'Meu Perfil',
    '/triage': 'Triagem',
    '/consultations': 'Consultas',
    '/consents': 'Consentimentos',
    '/doctor/profile': 'Perfil Médico',
    '/doctor/queue': 'Fila de Espera',
    '/admin': 'Dashboard Admin',
    '/admin/doctors': 'Verificar Médicos',
    '/settings': 'Definições',
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
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
