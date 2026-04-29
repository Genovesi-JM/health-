import { useEffect, useState } from 'react';
import api from '../api';
import type { Doctor } from '../types';
import { UserCog, CheckCircle2, XCircle, Clock, RefreshCw, UserPlus, Copy, CheckCheck, Trash2, Loader2 } from 'lucide-react';

interface DoctorInvite {
  id: number;
  invited_email: string | null;
  note: string | null;
  invite_url: string;
  used_at: string | null;
  expires_at: string | null;
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'verified' | 'rejected'>('pending');

  // Invites
  const [invites, setInvites] = useState<DoctorInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNote, setInviteNote] = useState('');
  const [inviteCreating, setInviteCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => { loadDoctors(); loadInvites(); }, []);

  const loadDoctors = () => {
    setLoading(true);
    api.get('/api/v1/doctors/')
      .then(r => setDoctors(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadInvites = () => {
    setInvitesLoading(true);
    api.get('/admin/doctor-invites')
      .then(r => setInvites(r.data))
      .catch(() => {})
      .finally(() => setInvitesLoading(false));
  };

  const createInvite = async () => {
    setInviteCreating(true);
    try {
      const res = await api.post('/admin/doctor-invites', {
        invited_email: inviteEmail.trim() || null,
        note: inviteNote.trim() || null,
      });
      setInvites(prev => [res.data, ...prev]);
      setInviteEmail('');
      setInviteNote('');
      setShowInviteForm(false);
    } catch { /* ignore */ } finally {
      setInviteCreating(false);
    }
  };

  const copyUrl = (invite: DoctorInvite) => {
    navigator.clipboard.writeText(invite.invite_url).then(() => {
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const deleteInvite = async (id: number) => {
    await api.delete(`/admin/doctor-invites/${id}`).catch(() => {});
    setInvites(prev => prev.filter(i => i.id !== id));
  };

  const updateStatus = async (id: string, status: 'verified' | 'rejected') => {
    try {
      const action = status === 'verified' ? 'verify' : 'reject';
      await api.post(`/api/v1/doctors/${id}/verify`, { action });
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

      {/* Invite panel */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={16} style={{ color: 'var(--brand-primary)' }} /> Convidar médico
          </h3>
          <button onClick={() => setShowInviteForm(f => !f)} className="btn btn-primary btn-sm">
            {showInviteForm ? 'Cancelar' : '+ Novo convite'}
          </button>
        </div>

        {showInviteForm && (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Email do médico <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
              <input className="form-input" placeholder="medico@exemplo.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label className="form-label">Nota interna <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
              <input className="form-input" placeholder="ex: Referenciado pela Clínica X" value={inviteNote} onChange={e => setInviteNote(e.target.value)} />
            </div>
            <button onClick={createInvite} disabled={inviteCreating} className="btn btn-primary btn-sm" style={{ padding: '0.6rem 1.1rem', whiteSpace: 'nowrap' }}>
              {inviteCreating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Gerar link'}
            </button>
          </div>
        )}

        {invitesLoading ? (
          <div style={{ marginTop: '1rem', textAlign: 'center' }}><Loader2 size={18} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} /></div>
        ) : invites.length > 0 ? (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {invites.map(inv => (
              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.9rem', borderRadius: '10px', background: 'var(--bg-subtle, var(--bg-card))', border: '1px solid var(--border)', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{inv.invite_url}</div>
                  {inv.invited_email && <div style={{ fontWeight: 600 }}>{inv.invited_email}</div>}
                  {inv.note && <div style={{ color: 'var(--text-muted)' }}>{inv.note}</div>}
                </div>
                {inv.used_at && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.55rem', borderRadius: 999 }}>Usado</span>}
                <button onClick={() => copyUrl(inv)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.35rem 0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: copiedId === inv.id ? '#059669' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem' }}>
                  {copiedId === inv.id ? <><CheckCheck size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                </button>
                <button onClick={() => deleteInvite(inv.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '0.3rem' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Ainda não foram gerados convites.</p>
        )}
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
