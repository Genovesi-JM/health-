import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getSession } from '../api';
import { checkReadingConsent, isReadingConsentDenial, readingScope } from '../utils/readingConsent';
import { apiErrorMessage, apiErrorStatus } from '../utils/apiError';
import {
  Activity, Plus, Trash2, X, Loader2, ThermometerSun,
  Droplets, Wind, Weight, Heart, HeartPulse, Upload, Scale,
} from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

// ── Types ────────────────────────────────────────────────────────────────────

type ReadingType =
  | 'blood_pressure'
  | 'glucose'
  | 'temperature'
  | 'oxygen_saturation'
  | 'weight'
  | 'heart_rate'
  | 'body_fat'
  | 'bmi'
  | 'lean_body_mass'
  | 'body_water_mass'
  | 'bone_mass'
  | 'height'
  | 'waist_circumference'
  | 'basal_metabolic_rate';

interface DeviceReading {
  id: string;
  reading_type: ReadingType;
  value: number | null;
  unit: string | null;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  measured_at: string;
  source: string | null;
  device_brand: string | null;
  device_model: string | null;
  notes: string | null;
  created_at: string;
  country?: 'AO' | 'PT' | null;
  consent_language?: string | null;
}

interface ReadingListOut {
  total: number;
  readings: DeviceReading[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const READING_TYPES: { value: ReadingType; label: string; labelKey: string; icon: React.ElementType; defaultUnit: string }[] = [
  { value: 'blood_pressure',    label: 'Pressão Arterial',      labelKey: 'read.t_blood_pressure', icon: Heart,         defaultUnit: 'mmHg' },
  { value: 'glucose',           label: 'Glicose',               labelKey: 'read.t_glucose',        icon: Droplets,      defaultUnit: 'mg/dL' },
  { value: 'temperature',       label: 'Temperatura',           labelKey: 'read.t_temperature',    icon: ThermometerSun,defaultUnit: '°C' },
  { value: 'oxygen_saturation', label: 'Saturação de Oxigénio', labelKey: 'read.t_oxygen',         icon: Wind,          defaultUnit: '%' },
  { value: 'weight',            label: 'Peso',                  labelKey: 'read.t_weight',         icon: Weight,        defaultUnit: 'kg' },
  { value: 'heart_rate',        label: 'Frequência Cardíaca',   labelKey: 'read.t_heart_rate',     icon: HeartPulse,    defaultUnit: 'bpm' },
  { value: 'body_fat',          label: 'Gordura Corporal',      labelKey: 'read.t_body_fat',       icon: Activity,      defaultUnit: '%' },
  { value: 'bmi',               label: 'IMC',                    labelKey: 'read.t_bmi',            icon: Scale,         defaultUnit: 'kg/m²' },
  { value: 'lean_body_mass',    label: 'Massa Magra',            labelKey: 'read.t_lean_mass',      icon: Weight,        defaultUnit: 'kg' },
  { value: 'body_water_mass',   label: 'Água Corporal',          labelKey: 'read.t_body_water',     icon: Droplets,      defaultUnit: 'kg' },
  { value: 'bone_mass',         label: 'Massa Óssea',            labelKey: 'read.t_bone_mass',      icon: Activity,      defaultUnit: 'kg' },
  { value: 'height',            label: 'Altura',                 labelKey: 'read.t_height',         icon: Activity,      defaultUnit: 'm' },
  { value: 'waist_circumference', label: 'Cintura',              labelKey: 'read.t_waist',          icon: Activity,      defaultUnit: 'cm' },
  { value: 'basal_metabolic_rate', label: 'Metabolismo Basal',   labelKey: 'read.t_bmr',            icon: Activity,      defaultUnit: 'kcal/day' },
];

const TYPE_META = Object.fromEntries(READING_TYPES.map(t => [t.value, t])) as Record<
  ReadingType,
  (typeof READING_TYPES)[number]
>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function readingDisplay(r: DeviceReading): string {
  if (r.reading_type === 'blood_pressure') {
    const parts = [r.systolic != null && r.diastolic != null ? `${r.systolic}/${r.diastolic}` : '—'];
    if (r.pulse) parts.push(`pulso: ${r.pulse}`);
    return parts.join(' · ') + ' mmHg';
  }
  return r.value != null ? `${r.value} ${r.unit ?? ''}`.trim() : '—';
}

function typeIcon(type: ReadingType) {
  const Icon = TYPE_META[type]?.icon ?? Activity;
  return <Icon size={14} />;
}

// ── Empty form state ─────────────────────────────────────────────────────────

const emptyForm = () => ({
  reading_type: 'blood_pressure' as ReadingType,
  value: '',
  unit: 'mmHg',
  systolic: '',
  diastolic: '',
  pulse: '',
  measured_at: localDateTime(),
  source: 'manual',
  device_brand: '',
  device_model: '',
  notes: '',
});

function localDateTime() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PatientReadingsPage() {
  const session = getSession();
  return <ReadingWorkspace key={`${session?.userId}:${session?.token}`} />;
}

function ReadingWorkspace() {
  const { t } = useT();
  const [session] = useState(getSession);
  const [readings, setReadings] = useState<DeviceReading[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [country, setCountry] = useState<'AO' | 'PT'>('AO');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterType, setFilterType] = useState<ReadingType | ''>('');
  const [importing, setImporting] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const denied = useRef(false);
  const authority = useRef(0);
  const [importFile, setImportFile] = useState<File | null>(null);
  const mounted = useRef(false);
  const busy = useRef(false);
  const readSequence = useRef(0);
  const advanceRead = useCallback(() => ++readSequence.current, []);
  const current = useCallback(() => mounted.current && !!session?.userId && !!session.token
    && getSession()?.userId === session.userId && getSession()?.token === session.token, [session]);
  const config = useCallback(() => ({ headers: { Authorization: `Bearer ${session?.token ?? ''}` } }), [session]);
  const clearDeniedAccess = useCallback((failure: unknown) => {
    if (![401, 403].includes(apiErrorStatus(failure) ?? 0) || isReadingConsentDenial(failure)) return;
    denied.current = true; ++authority.current; setAccessLost(true);
    ++readSequence.current; setReadings([]); setTotal(0); setLoaded(false); setLoading(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; advanceRead(); };
  }, [advanceRead]);

  const load = useCallback(async (type: ReadingType | '') => {
    if (!current()) return;
    const sequence = ++readSequence.current;
    setLoading(true); setReadError('');
    try {
      const response = await api.get<ReadingListOut>('/api/v1/readings/me', {
        ...config(), params: type ? { reading_type: type } : {},
      });
      if (!current() || sequence !== readSequence.current) return;
      denied.current = false; setAccessLost(false);
      setReadings(response.data.readings); setTotal(response.data.total); setLoaded(true);
    } catch (failure) {
      if (!current() || sequence !== readSequence.current) return;
      clearDeniedAccess(failure); setReadError(t('read.err_load'));
    } finally { if (current() && sequence === readSequence.current) setLoading(false); }
  }, [config, current, clearDeniedAccess, t]);
  useEffect(() => { void Promise.resolve().then(() => load(filterType)); }, [load, filterType]);

  const handleTypeChange = (type: ReadingType) => {
    setForm(f => ({ ...f, reading_type: type, unit: TYPE_META[type].defaultUnit }));
  };
  const handleFilterChange = (type: ReadingType | '') => {
    if (!busy.current && type !== filterType) { ++readSequence.current; setLoading(true); setFilterType(type); }
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!current() || busy.current || denied.current) return;
    const epoch = authority.current;
    const active = () => current() && epoch === authority.current && !denied.current;
    busy.current = true; setError(''); setSuccess(''); setSaving(true);
    let sent = false;
    try {
      const scope = readingScope(country);
      const payload: Record<string, unknown> = {
        ...scope, reading_type: form.reading_type, source: 'manual',
        measured_at: form.measured_at ? new Date(form.measured_at).toISOString() : undefined,
        device_brand: form.device_brand || undefined, device_model: form.device_model || undefined,
        notes: form.notes || undefined,
      };
      if (form.reading_type === 'blood_pressure') {
        if (!form.systolic || !form.diastolic) throw new Error(t('read.bp_required'));
        payload.systolic = Number(form.systolic); payload.diastolic = Number(form.diastolic);
        if (form.pulse) payload.pulse = Number(form.pulse);
      } else {
        if (!form.value) throw new Error(t('read.value_required'));
        payload.value = Number(form.value); payload.unit = form.unit || TYPE_META[form.reading_type].defaultUnit;
      }
      await checkReadingConsent(scope, { device: false, current: active, ...config() });
      if (!active()) return;
      sent = true;
      await api.post('/api/v1/readings', payload, config());
      if (!active()) return;
      setSuccess(t('read.saved')); setShowForm(false); setForm(emptyForm());
      void load(filterType);
    } catch (failure) {
      if (!active()) return;
      clearDeniedAccess(failure);
      const fallback = sent ? 'Não foi possível confirmar o registo. Atualize o histórico antes de repetir; a medição pode já estar guardada.'
        : failure instanceof Error ? failure.message : t('read.err_save');
      setError(apiErrorMessage(failure, fallback));
    } finally { if (current()) { busy.current = false; setSaving(false); } }
  };

  const handleDelete = async (id: string) => {
    if (!current() || busy.current || denied.current || !confirm(t('read.confirm_delete'))) return;
    const epoch = authority.current;
    const active = () => current() && epoch === authority.current && !denied.current;
    busy.current = true; setDeletingId(id); setError(''); setSuccess('');
    try {
      await api.delete(`/api/v1/readings/${encodeURIComponent(id)}`, config());
      if (!active()) return;
      ++readSequence.current; setLoading(false);
      setReadings(previous => previous.filter(item => item.id !== id));
      setTotal(previous => Math.max(0, previous - 1)); setSuccess(t('read.deleted'));
    } catch (failure) {
      if (!active()) return;
      clearDeniedAccess(failure); setError(apiErrorMessage(failure, t('read.err_delete')));
    } finally { if (current()) { busy.current = false; setDeletingId(null); } }
  };
  const isBP = form.reading_type === 'blood_pressure';
  const operationBusy = saving || importing || deletingId !== null;
  const importRenphoCsv = async () => {
    if (!importFile || !current() || busy.current || denied.current) return;
    const epoch = authority.current;
    const active = () => current() && epoch === authority.current && !denied.current;
    busy.current = true; setError(''); setSuccess(''); setImporting(true);
    let sent = false;
    try {
      if (!importFile.name.toLowerCase().endsWith('.csv') || !importFile.size || importFile.size > 2 * 1024 * 1024) {
        throw new Error('Escolha um ficheiro CSV com conteúdo e até 2 MB.');
      }
      const scope = readingScope(country);
      await checkReadingConsent(scope, { device: true, current: active, ...config() });
      if (!active()) return;
      const body = new FormData(); body.append('file', importFile);
      body.append('country', scope.country); body.append('consent_language', scope.consent_language);
      sent = true;
      const response = await api.post('/api/v1/readings/import', body, { headers: { ...config().headers, 'Content-Type': 'multipart/form-data' } });
      if (!active()) return;
      const result = response.data as { imported?: unknown; skipped?: unknown; errors?: unknown };
      if (!Number.isSafeInteger(result.imported) || (result.imported as number) < 0 || !Number.isSafeInteger(result.skipped) || (result.skipped as number) < 0
        || !Array.isArray(result.errors) || result.errors.some(item => typeof item !== 'string')) throw new Error('Resposta de importação incompleta.');
      const summary = `${result.imported} medições importadas; ${result.skipped} linhas ignoradas.`;
      if (result.errors.length) {
        setError(`${summary} Existem linhas por corrigir. O ficheiro selecionado foi mantido. ${result.errors.join(' ')}`);
      } else { setSuccess(summary); setImportFile(null); }
      void load(filterType);
    } catch (failure) {
      if (!active()) return;
      clearDeniedAccess(failure);
      setError(apiErrorMessage(failure, sent ? 'Não foi possível confirmar a importação. O ficheiro foi mantido; atualize o histórico antes de repetir.'
        : failure instanceof Error ? failure.message : t('read.import_error')));
    } finally { if (current()) { busy.current = false; setImporting(false); } }
  };

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{t('read.title')}</h1>
          <p>{t('read.subtitle')}</p>
        </div>
        <button className="btn btn-primary" disabled={operationBusy || accessLost} onClick={() => { setShowForm(s => !s); setError(''); setSuccess(''); }}>
          {showForm ? <><X size={16} /> {t('common.cancel')}</> : <><Plus size={16} /> {t('read.new')}</>}
        </button>
      </div>

      {/* Alerts */}
      {error   && <div role="alert" className="alert alert-error"   style={{ marginBottom: '1rem' }}>{error}   <button onClick={() => setError('')}   style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button></div>}
      {accessLost && <p role="alert">O acesso precisa de nova confirmação. Atualize o histórico antes de continuar; os rascunhos foram mantidos.</p>}
      {success && <div role="status" className="alert alert-success" style={{ marginBottom: '1rem' }}>{success} <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button></div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <label htmlFor="readings-country">País das novas medições</label>{' '}
        <select id="readings-country" value={country} disabled={operationBusy} onChange={event => setCountry(event.target.value === 'PT' ? 'PT' : 'AO')}>
          <option value="AO">Angola</option><option value="PT">Portugal</option>
        </select>
        <p>As novas medições usam os consentimentos atuais deste país. A importação exige também a decisão separada para dispositivos. <Link to={`/consents?country=${country}`}>Rever consentimentos</Link>.</p>
        <p>O histórico e a eliminação das suas medições continuam disponíveis após retirar consentimentos.</p>
      </div>

      <div className="reading-import-card">
        <div className="reading-import-card__icon"><Scale size={22} /></div>
        <div className="reading-import-card__copy">
          <strong>{t('read.import_title')}</strong>
          <span>{t('read.import_desc')}</span>
        </div>
        <label className={`btn btn-outline reading-import-card__button${operationBusy ? ' disabled' : ''}`}>
          {importing ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
          {importing ? t('read.importing') : t('read.import_button')}
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Ficheiro CSV"
            disabled={operationBusy || accessLost}
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) { setImportFile(file); setError(''); setSuccess(''); }
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>

      {importFile && <div style={{ marginBottom: '1rem' }}>
        <p>Ficheiro selecionado: {importFile.name}</p>
        <button type="button" className="btn btn-primary" disabled={operationBusy || accessLost} onClick={() => void importRenphoCsv()}>{importing ? 'A importar…' : 'Importar ficheiro selecionado'}</button>
        <button type="button" className="btn btn-ghost" disabled={operationBusy} onClick={() => setImportFile(null)}>Remover seleção</button>
      </div>}

      {/* ── Add form ── */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: 600 }}>{t('read.new')}</h3>
          <form onSubmit={handleSubmit}>
            <fieldset disabled={operationBusy || accessLost} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>

              {/* Type */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="reading-type">Tipo de Medição *</label>
                <select id="reading-type"
                  className="form-input"
                  value={form.reading_type}
                  onChange={e => handleTypeChange(e.target.value as ReadingType)}
                  required
                >
                  {READING_TYPES.map(rt => (
                    <option key={rt.value} value={rt.value}>{t(rt.labelKey)}</option>
                  ))}
                </select>
              </div>

              {/* Blood pressure fields */}
              {isBP ? (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reading-systolic">Sistólica (mmHg) *</label>
                    <input id="reading-systolic" className="form-input" type="number" min={40} max={300} placeholder="120"
                      value={form.systolic} onChange={e => setForm(f => ({ ...f, systolic: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reading-diastolic">Diastólica (mmHg) *</label>
                    <input id="reading-diastolic" className="form-input" type="number" min={20} max={200} placeholder="80"
                      value={form.diastolic} onChange={e => setForm(f => ({ ...f, diastolic: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reading-pulse">Pulso (bpm)</label>
                    <input id="reading-pulse" className="form-input" type="number" min={20} max={300} placeholder="72"
                      value={form.pulse} onChange={e => setForm(f => ({ ...f, pulse: e.target.value }))} />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reading-value">Valor *</label>
                    <input id="reading-value" className="form-input" type="number" step="any" placeholder="0"
                      value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('read.unit')}</label>
                    <input className="form-input" type="text" maxLength={20}
                      value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
                  </div>
                </>
              )}

              {/* measured_at */}
              <div className="form-group">
                <label className="form-label">Data / Hora da Medição</label>
                <input className="form-input" type="datetime-local"
                  value={form.measured_at} onChange={e => setForm(f => ({ ...f, measured_at: e.target.value }))} />
              </div>

              {/* device_brand */}
              <div className="form-group">
                <label className="form-label">{t('read.device_brand')}</label>
                <input className="form-input" type="text" maxLength={100} placeholder="ex: Omron"
                  value={form.device_brand} onChange={e => setForm(f => ({ ...f, device_brand: e.target.value }))} />
              </div>

              {/* device_model */}
              <div className="form-group">
                <label className="form-label">{t('read.device_model')}</label>
                <input className="form-input" type="text" maxLength={100} placeholder="ex: M3"
                  value={form.device_model} onChange={e => setForm(f => ({ ...f, device_model: e.target.value }))} />
              </div>

              {/* notes */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">{t('read.notes')}</label>
                <textarea className="form-input" rows={2} maxLength={500} placeholder={t('read.notes_ph')}
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><Loader2 size={14} className="spin" /> A guardar…</> : 'Guardar Medição'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setForm(emptyForm()); }}>
                Cancelar
              </button>
            </div>
            </fieldset>
          </form>
        </div>
      )}

      {/* ── Filter ── */}
      <div className="tab-nav" style={{ marginBottom: '1.25rem' }}>
        <button className={filterType === '' ? 'active' : ''} onClick={() => handleFilterChange('')}>{t('read.all')}</button>
        {READING_TYPES.map(rt => (
          <button key={rt.value} className={filterType === rt.value ? 'active' : ''} onClick={() => handleFilterChange(rt.value)}>
            {t(rt.labelKey)}
          </button>
        ))}
      </div>

      <button className="btn btn-outline" disabled={operationBusy || loading} onClick={() => void load(filterType)}>Atualizar histórico</button>
      {readError && <p role="alert">{readError}</p>}
      {/* ── Readings list ── */}
      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : !loaded ? <p>O histórico ainda não foi carregado. Tente atualizar.</p> : readings.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '4rem 2rem' }}>
            <div className="empty-state-icon">
              <Activity size={32} style={{ color: 'var(--accent-teal)' }} />
            </div>
            <div className="empty-state-title">{t('read.empty')}</div>
            <div className="empty-state-desc">
              {t('read.empty_hint')}
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              A mostrar {readings.length} de {total} medições
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2, #f9fafb)' }}>
                  {['Tipo', 'Valor', 'Data / Hora', 'País', 'Dispositivo', 'Notas', ''].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {readings.map((r, i) => (
                  <tr key={r.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500 }}>
                        {typeIcon(r.reading_type)}
                        {TYPE_META[r.reading_type] ? t(TYPE_META[r.reading_type].labelKey) : r.reading_type}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {readingDisplay(r)}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(r.measured_at)}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>{r.country === 'AO' ? 'Angola' : r.country === 'PT' ? 'Portugal' : 'Não registado'}</td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)' }}>
                      {[r.device_brand, r.device_model].filter(Boolean).join(' ') || (r.source === 'manual' ? 'Manual' : r.source) || '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', maxWidth: '200px' }}>
                      <span title={r.notes ?? ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {r.notes || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '0.25rem 0.5rem', color: 'var(--danger, #ef4444)' }}
                        disabled={operationBusy}
                        onClick={() => handleDelete(r.id)}
                        title="Eliminar" aria-label="Eliminar medição"
                      >
                        {deletingId === r.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
