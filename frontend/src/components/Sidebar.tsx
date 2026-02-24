import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getInitials } from '../api';
import { useT } from '../i18n/LanguageContext';
import {
  Activity, User, Users, Stethoscope, ClipboardList, Calendar,
  Shield, LayoutDashboard, LogOut, UserCog, Heart, Settings, Home, X,
} from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();
  const role = user?.role;
  const initials = getInitials(user?.name, user?.email);
  const displayName = user?.name || user?.email?.split('@')[0] || t('sidebar.user_fallback');
  const roleLabel = role === 'admin' ? t('sidebar.role_admin') : role === 'doctor' ? t('sidebar.role_doctor') : t('sidebar.role_patient');

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      {/* Mobile backdrop */}
      {open && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <Link to="/" className="sidebar-brand-link">
            <Heart className="sidebar-brand-icon" />
            <div>
              <div className="sidebar-brand-name">HEALTH</div>
              <div className="sidebar-brand-sub">Triage & Teleconsulta</div>
            </div>
          </Link>
          <button className="sidebar-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {/* Patient / General */}
          {(role === 'patient' || role === 'cliente' || role === 'admin') && (
            <SidebarSection title={t('sidebar.main')}>
              <SidebarLink to="/dashboard" icon={Home} label={t('sidebar.overview')} onClick={onClose} />
              <SidebarLink to="/patient/profile" icon={User} label={t('sidebar.my_profile')} onClick={onClose} />
              <SidebarLink to="/triage" icon={Activity} label={t('sidebar.triage')} onClick={onClose} />
              <SidebarLink to="/consultations" icon={Calendar} label={t('sidebar.consultations')} onClick={onClose} />
              <SidebarLink to="/consents" icon={Shield} label={t('sidebar.consents')} onClick={onClose} />
            </SidebarSection>
          )}

          {/* Doctor */}
          {(role === 'doctor' || role === 'admin') && (
            <SidebarSection title={t('sidebar.doctor')}>
              <SidebarLink to="/doctor/profile" icon={Stethoscope} label={t('sidebar.doctor_profile')} onClick={onClose} />
              <SidebarLink to="/doctor/queue" icon={ClipboardList} label={t('sidebar.queue')} onClick={onClose} />
            </SidebarSection>
          )}

          {/* Admin */}
          {role === 'admin' && (
            <SidebarSection title={t('sidebar.admin')}>
              <SidebarLink to="/admin" icon={LayoutDashboard} label={t('sidebar.dashboard')} onClick={onClose} />
              <SidebarLink to="/admin/patients" icon={Users} label={t('sidebar.patients')} onClick={onClose} />
              <SidebarLink to="/admin/doctors" icon={UserCog} label={t('sidebar.verify_doctors')} onClick={onClose} />
            </SidebarSection>
          )}

          {/* Conta */}
          <SidebarSection title={t('sidebar.account')}>
            <SidebarLink to="/settings" icon={Settings} label={t('sidebar.settings')} onClick={onClose} />
          </SidebarSection>
        </nav>

        {/* User Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{displayName}</div>
              <div className="sidebar-user-role">{roleLabel}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={handleLogout}>
            <LogOut size={16} /> {t('sidebar.logout')}
          </button>
        </div>
      </aside>
    </>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sidebar-section">
      <div className="sidebar-section-title">{title}</div>
      {children}
    </div>
  );
}

function SidebarLink({ to, icon: Icon, label, onClick }: { to: string; icon: any; label: string; onClick?: () => void }) {
  return (
    <NavLink to={to} onClick={onClick}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
      <span className="sidebar-link-icon"><Icon size={18} /></span>
      <span>{label}</span>
    </NavLink>
  );
}
