import { useState } from 'react';
import {
  FileText, AlertTriangle, CheckCircle2, X, ChevronDown, ChevronUp,
  User, Clock, Pill, Activity, Calendar, MessageSquare, Search,
  Filter, Stethoscope, AlertCircle, RefreshCw, ExternalLink,
} from 'lucide-react';

interface Medication { name: string; dose: string; frequency: string; since?: string }
interface Prescription {
  id: string;
  patient: string;
  age: number;
  gender: 'M' | 'F';
  province: string;
  avatar: string;
  photo?: string;
  condition: string;
  chronic: string[];
  allergies: string[];
  currentMeds: Medication[];
  requested: Medication;
  reason: string;
  lastConsult: string;
  lastDoctor: string;
  risk: 'low' | 'medium' | 'high';
  riskAlert?: string;
  requestedAt: string;
  vitals?: { bp?: string; weight?: string; glucose?: string; spo2?: string };
}

const MOCK_PRESCRIPTIONS: Prescription[] = [
  {
    id: 'rx1',
    patient: 'Maria Fernanda Santos',
    age: 52,
    gender: 'F',
    province: 'Luanda',
    avatar: 'MS',
    condition: 'HTA + Diabetes Tipo 2',
    chronic: ['Hipertensão arterial', 'Diabetes mellitus T2'],
    allergies: ['Penicilina', 'AAS'],
    currentMeds: [
      { name: 'Metformina 850mg', dose: '1 comprimido', frequency: '2×/dia' },
      { name: 'Amlodipina 5mg', dose: '1 comprimido', frequency: '1×/dia' },
      { name: 'Losartan 50mg', dose: '1 comprimido', frequency: '1×/dia' },
    ],
    requested: { name: 'Metformina 850mg', dose: '1 comprimido', frequency: '2×/dia' },
    reason: 'Renovação mensal habitual. Paciente crónica, bem controlada.',
    lastConsult: '12/03/2026',
    lastDoctor: 'Dr. Carlos Mendonça',
    risk: 'low',
    requestedAt: 'há 2 horas',
    vitals: { bp: '132/84 mmHg', weight: '68 kg', glucose: '112 mg/dL' },
  },
  {
    id: 'rx2',
    patient: 'José Eduardo Almeida',
    age: 67,
    gender: 'M',
    province: 'Benguela',
    avatar: 'JA',
    condition: 'Insuficiência cardíaca congestiva · FEVE 35%',
    chronic: ['ICC', 'FA permanente', 'DRC G3a'],
    allergies: ['Contraste iodado'],
    currentMeds: [
      { name: 'Furosemida 40mg', dose: '1 comprimido', frequency: '1×/dia' },
      { name: 'Espironolactona 25mg', dose: '1 comprimido', frequency: '1×/dia' },
      { name: 'Bisoprolol 5mg', dose: '1 comprimido', frequency: '1×/dia' },
      { name: 'Rivaroxabana 20mg', dose: '1 comprimido', frequency: '1×/dia (jantar)' },
    ],
    requested: { name: 'Furosemida 80mg', dose: '1 comprimido', frequency: '2×/dia' },
    reason: 'Edemas maleolares há 3 dias. Ganhou 2 kg em 1 semana.',
    lastConsult: '02/04/2026',
    lastDoctor: 'Dr. Rui Ferreira (Cardiologia)',
    risk: 'high',
    riskAlert: 'Aumento de dose em doente com DRC G3a — risco de hipocaliemia e deterioração renal. Verificar creatinina e K⁺ antes de aprovar.',
    requestedAt: 'há 5 horas',
    vitals: { bp: '155/92 mmHg', weight: '74 kg' },
  },
  {
    id: 'rx3',
    patient: 'Beatriz Maria Lima',
    age: 34,
    gender: 'F',
    province: 'Huambo',
    avatar: 'BL',
    condition: 'Asma brônquica moderada persistente',
    chronic: ['Asma brônquica', 'Rinite alérgica'],
    allergies: ['AINE', 'Paracetamol (leve)'],
    currentMeds: [
      { name: 'Budesonida/Formoterol 160/4.5 μg', dose: '2 inalações', frequency: '2×/dia' },
      { name: 'Salbutamol inalador', dose: '2 inalações', frequency: 'SOS' },
      { name: 'Cetirizina 10mg', dose: '1 comprimido', frequency: '1×/dia (noite)' },
    ],
    requested: { name: 'Salbutamol inalador', dose: '2 inalações', frequency: 'SOS' },
    reason: 'Acabou o inalador de resgate. Período polínico.',
    lastConsult: '18/02/2026',
    lastDoctor: 'Dra. Ana Ferreira',
    risk: 'medium',
    riskAlert: 'Paciente usou SOS >4×/semana no último mês — avaliar se controlo adequado.',
    requestedAt: 'há 1 dia',
    vitals: { spo2: '97%', weight: '58 kg' },
  },
];

const riskConfig = {
  low:    { label: 'Baixo risco',  color: '#059669', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
  medium: { label: 'Risco médio', color: '#d97706', bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.3)'   },
  high:   { label: 'Alto risco',  color: '#dc2626', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'   },
};

type Action = 'approve' | 'adjust' | 'consult' | 'exams' | 'reject' | null;

export default function DoctorPrescriptionsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [expanded, setExpanded] = useState<string | null>('rx2'); // open high risk by default
  const [actions, setActions] = useState<Record<string, { action: Action; note?: string; done?: boolean }>>({});
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const filtered = MOCK_PRESCRIPTIONS.filter(rx => {
    if (filter !== 'all' && rx.risk !== filter) return false;
    if (search && !rx.patient.toLowerCase().includes(search.toLowerCase()) && !rx.requested.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).filter(rx => !actions[rx.id]?.done);

  const done = MOCK_PRESCRIPTIONS.filter(rx => actions[rx.id]?.done);

  const handleAction = (id: string, action: Action) => {
    if (action === 'reject' || action === 'adjust') {
      setNoteFor(id);
      setNoteText('');
      return;
    }
    setActions(prev => ({ ...prev, [id]: { action, done: true } }));
  };

  const confirmWithNote = (id: string, action: Action) => {
    setActions(prev => ({ ...prev, [id]: { action, note: noteText, done: true } }));
    setNoteFor(null);
    setNoteText('');
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} style={{ color: '#ef4444' }} /> Prescrições Pendentes
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
            Avalie com segurança — todas as informações relevantes estão aqui
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '0.35rem 0.75rem', borderRadius: 999 }}>{filtered.length} pendentes</span>
          <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.4rem 0.75rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="form-input" placeholder="Pesquisar paciente ou medicamento…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.1rem' }} />
        </div>
        {(['all', 'high', 'medium', 'low'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '0.5rem 0.9rem', borderRadius: '8px', border: `1.5px solid ${filter === f ? 'var(--brand-primary)' : 'var(--border)'}`, background: filter === f ? 'var(--brand-light)' : 'var(--bg-card)', color: filter === f ? 'var(--brand-primary)' : 'var(--text-secondary)', fontWeight: filter === f ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer' }}>
            {f === 'all' ? 'Todos' : riskConfig[f].label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <CheckCircle2 size={40} style={{ color: '#10b981', margin: '0 auto 0.75rem', display: 'block' }} />
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#10b981' }}>Tudo em dia!</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Sem prescrições pendentes.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filtered.map(rx => {
          const risk = riskConfig[rx.risk];
          const isOpen = expanded === rx.id;
          return (
            <div key={rx.id} className="card" style={{ padding: 0, overflow: 'hidden', border: rx.risk === 'high' ? `2px solid ${risk.border}` : undefined }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.1rem 1.25rem', cursor: 'pointer', background: rx.risk === 'high' ? 'rgba(239,68,68,0.03)' : undefined }}
                onClick={() => setExpanded(isOpen ? null : rx.id)}>
                {/* Avatar */}
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: risk.bg, color: risk.color, fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `2px solid ${risk.border}` }}>
                  {rx.avatar}
                </div>
                {/* Patient info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{rx.patient}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rx.age} anos · {rx.gender === 'F' ? 'Feminino' : 'Masculino'} · {rx.province}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{rx.condition}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500, marginTop: '0.2rem' }}>💊 Pedido: <strong>{rx.requested.name}</strong> — {rx.requested.dose} {rx.requested.frequency}</div>
                </div>
                {/* Risk + time */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: 999, background: risk.bg, color: risk.color, border: `1px solid ${risk.border}` }}>
                    {rx.risk === 'high' ? <><AlertTriangle size={11} style={{ display: 'inline', marginRight: 3 }} /></> : null}
                    {risk.label}
                  </span>
                  <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{rx.requestedAt}</span>
                  {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                </div>
              </div>

              {/* RISK ALERT */}
              {rx.riskAlert && (
                <div style={{ display: 'flex', gap: '0.6rem', padding: '0.7rem 1.25rem', background: rx.risk === 'high' ? 'rgba(239,68,68,0.07)' : 'rgba(234,179,8,0.07)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                  <AlertCircle size={16} style={{ color: risk.color, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: '0.8rem', color: risk.color, fontWeight: 500 }}>{rx.riskAlert}</span>
                </div>
              )}

              {/* EXPANDED DETAIL */}
              {isOpen && (
                <div style={{ padding: '1.25rem', borderTop: rx.riskAlert ? undefined : '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>

                    {/* Condições + Alergias */}
                    <DetailBlock title="🩺 Condições crónicas">
                      {rx.chronic.map(c => <Tag key={c} label={c} color="rgba(59,130,246,0.1)" textColor="#3b82f6" />)}
                    </DetailBlock>
                    <DetailBlock title="⚠️ Alergias">
                      {rx.allergies.map(a => <Tag key={a} label={a} color="rgba(239,68,68,0.1)" textColor="#dc2626" />)}
                    </DetailBlock>
                    <DetailBlock title="📋 Última consulta">
                      <div style={{ fontSize: '0.82rem' }}><strong>{rx.lastConsult}</strong></div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{rx.lastDoctor}</div>
                    </DetailBlock>

                    {/* Medicação actual */}
                    <div style={{ gridColumn: '1 / 3' }}>
                      <DetailBlock title="💊 Medicação actual">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {rx.currentMeds.map((m, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.3rem 0.5rem', borderRadius: '6px', background: 'var(--bg-subtle, rgba(0,0,0,0.02))' }}>
                              <span style={{ fontWeight: 600 }}>{m.name}</span>
                              <span style={{ color: 'var(--text-muted)' }}>{m.dose} · {m.frequency}</span>
                            </div>
                          ))}
                        </div>
                      </DetailBlock>
                    </div>

                    {/* Sinais vitais */}
                    {rx.vitals && (
                      <DetailBlock title="📊 Sinais vitais recentes">
                        {rx.vitals.bp && <VitalLine label="PA" value={rx.vitals.bp} />}
                        {rx.vitals.glucose && <VitalLine label="Glicemia" value={rx.vitals.glucose} />}
                        {rx.vitals.weight && <VitalLine label="Peso" value={rx.vitals.weight} />}
                        {rx.vitals.spo2 && <VitalLine label="SpO₂" value={rx.vitals.spo2} />}
                      </DetailBlock>
                    )}
                  </div>

                  {/* Motivo */}
                  <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'var(--bg-subtle, rgba(0,0,0,0.025))', border: '1px solid var(--border)', marginBottom: '1.25rem', fontSize: '0.83rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Motivo do pedido: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{rx.reason}</span>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <ActionBtn onClick={() => handleAction(rx.id, 'approve')} color="#059669" bg="rgba(16,185,129,0.1)" border="rgba(16,185,129,0.3)" icon={<CheckCircle2 size={15} />} label="Aprovar" />
                    <ActionBtn onClick={() => handleAction(rx.id, 'adjust')} color="#d97706" bg="rgba(234,179,8,0.1)" border="rgba(234,179,8,0.3)" icon={<Stethoscope size={15} />} label="Ajustar dose" />
                    <ActionBtn onClick={() => handleAction(rx.id, 'consult')} color="#3b82f6" bg="rgba(59,130,246,0.1)" border="rgba(59,130,246,0.3)" icon={<Calendar size={15} />} label="Solicitar consulta" />
                    <ActionBtn onClick={() => handleAction(rx.id, 'exams')} color="#8b5cf6" bg="rgba(139,92,246,0.1)" border="rgba(139,92,246,0.3)" icon={<Activity size={15} />} label="Pedir exames" />
                    <ActionBtn onClick={() => handleAction(rx.id, 'reject')} color="#dc2626" bg="rgba(239,68,68,0.08)" border="rgba(239,68,68,0.25)" icon={<X size={15} />} label="Recusar" />
                  </div>

                  {/* Note modal inline */}
                  {noteFor === rx.id && (
                    <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '10px', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                        {actions[rx.id]?.action === 'reject' ? 'Motivo da recusa' : 'Ajuste pretendido'}
                      </label>
                      <textarea className="form-input" rows={2} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Escreva a justificação…" style={{ resize: 'vertical', marginBottom: '0.6rem' }} />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => confirmWithNote(rx.id, noteFor === rx.id ? 'reject' : 'adjust')} disabled={!noteText.trim()} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--brand-primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Confirmar</button>
                        <button onClick={() => setNoteFor(null)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: 'none', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Done */}
      {done.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Processadas nesta sessão ({done.length})</div>
          {done.map(rx => (
            <div key={rx.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: '0.5rem', opacity: 0.65 }}>
              <CheckCircle2 size={16} style={{ color: '#10b981' }} />
              <span style={{ flex: 1, fontSize: '0.83rem', fontWeight: 500 }}>{rx.patient} — {rx.requested.name}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {actions[rx.id]?.action === 'approve' ? '✓ Aprovada' : actions[rx.id]?.action === 'reject' ? '✗ Recusada' : actions[rx.id]?.action === 'adjust' ? '~ Ajustada' : actions[rx.id]?.action === 'consult' ? '📅 Consulta solicitada' : '🔬 Exames pedidos'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>{children}</div>
    </div>
  );
}

function Tag({ label, color, textColor }: { label: string; color: string; textColor: string }) {
  return <span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 999, background: color, color: textColor, fontSize: '0.77rem', fontWeight: 600, width: 'fit-content' }}>{label}</span>;
}

function VitalLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.2rem 0' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ActionBtn({ onClick, color, bg, border, icon, label }: { onClick: () => void; color: string; bg: string; border: string; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.95rem', borderRadius: '10px', background: bg, color, border: `1.5px solid ${border}`, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
      {icon} {label}
    </button>
  );
}
