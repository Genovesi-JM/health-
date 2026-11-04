import { useState } from 'react';
import { Heart, HeartPulse, LogOut, Menu, Settings, X } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import NurseDashboardPage from './NurseDashboardPage';
import { useT } from '../i18n/LanguageContext';

export default function NurseDashboardPreviewShell() {
  const { t } = useT();
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
              <div className="sidebar-brand-sub">{t('nurse.portal_sub')}</div>
            </div>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label={t('common.close_menu')}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label={t('nurse.portal_sub')}>
          <div className="sidebar-section">
            <div className="sidebar-section-title">{t('nurse.section')}</div>
            <div className="sidebar-link active">
              <span className="sidebar-link-icon"><HeartPulse size={17} /></span>
              <span className="sidebar-link-label">{t('nurse.dashboard')}</span>
            </div>
            <div className="sidebar-link">
              <span className="sidebar-link-icon"><Settings size={17} /></span>
              <span className="sidebar-link-label">{t('sidebar.settings')}</span>
            </div>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">SM</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">Sofia Mendes</div>
              <div className="sidebar-user-role">{t('nurse.role_label')}</div>
            </div>
          </div>
          <button className="sidebar-logout" type="button">
            <LogOut size={16} /> {t('sidebar.logout')}
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="app-topbar-toggle" onClick={() => setSidebarOpen(true)} aria-label={t('common.menu')}>
              <Menu size={22} />
            </button>
            <div className="app-topbar-title">{t('nurse.dashboard')}</div>
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
