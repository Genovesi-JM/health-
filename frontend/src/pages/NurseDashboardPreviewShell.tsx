import { useState } from 'react';
import { Heart, HeartPulse, LogOut, Menu, Settings, X } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import NurseDashboardPage from './NurseDashboardPage';

export default function NurseDashboardPreviewShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-link">
            <Heart className="sidebar-brand-icon" />
            <div>
              <div className="sidebar-brand-name">KAYA</div>
              <div className="sidebar-brand-sub">Portal de Enfermagem</div>
            </div>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação de enfermagem">
          <div className="sidebar-section">
            <div className="sidebar-section-title">ENFERMAGEM</div>
            <div className="sidebar-link active">
              <span className="sidebar-link-icon"><HeartPulse size={17} /></span>
              <span className="sidebar-link-label">Painel de Enfermagem</span>
            </div>
            <div className="sidebar-link">
              <span className="sidebar-link-icon"><Settings size={17} /></span>
              <span className="sidebar-link-label">Definições</span>
            </div>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">SM</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">Sofia Mendes</div>
              <div className="sidebar-user-role">Enfermeira</div>
            </div>
          </div>
          <button className="sidebar-logout" type="button">
            <LogOut size={16} /> Terminar sessão
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="app-topbar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              <Menu size={22} />
            </button>
            <div className="app-topbar-title">Painel de Enfermagem</div>
          </div>
          <LanguageSelector />
        </header>
        <main className="app-content">
          <NurseDashboardPage preview />
        </main>
      </div>
    </div>
  );
}
