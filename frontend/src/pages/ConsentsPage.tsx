import { useEffect, useState } from 'react';
import api from '../api';
import type { Consent } from '../types';
import { Shield, CheckCircle2, Plus } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

const LOCALE_MAP: Record<string, string> = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR' };

export default function ConsentsPage() {
  const { t, lang } = useT();
  const locale = LOCALE_MAP[lang] || 'pt-PT';
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [consentType, setConsentType] = useState('');
  const [msg, setMsg] = useState('');

  const consentTypes = [
    { value: 'Partilha de Dados Clínicos', label: t('consents.type_data') },
    { value: 'Teleconsulta', label: t('consents.type_teleconsult') },
    { value: 'Prescrição Digital', label: t('consents.type_prescription') },
    { value: 'Notificações de Saúde', label: t('consents.type_notifications') },
    { value: 'Investigação Clínica', label: t('consents.type_research') },
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
      setMsg(t('consents.registered'));
    } catch (err: any) {
      setMsg(err.response?.data?.detail || t('common.error'));
    }
    setAdding(false);
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <>
      <div className="page-header">
        <h1>{t('consents.title')}</h1>
        <p>{t('consents.subtitle')}</p>
      </div>

      {/* Add consent */}
      <div className="card" style={{ maxWidth: '600px', marginBottom: '1.25rem' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} style={{ color: 'var(--accent-teal)' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('consents.new')}</h3>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">{t('consents.type')}</label>
            <select className="form-select" value={consentType} onChange={e => setConsentType(e.target.value)}>
              <option value="">{t('consents.select')}</option>
              {consentTypes.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={addConsent} disabled={adding || !consentType}>
            {adding ? t('consents.accepting') : t('consents.accept')}
          </button>
        </div>
        {msg && <p style={{ padding: '0 1.25rem 1rem', fontSize: '0.82rem', color: 'var(--accent-green)' }}>{msg}</p>}
      </div>

      {/* List */}
      <div className="card" style={{ maxWidth: '600px' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={18} style={{ color: 'var(--accent-teal)' }} />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('consents.active')}</h3>
        </div>
        {consents.length === 0 ? (
          <div className="empty-state" style={{ padding: '2.5rem' }}>
            <div className="empty-state-icon"><Shield size={24} style={{ color: 'var(--accent-teal)' }} /></div>
            <div className="empty-state-title">{t('consents.none')}</div>
            <div className="empty-state-desc">{t('consents.none_desc')}</div>
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
                    {t('consents.accepted_at')} {new Date(c.accepted_at).toLocaleDateString(locale)}
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
