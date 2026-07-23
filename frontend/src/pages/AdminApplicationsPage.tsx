import { useEffect, useState } from 'react';
import api from '../api';
import { Briefcase, Mail, Check, Eye, X } from 'lucide-react';

interface Application {
  id: string;
  applicant_type: string;
  name: string;
  email: string;
  phone?: string | null;
  specialty?: string | null;
  org_name?: string | null;
  location?: string | null;
  license_number?: string | null;
  message?: string | null;
  status: string;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'Nova',        color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  reviewing: { label: 'Em análise',  color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  invited:   { label: 'Convidado',   color: '#059669', bg: 'rgba(5,150,105,0.12)' },
  rejected:  { label: 'Rejeitada',   color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
};

const TYPE_LABEL: Record<string, string> = {
  medico: 'Médico', especialista: 'Especialista', clinica: 'Clínica',
};

export default function AdminApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const load = () => {
    setLoading(true);
    api.get('/admin/doctor-applications', { params: filter ? { status: filter } : {} })
      .then(r => setApps(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  const setStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/admin/doctor-applications/${id}`, { status });
      setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch { /* ignore */ }
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-PT');

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Briefcase size={20} style={{ color: 'var(--brand-primary)' }} /> Candidaturas de Parceiros
      </h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.25rem', fontSize: '0.85rem' }}>
        Médicos e clínicas que se candidataram a aderir à KAYA. Reveja e envie um convite.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[['', 'Todas'], ['new', 'Novas'], ['reviewing', 'Em análise'], ['invited', 'Convidados'], ['rejected', 'Rejeitadas']].map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)} className={`btn btn-sm ${filter === v ? 'btn-primary' : 'btn-outline'}`}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : apps.length === 0 ? (
        <div className="empty-state" style={{ padding: '3rem' }}>
          <div className="empty-state-icon"><Briefcase size={24} style={{ color: 'var(--accent-teal)' }} /></div>
          <div className="empty-state-title">Sem candidaturas</div>
          <div className="empty-state-desc">As candidaturas submetidas no site aparecem aqui.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th><th>Tipo</th><th>Especialidade</th><th>Contacto</th><th>Local</th><th>Estado</th><th>Data</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {apps.map(a => {
                  const s = STATUS_META[a.status] ?? { label: a.status, color: '#64748b', bg: 'rgba(100,116,139,0.1)' };
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>
                        {a.name}
                        {a.org_name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.org_name}</div>}
                        {a.license_number && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cédula: {a.license_number}</div>}
                      </td>
                      <td>{TYPE_LABEL[a.applicant_type] ?? a.applicant_type}</td>
                      <td>{a.specialty || '—'}</td>
                      <td>
                        <a href={`mailto:${a.email}`} style={{ color: 'var(--brand-primary)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.82rem' }}><Mail size={12} /> {a.email}</a>
                        {a.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.phone}</div>}
                      </td>
                      <td>{a.location || '—'}</td>
                      <td><span style={{ padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.73rem', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span></td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmtDate(a.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          {a.status !== 'reviewing' && a.status !== 'invited' && (
                            <button title="Em análise" onClick={() => setStatus(a.id, 'reviewing')} style={iconBtn('#d97706')}><Eye size={14} /></button>
                          )}
                          {a.status !== 'invited' && (
                            <button title="Marcar como convidado" onClick={() => setStatus(a.id, 'invited')} style={iconBtn('#059669')}><Check size={14} /></button>
                          )}
                          {a.status !== 'rejected' && (
                            <button title="Rejeitar" onClick={() => setStatus(a.id, 'rejected')} style={iconBtn('#dc2626')}><X size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function iconBtn(color: string): React.CSSProperties {
  return { padding: '0.35rem', border: 'none', borderRadius: 8, background: `${color}18`, color, cursor: 'pointer', display: 'inline-flex' };
}
