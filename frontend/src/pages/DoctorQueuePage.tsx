import { useEffect, useState } from 'react';
import api from '../api';
import type { ConsultationQueueItem } from '../types';
import { ClipboardList, CheckCircle2, Play, Phone } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export default function DoctorQueuePage() {
  const { t } = useT();
  const [queue, setQueue] = useState<ConsultationQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadQueue(); }, []);

  const loadQueue = () => {
    setLoading(true);
    api.get('/api/v1/doctor/queue')
      .then(r => setQueue(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const startConsultation = async (id: string) => {
    try {
      await api.post(`/api/v1/consultations/${id}/start`);
      loadQueue();
    } catch { /* ignore */ }
  };

  const completeConsultation = async (id: string) => {
    try {
      await api.post(`/api/v1/consultations/${id}/complete`);
      loadQueue();
    } catch { /* ignore */ }
  };

  const riskBadge = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'URGENT': case 'HIGH': return 'badge-danger';
      case 'MEDIUM': return 'badge-warning';
      default: return 'badge-success';
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h1>{t('queue.title')}</h1>
        <p>{t('queue.subtitle')}</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={18} style={{ color: 'var(--accent-teal)' }} />
            {t('queue.patients')}
          </h3>
          <span className={`badge ${queue.length > 0 ? 'badge-warning' : 'badge-neutral'}`}>
            {queue.length} paciente{queue.length !== 1 ? 's' : ''}
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <div className="empty-state-icon"><ClipboardList size={24} style={{ color: 'var(--accent-teal)' }} /></div>
            <div className="empty-state-title">{t('queue.empty')}</div>
            <div className="empty-state-desc">{t('queue.empty_desc')}</div>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('table.patient')}</th>
                  <th>{t('table.specialty')}</th>
                  <th>{t('table.risk')}</th>
                  <th>{t('table.status')}</th>
                  <th>{t('table.date')}</th>
                  <th>{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(q => (
                  <tr key={q.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{q.patient_name}</td>
                    <td>{q.specialty}</td>
                    <td><span className={`badge ${riskBadge(q.risk_level)}`}>{q.risk_level || '—'}</span></td>
                    <td><span className={`badge ${q.status === 'in_progress' ? 'badge-info' : 'badge-warning'}`}>{q.status}</span></td>
                    <td>{new Date(q.created_at).toLocaleDateString('pt')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {q.status !== 'in_progress' && (
                          <button className="btn btn-primary btn-sm" onClick={() => startConsultation(q.id)} title={t('queue.start')}>
                            <Play size={13} /> {t('queue.start')}
                          </button>
                        )}
                        {q.status === 'in_progress' && (
                          <button className="btn btn-sm" onClick={() => completeConsultation(q.id)} title={t('queue.complete')}
                            style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                            <CheckCircle2 size={13} /> {t('queue.complete')}
                          </button>
                        )}
                      </div>
                    </td>
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
