import { useEffect, useState } from 'react';
import api from '../api';
import {
  Users, Search, RefreshCw, User, Heart, AlertCircle,
  ChevronDown, ChevronUp, Phone, Calendar, Droplets, X,
} from 'lucide-react';

interface PatientAdmin {
  id: string;
  user_id: string;
  email?: string;
  name?: string;
  is_active: boolean;
  date_of_birth?: string;
  gender?: string;
  blood_type?: string;
  allergies: string[];
  chronic_conditions: string[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at: string;
}

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<PatientAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PatientAdmin | null>(null);

  useEffect(() => { loadPatients(); }, []);

  const loadPatients = (query?: string) => {
    setLoading(true);
    const params = query ? `?search=${encodeURIComponent(query)}` : '';
    api.get(`/api/v1/patients/${params}`)
      .then(r => setPatients(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleSearch = () => loadPatients(search.trim() || undefined);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const genderLabel = (g?: string) => {
    switch (g) {
      case 'male': return 'Masculino';
      case 'female': return 'Feminino';
      case 'other': return 'Outro';
      default: return '—';
    }
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('pt-PT'); } catch { return d; }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h1>Pacientes / Clientes</h1>
        <p>Visualizar e gerir todos os pacientes registados na plataforma</p>
      </div>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', maxWidth: '500px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            type="text"
            placeholder="Pesquisar por email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ paddingLeft: '2.2rem' }}
          />
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleSearch}>
          <Search size={14} /> Pesquisar
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); loadPatients(); }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <StatCard icon={<Users size={18} />} label="Total Pacientes" value={patients.length} color="rgba(20,184,166,0.12)" />
        <StatCard icon={<Heart size={18} />} label="Com Alergias" value={patients.filter(p => p.allergies.length > 0).length} color="rgba(251,191,36,0.12)" />
        <StatCard icon={<AlertCircle size={18} />} label="Condições Crónicas" value={patients.filter(p => p.chronic_conditions.length > 0).length} color="rgba(239,68,68,0.12)" />
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} style={{ color: 'var(--accent-teal)' }} />
            Lista de Pacientes
          </h3>
          <span className="badge badge-info">{patients.length} registados</span>
        </div>

        {patients.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <div className="empty-state-icon"><Users size={24} style={{ color: 'var(--accent-teal)' }} /></div>
            <div className="empty-state-title">Sem pacientes</div>
            <div className="empty-state-desc">Ainda não existem pacientes registados na plataforma.</div>
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Género</th>
                  <th>Tipo Sanguíneo</th>
                  <th>Alergias</th>
                  <th>Data de Registo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected?.id === p.id ? null : p)}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.email || '—'}</td>
                    <td>{genderLabel(p.gender)}</td>
                    <td>
                      {p.blood_type ? (
                        <span className="badge badge-info" style={{ gap: '0.2rem' }}>
                          <Droplets size={11} /> {p.blood_type}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      {p.allergies.length > 0 ? (
                        <span className="badge badge-warning">{p.allergies.length} alergia{p.allergies.length > 1 ? 's' : ''}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Nenhuma</span>
                      )}
                    </td>
                    <td>{formatDate(p.created_at)}</td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {p.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      {selected?.id === p.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expanded Detail Panel */}
      {selected && (
        <div className="card" style={{ marginTop: '1rem', maxWidth: '700px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} style={{ color: 'var(--accent-teal)' }} />
              Detalhes — {selected.email || selected.name || 'Paciente'}
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)} style={{ padding: '0.3rem 0.5rem' }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ padding: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <DetailRow icon={<User size={14} />} label="ID Utilizador" value={selected.user_id} />
              <DetailRow icon={<Calendar size={14} />} label="Data de Nascimento" value={formatDate(selected.date_of_birth)} />
              <DetailRow icon={<User size={14} />} label="Género" value={genderLabel(selected.gender)} />
              <DetailRow icon={<Droplets size={14} />} label="Tipo Sanguíneo" value={selected.blood_type || '—'} />
              <DetailRow icon={<Phone size={14} />} label="Contacto Emergência" value={selected.emergency_contact_name ? `${selected.emergency_contact_name} — ${selected.emergency_contact_phone || '?'}` : '—'} />
              <DetailRow icon={<Calendar size={14} />} label="Registado em" value={formatDate(selected.created_at)} />
            </div>

            {/* Allergies */}
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Alergias</div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {selected.allergies.length > 0 ? selected.allergies.map((a, i) => (
                  <span key={i} className="badge badge-warning">{a}</span>
                )) : <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Nenhuma registada</span>}
              </div>
            </div>

            {/* Chronic Conditions */}
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Condições Crónicas</div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {selected.chronic_conditions.length > 0 ? selected.chronic_conditions.map((c, i) => (
                  <span key={i} className="badge badge-danger">{c}</span>
                )) : <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Nenhuma registada</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Helper Components ── */

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.85rem 1.1rem', borderRadius: '12px',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)', minWidth: '160px',
    }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-teal)' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}</div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
      <div style={{ color: 'var(--accent-teal)', marginTop: '2px', flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}
