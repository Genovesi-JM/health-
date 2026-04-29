import { useState } from 'react';
import { Users, Search, X, User } from 'lucide-react';
import PatientReadingsPanel from '../components/PatientReadingsPanel';

// ── Mock patient list (replace with real API when patient search is available) ──

interface MockPatient {
  id: string;
  name: string;
  age: number;
  condition: string;
  lastVisit: string;
  status: 'Urgente' | 'Crónico' | 'Estável';
  chronic_conditions: string[];
}

const MOCK: MockPatient[] = [
  { id: 'mock-p1', name: 'Maria Fernanda Santos',  age: 52, condition: 'HTA + Diabetes T2',      lastVisit: '12/03/2026', status: 'Crónico', chronic_conditions: ['Hipertensão', 'Diabetes Tipo 2'] },
  { id: 'mock-p2', name: 'José Eduardo Almeida',   age: 67, condition: 'ICC · FA · DRC',          lastVisit: '02/04/2026', status: 'Urgente', chronic_conditions: ['Insuficiência Cardíaca', 'Fibrilhação Auricular', 'DRC'] },
  { id: 'mock-p3', name: 'Beatriz Maria Lima',     age: 34, condition: 'Asma brônquica',          lastVisit: '18/02/2026', status: 'Estável', chronic_conditions: ['Asma'] },
  { id: 'mock-p4', name: 'Carlos Manuel Pinto',    age: 45, condition: 'HTA controlada',          lastVisit: '01/04/2026', status: 'Estável', chronic_conditions: ['Hipertensão'] },
  { id: 'mock-p5', name: 'Sofia Beatriz Costa',    age: 29, condition: 'Rinite alérgica',         lastVisit: '22/03/2026', status: 'Estável', chronic_conditions: [] },
  { id: 'mock-p6', name: 'António Nunes Ferreira', age: 58, condition: 'DM2 + Dislipidemia',      lastVisit: '10/04/2026', status: 'Crónico', chronic_conditions: ['Diabetes Tipo 2', 'Dislipidemia'] },
];

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  Urgente: { color: '#dc2626', bg: 'rgba(239,68,68,0.1)'  },
  Crónico: { color: '#d97706', bg: 'rgba(234,179,8,0.1)'  },
  Estável: { color: '#059669', bg: 'rgba(16,185,129,0.1)' },
};

function isRealId(id: string) { return !id.startsWith('mock-'); }

export default function DoctorPatientsPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MockPatient | null>(null);

  const shown = MOCK.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} style={{ color: 'var(--brand-primary)' }} /> Os Meus Pacientes
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>{MOCK.length} pacientes registados</p>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="form-input" placeholder="Pesquisar por nome…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.1rem' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 480px' : '1fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* ── Patient list ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {shown.map(p => {
            const s = STATUS_STYLE[p.status] ?? { color: '#6366f1', bg: 'rgba(99,102,241,0.1)' };
            const isActive = selected?.id === p.id;
            return (
              <div key={p.id} className="card"
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', cursor: 'pointer', border: isActive ? '1.5px solid var(--brand-primary)' : undefined, background: isActive ? 'var(--brand-light, rgba(15,118,110,0.04))' : undefined }}
                onClick={() => setSelected(prev => prev?.id === p.id ? null : p)}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: isActive ? 'var(--brand-primary)' : 'var(--brand-light)', color: isActive ? '#fff' : 'var(--brand-primary)', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {p.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{p.age} anos · {p.condition}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ padding: '0.2rem 0.65rem', borderRadius: 999, background: s.bg, color: s.color, fontSize: '0.73rem', fontWeight: 700, display: 'block', marginBottom: '0.2rem' }}>{p.status}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Últ. {p.lastVisit}</span>
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
                  <InfoRow label="Idade" value={`${selected.age} anos`} />
                  <InfoRow label="Estado" value={<span style={{ fontWeight: 700, color: STATUS_STYLE[selected.status]?.color }}>{selected.status}</span>} />
                  <InfoRow label="Condição" value={selected.condition} />
                  <InfoRow label="Última visita" value={selected.lastVisit} />
                </div>
              </div>

              {selected.chronic_conditions.length > 0 && (
                <div>
                  <SecLabel>Condições Crónicas</SecLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {selected.chronic_conditions.map(c => (
                      <span key={c} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: 999, background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 600 }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                {isRealId(selected.id) ? (
                  <PatientReadingsPanel patientId={selected.id} patientName={selected.name} />
                ) : (
                  <>
                    <SecLabel>Medições do Paciente</SecLabel>
                    <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      ℹ️ Esta lista utiliza dados demonstrativos. As medições reais são carregadas automaticamente quando os pacientes estiverem ligados ao backend.
                    </div>
                  </>
                )}
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
