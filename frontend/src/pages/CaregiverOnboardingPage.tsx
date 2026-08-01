import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, HeartHandshake, Loader2 } from 'lucide-react';
import api from '../api';
import DocumentUpload from '../components/DocumentUpload';
import { useT } from '../i18n/LanguageContext';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.65rem 0.8rem', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg-primary)',
  fontSize: '0.9rem', color: 'var(--text-primary)',
};

const EVIDENCE_TYPES = ['parent_minor', 'legal_guardian'];

export default function CaregiverOnboardingPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const TOTAL = 6;
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const [linkId, setLinkId] = useState<string | null>(null);
  const [hasEvidence, setHasEvidence] = useState(false);

  // dependant fields
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [relationship, setRelationship] = useState('');
  const [cgType, setCgType] = useState('authorised_family');
  // scopes
  const [viewAppts, setViewAppts] = useState(false);
  const [viewRx, setViewRx] = useState(false);
  const [reminders, setReminders] = useState(false);
  const [actOnBehalf, setActOnBehalf] = useState(false);

  const evidenceNeeded = EVIDENCE_TYPES.includes(cgType);

  const createDependant = async (): Promise<boolean> => {
    if (linkId) return true; // already created
    setBusy(true); setError('');
    try {
      const r = await api.post('/api/v1/caregiver/dependants', {
        full_name: fullName,
        caregiver_type: cgType,
        relationship,
        date_of_birth: dob || null,
      });
      setLinkId(r.data.id);
      return true;
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao criar dependente.');
      return false;
    } finally { setBusy(false); }
  };

  const saveScopes = async (): Promise<boolean> => {
    if (!linkId) return false;
    setBusy(true); setError('');
    try {
      await api.patch(`/api/v1/caregiver/dependants/${linkId}/scopes`, {
        can_view_appointments: viewAppts,
        can_view_prescriptions: viewRx,
        can_receive_reminders: reminders,
        can_act_on_behalf: actOnBehalf,
      });
      return true;
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Não foi possível guardar as permissões.');
      return false;
    } finally { setBusy(false); }
  };

  const next = async () => {
    setError('');
    if (step === 3) {
      // Create the dependant after relationship/type is chosen.
      if (!fullName.trim() || !relationship.trim()) { setError('Preencha o nome e a relação.'); return; }
      if (!(await createDependant())) return;
      // Skip evidence step if not needed.
      if (!evidenceNeeded) { setStep(5); return; }
    }
    if (step < TOTAL) { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const back = () => {
    setError('');
    if (step === 5 && !evidenceNeeded) { setStep(3); return; }
    setStep(Math.max(1, step - 1));
  };

  const finish = async () => {
    if (!(await saveScopes())) return;
    setDone(true);
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div className="card" style={{ padding: '2rem 1.75rem', maxWidth: 460, textAlign: 'center' }}>
          <CheckCircle2 size={56} style={{ color: '#22c55e', marginBottom: '0.75rem' }} />
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 800 }}>{t('cg.done_title')}</h1>
          <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)' }}>{t('cg.done_sub')}</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>{t('cg.go_dashboard')}</button>
        </div>
      </div>
    );
  }

  const progressPct = Math.round((step / TOTAL) * 100);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', paddingTop: '2rem' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 1.25rem 4rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            <span>{t('cg.step')} {step} {t('cg.of')} {TOTAL}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><HeartHandshake size={13} /> {t('cg.title')}</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-hover)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--brand-primary)', transition: 'width 240ms ease' }} />
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          {step === 1 && (
            <>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', fontWeight: 800 }}>{t('cg.s1_title')}</h2>
              <p style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{t('cg.own_account_note')}</p>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1.15rem', fontWeight: 800 }}>{t('cg.s2_title')}</h2>
              <Field label={t('cg.full_name')} required><input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} /></Field>
              <Field label={t('cg.dob')}><input style={inputStyle} type="date" value={dob} onChange={e => setDob(e.target.value)} /></Field>
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1.15rem', fontWeight: 800 }}>{t('cg.s3_title')}</h2>
              <Field label={t('cg.relationship')} required><input style={inputStyle} value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="filho / mãe / …" /></Field>
              <Field label={t('cg.type')} required>
                <select style={inputStyle} value={cgType} onChange={e => setCgType(e.target.value)}>
                  <option value="parent_minor">{t('cg.type_parent_minor')}</option>
                  <option value="legal_guardian">{t('cg.type_legal_guardian')}</option>
                  <option value="informal">{t('cg.type_informal')}</option>
                  <option value="authorised_family">{t('cg.type_authorised_family')}</option>
                  <option value="professional">{t('cg.type_professional')}</option>
                </select>
              </Field>
            </>
          )}

          {step === 4 && (
            <>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', fontWeight: 800 }}>{t('cg.s4_title')}</h2>
              <p style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('cg.s4_sub')}</p>
              {linkId && (
                <DocumentUpload kind="guardianship" label={t('cg.s4_title')}
                  endpoint={`/api/v1/caregiver/dependants/${linkId}/evidence`}
                  onUploaded={() => setHasEvidence(true)} />
              )}
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('cg.s4_skip')}</p>
            </>
          )}

          {step === 5 && (
            <>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', fontWeight: 800 }}>{t('cg.s5_title')}</h2>
              <p style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('cg.s5_sub')}</p>
              <Toggle label={t('cg.scope_appointments')} checked={viewAppts} onChange={setViewAppts} />
              <Toggle label={t('cg.scope_prescriptions')} checked={viewRx} onChange={setViewRx} />
              <Toggle label={t('cg.scope_reminders')} checked={reminders} onChange={setReminders} />
              <Toggle
                label={t('cg.scope_act')}
                checked={actOnBehalf}
                onChange={setActOnBehalf}
                disabled={evidenceNeeded && !hasEvidence}
                hint={evidenceNeeded && !hasEvidence ? t('cg.scope_act_locked') : undefined}
              />
            </>
          )}

          {step === 6 && (
            <>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', fontWeight: 800 }}>{t('cg.s6_title')}</h2>
              <ul style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <li><strong>{fullName}</strong> — {relationship} ({t(`cg.type_${cgType}`)})</li>
                <li>{[viewAppts && t('cg.scope_appointments'), viewRx && t('cg.scope_prescriptions'), reminders && t('cg.scope_reminders'), actOnBehalf && t('cg.scope_act')].filter(Boolean).join(', ') || '—'}</li>
              </ul>
            </>
          )}

          {error && (
            <div role="alert" style={{ marginTop: '1rem', padding: '0.7rem 0.9rem', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#b91c1c', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
          <button className="btn btn-ghost" onClick={back} disabled={step === 1 || busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={16} /> {t('cg.back')}
          </button>
          {step < TOTAL ? (
            <button className="btn btn-primary" onClick={next} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {busy ? <><Loader2 size={16} className="spin" /> {t('cg.saving')}</> : <>{t('cg.next')} <ArrowRight size={16} /></>}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={finish} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {busy ? <><Loader2 size={16} className="spin" /> {t('cg.saving')}</> : <>{t('cg.finish')} <CheckCircle2 size={16} /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
      </div>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange, disabled, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return (
    <div style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--border)', opacity: disabled ? 0.55 : 1 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} style={{ accentColor: 'var(--brand-primary)' }} />
        <span style={{ fontSize: '0.9rem' }}>{label}</span>
      </label>
      {hint && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3, marginLeft: '1.7rem' }}>{hint}</div>}
    </div>
  );
}
