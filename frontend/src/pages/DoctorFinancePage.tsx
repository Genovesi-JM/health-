import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Clock, ArrowDownRight } from 'lucide-react';
import api from '../api';

interface Kpis {
  today: { amount: string; count: number };
  month: { amount: string; count: number };
  pending: { amount: string };
  platform_fee: { amount: string; rate: string };
  net_total: { amount: string };
}
interface Tx { id: string; patient: string; type: string; amount: string; date: string; status: string; }

export default function DoctorFinancePage() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/v1/doctor/finance')
      .then(r => { setKpis(r.data.kpis); setTxs(r.data.transactions || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = kpis ? [
    { label: 'Receita hoje',        value: kpis.today.amount,   sub: `${kpis.today.count} consulta${kpis.today.count !== 1 ? 's' : ''}`, icon: <DollarSign size={18} />,   color: '#059669' },
    { label: 'Receita este mês',    value: kpis.month.amount,   sub: `${kpis.month.count} consulta${kpis.month.count !== 1 ? 's' : ''}`, icon: <TrendingUp size={18} />,   color: '#3b82f6' },
    { label: 'Pagamentos pendentes', value: kpis.pending.amount, sub: 'A aguardar confirmação',                                          icon: <Clock size={18} />,        color: '#d97706' },
    { label: 'Taxa da plataforma',  value: kpis.platform_fee.amount, sub: kpis.platform_fee.rate,                                        icon: <ArrowDownRight size={18} />, color: '#6366f1' },
  ] : [];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <DollarSign size={20} style={{ color: '#059669' }} /> Financeiro
      </h1>

      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {cards.map(k => (
              <div key={k.label} className="card" style={{ padding: '1.1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</span>
                  <span style={{ color: k.color }}>{k.icon}</span>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {kpis && (
            <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.06)' }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Líquido a receber (após taxa)</span>
              <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#059669' }}>{kpis.net_total.amount}</span>
            </div>
          )}

          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.88rem' }}>Transacções Recentes</div>
            {txs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0', textAlign: 'center' }}>
                Ainda não há transacções. Aparecem aqui quando os pacientes pagam as consultas.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {txs.map((t, i) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.7rem 0', borderBottom: i < txs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.patient}</div>
                      <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{t.type} · {t.date}</div>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.amount}</span>
                    <span style={{ padding: '0.2rem 0.65rem', borderRadius: 999, fontSize: '0.73rem', fontWeight: 700,
                      background: t.status === 'Pago' ? 'rgba(16,185,129,0.1)' : 'rgba(234,179,8,0.1)',
                      color: t.status === 'Pago' ? '#059669' : '#d97706' }}>{t.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
