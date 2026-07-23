import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import api from '../api';

interface Review { id: string; patient: string; rating: number; comment?: string | null; date: string; }

function Stars({ n }: { n: number }) {
  return (
    <div style={{ display: 'flex', gap: '0.15rem' }}>
      {[1, 2, 3, 4, 5].map(i => <Star key={i} size={14} fill={i <= n ? '#f59e0b' : 'none'} style={{ color: '#f59e0b' }} />)}
    </div>
  );
}

export default function DoctorReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/v1/doctor/reviews')
      .then(r => { setReviews(r.data.reviews || []); setAverage(r.data.average || 0); setCount(r.data.count || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Star size={20} style={{ color: '#f59e0b' }} /> Avaliações dos Pacientes
      </h1>

      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : count === 0 ? (
        <div className="empty-state" style={{ padding: '3rem' }}>
          <div className="empty-state-icon"><Star size={24} style={{ color: '#f59e0b' }} /></div>
          <div className="empty-state-title">Ainda sem avaliações</div>
          <div className="empty-state-desc">As avaliações dos pacientes aparecem aqui após as consultas concluídas.</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: '1.5rem', textAlign: 'center', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{average.toFixed(1)}</div>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}><Stars n={Math.round(average)} /></div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{count} avaliaç{count === 1 ? 'ão' : 'ões'}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {reviews.map(r => (
              <div key={r.id} className="card" style={{ padding: '1.1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{r.patient}</span>
                    <div style={{ marginTop: '0.2rem' }}><Stars n={r.rating} /></div>
                  </div>
                  <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{r.date}</span>
                </div>
                {r.comment && <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{r.comment}"</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
