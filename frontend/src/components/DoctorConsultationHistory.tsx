import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Consultation } from '../types';
import { useConsultationPages } from '../utils/useConsultationPages';
import { formatAppointmentTime } from '../utils/appointments';
import ConsultationCloseout from './ConsultationCloseout';

export default function DoctorConsultationHistory({ onAccessLost }: { onAccessLost?: () => void }) {
  const [view, setView] = useState('all');
  const history = useConsultationPages<Consultation & { patient_name?: string | null }>('/api/v1/doctor/consultations/page', view, onAccessLost);
  const [selected, setSelected] = useState<{ id: string; accessEpoch: number } | null>(null);
  const statuses: Record<string, string> = { requested: 'Pedido', scheduled: 'Agendada', in_progress: 'Em curso', completed: 'Concluída', cancelled: 'Cancelada', no_show: 'Não compareceu', expired: 'Prazo terminado' };
  return <section className="card" aria-label="Histórico das minhas consultas" style={{ padding: '1rem', marginBlock: '1rem' }}>
    <h2>Histórico das minhas consultas</h2>
    <label>Mostrar consultas <select className="form-input" value={view} onChange={event => { setSelected(null); setView(event.target.value); }}>
      <option value="all">Todas</option><option value="upcoming">Pendentes e em curso</option><option value="past">Anteriores</option>
    </select></label>
    <button className="btn btn-secondary" disabled={history.loading} onClick={() => void history.refresh()}>Atualizar histórico</button>
    {history.error && <p role="alert">{history.error}</p>}
    {history.loading ? <p role="status">A carregar consultas…</p> : !history.accessLost && <>
      {!history.error && history.items.length === 0 && <p>Sem consultas nesta vista.</p>}
      <p>{history.items.length} consultas carregadas{history.nextCursor ? '; existem mais registos.' : '.'}</p>
      {history.items.map(item => <article key={item.id} style={{ paddingBlock: '0.75rem', borderBottom: '1px solid var(--border)' }}>
        <strong>{item.patient_name || 'Paciente'}</strong> · {statuses[item.status] || item.status}
        <p>{item.scheduled_at ? formatAppointmentTime(item.scheduled_at, item.timezone) : 'Pedido sem horário definido'}</p>
        {item.status === 'completed' && <button className="btn btn-secondary" onClick={() => setSelected({ id: item.id, accessEpoch: history.accessEpoch })}>Ler registo concluído</button>}
        {item.patient_id && ['scheduled', 'in_progress', 'completed'].includes(item.status) && <Link className="btn btn-secondary" to={`/clinician/patients/${encodeURIComponent(item.patient_id)}`}>Abrir visão clínica</Link>}
      </article>)}
      {history.moreError && <p role="alert">{history.moreError}</p>}
      {history.nextCursor && <button className="btn btn-secondary" disabled={history.loadingMore} onClick={() => void history.loadMore()}>{history.loadingMore ? 'A carregar…' : 'Carregar mais registos'}</button>}
    </>}
    {selected && !history.accessLost && selected.accessEpoch === history.accessEpoch && <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Registo clínico concluído">
      <section className="modal" style={{ padding: '1rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <button className="btn btn-secondary" onClick={() => setSelected(null)}>Fechar registo</button>
        <ConsultationCloseout consultationId={selected.id} role="doctor" allowAmendment={false} onAccessLost={onAccessLost} />
      </section>
    </div>}
  </section>;
}
