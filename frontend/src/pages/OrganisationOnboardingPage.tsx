import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
import api from '../api';
import DocumentUpload from '../components/DocumentUpload';
import { useT } from '../i18n/LanguageContext';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.65rem 0.8rem', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg-primary)',
  fontSize: '0.9rem', color: 'var(--text-primary)',
};

interface OrgProfile {
  id: string;
  status: string;
  locations: Array<{ id: string; name: string; city?: string }>;
  documents: Array<{ id: string; kind: string; filename: string }>;
}

export default function OrganisationOnboardingPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetType = params.get('type') === 'pharmacy' ? 'pharmacy_org' : 'clinic';

  const [step, setStep] = useState(1);
  const [org, setOrg] = useState<OrgProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const TOTAL = 5;

  // Step 1 fields
  const [orgType, setOrgType] = useState(presetType);
  const [legalName, setLegalName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [genEmail, setGenEmail] = useState('');
  const [genPhone, setGenPhone] = useState('');
  const [rep, setRep] = useState('');
  const [respPro, setRespPro] = useState('');
  // Step 4 fields
  const [bankHolder, setBankHolder] = useState('');
  const [iban, setIban] = useState('');
  const [plan, setPlan] = useState('standard');
  const [hasApi, setHasApi] = useState(false);
  const [csvImport, setCsvImport] = useState(false);
  // Step 3 location entry
  const [locName, setLocName] = useState('');
  const [locCity, setLocCity] = useState('');

  // Load any existing draft profile on mount.
  useEffect(() => {
    api.get('/api/v1/organisations/me')
      .then(r => {
        setOrg(r.data);
        setOrgType(r.data.org_type || presetType);
        setLegalName(r.data.legal_name || '');
        setTradingName(r.data.trading_name || '');
        setRegNumber(r.data.registration_number || '');
        setTaxNumber(r.data.tax_number || '');
        setGenEmail(r.data.general_email || '');
        setGenPhone(r.data.general_phone || '');
        setRep(r.data.representative_name || '');
        setRespPro(r.data.responsible_professional || '');
      })
      .catch(() => { /* no draft yet — fine */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProfile = async (): Promise<boolean> => {
    setBusy(true); setError('');
    try {
      const r = await api.post('/api/v1/organisations', {
        org_type: orgType,
        legal_name: legalName,
        trading_name: tradingName || null,
        registration_number: regNumber,
        tax_number: taxNumber || null,
        country: 'AO',
        general_email: genEmail || null,
        general_phone: genPhone || null,
        representative_name: rep || null,
        responsible_professional: respPro || null,
        bank_holder_name: bankHolder || null,
        iban: iban || null,
        subscription_plan: plan,
        integration: { has_api: hasApi, csv_import: csvImport },
      });
      setOrg(r.data);
      return true;
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao guardar.');
      return false;
    } finally { setBusy(false); }
  };

  const refresh = async () => {
    const r = await api.get('/api/v1/organisations/me');
    setOrg(r.data);
  };

  const addLocation = async () => {
    if (!locName.trim()) return;
    setBusy(true); setError('');
    try {
      const r = await api.post('/api/v1/organisations/me/locations', { name: locName.trim(), city: locCity.trim() || null });
      setOrg(r.data);
      setLocName(''); setLocCity('');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao adicionar localização.');
    } finally { setBusy(false); }
  };

  const removeLocation = async (id: string) => {
    const r = await api.delete(`/api/v1/organisations/me/locations/${id}`);
    setOrg(r.data);
  };

  const next = async () => {
    setError('');
    if (step === 1) {
      if (!legalName.trim() || !regNumber.trim()) { setError('Preencha o nome legal e o número de registo.'); return; }
      if (!(await saveProfile())) return;
    }
    if (step === 4) {
      if (!(await saveProfile())) return;
    }
    if (step < TOTAL) { setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await saveProfile();
      await api.post('/api/v1/organisations/me/submit');
      setDone(true);
    } catch (e: any) {
      const d = e.response?.data?.detail;
      setError(typeof d === 'object' ? 'Precisa de pelo menos um documento e uma localização.' : (d || 'Erro ao submeter.'));
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div className="card" style={{ padding: '2rem 1.75rem', maxWidth: 460, textAlign: 'center' }}>
          <CheckCircle2 size={56} style={{ color: '#22c55e', marginBottom: '0.75rem' }} />
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 800 }}>{t('org.done_title')}</h1>
          <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)' }}>{t('org.done_sub')}</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>{t('org.go_dashboard')}</button>
        </div>
      </div>
    );
  }

  const progressPct = Math.round((step / TOTAL) * 100);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', paddingTop: '2rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 1.25rem 4rem' }}>
        {/* Progress */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            <span>{t('org.step')} {step} {t('org.of')} {TOTAL}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Building2 size={13} /> {t('org.title')}</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-hover)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--brand-primary)', transition: 'width 240ms ease' }} />
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          {/* Step 1 — details */}
          {step === 1 && (
            <>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1.15rem', fontWeight: 800 }}>{t('org.s1_title')}</h2>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>{t('org.type')}</div>
                <select value={orgType} onChange={e => setOrgType(e.target.value)} style={inputStyle}>
                  <option value="clinic">{t('org.type_clinic')}</option>
                  <option value="laboratory">{t('org.type_lab')}</option>
                  <option value="pharmacy_org">{t('org.type_pharmacy')}</option>
                  <option value="health_org">{t('org.type_health_org')}</option>
                </select>
              </label>
              <Field label={t('org.legal_name')} required><input style={inputStyle} value={legalName} onChange={e => setLegalName(e.target.value)} /></Field>
              <Field label={t('org.trading_name')}><input style={inputStyle} value={tradingName} onChange={e => setTradingName(e.target.value)} /></Field>
              <Field label={t('org.reg_number')} required><input style={inputStyle} value={regNumber} onChange={e => setRegNumber(e.target.value)} /></Field>
              <Field label={t('org.tax_number')}><input style={inputStyle} value={taxNumber} onChange={e => setTaxNumber(e.target.value)} /></Field>
              <Field label={t('org.gen_email')}><input style={inputStyle} type="email" value={genEmail} onChange={e => setGenEmail(e.target.value)} /></Field>
              <Field label={t('org.gen_phone')}><input style={inputStyle} value={genPhone} onChange={e => setGenPhone(e.target.value)} /></Field>
              <Field label={t('org.rep')}><input style={inputStyle} value={rep} onChange={e => setRep(e.target.value)} /></Field>
              <Field label={t('org.resp_pro')}><input style={inputStyle} value={respPro} onChange={e => setRespPro(e.target.value)} /></Field>
            </>
          )}

          {/* Step 2 — documents */}
          {step === 2 && (
            <>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', fontWeight: 800 }}>{t('org.s2_title')}</h2>
              <p style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('org.s2_sub')}</p>
              <DocumentUpload kind="business_registration" label="Registo comercial" onUploaded={refresh}
                currentFilename={org?.documents.find(d => d.kind === 'business_registration')?.filename} />
              <DocumentUpload kind="operating_licence" label="Licença de funcionamento" onUploaded={refresh}
                currentFilename={org?.documents.find(d => d.kind === 'operating_licence')?.filename} />
              <DocumentUpload kind="healthcare_licence" label="Licença sanitária" onUploaded={refresh}
                currentFilename={org?.documents.find(d => d.kind === 'healthcare_licence')?.filename} />
              {orgType === 'pharmacy_org' && (
                <DocumentUpload kind="pharmacy_licence" label="Licença de farmácia" onUploaded={refresh}
                  currentFilename={org?.documents.find(d => d.kind === 'pharmacy_licence')?.filename} />
              )}
              {orgType === 'laboratory' && (
                <DocumentUpload kind="lab_accreditation" label="Acreditação laboratorial" onUploaded={refresh}
                  currentFilename={org?.documents.find(d => d.kind === 'lab_accreditation')?.filename} />
              )}
              <DocumentUpload kind="insurance" label="Seguro" onUploaded={refresh}
                currentFilename={org?.documents.find(d => d.kind === 'insurance')?.filename} />
            </>
          )}

          {/* Step 3 — locations */}
          {step === 3 && (
            <>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', fontWeight: 800 }}>{t('org.s3_title')}</h2>
              <p style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('org.s3_sub')}</p>
              {(org?.locations || []).map(loc => (
                <div key={loc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
                    <MapPin size={15} style={{ color: 'var(--brand-primary)' }} /> <strong>{loc.name}</strong>{loc.city ? ` · ${loc.city}` : ''}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeLocation(loc.id)} style={{ color: '#b91c1c' }}>
                    <Trash2 size={14} /> {t('org.remove')}
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <input style={{ ...inputStyle, flex: 2, minWidth: 160 }} placeholder={t('org.loc_name')} value={locName} onChange={e => setLocName(e.target.value)} />
                <input style={{ ...inputStyle, flex: 1, minWidth: 120 }} placeholder={t('org.loc_city')} value={locCity} onChange={e => setLocCity(e.target.value)} />
                <button className="btn btn-primary btn-sm" onClick={addLocation} disabled={busy || !locName.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={14} /> {t('org.add_location')}
                </button>
              </div>
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {(org?.locations || []).length} {t('org.loc_added')}
              </div>
            </>
          )}

          {/* Step 4 — banking + integration */}
          {step === 4 && (
            <>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1.15rem', fontWeight: 800 }}>{t('org.s4_title')}</h2>
              <Field label={t('org.bank_holder')}><input style={inputStyle} value={bankHolder} onChange={e => setBankHolder(e.target.value)} /></Field>
              <Field label={t('org.iban')} hint={t('org.iban_hint')}><input style={inputStyle} value={iban} onChange={e => setIban(e.target.value)} placeholder="AO06 …" /></Field>
              <Field label={t('org.plan')}>
                <select style={inputStyle} value={plan} onChange={e => setPlan(e.target.value)}>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </Field>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0.5rem 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={hasApi} onChange={e => setHasApi(e.target.checked)} style={{ accentColor: 'var(--brand-primary)' }} />
                <span style={{ fontSize: '0.88rem' }}>{t('org.has_api')}</span>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0.5rem 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={csvImport} onChange={e => setCsvImport(e.target.checked)} style={{ accentColor: 'var(--brand-primary)' }} />
                <span style={{ fontSize: '0.88rem' }}>{t('org.csv_import')}</span>
              </label>
            </>
          )}

          {/* Step 5 — review */}
          {step === 5 && (
            <>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', fontWeight: 800 }}>{t('org.s5_title')}</h2>
              <p style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>{t('org.review_note')}</p>
              <ul style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <li><strong>{legalName}</strong> ({orgType})</li>
                <li>{(org?.documents || []).length} documento(s)</li>
                <li>{(org?.locations || []).length} localização(ões)</li>
              </ul>
            </>
          )}

          {error && (
            <div role="alert" style={{ marginTop: '1rem', padding: '0.7rem 0.9rem', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#b91c1c', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
          <button className="btn btn-ghost" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1 || busy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={16} /> {t('org.back')}
          </button>
          {step < TOTAL ? (
            <button className="btn btn-primary" onClick={next} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {busy ? <><Loader2 size={16} className="spin" /> {t('org.saving')}</> : <>{t('org.next')} <ArrowRight size={16} /></>}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {busy ? <><Loader2 size={16} className="spin" /> {t('org.saving')}</> : <>{t('org.submit')} <CheckCircle2 size={16} /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
      </div>
      {children}
      {hint && <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{hint}</div>}
    </label>
  );
}
