import { useState } from 'react';
import { Users, Search, Filter, ChevronRight, Activity } from 'lucide-react';

const MOCK = [
  { id: 'p1', name: 'Maria Fernanda Santos',   age: 52, condition: 'HTA + Diabetes T2', lastVisit: '12/03/2026', status: 'Crónico' },
  { id: 'p2', name: 'José Eduardo Almeida',    age: 67, condition: 'ICC · FA · DRC',    lastVisit: '02/04/2026', status: 'Urgente' },
  { id: 'p3', name: 'Beatriz Maria Lima',      age: 34, condition: 'Asma brônquica',    lastVisit: '18/02/2026', status: 'Estável' },
  { id: 'p4', name: 'Carlos Manuel Pinto',     age: 45, condition: 'HTA controlada',    lastVisit: '01/04/2026', status: 'Estável' },
  { id: 'p5', name: 'Sofia Beatriz Costa',     age: 29, condition: 'Rinite alérgica',   lastVisit: '22/03/2026', status: 'Estável' },
  { id: 'p6', name: 'António Nunes Ferreira',  age: 58, condition: 'DM2 + Dislipidemia',lastVisit: '10/04/2026', status: 'Crónico' },
];

const statusColor: Record<string, { color: string; bg: string }> = {
  Urgente: { color: '#dc2626', bg: 'rgba(239,68,68,0.1)' },
  Crónico: { color: '#d97706', bg: 'rgba(234,179,8,0.1)' },
  Estável: { color: '#059669', bg: 'rgba(16,185,129,0.1)' },
};

export default function DoctorPatientsPage() {
  const [search, setSearch] = useState('');
  const shown = MOCK.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {shown.map(p => {
          const s = statusColor[p.status] ?? { color: '#6366f1', bg: 'rgba(99,102,241,0.1)' };
          return (
            <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', cursor: 'pointer' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--brand-light)', color: 'var(--brand-primary)', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
              <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
