import { useEffect, useState, type FormEvent } from 'react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import { useAuth } from '../AuthContext';
import { specialtyLabel } from '../constants/specialties';
import { Building2, Users, Activity, TrendingUp, ShieldCheck, UserPlus, CheckCircle2 } from 'lucide-react';

interface Account { id: string; company_name: string; tax_id?: string | null; contact_email: string; plan: string; max_employees: number; is_active: boolean; }
interface Kpis {
  employees_covered: number; consultations_total: number; consultations_per_100: number;
  triage_distribution: Record<string, number>; resolution_rate: number; referral_rate: number;
  top_specialties: { specialty: string; count: number }[];
}

export default function CorporateDashboardPage() {
  const { t } = useT();
  const { refreshUser } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);

  // Create-account form
  const [form, setForm] = useState({ company_name: '', tax_id: '', contact_email: '', contact_phone: '', max_employees: 50 });
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  // Enrol form
  const [patientId, setPatientId] = useState('');
  const [empCode, setEmpCode] = useState('');
  const [enrolMsg, setEnrolMsg] = useState('');
  const [enrolErr, setEnrolErr] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/api/v1/corporate/accounts/me')
      .then(r => {
        setAccount(r.data);
        return api.get('/api/v1/corporate/kpis').then(k => setKpis(k.data)).catch(() => {});
      })
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const createAccount = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true); setCreateErr('');
    try {
      await api.post('/api/v1/corporate/accounts', { ...form, max_employees: Number(form.max_employees) });
      try { await refreshUser(); } catch { /* ignore */ }
      load();
    } catch (err: any) {
      setCreateErr(err.response?.data?.detail || t('booking.error'));
    }
    setCreating(false);
  };

  const enrol = async (e: FormEvent) => {
    e.preventDefault();
    setEnrolMsg(''); setEnrolErr('');
    try {
      const r = await api.post('/api/v1/corporate/enroll', { patient_id: patientId.trim(), employee_code: empCode.trim() || undefined });
      setEnrolMsg(r.data?.detail || 'OK');
      setPatientId(''); setEmpCode('');
      load();
    } catch (err: any) {
      setEnrolErr(err.response?.data?.detail || t('booking.error'));
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  // ── No account yet: self-serve creation ──
  if (!account) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 size={20} style={{ color: 'var(--brand-primary)' }} /> {t('corp.create_title')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>{t('corp.create_desc')}</p>
        <form onSubmit={createAccount} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <Field label={t('corp.company_name')} value={form.company_name} onChange={v => setForm(f => ({ ...f, company_name: v }))} required />
          <Field label={t('corp.tax_id')} value={form.tax_id} onChange={v => setForm(f => ({ ...f, tax_id: v }))} />
          <Field label={t('corp.contact_email')} type="email" value={form.contact_email} onChange={v => setForm(f => ({ ...f, contact_email: v }))} required />
          <Field label={t('corp.contact_phone')} value={form.contact_phone} onChange={v => setForm(f => ({ ...f, contact_phone: v }))} />
          <Field label={t('corp.max_employees')} type="number" value={String(form.max_employees)} onChange={v => setForm(f => ({ ...f, max_employees: Number(v) }))} />
          {createErr && <div style={{ color: '#ef4444', fontSize: '0.82rem' }}>{createErr}</div>}
          <button className="btn btn-primary" disabled={creating || !form.company_name || !form.contact_email}>{t('corp.create_btn')}</button>
        </form>
        <p style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '1rem' }}>
          <ShieldCheck size={14} /> {t('corp.privacy_note')}
        </p>
      </div>
    );
  }

  // ── Account exists: KPIs + enrol ──
  const kpiCards = kpis ? [
    { label: t('corp.kpi_employees'), value: kpis.employees_covered, icon: <Users size={18} />, color: '#0d9488' },
    { label: t('corp.kpi_consultations'), value: kpis.consultations_total, icon: <Activity size={18} />, color: '#3b82f6' },
    { label: t('corp.kpi_per100'), value: kpis.consultations_per_100.toFixed(1), icon: <TrendingUp size={18} />, color: '#7c3aed' },
    { label: t('corp.kpi_resolution'), value: `${(kpis.resolution_rate).toFixed(0)}%`, icon: <CheckCircle2 size={18} />, color: '#059669' },
  ] : [];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Building2 size={20} style={{ color: 'var(--brand-primary)' }} /> {account.company_name}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>{t('corp.title')} · {account.plan}</p>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {kpiCards.map(k => (
          <div key={k.label} className="card" style={{ padding: '1.1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{k.label}</span>
              <span style={{ color: k.color }}>{k.icon}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Triage distribution + top specialties */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>{t('corp.triage_dist')}</div>
            {Object.entries(kpis.triage_distribution || {}).map(([level, n]) => (
              <div key={level} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{level}</span><span style={{ fontWeight: 700 }}>{n}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.75rem' }}>{t('corp.top_specialties')}</div>
            {(kpis.top_specialties || []).length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</div>
            ) : kpis.top_specialties.map(s => (
              <div key={s.specialty} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{specialtyLabel(s.specialty, t)}</span><span style={{ fontWeight: 700 }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enrol employee */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.3rem' }}>
          <UserPlus size={16} style={{ color: 'var(--accent-teal)' }} /> {t('corp.enrol_title')}
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 0.85rem' }}>{t('corp.enrol_desc')}</p>
        <form onSubmit={enrol} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('corp.patient_id')}</label>
            <input className="form-input" style={{ width: '100%' }} value={patientId} onChange={e => setPatientId(e.target.value)} required />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('corp.employee_code')}</label>
            <input className="form-input" style={{ width: '100%' }} value={empCode} onChange={e => setEmpCode(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={!patientId.trim()}>{t('corp.enrol_btn')}</button>
        </form>
        {enrolMsg && <div style={{ color: '#059669', fontSize: '0.82rem', marginTop: '0.6rem' }}>{enrolMsg}</div>}
        {enrolErr && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '0.6rem' }}>{enrolErr}</div>}
      </div>

      <p style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '1rem' }}>
        <ShieldCheck size={14} /> {t('corp.privacy_note')}
      </p>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{label}</label>
      <input className="form-input" style={{ width: '100%' }} type={type} value={value} onChange={e => onChange(e.target.value)} required={required} />
    </div>
  );
}
