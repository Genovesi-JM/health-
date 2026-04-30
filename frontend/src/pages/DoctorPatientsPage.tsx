import { useState, useEffect } from 'react';
import { Users, Search, X, User, RefreshCw } from 'lucide-react';
import PatientReadingsPanel from '../components/PatientReadingsPanel';
import api from '../api';

interface Patient {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  blood_type: string | null;
  chronic_conditions: string[];
  allergies: string[];
  last_consultation_at: string | null;
  consultation_count: number;
  status: 'urgent' | 'chronic' | 'stable' | string;
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  urgent:  { label: 'Urgente', color: '#dc2626', bg: 'rgba(239,68,68,0.1)'  },
  chronic: { label: 'Crónico', color: '#d97706', bg: 'rgba(234,179,8,0.1)'  },
  stable:  { label: 'Estável', color: '#059669', bg: 'rgba(16,185,129,0.1)' },
};

export default function DoctorPatientsPage() {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Patient | null>(null);

  const fetchPatients = () => {
    setLoading(true);
    api.get('/api/v1/doctor/patients', { params: { search: search || undefined, limit: 100 } })
      .then(r => {
        setPatients(r.data.patients ?? []);
        setTotal(r.data.total ?? 0);
      })
      .catch(() => { setPatients([]); setTotal(0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPatients(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = patients.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} style={{ color: 'var(--brand-primary)' }} /> Os Meus Pacientes
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>{total} paciente{total !== 1 ? 's' : ''} registado{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={fetchPatients} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'A carregar…' : 'Actualizar'}
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '1.25rem', display: 'flex', gap: '0.5rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" placeholder="Pesquisar por nome…" value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchPatients()}
            style={{ paddingLeft: '2.1rem' }} />
        </div>
        <button onClick={fetchPatients} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0 1rem', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          Pesquisar
        </button>
      </div>

      {loading && patients.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>A carregar pacientes…</div>
      )}

      {!loading && patients.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          <Users size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.3 }} />
          Nenhum paciente encontrado. As consultas realizadas aparecerão aqui.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 480px' : '1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* ── Patient list ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {shown.map(p => {
            const s = STATUS_STYLE[p.status] ?? { label: p.status, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' };
            const isActive = selected?.id === p.id;
            const lastVisit = p.last_consultation_at
              ? new Date(p.last_consultation_at).toLocaleDateString('pt-PT')
              : '—';
            const conditions = (p.chronic_conditions ?? []).slice(0, 2).join(' · ') || 'Sem condições crónicas';
            return (
              <div key={p.id} className="card"
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', cursor: 'pointer', border: isActive ? '1.5px solid var(--brand-primary)' : undefined, background: isActive ? 'var(--brand-light, rgba(15,118,110,0.04))' : undefined }}
                onClick={() => setSelected(prev => prev?.id === p.id ? null : p)}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: isActive ? 'var(--brand-primary)' : 'var(--brand-light)', color: isActive ? '#fff' : 'var(--brand-primary)', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {p.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    {p.age != null ? `${p.age} anos` : 'Idade desconhecida'} · {conditions}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ padding: '0.2rem 0.65rem', borderRadius: 999, background: s.bg, color: s.color, fontSize: '0.73rem', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>{s.label}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Últ. {lastVisit}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Patient detail panel ── */}
        {selected && (
          <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: '1.25rem' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2, #f9fafb)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <User size={16} style={{ color: 'var(--brand-primary)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{selected.name}</span>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '80vh', overflowY: 'auto' }}>

              {/* Basic info */}
              <div>
                <SecLabel>Informação Clínica</SecLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.83rem' }}>
                  <InfoRow label="Idade" value={selected.age != null ? `${selected.age} anos` : '—'} />
                  <InfoRow label="Género" value={selected.gender ?? '—'} />
                  <InfoRow label="Grupo Sanguíneo" value={selected.blood_type ?? '—'} />
                  <InfoRow label="Estado" value={<span style={{ fontWeight: 700, color: STATUS_STYLE[selected.status]?.color }}>{STATUS_STYLE[selected.status]?.label ?? selected.status}</span>} />
                  <InfoRow label="Consultas" value={`${selected.consultation_count} consulta${selected.consultation_count !== 1 ? 's' : ''}`} />
                  <InfoRow label="Última visita" value={selected.last_consultation_at ? new Date(selected.last_consultation_at).toLocaleDateString('pt-PT') : '—'} />
                </div>
              </div>

              {(selected.chronic_conditions ?? []).length > 0 && (
                <div>
                  <SecLabel>Condições Crónicas</SecLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {selected.chronic_conditions.map(c => (
                      <span key={c} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: 999, background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 600 }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {(selected.allergies ?? []).length > 0 && (
                <div>
                  <SecLabel>Alergias</SecLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {selected.allergies.map(a => (
                      <span key={a} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: 999, background: 'rgba(234,179,8,0.08)', color: '#d97706', border: '1px solid rgba(234,179,8,0.2)', fontWeight: 600 }}>{a}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                <PatientReadingsPanel patientId={selected.id} patientName={selected.name} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SecLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>{children}</div>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 110, flexShrink: 0 }}>{label}:</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
