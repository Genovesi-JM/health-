import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { useT } from '../i18n/LanguageContext';

type Stage = 'idle' | 'setup' | 'recovery';

export default function SecurityMfaPage() {
  const { t } = useT();
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [mandatory, setMandatory] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  // Read the authoritative MFA posture from the backend.
  useEffect(() => {
    api.get('/auth/mfa/status')
      .then(res => {
        setEnabled(Boolean(res.data.enabled));
        setMandatory(Boolean(res.data.mandatory));
      })
      .catch(() => {
        // Fallback: infer mandatory from role if the call fails.
        const role = user?.role || '';
        setMandatory(['doctor', 'nurse', 'pharmacist', 'admin', 'compliance_reviewer', 'corporate_admin'].includes(role));
      });
  }, [user]);

  const startSetup = async () => {
    setBusy(true); setError('');
    try {
      const res = await api.post('/auth/mfa/setup');
      setSecret(res.data.secret);
      setStage('setup');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao iniciar configuração.');
    } finally { setBusy(false); }
  };

  const confirmSetup = async () => {
    setBusy(true); setError('');
    try {
      const res = await api.post('/auth/mfa/verify', { code: code.trim() });
      setRecoveryCodes(res.data.recovery_codes || []);
      setEnabled(true);
      setStage('recovery');
      setCode('');
    } catch (e: any) {
      setError(e.response?.data?.detail || t('mfa.invalid_code'));
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setError('');
    try {
      await api.post('/auth/mfa/disable', { code: disableCode.trim() });
      setEnabled(false);
      setStage('idle');
      setDisableCode('');
    } catch (e: any) {
      setError(e.response?.data?.detail || t('mfa.invalid_code'));
    } finally { setBusy(false); }
  };

  const regen = async () => {
    setBusy(true); setError('');
    try {
      const res = await api.post('/auth/mfa/recovery-codes', { code: disableCode.trim() });
      setRecoveryCodes(res.data.recovery_codes || []);
      setStage('recovery');
      setDisableCode('');
    } catch (e: any) {
      setError(e.response?.data?.detail || t('mfa.invalid_code'));
    } finally { setBusy(false); }
  };

  const copyKey = () => {
    navigator.clipboard?.writeText(secret).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={22} style={{ color: 'var(--brand-primary)' }} /> {t('mfa.title')}
      </h1>
      <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
        {t('mfa.subtitle')}
      </p>

      {mandatory && !enabled && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '1rem',
          background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', color: '#a16207', fontSize: '0.85rem' }}>
          {t('mfa.mandatory_notice')}
        </div>
      )}

      <div className="card" style={{ padding: '1.25rem' }}>
        {/* Status row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: stage === 'idle' ? 0 : '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            {enabled ? <ShieldCheck size={18} style={{ color: '#059669' }} /> : <ShieldOff size={18} style={{ color: 'var(--text-muted)' }} />}
            TOTP
            <span style={{ padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
              background: enabled ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
              color: enabled ? '#047857' : '#64748b' }}>
              {enabled ? t('mfa.enabled_badge') : t('mfa.disabled_badge')}
            </span>
          </div>
          {stage === 'idle' && !enabled && (
            <button className="btn btn-primary btn-sm" onClick={startSetup} disabled={busy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {busy && <Loader2 size={14} className="spin" />} {t('mfa.start_setup')}
            </button>
          )}
        </div>

        {/* Setup flow */}
        {stage === 'setup' && (
          <>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 6 }}>{t('mfa.step_scan')}</div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: 0 }}>{t('mfa.scan_help')}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '1.25rem' }}>
              <code style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: 8, background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', fontSize: '0.95rem', letterSpacing: '0.12em', wordBreak: 'break-all' }}>
                {secret}
              </code>
              <button className="btn btn-ghost btn-sm" onClick={copyKey} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t('mfa.copied') : t('mfa.copy_key')}
              </button>
            </div>

            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 6 }}>{t('mfa.step_confirm')}</div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: 0 }}>{t('mfa.confirm_help')}</p>
            <input
              inputMode="numeric"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="123456"
              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)',
                fontSize: '1.1rem', letterSpacing: '0.3em', textAlign: 'center', marginBottom: 12 }}
            />
            {error && <div style={{ color: '#dc2626', fontSize: '0.83rem', marginBottom: 10 }}>{error}</div>}
            <button className="btn btn-primary" onClick={confirmSetup} disabled={busy || code.trim().length < 6}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {busy && <Loader2 size={14} className="spin" />} {t('mfa.confirm')}
            </button>
          </>
        )}

        {/* Recovery codes display */}
        {stage === 'recovery' && (
          <>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <KeyRound size={16} /> {t('mfa.recovery_title')}
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: 0 }}>{t('mfa.recovery_help')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: '1rem' }}>
              {recoveryCodes.map(rc => (
                <code key={rc} style={{ padding: '0.5rem 0.7rem', borderRadius: 6, background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)', fontSize: '0.9rem', textAlign: 'center', letterSpacing: '0.08em' }}>
                  {rc}
                </code>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => setStage('idle')}>{t('mfa.recovery_saved')}</button>
          </>
        )}

        {/* Enabled management */}
        {stage === 'idle' && enabled && (
          <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: 0 }}>{t('mfa.disable_confirm')}</p>
            <input
              inputMode="numeric"
              value={disableCode}
              onChange={e => setDisableCode(e.target.value)}
              placeholder="123456"
              style={{ width: '100%', padding: '0.55rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)',
                fontSize: '1rem', letterSpacing: '0.2em', textAlign: 'center', marginBottom: 10 }}
            />
            {error && <div style={{ color: '#dc2626', fontSize: '0.83rem', marginBottom: 10 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={regen} disabled={busy || disableCode.trim().length < 6}>
                {t('mfa.regen')}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={disable} disabled={busy || disableCode.trim().length < 6}
                style={{ color: '#b91c1c' }}>
                {t('mfa.disable')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
