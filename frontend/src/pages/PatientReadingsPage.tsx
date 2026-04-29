import { useEffect, useState } from 'react';
import api from '../api';
import {
  Activity, Plus, Trash2, X, Loader2, ThermometerSun,
  Droplets, Wind, Weight, Heart, HeartPulse,
} from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

// ── Types ────────────────────────────────────────────────────────────────────

type ReadingType =
  | 'blood_pressure'
  | 'glucose'
  | 'temperature'
  | 'oxygen_saturation'
  | 'weight'
  | 'heart_rate';

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
}

interface ReadingListOut {
  total: number;
  readings: DeviceReading[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const READING_TYPES: { value: ReadingType; label: string; icon: React.ElementType; defaultUnit: string }[] = [
  { value: 'blood_pressure',    label: 'Pressão Arterial',      icon: Heart,         defaultUnit: 'mmHg' },
  { value: 'glucose',           label: 'Glicose',               icon: Droplets,      defaultUnit: 'mg/dL' },
  { value: 'temperature',       label: 'Temperatura',           icon: ThermometerSun,defaultUnit: '°C' },
  { value: 'oxygen_saturation', label: 'Saturação de Oxigênio', icon: Wind,          defaultUnit: '%' },
  { value: 'weight',            label: 'Peso',                  icon: Weight,        defaultUnit: 'kg' },
  { value: 'heart_rate',        label: 'Frequência Cardíaca',   icon: HeartPulse,    defaultUnit: 'bpm' },
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

const emptyForm = {
  reading_type: 'blood_pressure' as ReadingType,
  value: '',
  unit: 'mmHg',
  systolic: '',
  diastolic: '',
  pulse: '',
  measured_at: new Date().toISOString().slice(0, 16), // datetime-local format
  source: 'manual',
  device_brand: '',
  device_model: '',
  notes: '',
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function PatientReadingsPage() {
  const { t } = useT();

  const [readings, setReadings]     = useState<DeviceReading[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [filterType, setFilterType] = useState<ReadingType | ''>('');

  // Load readings
  const load = (type?: ReadingType | '') => {
    setLoading(true);
    const params = type ? `?reading_type=${type}` : '';
    api.get<ReadingListOut>(`/api/v1/readings/me${params}`)
      .then(r => { setReadings(r.data.readings); setTotal(r.data.total); })
      .catch(() => setError('Erro ao carregar medições.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Sync unit default when reading_type changes
  const handleTypeChange = (type: ReadingType) => {
    setForm(f => ({ ...f, reading_type: type, unit: TYPE_META[type].defaultUnit }));
  };

  const handleFilterChange = (type: ReadingType | '') => {
    setFilterType(type);
    load(type);
  };

  // Submit new reading
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        reading_type: form.reading_type,
        source: form.source || 'manual',
        measured_at: form.measured_at ? new Date(form.measured_at).toISOString() : undefined,
        device_brand: form.device_brand || undefined,
        device_model: form.device_model || undefined,
        notes: form.notes || undefined,
      };

      if (form.reading_type === 'blood_pressure') {
        if (!form.systolic || !form.diastolic) {
          setError('Sistólica e diastólica são obrigatórias para pressão arterial.');
          setSaving(false);
          return;
        }
        payload.systolic  = Number(form.systolic);
        payload.diastolic = Number(form.diastolic);
        if (form.pulse)  payload.pulse = Number(form.pulse);
      } else {
        if (!form.value) {
          setError('Valor é obrigatório.');
          setSaving(false);
          return;
        }
        payload.value = Number(form.value);
        payload.unit  = form.unit || TYPE_META[form.reading_type].defaultUnit;
      }

      await api.post('/api/v1/readings', payload);
      setSuccess('Medição registada com sucesso!');
      setShowForm(false);
      setForm(emptyForm);
      load(filterType);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro ao guardar medição.');
    } finally {
      setSaving(false);
    }
  };

  // Delete a reading
  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta medição?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/v1/readings/${id}`);
      setReadings(prev => prev.filter(r => r.id !== id));
      setTotal(t => t - 1);
      setSuccess('Medição eliminada.');
    } catch {
      setError('Erro ao eliminar medição.');
    } finally {
      setDeletingId(null);
    }
  };

  const isBP = form.reading_type === 'blood_pressure';

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Minhas Medições</h1>
          <p>Registe as leituras dos seus dispositivos de saúde em casa.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(s => !s); setError(''); setSuccess(''); }}>
          {showForm ? <><X size={16} /> Cancelar</> : <><Plus size={16} /> Nova Medição</>}
        </button>
      </div>

      {/* Alerts */}
      {error   && <div className="alert alert-error"   style={{ marginBottom: '1rem' }}>{error}   <button onClick={() => setError('')}   style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success} <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button></div>}

      {/* ── Add form ── */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: 600 }}>Nova Medição</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>

              {/* Type */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Tipo de Medição *</label>
                <select
                  className="form-input"
                  value={form.reading_type}
                  onChange={e => handleTypeChange(e.target.value as ReadingType)}
                  required
                >
                  {READING_TYPES.map(rt => (
                    <option key={rt.value} value={rt.value}>{rt.label}</option>
                  ))}
                </select>
              </div>

              {/* Blood pressure fields */}
              {isBP ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Sistólica (mmHg) *</label>
                    <input className="form-input" type="number" min={40} max={300} placeholder="120"
                      value={form.systolic} onChange={e => setForm(f => ({ ...f, systolic: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Diastólica (mmHg) *</label>
                    <input className="form-input" type="number" min={20} max={200} placeholder="80"
                      value={form.diastolic} onChange={e => setForm(f => ({ ...f, diastolic: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pulso (bpm)</label>
                    <input className="form-input" type="number" min={20} max={300} placeholder="72"
                      value={form.pulse} onChange={e => setForm(f => ({ ...f, pulse: e.target.value }))} />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Valor *</label>
                    <input className="form-input" type="number" step="any" placeholder="0"
                      value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unidade</label>
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
                <label className="form-label">Marca do Dispositivo</label>
                <input className="form-input" type="text" maxLength={100} placeholder="ex: Omron"
                  value={form.device_brand} onChange={e => setForm(f => ({ ...f, device_brand: e.target.value }))} />
              </div>

              {/* device_model */}
              <div className="form-group">
                <label className="form-label">Modelo do Dispositivo</label>
                <input className="form-input" type="text" maxLength={100} placeholder="ex: M3"
                  value={form.device_model} onChange={e => setForm(f => ({ ...f, device_model: e.target.value }))} />
              </div>

              {/* notes */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notas</label>
                <textarea className="form-input" rows={2} maxLength={500} placeholder="Observações opcionais…"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><Loader2 size={14} className="spin" /> A guardar…</> : 'Guardar Medição'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setForm(emptyForm); }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter ── */}
      <div className="tab-nav" style={{ marginBottom: '1.25rem' }}>
        <button className={filterType === '' ? 'active' : ''} onClick={() => handleFilterChange('')}>Todos</button>
        {READING_TYPES.map(rt => (
          <button key={rt.value} className={filterType === rt.value ? 'active' : ''} onClick={() => handleFilterChange(rt.value)}>
            {rt.label}
          </button>
        ))}
      </div>

      {/* ── Readings list ── */}
      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : readings.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '4rem 2rem' }}>
            <div className="empty-state-icon">
              <Activity size={32} style={{ color: 'var(--accent-teal)' }} />
            </div>
            <div className="empty-state-title">Sem medições registadas</div>
            <div className="empty-state-desc">
              Clique em <strong>Nova Medição</strong> para registar a sua primeira leitura.
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {total} medição{total !== 1 ? 'ões' : ''} encontrada{total !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2, #f9fafb)' }}>
                  {['Tipo', 'Valor', 'Data / Hora', 'Dispositivo', 'Notas', ''].map(h => (
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
                        {TYPE_META[r.reading_type]?.label ?? r.reading_type}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {readingDisplay(r)}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(r.measured_at)}
                    </td>
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
                        disabled={deletingId === r.id}
                        onClick={() => handleDelete(r.id)}
                        title="Eliminar"
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
