import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Video, Building2, Home, Star, Filter, X, Loader2 } from 'lucide-react';
import api from '../api';

const SPECIALTIES = [
  { value: '', label: 'Todas as especialidades' },
  { value: 'clinica_geral', label: 'Clínica Geral' },
  { value: 'pediatria', label: 'Pediatria' },
  { value: 'cardiologia', label: 'Cardiologia' },
  { value: 'ginecologia', label: 'Ginecologia' },
  { value: 'dermatologia', label: 'Dermatologia' },
  { value: 'ortopedia', label: 'Ortopedia' },
  { value: 'oftalmologia', label: 'Oftalmologia' },
  { value: 'neurologia', label: 'Neurologia' },
  { value: 'psiquiatria', label: 'Psiquiatria' },
  { value: 'psicologia', label: 'Psicologia' },
  { value: 'fisioterapia', label: 'Fisioterapia' },
  { value: 'odontologia', label: 'Medicina Dentária' },
  { value: 'medicina_interna', label: 'Medicina Interna' },
  { value: 'urgencia', label: 'Urgência / Emergência' },
  { value: 'outro', label: 'Outra especialidade' },
];

const CONSULT_ICONS: Record<string, ReactElement> = {
  teleconsulta: <Video size={12} />,
  presencial: <Building2 size={12} />,
  domicilio: <Home size={12} />,
};

const CONSULT_LABELS: Record<string, string> = {
  teleconsulta: 'Teleconsulta',
  presencial: 'Presencial',
  domicilio: 'Domicílio',
};

interface Doctor {
  id: number;
  display_name: string | null;
  title: string | null;
  specialization: string | null;
  slug: string | null;
  photo_url: string | null;
  bio: string | null;
  location_city: string | null;
  location_province: string | null;
  years_experience: number | null;
  accepts_new_patients: boolean | null;
  consultation_types: string[] | null;
  price_min: number | null;
  price_max: number | null;
  languages: string[] | null;
}

export default function DoctorsListPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [consultType, setConsultType] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (specialty) params.specialty = specialty;
      if (consultType) params.consultation_type = consultType;
      const res = await api.get('/api/v1/doctors/', { params });
      let data: Doctor[] = res.data;
      if (search.trim()) {
        const q = search.toLowerCase();
        data = data.filter(d =>
          d.display_name?.toLowerCase().includes(q) ||
          d.location_city?.toLowerCase().includes(q) ||
          d.specialization?.toLowerCase().includes(q) ||
          d.bio?.toLowerCase().includes(q)
        );
      }
      setDoctors(data);
    } catch {
      setError('Não foi possível carregar os médicos.');
    } finally {
      setLoading(false);
    }
  }, [specialty, consultType, search]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const activeFilters = [specialty, consultType].filter(Boolean).length;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.25rem' }}>Encontre um médico</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
          Profissionais de saúde verificados em Angola
        </p>
      </div>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            placeholder="Pesquisar por nome, especialidade, cidade…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2.2rem' }}
          />
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '10px', border: '1.5px solid var(--border)', background: showFilters ? 'var(--brand-light)' : 'var(--bg-card)', color: showFilters ? 'var(--brand-primary)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <Filter size={15} /> Filtros {activeFilters > 0 && <span style={{ background: 'var(--brand-primary)', color: '#fff', borderRadius: 999, padding: '0 5px', fontSize: '0.7rem' }}>{activeFilters}</span>}
        </button>
      </div>

      {showFilters && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', padding: '1rem', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <select className="form-input" style={{ minWidth: 200 }} value={specialty} onChange={e => setSpecialty(e.target.value)}>
            {SPECIALTIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="form-input" style={{ minWidth: 180 }} value={consultType} onChange={e => setConsultType(e.target.value)}>
            <option value="">Tipo de consulta</option>
            <option value="teleconsulta">📹 Teleconsulta</option>
            <option value="presencial">🏥 Presencial</option>
            <option value="domicilio">🏠 Domicílio</option>
          </select>
          {activeFilters > 0 && (
            <button onClick={() => { setSpecialty(''); setConsultType(''); }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.85rem', borderRadius: '8px', border: 'none', background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
              <X size={13} /> Limpar filtros
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Loader2 size={28} style={{ color: 'var(--brand-primary)', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>{error}</div>
      ) : doctors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Nenhum médico encontrado para esta pesquisa.</p>
          {(specialty || consultType || search) && (
            <button onClick={() => { setSpecialty(''); setConsultType(''); setSearch(''); }} style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: 'var(--brand-primary)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {doctors.length} médico{doctors.length !== 1 ? 's' : ''} encontrado{doctors.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {doctors.map(d => (
              <DoctorCard key={d.id} doctor={d} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DoctorCard({ doctor: d }: { doctor: Doctor }) {
  const initials = (d.display_name || 'M').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const specialtyLabel = SPECIALTIES.find(s => s.value === d.specialization)?.label ?? d.specialization ?? 'Medicina';

  return (
    <Link to={d.slug ? `/medicos/${d.slug}` : '#'} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card" style={{ padding: '1.25rem', transition: 'box-shadow 0.2s, transform 0.15s', cursor: 'pointer' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}>
        <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}>
          {d.photo_url ? (
            <img src={d.photo_url} alt={d.display_name || ''} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--brand-light)', color: 'var(--brand-primary)', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.title ? `${d.title} ` : ''}{d.display_name || 'Médico'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 600, marginTop: '0.1rem' }}>{specialtyLabel}</div>
          </div>
        </div>

        {d.bio && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.75rem 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {d.bio}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {(d.consultation_types || []).map(ct => (
            <span key={ct} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', padding: '0.25rem 0.6rem', borderRadius: 999, background: 'var(--brand-light)', color: 'var(--brand-primary)', fontWeight: 600 }}>
              {CONSULT_ICONS[ct]} {CONSULT_LABELS[ct] || ct}
            </span>
          ))}
          {d.accepts_new_patients === false && (
            <span style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem', borderRadius: 999, background: 'rgba(239,68,68,0.08)', color: '#dc2626', fontWeight: 600 }}>Sem vagas</span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem' }}>
          {(d.location_city || d.location_province) && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.77rem', color: 'var(--text-muted)' }}>
              <MapPin size={11} /> {[d.location_city, d.location_province].filter(Boolean).join(', ')}
            </span>
          )}
          {(d.price_min || d.price_max) && (
            <span style={{ fontSize: '0.77rem', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
              {d.price_min && d.price_max ? `${d.price_min.toLocaleString()}–${d.price_max.toLocaleString()} Kz` : d.price_min ? `A partir de ${d.price_min.toLocaleString()} Kz` : `Até ${d.price_max!.toLocaleString()} Kz`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
