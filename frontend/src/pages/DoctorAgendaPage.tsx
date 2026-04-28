import { useState } from 'react';
import { Calendar, Clock, User, Video, MapPin, ChevronLeft, ChevronRight, Check, X, RefreshCw, Plus } from 'lucide-react';

interface Appointment {
  id: string;
  time: string;
  duration: number;
  patient: string;
  type: 'teleconsulta' | 'presencial';
  reason: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'done';
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const TODAY_APPOINTMENTS: Appointment[] = [
  { id: 'a1', time: '09:00', duration: 30, patient: 'Carlos Manuel Pinto',    type: 'teleconsulta', reason: 'Seguimento HTA',                  status: 'confirmed' },
  { id: 'a2', time: '09:30', duration: 20, patient: 'Sofia Beatriz Costa',    type: 'presencial',   reason: 'Resultado de exames',             status: 'confirmed' },
  { id: 'a3', time: '10:00', duration: 30, patient: 'António Nunes Ferreira', type: 'teleconsulta', reason: 'Consulta de rotina diabetes T2',  status: 'pending'   },
  { id: 'a4', time: '10:45', duration: 45, patient: 'Isabel Marques Lima',    type: 'presencial',   reason: 'Dor abdominal crónica',           status: 'confirmed' },
  { id: 'a5', time: '11:30', duration: 20, patient: 'Luís Eduardo Teixeira',  type: 'teleconsulta', reason: 'Renovação de prescrição',         status: 'done'      },
  { id: 'a6', time: '14:00', duration: 30, patient: 'Ana Luísa Rodrigues',    type: 'teleconsulta', reason: 'Primeira consulta — cefaleia',    status: 'pending'   },
  { id: 'a7', time: '14:30', duration: 30, patient: 'Manuel Francisco Sousa', type: 'presencial',   reason: 'Controlo pós-operatório',         status: 'confirmed' },
  { id: 'a8', time: '15:30', duration: 20, patient: 'Rita Carvalho Matos',    type: 'teleconsulta', reason: 'Follow-up depressão',             status: 'confirmed' },
];

const statusConfig = {
  confirmed: { label: 'Confirmada',  color: '#059669', bg: 'rgba(16,185,129,0.1)'  },
  pending:   { label: 'Pendente',    color: '#d97706', bg: 'rgba(234,179,8,0.12)'  },
  cancelled: { label: 'Cancelada',   color: '#dc2626', bg: 'rgba(239,68,68,0.1)'   },
  done:      { label: 'Concluída',   color: '#6366f1', bg: 'rgba(99,102,241,0.1)'  },
};

function buildWeek(anchor: Date): Date[] {
  const day = anchor.getDay();
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
}

export default function DoctorAgendaPage() {
  const today = new Date();
  const [anchor, setAnchor] = useState(new Date(today));
  const [selected, setSelected] = useState(new Date(today));
  const [appts, setAppts] = useState(TODAY_APPOINTMENTS);

  const week = buildWeek(anchor);

  const prevWeek = () => { const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d); };
  const nextWeek = () => { const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d); };
  const isToday = (d: Date) => d.toDateString() === today.toDateString();
  const isSelected = (d: Date) => d.toDateString() === selected.toDateString();

  const shownAppts = isToday(selected) ? appts : [];

  const updateStatus = (id: string, status: Appointment['status']) =>
    setAppts(prev => prev.map(a => a.id === id ? { ...a, status } : a));

  const confirmed = shownAppts.filter(a => a.status === 'confirmed').length;
  const pending   = shownAppts.filter(a => a.status === 'pending').length;
  const done      = shownAppts.filter(a => a.status === 'done').length;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} style={{ color: 'var(--brand-primary)' }} /> Agenda
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
            {MONTHS[selected.getMonth()]} {selected.getFullYear()}
          </p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '10px', background: 'var(--brand-primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer' }}>
          <Plus size={15} /> Nova consulta
        </button>
      </div>

      {/* Week selector */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
          <button onClick={prevWeek} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.35rem 0.6rem', cursor: 'pointer', color: 'var(--text-muted)' }}><ChevronLeft size={16} /></button>
          <div style={{ display: 'flex', gap: '0.4rem', flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            {week.map((d, i) => (
              <button key={i} onClick={() => setSelected(d)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.5rem 0.75rem',
                borderRadius: '10px', border: `1.5px solid ${isSelected(d) ? 'var(--brand-primary)' : 'var(--border)'}`,
                background: isToday(d) && isSelected(d) ? 'var(--brand-primary)' : isSelected(d) ? 'var(--brand-light)' : isToday(d) ? 'rgba(var(--brand-rgb,14,165,233),0.06)' : 'transparent',
                cursor: 'pointer', minWidth: 52,
              }}>
                <span style={{ fontSize: '0.7rem', color: isSelected(d) && isToday(d) ? '#fff' : 'var(--text-muted)', fontWeight: 600 }}>{DAYS[d.getDay()]}</span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: isSelected(d) && isToday(d) ? '#fff' : isSelected(d) ? 'var(--brand-primary)' : isToday(d) ? 'var(--brand-primary)' : 'var(--text-primary)', marginTop: '0.15rem' }}>{d.getDate()}</span>
                {isToday(d) && <span style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected(d) ? '#fff' : 'var(--brand-primary)', marginTop: '0.2rem' }} />}
              </button>
            ))}
          </div>
          <button onClick={nextWeek} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.35rem 0.6rem', cursor: 'pointer', color: 'var(--text-muted)' }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Stats row */}
      {isToday(selected) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
          {[
            { label: 'Confirmadas', val: confirmed, color: '#059669' },
            { label: 'Pendentes',   val: pending,   color: '#d97706' },
            { label: 'Concluídas',  val: done,       color: '#6366f1' },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center', padding: '0.85rem 0.5rem' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Appointment list */}
      {shownAppts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <Calendar size={36} style={{ display: 'block', margin: '0 auto 0.75rem', color: 'var(--text-muted)' }} />
          <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Sem consultas neste dia</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Seleccione outro dia ou crie uma nova consulta.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {shownAppts.map(a => {
            const s = statusConfig[a.status];
            return (
              <div key={a.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', opacity: a.status === 'cancelled' ? 0.5 : 1 }}>
                {/* Time */}
                <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 48 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{a.time}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{a.duration} min</div>
                </div>
                {/* Divider */}
                <div style={{ width: 3, height: 40, borderRadius: 99, background: a.type === 'teleconsulta' ? '#3b82f6' : '#10b981', flexShrink: 0 }} />
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{a.patient}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                    {a.type === 'teleconsulta' ? <Video size={12} style={{ color: '#3b82f6' }} /> : <MapPin size={12} style={{ color: '#10b981' }} />}
                    <span style={{ fontSize: '0.77rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{a.type}</span>
                    <span style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>· {a.reason}</span>
                  </div>
                </div>
                {/* Status */}
                <span style={{ padding: '0.25rem 0.65rem', borderRadius: 999, background: s.bg, color: s.color, fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{s.label}</span>
                {/* Actions */}
                {a.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button onClick={() => updateStatus(a.id, 'confirmed')} title="Confirmar" style={{ padding: '0.4rem', border: 'none', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', color: '#059669', cursor: 'pointer' }}><Check size={15} /></button>
                    <button onClick={() => updateStatus(a.id, 'cancelled')} title="Cancelar" style={{ padding: '0.4rem', border: 'none', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', color: '#dc2626', cursor: 'pointer' }}><X size={15} /></button>
                  </div>
                )}
                {a.status === 'confirmed' && a.type === 'teleconsulta' && (
                  <button style={{ padding: '0.45rem 0.9rem', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1.5px solid rgba(59,130,246,0.3)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Video size={13} /> Entrar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
