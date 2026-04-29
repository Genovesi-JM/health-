import { useEffect, useState } from 'react';
import api from '../api';
import {
  Activity, Heart, Droplets, ThermometerSun, Wind,
  Weight, HeartPulse, AlertTriangle, Loader2, RefreshCw,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ReadingType =
  | 'blood_pressure' | 'glucose' | 'temperature'
  | 'oxygen_saturation' | 'weight' | 'heart_rate';

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
}

interface ReadingListOut {
  total: number;
  readings: DeviceReading[];
}

// ── Range flags (visual only — NOT diagnosis) ─────────────────────────────────

interface RangeRule {
  label: string;
  check: (r: DeviceReading) => boolean;
}

const RANGE_RULES: Record<ReadingType, RangeRule[]> = {
  blood_pressure: [
    { label: 'Sistólica fora do intervalo típico — rever manualmente', check: r => r.systolic != null && (r.systolic < 90 || r.systolic > 140) },
    { label: 'Diastólica fora do intervalo típico — rever manualmente', check: r => r.diastolic != null && (r.diastolic < 60 || r.diastolic > 90) },
  ],
  glucose: [
    { label: 'Glicose fora do intervalo típico em jejum — rever manualmente', check: r => r.value != null && (r.value < 70 || r.value > 125) },
  ],
  temperature: [
    { label: 'Temperatura fora do intervalo típico — rever manualmente', check: r => r.value != null && (r.value < 36.0 || r.value > 37.5) },
  ],
  oxygen_saturation: [
    { label: 'Saturação abaixo do típico — rever manualmente', check: r => r.value != null && r.value < 95 },
  ],
  weight: [],
  heart_rate: [
    { label: 'Frequência cardíaca fora do intervalo típico — rever manualmente', check: r => r.value != null && (r.value < 50 || r.value > 100) },
  ],
};

function getFlags(r: DeviceReading): string[] {
  return (RANGE_RULES[r.reading_type] ?? [])
    .filter(rule => rule.check(r))
    .map(rule => rule.label);
}

// ── Metadata ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<ReadingType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  blood_pressure:    { label: 'Pressão Arterial',      icon: Heart,          color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
  glucose:           { label: 'Glicose',               icon: Droplets,       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  temperature:       { label: 'Temperatura',           icon: ThermometerSun, color: '#f97316', bg: 'rgba(249,115,22,0.1)'  },
  oxygen_saturation: { label: 'Saturação O₂',          icon: Wind,           color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
  weight:            { label: 'Peso',                  icon: Weight,         color: '#6366f1', bg: 'rgba(99,102,241,0.1)'  },
  heart_rate:        { label: 'Freq. Cardíaca',        icon: HeartPulse,     color: '#ec4899', bg: 'rgba(236,72,153,0.1)'  },
};

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtValue(r: DeviceReading): string {
  if (r.reading_type === 'blood_pressure') {
    if (r.systolic != null && r.diastolic != null) {
      return `${r.systolic}/${r.diastolic} mmHg${r.pulse ? ` · ${r.pulse} bpm` : ''}`;
    }
    return '—';
  }
  return r.value != null ? `${r.value} ${r.unit ?? ''}`.trim() : '—';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({ type, reading }: { type: ReadingType; reading: DeviceReading | undefined }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  const flags = reading ? getFlags(reading) : [];
  const hasFlag = flags.length > 0;

  return (
    <div style={{
      background: 'var(--surface, #fff)', border: `1px solid ${hasFlag ? '#fca5a5' : 'var(--border)'}`,
      borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem',
      boxShadow: hasFlag ? '0 0 0 2px rgba(239,68,68,0.12)' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.1rem' }}>
        <span style={{ width: 28, height: 28, borderRadius: '8px', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={14} style={{ color: meta.color }} />
        </span>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{meta.label}</span>
        {hasFlag && <span title={flags[0]} style={{ marginLeft: 'auto', lineHeight: 0 }}><AlertTriangle size={13} style={{ color: '#f97316' }} /></span>}
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: hasFlag ? '#dc2626' : 'var(--text-primary)', lineHeight: 1 }}>
        {reading ? fmtValue(reading) : <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>Sem dados</span>}
      </div>
      {reading && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{fmtDate(reading.measured_at)}</div>
      )}
      {hasFlag && (
        <div style={{ fontSize: '0.68rem', color: '#d97706', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 6, padding: '0.2rem 0.4rem', marginTop: '0.1rem', lineHeight: 1.4 }}>
          ⚠ {flags[0]}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  patientId: string;
  /** Optional patient name for the panel heading */
  patientName?: string;
}

const ALL_TYPES: ReadingType[] = [
  'blood_pressure', 'glucose', 'temperature', 'oxygen_saturation', 'weight', 'heart_rate',
];

export default function PatientReadingsPanel({ patientId, patientName }: Props) {
  const [readings, setReadings] = useState<DeviceReading[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api.get<ReadingListOut>(`/api/v1/readings/patient/${patientId}?limit=50`)
      .then(r => { setReadings(r.data.readings); setTotal(r.data.total); })
      .catch(() => setError('Não foi possível carregar as medições.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (patientId) load(); }, [patientId]);

  // Latest reading per type
  const latest = Object.fromEntries(
    ALL_TYPES.map(t => [t, readings.find(r => r.reading_type === t)])
  ) as Record<ReadingType, DeviceReading | undefined>;

  const allFlags = readings.flatMap(r => getFlags(r).map(f => ({ type: r.reading_type, flag: f, date: r.measured_at })));

  return (
    <div>
      {/* Panel header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={16} style={{ color: 'var(--brand-primary)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            Medições do Paciente{patientName ? ` — ${patientName}` : ''}
          </span>
          {total > 0 && (
            <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: 999, background: 'var(--brand-light)', color: 'var(--brand-primary)', fontWeight: 700 }}>
              {total} total
            </span>
          )}
        </div>
        <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.25rem' }}>
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>
          <Loader2 size={16} className="spin" /> A carregar medições…
        </div>
      ) : error ? (
        <div style={{ color: '#dc2626', fontSize: '0.85rem', padding: '0.75rem', background: 'rgba(239,68,68,0.06)', borderRadius: 8 }}>
          {error}
        </div>
      ) : readings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <Activity size={24} style={{ color: 'var(--border)', marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }} />
          Este paciente não tem medições registadas.
        </div>
      ) : (
        <>
          {/* Range flags summary */}
          {allFlags.length > 0 && (
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#d97706', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertTriangle size={13} /> {allFlags.length} valor{allFlags.length > 1 ? 'es' : ''} fora do intervalo típico — rever manualmente
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 1rem', fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                {allFlags.slice(0, 5).map((f, i) => (
                  <li key={i}>{TYPE_META[f.type].label}: {f.flag}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 6 latest summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.6rem', marginBottom: '1.25rem' }}>
            {ALL_TYPES.map(t => <SummaryCard key={t} type={t} reading={latest[t]} />)}
          </div>

          {/* History table */}
          <div style={{ borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '0.65rem 1rem', background: 'var(--surface-2, #f9fafb)', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Histórico de medições (últimas {readings.length})
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2, #f9fafb)' }}>
                    {['Tipo', 'Valor', 'Data', 'Dispositivo', 'Notas', ''].map(h => (
                      <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r, i) => {
                    const meta = TYPE_META[r.reading_type];
                    const flags = getFlags(r);
                    return (
                      <tr key={r.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none', background: flags.length > 0 ? 'rgba(251,191,36,0.04)' : undefined }}>
                        <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                            <meta.icon size={12} style={{ color: meta.color }} />
                            {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, whiteSpace: 'nowrap', color: flags.length > 0 ? '#dc2626' : 'var(--text-primary)' }}>
                          {fmtValue(r)}
                          {flags.length > 0 && <span title={flags[0]} style={{ lineHeight: 0 }}><AlertTriangle size={11} style={{ color: '#f97316', marginLeft: 4, verticalAlign: 'middle' }} /></span>}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDate(r.measured_at)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>
                          {[r.device_brand, r.device_model].filter(Boolean).join(' ') || r.source || '—'}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)', maxWidth: 180 }}>
                          <span title={r.notes ?? ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {r.notes || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem' }} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
