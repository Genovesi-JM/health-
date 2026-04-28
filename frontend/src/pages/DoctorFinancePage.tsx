import { DollarSign, TrendingUp, Clock, ArrowDownRight, ArrowUpRight } from 'lucide-react';

const KPI = [
  { label: 'Receita hoje',       value: '12.500 Kz', sub: '5 consultas',        icon: <DollarSign size={18} />, color: '#059669' },
  { label: 'Receita este mês',   value: '185.000 Kz', sub: '+12% vs mês anterior', icon: <TrendingUp size={18} />, color: '#3b82f6' },
  { label: 'Pagamentos pendentes', value: '34.000 Kz', sub: '3 consultas',      icon: <Clock size={18} />,      color: '#d97706' },
  { label: 'Taxa da plataforma', value: '18.500 Kz',  sub: '10% do total',      icon: <ArrowDownRight size={18} />, color: '#6366f1' },
];

const TRANSACTIONS = [
  { id: 'tx1', patient: 'Carlos Manuel Pinto',   type: 'Teleconsulta',  amount: '2.500 Kz', date: '14/04/2026', status: 'Pago'      },
  { id: 'tx2', patient: 'Maria Fernanda Santos', type: 'Presencial',    amount: '3.000 Kz', date: '12/04/2026', status: 'Pago'      },
  { id: 'tx3', patient: 'Beatriz Maria Lima',    type: 'Teleconsulta',  amount: '2.500 Kz', date: '10/04/2026', status: 'Pendente'  },
  { id: 'tx4', patient: 'José Eduardo Almeida',  type: 'Presencial',    amount: '4.000 Kz', date: '08/04/2026', status: 'Pendente'  },
  { id: 'tx5', patient: 'Sofia Beatriz Costa',   type: 'Teleconsulta',  amount: '2.500 Kz', date: '05/04/2026', status: 'Pago'      },
];

export default function DoctorFinancePage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <DollarSign size={20} style={{ color: '#059669' }} /> Financeiro
      </h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {KPI.map(k => (
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

      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.88rem' }}>Transacções Recentes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {TRANSACTIONS.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.7rem 0', borderBottom: i < TRANSACTIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.patient}</div>
                <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>{t.type} · {t.date}</div>
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.amount}</span>
              <span style={{ padding: '0.2rem 0.65rem', borderRadius: 999, fontSize: '0.73rem', fontWeight: 700,
                background: t.status === 'Pago' ? 'rgba(16,185,129,0.1)' : 'rgba(234,179,8,0.1)',
                color: t.status === 'Pago' ? '#059669' : '#d97706' }}>{t.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
