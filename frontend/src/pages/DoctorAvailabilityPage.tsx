import { useEffect, useState, type FormEvent } from 'react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import { Clock, Plus, Trash2 } from 'lucide-react';

interface Slot { id: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean; }

const DAY_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function DoctorAvailabilityPage() {
  const { t } = useT();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('17:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/api/v1/doctors/me/availability')
      .then(r => setSlots(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (end <= start) { setError(t('avail.to') + ' > ' + t('avail.from')); return; }
    setSaving(true); setError('');
    try {
      await api.post('/api/v1/doctors/me/availability', { day_of_week: day, start_time: start, end_time: end, is_active: true });
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro');
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    try { await api.delete(`/api/v1/doctors/me/availability/${id}`); setSlots(prev => prev.filter(s => s.id !== id)); } catch { /* ignore */ }
  };

  const dayName = (d: number) => DAY_PT[d] ?? String(d);

  const byDay = [...slots].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Clock size={20} style={{ color: 'var(--brand-primary)' }} /> {t('avail.title')}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>{t('avail.desc')}</p>

      {/* Add slot */}
      <form onSubmit={add} className="card" style={{ padding: '1.1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 3 }}>{t('avail.day')}</label>
          <select className="form-input" value={day} onChange={e => setDay(Number(e.target.value))}>
            {DAY_PT.map((_, i) => <option key={i} value={i}>{dayName(i)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 3 }}>{t('avail.from')}</label>
          <input className="form-input" type="time" value={start} onChange={e => setStart(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 3 }}>{t('avail.to')}</label>
          <input className="form-input" type="time" value={end} onChange={e => setEnd(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={saving}><Plus size={15} /> {t('avail.add')}</button>
      </form>
      {error && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{error}</div>}

      {/* Slot list */}
      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : byDay.length === 0 ? (
        <div className="empty-state" style={{ padding: '2.5rem' }}>
          <div className="empty-state-icon"><Clock size={22} style={{ color: 'var(--accent-teal)' }} /></div>
          <div className="empty-state-title">{t('avail.empty')}</div>
        </div>
      ) : (
        <div className="card" style={{ padding: '0.5rem 0' }}>
          {byDay.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{dayName(s.day_of_week)}</span>
                <span style={{ marginLeft: 10, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{s.start_time} — {s.end_time}</span>
              </div>
              <button onClick={() => remove(s.id)} title="Remover" style={{ padding: '0.35rem', border: 'none', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#dc2626', cursor: 'pointer', display: 'inline-flex' }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
