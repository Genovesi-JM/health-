import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  Stethoscope, Heart, HeartPulse, Activity, Brain, Eye,
  Bone, Apple, Wind, Baby, ChevronRight, Video, Calendar,
  Search, Filter,
} from 'lucide-react';
import { useState } from 'react';

const SPECIALTIES = [
  { icon: Stethoscope, label: 'Clínica Geral',   color: '#0d9488', desc: 'Consultas gerais, orientação inicial e encaminhamento.', modalidade: ['presencial', 'teleconsulta'] },
  { icon: Baby,        label: 'Pediatria',        color: '#0891b2', desc: 'Cuidados médicos para crianças e adolescentes até 18 anos.', modalidade: ['presencial', 'teleconsulta'] },
  { icon: Heart,       label: 'Ginecologia',      color: '#db2777', desc: 'Saúde da mulher, gravidez e planeamento familiar.', modalidade: ['presencial'] },
  { icon: HeartPulse,  label: 'Cardiologia',      color: '#dc2626', desc: 'Doenças do coração, hipertensão e ECG.', modalidade: ['presencial', 'teleconsulta'] },
  { icon: Activity,    label: 'Dermatologia',     color: '#ea580c', desc: 'Pele, cabelo, unhas e doenças dermatológicas.', modalidade: ['presencial', 'teleconsulta'] },
  { icon: Brain,       label: 'Psicologia',       color: '#7c3aed', desc: 'Apoio emocional, saúde mental e psicoterapia.', modalidade: ['teleconsulta'] },
  { icon: Brain,       label: 'Psiquiatria',      color: '#6d28d9', desc: 'Diagnóstico e tratamento de doenças mentais.', modalidade: ['presencial', 'teleconsulta'] },
  { icon: Eye,         label: 'Oftalmologia',     color: '#0369a1', desc: 'Visão, olhos e doenças oftalmológicas.', modalidade: ['presencial'] },
  { icon: Stethoscope, label: 'Dentária',         color: '#0891b2', desc: 'Saúde oral, cáries, ortodontia e implantes.', modalidade: ['presencial'] },
  { icon: Wind,        label: 'Fisioterapia',     color: '#059669', desc: 'Reabilitação, dor crónica e lesões musculares.', modalidade: ['presencial'] },
  { icon: Activity,    label: 'Neurologia',       color: '#4f46e5', desc: 'Sistema nervoso, enxaquecas e AVC.', modalidade: ['presencial', 'teleconsulta'] },
  { icon: Bone,        label: 'Ortopedia',        color: '#b45309', desc: 'Ossos, articulações, fracturas e cirurgia ortopédica.', modalidade: ['presencial'] },
  { icon: Apple,       label: 'Nutrição',         color: '#16a34a', desc: 'Dieta, obesidade, diabetes e planos alimentares.', modalidade: ['presencial', 'teleconsulta'] },
];

export default function EspecialistasPage() {
  const [filter, setFilter] = useState<'todos' | 'teleconsulta' | 'presencial'>('todos');
  const [search, setSearch] = useState('');

  const filtered = SPECIALTIES.filter(s => {
    const matchFilter = filter === 'todos' || s.modalidade.includes(filter);
    const matchSearch = s.label.toLowerCase().includes(search.toLowerCase()) || s.desc.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="landing-wrapper">
      <Navbar />

      <section className="lp-page-hero" style={{ paddingBottom: '3rem' }}>
        <div className="lp-tag">Especialidades Médicas</div>
        <h1>Encontre o especialista certo.</h1>
        <p>Presencial ou teleconsulta — consulte qualquer especialidade com médicos verificados e parceiros de confiança.</p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem', maxWidth: '600px', margin: '2rem auto 0' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Pesquisar especialidade..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: '2.4rem', paddingRight: '1rem', paddingTop: '0.7rem', paddingBottom: '0.7rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['todos', 'teleconsulta', 'presencial'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: filter === f ? '#0d9488' : '#ffffff', color: filter === f ? '#fff' : '#475569', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {f === 'todos' ? <Filter size={13} /> : f === 'teleconsulta' ? <Video size={13} /> : <Calendar size={13} />}
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" style={{ background: '#f8fafc' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem', maxWidth: '1100px', margin: '0 auto' }}>
          {filtered.map(sp => (
            <div key={sp.label}
              style={{
                background: '#ffffff',
                border: `1px solid #e2e8f0`,
                borderTop: `4px solid ${sp.color}`,
                borderRadius: '16px',
                padding: '1.5rem',
                transition: 'box-shadow 0.2s, border-color 0.2s',
                cursor: 'default',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 24px ${sp.color}22`; e.currentTarget.style.borderColor = sp.color; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.85rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${sp.color}15`, color: sp.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <sp.icon size={22} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>{sp.label}</div>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.6, marginBottom: '1.1rem' }}>{sp.desc}</p>

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
                {sp.modalidade.map(m => (
                  <span key={m} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 600,
                    background: m === 'teleconsulta' ? '#e0f2fe' : '#dcfce7',
                    color: m === 'teleconsulta' ? '#0369a1' : '#15803d',
                  }}>
                    {m === 'teleconsulta' ? <Video size={11} /> : <Calendar size={11} />} {m}
                  </span>
                ))}
              </div>

              <Link to="/login" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.65rem 1rem', background: sp.color, borderRadius: '10px',
                textDecoration: 'none', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600,
                transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                Marcar consulta <ChevronRight size={15} />
              </Link>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Nenhuma especialidade encontrada.</div>
        )}
      </section>

      <Footer />
    </div>
  );
}
