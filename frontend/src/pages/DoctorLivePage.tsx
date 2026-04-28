import { Video, Mic, MicOff, VideoOff, PhoneOff, MessageSquare, Users, Share2 } from 'lucide-react';
import { useState } from 'react';

export default function DoctorLivePage() {
  const [inCall, setInCall] = useState(false);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);

  if (!inCall) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Video size={20} style={{ color: '#3b82f6' }} /> Consultas Ao Vivo
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem', fontSize: '0.85rem' }}>Sala de teleconsulta segura e encriptada</p>

        <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '2rem' }}>
            <Video size={36} />
          </div>
          <h2 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Consulta Agendada</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Próxima consulta: <strong>Carlos Manuel Pinto</strong> às <strong>14:00</strong> — Seguimento HTA
          </p>
          <button onClick={() => setInCall(true)} style={{ padding: '0.8rem 2rem', borderRadius: '12px', background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Video size={18} /> Iniciar Consulta
          </button>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>CONSULTAS DE HOJE</div>
          {[
            { time: '09:00', patient: 'Carlos Manuel Pinto',   status: 'done',    label: 'Concluída' },
            { time: '10:00', patient: 'Ana Luísa Rodrigues',   status: 'pending', label: 'A aguardar' },
            { time: '14:00', patient: 'Rita Carvalho Matos',   status: 'next',    label: 'A seguir' },
          ].map(c => (
            <div key={c.patient} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.patient}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}> · {c.time}</span>
              </div>
              <span style={{ fontSize: '0.73rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 999,
                background: c.status === 'done' ? 'rgba(99,102,241,0.1)' : c.status === 'next' ? 'rgba(59,130,246,0.1)' : 'rgba(234,179,8,0.1)',
                color: c.status === 'done' ? '#6366f1' : c.status === 'next' ? '#3b82f6' : '#d97706' }}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <div style={{ background: '#1e1e2e', borderRadius: '16px', aspectRatio: '16/9', position: 'relative', overflow: 'hidden', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#6b7280', textAlign: 'center' }}>
          <Users size={48} style={{ display: 'block', margin: '0 auto 0.5rem' }} />
          <div style={{ fontSize: '0.9rem' }}>Câmara do paciente — a aguardar conexão</div>
        </div>
        <div style={{ position: 'absolute', bottom: 12, right: 12, width: 120, height: 80, background: '#374151', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>A sua câmara</span>
        </div>
        <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.5)', borderRadius: '8px', padding: '0.4rem 0.8rem', color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>
          🔴 Carlos Manuel Pinto · 00:00
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <CtrlBtn onClick={() => setMic(m => !m)} active={mic} color="#3b82f6" label={mic ? 'Mudo' : 'Microfone'} icon={mic ? <Mic size={18} /> : <MicOff size={18} />} />
        <CtrlBtn onClick={() => setCam(c => !c)} active={cam} color="#8b5cf6" label={cam ? 'Desligar câmara' : 'Ligar câmara'} icon={cam ? <Video size={18} /> : <VideoOff size={18} />} />
        <CtrlBtn onClick={() => {}} active={true} color="#059669" label="Chat" icon={<MessageSquare size={18} />} />
        <CtrlBtn onClick={() => {}} active={true} color="#d97706" label="Partilhar ecrã" icon={<Share2 size={18} />} />
        <button onClick={() => setInCall(false)} style={{ padding: '0.7rem 1.5rem', borderRadius: '12px', background: '#dc2626', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <PhoneOff size={18} /> Terminar
        </button>
      </div>
    </div>
  );
}

function CtrlBtn({ onClick, active, color, label, icon }: { onClick: () => void; active: boolean; color: string; label: string; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '0.65rem 1.1rem', borderRadius: '12px', background: active ? `${color}22` : 'rgba(107,114,128,0.15)', color: active ? color : '#6b7280', border: `1.5px solid ${active ? color + '44' : 'transparent'}`, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      {icon} {label}
    </button>
  );
}
