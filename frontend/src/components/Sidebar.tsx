import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { CirclePlus, CircleMinus, X } from 'lucide-react';
import { useAuth } from '../AuthContext';
import api, { getSession } from '../api';
import { useT } from '../i18n/LanguageContext';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import kayaLogo from '/kaya-logo.svg';

interface Props { open: boolean; onClose: () => void; }

type Item = { to: string; label: string; badge?: number };
type Group = { id: string; title: string; items: Item[] };

/* Menu drawer on the La Meva Salut pattern: plain list, groups expand with a
   plus/minus, then a divider with help and legal links, and the emergency
   number at the bottom. The link set per role is unchanged. */
export function Sidebar({ open, onClose }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();
  const unread = useUnreadNotifications();
  const role = user?.role;

  // Server-side count of pending renewals for doctors (never a page size).
  const [pendingRx, setPendingRx] = useState(0);
  const owner = String(user?.id ?? '');
  useEffect(() => {
    const session = getSession();
    if (role !== 'doctor' || !owner || session?.userId !== owner || !session.token) return;
    let active = true;
    const refresh = () => {
      api.get('/api/v1/doctor/dashboard', { headers: { Authorization: `Bearer ${session.token}` } })
        .then(r => { if (!active) return; const n: unknown = r.data.pending_prescription_requests; setPendingRx(Number.isSafeInteger(n) && (n as number) > 0 ? (n as number) : 0); })
        .catch(() => { if (active) setPendingRx(0); });
    };
    refresh(); const id = setInterval(refresh, 2 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [owner, role]);

  const alerts: Item = { to: '/notifications', label: t('sidebar.alerts'), badge: unread > 0 ? unread : undefined };
  const groups: Group[] =
    role === 'patient' || role === 'cliente' ? [
      { id: 'care', title: 'Informação clínica', items: [
        { to: '/triage', label: t('sidebar.triage') }, { to: '/consultations', label: t('sidebar.consultations') },
        { to: '/patient/documents', label: 'Os meus documentos' }, { to: '/patient/readings', label: t('sidebar.readings') },
      ] },
      { id: 'meds', title: 'Medicação', items: [{ to: '/prescricoes/pedido', label: 'Receitas e renovações' }, { to: '/self-care', label: t('sidebar.self_care') }] },
      { id: 'transport', title: 'Transporte e ambulância', items: [{ to: '/transporte', label: 'Pedir transporte' }, { to: '/urgencia', label: 'Urgência e pré-alerta' }] },
      { id: 'family', title: 'Família e consentimentos', items: [{ to: '/family', label: t('sidebar.family') }, { to: '/consents', label: t('sidebar.consents') }] },
      { id: 'other', title: 'Outros', items: [{ to: '/loja', label: t('store.title') }, { to: '/pricing', label: t('sidebar.subscription') }, alerts] },
    ] :
    role === 'doctor' ? [
      { id: 'work', title: 'Consultas', items: [
        { to: '/doctor/agenda', label: t('sidebar.doc_agenda') }, { to: '/doctor/disponibilidade', label: t('avail.title') },
        { to: '/doctor/consultas', label: t('sidebar.doc_live') }, { to: '/doctor/queue', label: t('sidebar.doc_queue') },
      ] },
      { id: 'patients', title: 'Pacientes e receitas', items: [
        { to: '/doctor/pacientes', label: t('sidebar.doc_patients') }, { to: '/doctor/prescricoes', label: t('sidebar.doc_prescriptions'), badge: pendingRx || undefined },
        { to: '/doctor/mensagens', label: t('sidebar.doc_messages') },
      ] },
      { id: 'practice', title: 'A minha prática', items: [
        { to: '/doctor/financeiro', label: t('sidebar.doc_finance') }, { to: '/doctor/avaliacoes', label: t('sidebar.doc_reviews') },
        { to: '/doctor/profile', label: t('sidebar.doc_profile') }, { to: '/professional-verification', label: t('sidebar.my_credentials') }, alerts,
      ] },
    ] :
    role === 'admin' ? [
      { id: 'admin', title: t('sidebar.admin'), items: [
        { to: '/admin/patients', label: t('sidebar.patients') }, { to: '/admin/doctors', label: t('sidebar.verify_doctors') },
        { to: '/admin/credentials', label: t('sidebar.credentials') }, { to: '/admin/applications', label: t('sidebar.applications') },
        { to: '/admin/compliance', label: t('admc.title') }, { to: '/admin/expiry', label: t('exp.title') }, alerts,
      ] },
    ] :
    role === 'nurse' ? [
      { id: 'nurse', title: t('nurse.section'), items: [{ to: '/professional-verification', label: t('sidebar.my_credentials') }, alerts] },
    ] :
    role === 'corporate_admin' ? [
      { id: 'corp', title: t('corp.title'), items: [{ to: '/corporate', label: t('corp.title') }, alerts] },
    ] : [];

  const home = role === 'doctor' ? '/doctor/dashboard' : role === 'admin' ? '/admin' : role === 'nurse' ? '/nurse' : role === 'corporate_admin' ? '/corporate' : '/dashboard';
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpenGroups(g => ({ ...g, [id]: !g[id] }));
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      {open && <div className="lms-scrim" onClick={onClose} />}
      <aside className={`lms-drawer${open ? ' is-open' : ''}`} aria-hidden={!open}>
        <div className="lms-drawer__head">
          <Link to={home} className="lms-brand" onClick={onClose} style={{ justifySelf: 'center', paddingLeft: 0 }}>
            <img src={kayaLogo} alt="" width={30} height={30} />
            <span className="lms-brand__text"><span className="lms-brand__top">A minha</span><span className="lms-brand__main">/<b>Saúde</b></span></span>
          </Link>
          {open && <button className="lms-drawer__close" onClick={onClose} aria-label="Fechar menu"><X size={26} /></button>}
        </div>
        <nav className="lms-drawer__nav">
          <div className="lms-drawer__plain"><NavLink to={home} onClick={onClose}>Início</NavLink></div>
          {groups.map(g => (
            <div key={g.id} className="lms-drawer__group">
              <button className="lms-drawer__title" onClick={() => toggle(g.id)} aria-expanded={Boolean(openGroups[g.id])}>
                <span>{g.title}</span>{openGroups[g.id] ? <CircleMinus size={30} strokeWidth={1.4} /> : <CirclePlus size={30} strokeWidth={1.4} />}
              </button>
              {openGroups[g.id] && (
                <ul className="lms-drawer__links">
                  {g.items.map(it => (
                    <li key={it.to + it.label}>
                      <NavLink to={it.to} onClick={onClose}>{it.label}{it.badge ? <span className="lms-badge">{it.badge}</span> : null}</NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <hr className="lms-drawer__sep" />
          <div className="lms-drawer__plain">
            <NavLink to="/settings" onClick={onClose}>{t('sidebar.settings')}</NavLink>
            <NavLink to="/security" onClick={onClose}>{t('sec.title')}</NavLink>
            <Link to="/faq" onClick={onClose}>Ajuda</Link>
            <Link to="/terms" onClick={onClose}>Aviso legal</Link>
            <button onClick={handleLogout}>{t('sidebar.logout')}</button>
          </div>
        </nav>
        <div className="lms-drawer__foot">
          <div className="lms-rule" />
          <small>Para mais informação</small>
          <strong>112</strong><span>Emergências</span>
        </div>
      </aside>
    </>
  );
}
