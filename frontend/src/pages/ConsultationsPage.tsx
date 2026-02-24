import { useEffect, useState } from 'react';
import api from '../api';
import type { Consultation } from '../types';
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function ConsultationsPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'upcoming' | 'past'>('all');

  useEffect(() => {
    api.get('/api/v1/consultations/')
      .then(r => setConsultations(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = consultations.filter(c => {
    if (tab === 'upcoming') return ['requested','scheduled','in_progress'].includes(c.status);
    if (tab === 'past') return ['completed','cancelled','no_show'].includes(c.status);
    return true;
  });

  const statusIcon = (s: string) => {
    switch (s) {
      case 'completed': return <CheckCircle2 size={14} style={{ color: '#22c55e' }} />;
      case 'cancelled': case 'no_show': return <XCircle size={14} style={{ color: '#ef4444' }} />;
      case 'in_progress': return <Clock size={14} style={{ color: '#06b6d4' }} />;
      default: return <AlertCircle size={14} style={{ color: '#eab308' }} />;
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'completed': return 'badge-success';
      case 'cancelled': case 'no_show': return 'badge-danger';
      case 'in_progress': return 'badge-info';
      case 'scheduled': return 'badge-warning';
      default: return 'badge-neutral';
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      requested: 'Pedido', scheduled: 'Agendada', in_progress: 'Em Curso',
      completed: 'Concluída', cancelled: 'Cancelada', no_show: 'Falta',
    };
    return map[s] || s;
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h1>Consultas</h1>
        <p>Gerir e acompanhar as suas consultas médicas</p>
      </div>

      <div className="tab-nav">
        <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Todas</button>
        <button className={tab === 'upcoming' ? 'active' : ''} onClick={() => setTab('upcoming')}>Próximas</button>
        <button className={tab === 'past' ? 'active' : ''} onClick={() => setTab('past')}>Passadas</button>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <div className="empty-state-icon"><Calendar size={24} style={{ color: 'var(--accent-teal)' }} /></div>
            <div className="empty-state-title">Sem consultas</div>
            <div className="empty-state-desc">Não existem consultas {tab === 'upcoming' ? 'agendadas' : tab === 'past' ? 'passadas' : 'registadas'}.</div>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Especialidade</th>
                  <th>Estado</th>
                  <th>Agendada</th>
                  <th>Pagamento</th>
                  <th>Criada</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.specialty}</td>
                    <td>
                      <span className={`badge ${statusBadge(c.status)}`}>
                        {statusIcon(c.status)} {statusLabel(c.status)}
                      </span>
                    </td>
                    <td>{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString('pt') : '—'}</td>
                    <td><span className={`badge ${c.payment_status === 'paid' ? 'badge-success' : 'badge-neutral'}`}>{c.payment_status}</span></td>
                    <td>{new Date(c.created_at).toLocaleDateString('pt')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
