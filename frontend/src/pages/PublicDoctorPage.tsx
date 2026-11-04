import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  MapPin, Video, Building2, Home, Globe, BookOpen,
  CheckCircle2, Loader2, ChevronLeft, Calendar, Star,
} from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';

const SPECIALTY_CODES = new Set([
  'clinica_geral', 'pediatria', 'cardiologia', 'ginecologia', 'dermatologia', 'ortopedia',
  'oftalmologia', 'neurologia', 'psiquiatria', 'psicologia', 'fisioterapia', 'odontologia',
  'medicina_interna', 'urgencia', 'outro',
]);

const CONSULT_ICONS: Record<string, { icon: typeof Video; labelKey: string }> = {
  teleconsulta: { icon: Video, labelKey: 'appt.teleconsulta' },
  presencial: { icon: Building2, labelKey: 'appt.presencial' },
  domicilio: { icon: Home, labelKey: 'appt.domicilio' },
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
  practice_country: 'AO' | 'PT' | null;
}

export default function PublicDoctorPage() {
  const { t } = useT();
  const { slug } = useParams<{ slug: string }>();
  const [params, setParams] = useSearchParams();
  const country = params.get('country') === 'PT' ? 'PT' : 'AO';
  const [attempt, setAttempt] = useState(0);
  const requestKey = JSON.stringify([slug, country, attempt]);
  const [result, setResult] = useState<{ key: string; doctor: DoctorPublic | null; status: 'ready' | 'not_found' | 'error' } | null>(null);
  const loading = result?.key !== requestKey;
  const doctor = !loading ? result?.doctor : null;
  const notFound = !loading && result?.status === 'not_found';
  const directoryLink = `/medicos?country=${country}`;
  const marketSelector = <label style={{ display: 'block', maxWidth: 760, margin: '1rem auto', padding: '0 1.25rem' }}>País de atendimento
    <select className="form-input" value={country} onChange={event => { const next = new URLSearchParams(params); next.set('country', event.target.value); setParams(next); }}>
      <option value="AO">Angola</option><option value="PT">Portugal</option>
    </select>
  </label>;

  useEffect(() => {
    let active = true;
    api.get<DoctorPublic>(`/api/v1/doctors/by-slug/${encodeURIComponent(slug ?? '')}`, { params: { country } })
      .then(response => { if (active) setResult({ key: requestKey, doctor: response.data, status: 'ready' }); })
      .catch((failure: unknown) => {
        const status = (failure as { response?: { status?: number } })?.response?.status;
        if (active) setResult({ key: requestKey, doctor: null, status: status === 404 ? 'not_found' : 'error' });
      });
    return () => { active = false; };
  }, [slug, country, requestKey]);

  if (loading) return <>{marketSelector}
    <div role="status" aria-label="A carregar perfil" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={28} style={{ color: 'var(--brand-primary)', animation: 'spin 1s linear infinite' }} />
    </div></>;

  if (notFound || !doctor) return <>{marketSelector}
    <div style={{ maxWidth: 560, margin: '4rem auto', textAlign: 'center', padding: '1.25rem' }}>
      <p role={notFound ? 'status' : 'alert'} style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        {notFound ? `Este perfil não está disponível para atendimento em ${country === 'AO' ? 'Angola' : 'Portugal'}.` : 'Não foi possível carregar o perfil. Verifique a ligação e tente novamente.'}
      </p>
      {!notFound && <button className="btn btn-secondary" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button>}
      <Link to={directoryLink} style={{ color: 'var(--brand-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
        ← {t('pubdoc.see_all')}
      </Link>
    </div></>;

  const initials = (doctor.display_name || 'M').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const specialtyLabel = doctor.specialization && SPECIALTY_CODES.has(doctor.specialization)
    ? t(`spec.${doctor.specialization}`)
    : doctor.specialization ?? t('dlist.default_specialty');

  const priceText = () => {
    if (doctor.practice_country !== 'AO') return null;
    if (doctor.price_min && doctor.price_max) return `${doctor.price_min.toLocaleString()} – ${doctor.price_max.toLocaleString()} Kz`;
    if (doctor.price_min) return `${t('dlist.price_from')} ${doctor.price_min.toLocaleString()} Kz`;
    if (doctor.price_max) return `${t('dlist.price_upto')} ${doctor.price_max.toLocaleString()} Kz`;
    return null;
  };

  return (
    <>{marketSelector}<div style={{ maxWidth: 760, margin: '0 auto', padding: '1.75rem 1.25rem 4rem' }}>
      <Link to={directoryLink} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.83rem', color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'none', marginBottom: '1.5rem' }}>
        <ChevronLeft size={14} /> {t('pubdoc.all_doctors')}
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
                {doctor.title ? `${doctor.title} ` : ''}{doctor.display_name || t('dlist.doctor')}
              </h1>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 999, background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 700 }}>
                <CheckCircle2 size={11} /> {t('pubdoc.verified')}
              </span>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--brand-primary)', fontWeight: 600, marginTop: '0.2rem' }}>{specialtyLabel}</div>
            <p style={{ color: 'var(--text-secondary)', margin: '0.4rem 0' }}>{doctor.practice_country === 'AO' ? 'Exercício confirmado em Angola' : doctor.practice_country === 'PT' ? 'Exercício confirmado em Portugal' : 'País de exercício não confirmado'}</p>
            {doctor.years_experience && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                <Star size={12} style={{ verticalAlign: 'middle', marginRight: '0.2rem' }} />
                {doctor.years_experience} {t('pubdoc.years_exp')}
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
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#dc2626', background: 'rgba(239,68,68,0.08)', padding: '0.3rem 0.75rem', borderRadius: 999 }}>{t('dlist.no_slots')}</span>
            ) : (
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#059669', background: 'rgba(16,185,129,0.08)', padding: '0.3rem 0.75rem', borderRadius: 999 }}>{t('pubdoc.accepts')}</span>
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
                <BookOpen size={14} /> {t('pubdoc.about')}
              </h3>
              <p style={{ fontSize: '0.88rem', lineHeight: 1.65, color: 'var(--text-secondary)', margin: 0 }}>{doctor.bio}</p>
            </div>
          )}

          {doctor.education && doctor.education.length > 0 && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>{t('pubdoc.education')}</h3>
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
              <Calendar size={14} /> {t('pubdoc.consult_types')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(doctor.consultation_types || []).map(ct => {
                const info = CONSULT_ICONS[ct];
                if (!info) return null;
                const Icon = info.icon;
                return (
                  <div key={ct} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', fontWeight: 500 }}>
                    <Icon size={15} style={{ color: 'var(--brand-primary)' }} /> {t(info.labelKey)}
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
                <Globe size={14} /> {t('pubdoc.languages')}
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
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.4rem' }}>{t('pubdoc.book')}</h3>
            <p style={{ fontSize: '0.82rem', margin: '0 0 1rem', opacity: 0.85 }}>
              {t('pubdoc.book_desc')}
            </p>
            <Link to="/register" style={{ display: 'block', textAlign: 'center', padding: '0.75rem', borderRadius: '10px', background: 'rgba(255,255,255,0.95)', color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}>
              {t('pubdoc.create_account')}
            </Link>
          </div>
        </div>
      </div>
    </div></>
  );
}
