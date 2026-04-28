import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin, Phone, Video, Building2, Home, Globe, BookOpen,
  CheckCircle2, Loader2, ChevronLeft, Calendar, Star,
} from 'lucide-react';
import api from '../api';

const SPECIALTIES: Record<string, string> = {
  clinica_geral: 'Clínica Geral', pediatria: 'Pediatria', cardiologia: 'Cardiologia',
  ginecologia: 'Ginecologia', dermatologia: 'Dermatologia', ortopedia: 'Ortopedia',
  oftalmologia: 'Oftalmologia', neurologia: 'Neurologia', psiquiatria: 'Psiquiatria',
  psicologia: 'Psicologia', fisioterapia: 'Fisioterapia', odontologia: 'Medicina Dentária',
  medicina_interna: 'Medicina Interna', urgencia: 'Urgência / Emergência', outro: 'Outra especialidade',
};

const CONSULT_ICONS: Record<string, { icon: typeof Video; label: string }> = {
  teleconsulta: { icon: Video, label: 'Teleconsulta' },
  presencial: { icon: Building2, label: 'Presencial' },
  domicilio: { icon: Home, label: 'Domicílio' },
};

interface DoctorPublic {
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
  education: { institution: string; degree: string; year: number | null }[] | null;
}

export default function PublicDoctorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [doctor, setDoctor] = useState<DoctorPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api.get(`/api/v1/doctors/by-slug/${slug}`)
      .then(r => setDoctor(r.data))
      .catch(err => { if (err.response?.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={28} style={{ color: 'var(--brand-primary)', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (notFound || !doctor) return (
    <div style={{ maxWidth: 560, margin: '4rem auto', textAlign: 'center', padding: '1.25rem' }}>
      <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Médico não encontrado.
      </p>
      <Link to="/medicos" style={{ color: 'var(--brand-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
        ← Ver todos os médicos
      </Link>
    </div>
  );

  const initials = (doctor.display_name || 'M').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const specialtyLabel = SPECIALTIES[doctor.specialization || ''] ?? doctor.specialization ?? 'Medicina';

  const priceText = () => {
    if (doctor.price_min && doctor.price_max) return `${doctor.price_min.toLocaleString()} – ${doctor.price_max.toLocaleString()} Kz`;
    if (doctor.price_min) return `A partir de ${doctor.price_min.toLocaleString()} Kz`;
    if (doctor.price_max) return `Até ${doctor.price_max.toLocaleString()} Kz`;
    return null;
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.75rem 1.25rem 4rem' }}>
      <Link to="/medicos" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.83rem', color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'none', marginBottom: '1.5rem' }}>
        <ChevronLeft size={14} /> Todos os médicos
      </Link>

      {/* Hero card */}
      <div className="card" style={{ padding: '1.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {doctor.photo_url ? (
            <img src={doctor.photo_url} alt={doctor.display_name || ''} style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'var(--brand-light)', color: 'var(--brand-primary)', fontWeight: 800, fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                {doctor.title ? `${doctor.title} ` : ''}{doctor.display_name || 'Médico'}
              </h1>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 999, background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 700 }}>
                <CheckCircle2 size={11} /> Verificado
              </span>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--brand-primary)', fontWeight: 600, marginTop: '0.2rem' }}>{specialtyLabel}</div>
            {doctor.years_experience && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                <Star size={12} style={{ verticalAlign: 'middle', marginRight: '0.2rem' }} />
                {doctor.years_experience} anos de experiência
              </div>
            )}
            {(doctor.location_city || doctor.location_province) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                <MapPin size={12} /> {[doctor.location_city, doctor.location_province].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            {doctor.accepts_new_patients === false ? (
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#dc2626', background: 'rgba(239,68,68,0.08)', padding: '0.3rem 0.75rem', borderRadius: 999 }}>Sem vagas</span>
            ) : (
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#059669', background: 'rgba(16,185,129,0.08)', padding: '0.3rem 0.75rem', borderRadius: 999 }}>Aceita pacientes</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {doctor.bio && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <BookOpen size={14} /> Sobre mim
              </h3>
              <p style={{ fontSize: '0.88rem', lineHeight: 1.65, color: 'var(--text-secondary)', margin: 0 }}>{doctor.bio}</p>
            </div>
          )}

          {doctor.education && doctor.education.length > 0 && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>🎓 Formação</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {doctor.education.map((e, i) => (
                  <div key={i} style={{ paddingLeft: '0.75rem', borderLeft: '2.5px solid var(--brand-primary)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{e.degree}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.institution}{e.year ? ` · ${e.year}` : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={14} /> Tipos de consulta
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(doctor.consultation_types || []).map(ct => {
                const info = CONSULT_ICONS[ct];
                if (!info) return null;
                const Icon = info.icon;
                return (
                  <div key={ct} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', fontWeight: 500 }}>
                    <Icon size={15} style={{ color: 'var(--brand-primary)' }} /> {info.label}
                  </div>
                );
              })}
            </div>
            {priceText() && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                💰 {priceText()}
              </div>
            )}
          </div>

          {doctor.languages && doctor.languages.length > 0 && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Globe size={14} /> Idiomas
              </h3>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {doctor.languages.map(l => (
                  <span key={l} style={{ padding: '0.3rem 0.7rem', borderRadius: 999, background: 'var(--bg-subtle)', fontSize: '0.82rem', fontWeight: 600 }}>{l}</span>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--brand-gradient, var(--brand-primary))', color: '#fff', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.4rem' }}>Marcar consulta</h3>
            <p style={{ fontSize: '0.82rem', margin: '0 0 1rem', opacity: 0.85 }}>
              Entre em contacto directamente com o médico.
            </p>
            <Link to="/register" style={{ display: 'block', textAlign: 'center', padding: '0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.95)', color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}>
              Criar conta de paciente
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
