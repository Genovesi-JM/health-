import { useEffect, useState } from 'react';
import api from '../api';
import type { Doctor } from '../types';
import { UserCog, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'verified' | 'rejected'>('pending');

  useEffect(() => { loadDoctors(); }, []);

  const loadDoctors = () => {
    setLoading(true);
    api.get('/api/v1/doctors/')
      .then(r => setDoctors(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const updateStatus = async (id: string, status: 'verified' | 'rejected') => {
    try {
      await api.put(`/api/v1/doctors/${id}/verify`, { status });
      loadDoctors();
    } catch { /* ignore */ }
  };

  const filtered = doctors.filter(d => d.verification_status === tab);

  const statusIcon = (s: string) => {
    switch (s) {
      case 'verified': return <CheckCircle2 size={14} style={{ color: '#22c55e' }} />;
      case 'rejected': return <XCircle size={14} style={{ color: '#ef4444' }} />;
      default: return <Clock size={14} style={{ color: '#eab308' }} />;
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h1>Verificar Médicos</h1>
        <p>Gerir e verificar as credenciais dos profissionais de saúde</p>
      </div>

      <div className="tab-nav">
        <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>
          Pendentes ({doctors.filter(d => d.verification_status === 'pending').length})
        </button>
        <button className={tab === 'verified' ? 'active' : ''} onClick={() => setTab('verified')}>
          Verificados ({doctors.filter(d => d.verification_status === 'verified').length})
        </button>
        <button className={tab === 'rejected' ? 'active' : ''} onClick={() => setTab('rejected')}>
          Rejeitados ({doctors.filter(d => d.verification_status === 'rejected').length})
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserCog size={18} style={{ color: 'var(--accent-teal)' }} />
            Médicos — {tab === 'pending' ? 'Pendentes' : tab === 'verified' ? 'Verificados' : 'Rejeitados'}
          </h3>
          <button className="btn btn-secondary btn-sm" onClick={loadDoctors}>
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <div className="empty-state-icon"><UserCog size={24} style={{ color: 'var(--accent-teal)' }} /></div>
            <div className="empty-state-title">Sem médicos</div>
            <div className="empty-state-desc">Não existem médicos {tab === 'pending' ? 'pendentes' : tab === 'verified' ? 'verificados' : 'rejeitados'}.</div>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Licença</th>
                  <th>Especialização</th>
                  <th>Estado</th>
                  {tab === 'pending' && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{d.user?.email || '—'}</td>
                    <td>{d.license_number}</td>
                    <td>{d.specialization}</td>
                    <td>
                      <span className={`badge ${d.verification_status === 'verified' ? 'badge-success' : d.verification_status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                        {statusIcon(d.verification_status)} {d.verification_status}
                      </span>
                    </td>
                    {tab === 'pending' && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-sm" onClick={() => updateStatus(d.id, 'verified')}
                            style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                            <CheckCircle2 size={13} /> Aprovar
                          </button>
                          <button className="btn btn-sm" onClick={() => updateStatus(d.id, 'rejected')}
                            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                            <XCircle size={13} /> Rejeitar
                          </button>
                        </div>
                      </td>
                    )}
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
