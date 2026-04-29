import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { getInitials } from '../api';
import { useT } from '../i18n/LanguageContext';
import {
  Activity, User, Users, Stethoscope, ClipboardList, Calendar,
  Shield, LayoutDashboard, LogOut, UserCog, Heart, Settings, Home, X, HeartPulse,
  Cpu, CreditCard, UserCheck, Bell, Video, FileText, MessageSquare,
  DollarSign, Star, Globe, HelpCircle, Lock,
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
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <Link to={role === 'doctor' ? '/doctor/dashboard' : role === 'admin' ? '/admin' : '/dashboard'} className="sidebar-brand-link">
            <Heart className="sidebar-brand-icon" />
            <div>
              <div className="sidebar-brand-name">HEALTH</div>
              <div className="sidebar-brand-sub">{role === 'doctor' ? 'Portal Médico' : role === 'admin' ? 'Administração' : 'Triage & Teleconsulta'}</div>
            </div>
          </Link>
          <button className="sidebar-close" onClick={onClose}><X size={18} /></button>
        </div>

        <nav className="sidebar-nav">
          {/* ── PATIENT ── */}
          {(role === 'patient' || role === 'cliente') && (
            <SidebarSection title={t('sidebar.main')}>
              <SidebarLink to="/dashboard"       icon={Home}        label={t('sidebar.overview')}      onClick={onClose} />
              <SidebarLink to="/patient/profile" icon={User}        label={t('sidebar.my_profile')}    onClick={onClose} />
              <SidebarLink to="/triage"          icon={Activity}    label={t('sidebar.triage')}        onClick={onClose} />
              <SidebarLink to="/consultations"   icon={Calendar}    label={t('sidebar.consultations')} onClick={onClose} />
              <SidebarLink to="/self-care"       icon={HeartPulse}  label={t('sidebar.self_care')}     onClick={onClose} />
              <SidebarLink to="/consents"        icon={Shield}      label={t('sidebar.consents')}      onClick={onClose} />
            </SidebarSection>
          )}
          {(role === 'patient' || role === 'cliente') && (
            <SidebarSection title="Saúde & Dispositivos">
              <SidebarLink to="/devices"       icon={Cpu}       label="Dispositivos"  onClick={onClose} />
              <SidebarLink to="/family"        icon={UserCheck} label="Família"       onClick={onClose} />
              <SidebarLink to="/notifications" icon={Bell}      label="Alertas"       onClick={onClose} badge={3} badgeVariant="alert" />
            </SidebarSection>
          )}
          {(role === 'patient' || role === 'cliente') && (
            <SidebarSection title="Plano & Faturação">
              <SidebarLink to="/pricing" icon={CreditCard} label="Subscrição" onClick={onClose} />
            </SidebarSection>
          )}

          {/* ── DOCTOR ── */}
          {role === 'doctor' && (
            <SidebarSection title="MÉDICO">
              <SidebarLink to="/doctor/dashboard"    icon={LayoutDashboard} label="Dashboard"              onClick={onClose} />
              <SidebarLink to="/doctor/agenda"       icon={Calendar}        label="Agenda"                 onClick={onClose} />
              <SidebarLink to="/doctor/pacientes"    icon={Users}           label="Pacientes"              onClick={onClose} />
              <SidebarLink to="/doctor/consultas"    icon={Video}           label="Consultas Ao Vivo"      onClick={onClose} />
              <SidebarLink to="/doctor/queue"        icon={ClipboardList}   label="Fila de Espera"         onClick={onClose} />
              <SidebarLink to="/doctor/prescricoes"  icon={FileText}        label="Prescrições Pendentes"  onClick={onClose} badge={3} badgeVariant="alert" />
              <SidebarLink to="/doctor/mensagens"    icon={MessageSquare}   label="Mensagens"              onClick={onClose} />
              <SidebarLink to="/doctor/financeiro"   icon={DollarSign}      label="Financeiro"             onClick={onClose} />
              <SidebarLink to="/doctor/avaliacoes"   icon={Star}            label="Avaliações"             onClick={onClose} />
              <SidebarLink to="/doctor/profile"      icon={Stethoscope}     label="Perfil Público"         onClick={onClose} />
            </SidebarSection>
          )}
          {role === 'doctor' && (
            <SidebarSection title="CONTA">
              <SidebarLink to="/settings"        icon={Settings}      label="Definições"  onClick={onClose} />
              <SidebarLink to="/doctor/security" icon={Lock}          label="Segurança"   onClick={onClose} />
              <SidebarLink to="/doctor/suporte"  icon={HelpCircle}    label="Suporte"     onClick={onClose} />
            </SidebarSection>
          )}

          {/* ── ADMIN ── */}
          {role === 'admin' && (
            <SidebarSection title={t('sidebar.admin')}>
              <SidebarLink to="/admin"          icon={LayoutDashboard} label={t('sidebar.dashboard')}      onClick={onClose} />
              <SidebarLink to="/admin/patients" icon={Users}           label={t('sidebar.patients')}       onClick={onClose} />
              <SidebarLink to="/admin/doctors"  icon={UserCog}         label={t('sidebar.verify_doctors')} onClick={onClose} />
            </SidebarSection>
          )}
          {role === 'admin' && (
            <SidebarSection title={t('sidebar.account')}>
              <SidebarLink to="/settings" icon={Settings} label={t('sidebar.settings')} onClick={onClose} />
            </SidebarSection>
          )}

          {/* ── PATIENT ACCOUNT ── */}
          {(role === 'patient' || role === 'cliente') && (
            <SidebarSection title={t('sidebar.account')}>
              <SidebarLink to="/settings" icon={Settings} label={t('sidebar.settings')} onClick={onClose} />
            </SidebarSection>
          )}
        </nav>

        {/* Footer */}
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

function SidebarLink({
  to, icon: Icon, label, onClick, badge, badgeVariant = 'default',
}: {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick?: () => void;
  badge?: number;
  badgeVariant?: 'default' | 'alert' | 'muted';
}) {
  return (
    <NavLink to={to} onClick={onClick}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
      <span className="sidebar-link-icon"><Icon size={17} /></span>
      <span className="sidebar-link-label">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`sidebar-badge sidebar-badge--${badgeVariant}`}>{badge}</span>
      )}
    </NavLink>
  );
}


