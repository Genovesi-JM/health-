import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Ambulance, Accessibility, CalendarClock, Siren, ArrowRight, Phone } from 'lucide-react';
import api from '../api';
import { apiErrorMessage } from '../utils/apiError';

type Kind = 'scheduled' | 'accessible' | 'assisted' | 'emergency';
interface TransportRequest {
  id: string; kind: Kind; kind_label: string; status: string; pickup_address: string; destination: string;
  scheduled_for: string | null; mobility_needs: string | null; companion: boolean; notes: string | null;
  created_at: string; guidance?: string | null;
}

const KINDS: { kind: Kind; label: string; desc: string; color: string; icon: typeof Ambulance }[] = [
  { kind: 'scheduled',  label: 'Transporte agendado',     desc: 'Viagem planeada até à consulta ou exame, com operador qualificado.',  color: '#a9ddf4', icon: CalendarClock },
  { kind: 'accessible', label: 'Mobilidade acessível',    desc: 'Apoio não clínico ao passageiro: cadeira de rodas, acompanhante.',    color: '#bfe7df', icon: Accessibility },
  { kind: 'assisted',   label: 'Transferência assistida', desc: 'Equipa e equipamento clínico a bordo, entre casa e hospital.',         color: '#cdb8f0', icon: Ambulance },
  { kind: 'emergency',  label: 'Emergência',              desc: 'Pré-alerta ao hospital. Em risco de vida ligue primeiro para o 112.', color: '#f3a1a1', icon: Siren },
];

const STATUS_PT: Record<string, string> = {
  requested: 'Pedido enviado', confirmed: 'Confirmado', en_route: 'A caminho', completed: 'Concluído', cancelled: 'Cancelado',
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PatientTransportPage() {
  const [kind, setKind] = useState<Kind | null>(null);
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<TransportRequest | null>(null);
  const [form, setForm] = useState({
    pickup_address: '', destination: '', scheduled_for: toLocalInput(new Date(Date.now() + 24 * 3600 * 1000)),
    mobility_needs: '', companion: false, notes: '',
  });

  const load = useCallback(() => {
    api.get('/api/v1/transport/requests/me')
      .then(r => setRequests(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!kind) return;
    setSending(true); setError(''); setDone(null);
    try {
      const body = {
        kind, pickup_address: form.pickup_address, destination: form.destination,
        scheduled_for: kind === 'emergency' ? null : new Date(form.scheduled_for).toISOString(),
        mobility_needs: form.mobility_needs || null, companion: form.companion, notes: form.notes || null,
      };
      const r = await api.post('/api/v1/transport/requests', body);
      setDone(r.data); setKind(null);
      setForm(f => ({ ...f, pickup_address: '', destination: '', mobility_needs: '', notes: '' }));
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível registar o pedido.'));
    } finally { setSending(false); }
  };

  const cancel = async (id: string) => {
    try { await api.post(`/api/v1/transport/requests/${id}/cancel`); load(); }
    catch (err) { setError(apiErrorMessage(err, 'Não foi possível cancelar.')); }
  };

  const selected = KINDS.find(k => k.kind === kind);

  return (
    <>
      <section className="lms-greet">
        <h1>Transporte e ambulância</h1>
        <p>Peça o caminho até ao cuidado: agendado, acessível, assistido ou de emergência.</p>
      </section>

      <div className="lms-card" style={{ marginBottom: '2rem', borderColor: '#f3a1a1' }}>
        <div className="lms-card__ico" style={{ background: '#fde8e8' }}><Phone /></div>
        <div>
          <h3>Risco de vida? Ligue 112.</h3>
          <p>O pedido de emergência no KAYA avisa a rede e o hospital de destino, mas não substitui a chamada de emergência.</p>
          <a href="tel:112">Ligar 112 <ArrowRight size={20} /></a>
        </div>
      </div>

      <h2 className="lms-h2">Que transporte precisa?</h2>
      <div className="lms-strip" style={{ marginBottom: '1.5rem' }}>
        <div className="lms-strip__page" style={{ display: 'grid' }}>
          {KINDS.map(k => (
            <button key={k.kind} className="lms-tile" onClick={() => { setKind(k.kind); setDone(null); setError(''); }} aria-pressed={kind === k.kind}>
              <span className="lms-tile__sq" style={{ background: k.color, outline: kind === k.kind ? '3px solid #1a1a1a' : 'none', outlineOffset: 3 }}><k.icon /></span>
              <span className="lms-tile__label">{k.label}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <form onSubmit={submit} className="lms-card" style={{ display: 'block', padding: '1.4rem 1.2rem', marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0 }}>{selected.label}</h3>
          <p>{selected.desc}</p>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <label className="lms-field">
              <span>Local de recolha</span>
              <input required value={form.pickup_address} onChange={e => setForm({ ...form, pickup_address: e.target.value })} placeholder="Rua, bairro, município" />
            </label>
            <label className="lms-field">
              <span>Destino</span>
              <input required value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder="Clínica, hospital ou casa" />
            </label>
            {selected.kind !== 'emergency' && (
              <label className="lms-field">
                <span>Data e hora</span>
                <input type="datetime-local" required value={form.scheduled_for} onChange={e => setForm({ ...form, scheduled_for: e.target.value })} />
              </label>
            )}
            <label className="lms-field">
              <span>Necessidades de mobilidade</span>
              <input value={form.mobility_needs} onChange={e => setForm({ ...form, mobility_needs: e.target.value })} placeholder="Cadeira de rodas, maca, oxigénio…" />
            </label>
            <label className="lms-check">
              <input type="checkbox" checked={form.companion} onChange={e => setForm({ ...form, companion: e.target.checked })} />
              <span>Vou com acompanhante</span>
            </label>
            <label className="lms-field">
              <span>Notas</span>
              <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Algo que o operador deva saber" />
            </label>
          </div>
          {error && <p style={{ color: '#b42318', marginTop: '1rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginTop: '1.2rem', flexWrap: 'wrap' }}>
            <button type="submit" className="lms-btn" disabled={sending}>{sending ? 'A enviar…' : selected.kind === 'emergency' ? 'Enviar pré-alerta' : 'Pedir transporte'}</button>
            <button type="button" className="lms-link" onClick={() => setKind(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {done && (
        <div className="lms-card" style={{ marginBottom: '2rem', borderColor: '#9fd0ea' }}>
          <div className="lms-card__ico"><Ambulance /></div>
          <div>
            <h3>{done.kind === 'emergency' ? 'Pré-alerta enviado' : 'Pedido registado'}</h3>
            <p>{done.guidance || `${done.kind_label} para ${done.destination}. Vai receber a confirmação do operador nas notificações.`}</p>
          </div>
        </div>
      )}

      <h2 className="lms-h2">Os meus pedidos</h2>
      {loading ? <p>A carregar…</p> : requests.length === 0 ? (
        <p style={{ color: 'var(--lms-mute)' }}>Ainda não tem pedidos de transporte.</p>
      ) : (
        <ul className="lms-feat">
          {requests.map(r => (
            <li key={r.id} className="lms-card">
              <div className="lms-card__ico">{r.kind === 'emergency' ? <Siren /> : r.kind === 'accessible' ? <Accessibility /> : r.kind === 'assisted' ? <Ambulance /> : <CalendarClock />}</div>
              <div>
                <h3>{r.kind_label}</h3>
                <div className="lms-card__meta">{STATUS_PT[r.status] || r.status}{r.scheduled_for ? ` · ${new Date(r.scheduled_for).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}` : ''}</div>
                <p>{r.pickup_address} → {r.destination}{r.mobility_needs ? ` · ${r.mobility_needs}` : ''}{r.companion ? ' · com acompanhante' : ''}</p>
                {(r.status === 'requested' || r.status === 'confirmed') && (
                  <button className="lms-link" onClick={() => cancel(r.id)}>Cancelar pedido <ArrowRight size={20} /></button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
