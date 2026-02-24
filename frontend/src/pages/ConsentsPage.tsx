import { useEffect, useState } from 'react';
import api from '../api';
import type { Consent } from '../types';
import { Shield, CheckCircle2, Plus } from 'lucide-react';

export default function ConsentsPage() {
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [consentType, setConsentType] = useState('');
  const [msg, setMsg] = useState('');

  const consentTypes = [
    'Partilha de Dados Clínicos',
    'Teleconsulta',
    'Prescrição Digital',
    'Notificações de Saúde',
    'Investigação Clínica',
  ];

  useEffect(() => {
    api.get('/api/v1/patients/me/consents')
      .then(r => setConsents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const addConsent = async () => {
    if (!consentType) return;
    setAdding(true); setMsg('');
    try {
      const r = await api.post('/api/v1/patients/me/consents', { consent_type: consentType });
      setConsents(c => [...c, r.data]);
      setConsentType('');
      setMsg('Consentimento registado.');
    } catch (err: any) {
      setMsg(err.response?.data?.detail || 'Erro ao registar.');
    }
    setAdding(false);
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h1>Consentimentos</h1>
        <p>Gerir os seus consentimentos e autorizações de saúde</p>
      </div>

      {/* Add consent */}
      <div className="card" style={{ maxWidth: '600px', marginBottom: '1.25rem' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} style={{ color: 'var(--accent-teal)' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Novo Consentimento</h3>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Tipo de Consentimento</label>
            <select className="form-select" value={consentType} onChange={e => setConsentType(e.target.value)}>
              <option value="">Selecionar</option>
              {consentTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={addConsent} disabled={adding || !consentType}>
            {adding ? 'A registar…' : 'Aceitar'}
          </button>
        </div>
        {msg && <p style={{ padding: '0 1.25rem 1rem', fontSize: '0.82rem', color: 'var(--accent-green)' }}>{msg}</p>}
      </div>

      {/* List */}
      <div className="card" style={{ maxWidth: '600px' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={18} style={{ color: 'var(--accent-teal)' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Consentimentos Ativos</h3>
        </div>
        {consents.length === 0 ? (
          <div className="empty-state" style={{ padding: '2.5rem' }}>
            <div className="empty-state-icon"><Shield size={24} style={{ color: 'var(--accent-teal)' }} /></div>
            <div className="empty-state-title">Sem consentimentos</div>
            <div className="empty-state-desc">Adicione os consentimentos necessários para usufruir de todos os serviços.</div>
          </div>
        ) : (
          <div style={{ padding: '0.75rem 0' }}>
            {consents.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)',
              }}>
                <CheckCircle2 size={18} style={{ color: '#22c55e', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{c.consent_type}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Aceite em {new Date(c.accepted_at).toLocaleDateString('pt')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
