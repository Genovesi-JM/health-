import { Star } from 'lucide-react';

const REVIEWS = [
  { id: 'r1', patient: 'Maria F.',  rating: 5, comment: 'Excelente médica, muito atenciosa e clara nas explicações. Recomendo!', date: '10/04/2026' },
  { id: 'r2', patient: 'Carlos P.', rating: 5, comment: 'Consulta muito rápida e eficiente. A teleconsulta funciona muito bem.', date: '05/04/2026' },
  { id: 'r3', patient: 'Sofia C.',  rating: 4, comment: 'Boa consulta, fui bem atendida. Apenas esperei um pouco mais.', date: '01/04/2026' },
  { id: 'r4', patient: 'José A.',   rating: 5, comment: 'Profissional de excelência. Explicou tudo com muita paciência.', date: '22/03/2026' },
  { id: 'r5', patient: 'Beatriz L.',rating: 4, comment: 'Muito satisfeita. O sistema de teleconsulta é prático.', date: '15/03/2026' },
];

const avg = (REVIEWS.reduce((s, r) => s + r.rating, 0) / REVIEWS.length).toFixed(1);

function Stars({ n }: { n: number }) {
  return (
    <div style={{ display: 'flex', gap: '0.15rem' }}>
      {[1,2,3,4,5].map(i => <Star key={i} size={14} fill={i <= n ? '#f59e0b' : 'none'} style={{ color: '#f59e0b' }} />)}
    </div>
  );
}

export default function DoctorReviewsPage() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Star size={20} style={{ color: '#f59e0b' }} /> Avaliações dos Pacientes
      </h1>

      <div className="card" style={{ padding: '1.5rem', textAlign: 'center', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '3rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{avg}</div>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}><Stars n={5} /></div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{REVIEWS.length} avaliações</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {REVIEWS.map(r => (
          <div key={r.id} className="card" style={{ padding: '1.1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{r.patient}</span>
                <div style={{ marginTop: '0.2rem' }}><Stars n={r.rating} /></div>
              </div>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{r.date}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{r.comment}"</p>
          </div>
        ))}
      </div>
    </div>
  );
}
