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
              style={{ width: '100%', paddingLeft: '2.4rem', paddingRight: '1rem', paddingTop: '0.7rem', paddingBottom: '0.7rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['todos', 'teleconsulta', 'presencial'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: filter === f ? 'var(--accent-teal)' : 'transparent', color: filter === f ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                {f === 'todos' ? <Filter size={13} /> : f === 'teleconsulta' ? <Video size={13} /> : <Calendar size={13} />}
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', maxWidth: '1100px', margin: '0 auto' }}>
          {filtered.map(sp => (
            <div key={sp.label} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.4rem', transition: 'border-color 0.2s', cursor: 'default' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = sp.color + '60')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.75rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${sp.color}18`, color: sp.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <sp.icon size={20} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{sp.label}</div>
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>{sp.desc}</p>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {sp.modalidade.map(m => (
                  <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600, background: m === 'teleconsulta' ? 'rgba(8,145,178,0.12)' : 'rgba(22,163,74,0.12)', color: m === 'teleconsulta' ? '#22d3ee' : '#4ade80' }}>
                    {m === 'teleconsulta' ? <Video size={11} /> : <Calendar size={11} />} {m}
                  </span>
                ))}
              </div>
              <Link to="/login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: `${sp.color}18`, borderRadius: '8px', textDecoration: 'none', color: sp.color, fontSize: '0.82rem', fontWeight: 600 }}>
                Marcar consulta <ChevronRight size={14} />
              </Link>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Nenhuma especialidade encontrada.</div>
        )}
      </section>

      <Footer />
    </div>
  );
}
