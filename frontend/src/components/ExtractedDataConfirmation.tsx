import { useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export interface ExtractedField {
  key: string;
  label: string;
  extractedValue: string | number | null;
  confidence?: number;  // 0..1
}

interface Props {
  fields: ExtractedField[];
  /** Fires with the final map of confirmed values. Missing keys = user marked incorrect. */
  onConfirm: (values: Record<string, string>) => void;
  onMarkIncorrect: () => void;
}

/**
 * Renders extracted values side-by-side with editable inputs.
 * The user can confirm as-is, correct any value, or mark the whole
 * extraction as wrong (which prompts a re-upload upstream).
 */
export default function ExtractedDataConfirmation({ fields, onConfirm, onMarkIncorrect }: Props) {
  const { t } = useT();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(f => [f.key, f.extractedValue == null ? '' : String(f.extractedValue)]))
  );

  const setField = (key: string, value: string) => setValues(prev => ({ ...prev, [key]: value }));

  const anyLowConfidence = fields.some(f => (f.confidence ?? 1) < 0.7);

  return (
    <div>
      <div style={{
        padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '1rem',
        background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.2)',
        fontSize: '0.85rem', lineHeight: 1.5,
      }}>
        {t('extract.review_prompt')}
        {anyLowConfidence && (
          <div style={{ marginTop: '0.35rem', color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} /> {t('extract.low_confidence_warning')}
          </div>
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'left' }}>
            <th style={{ padding: '0.4rem 0', fontWeight: 600 }}>{t('extract.field')}</th>
            <th style={{ padding: '0.4rem 0', fontWeight: 600 }}>{t('extract.extracted')}</th>
            <th style={{ padding: '0.4rem 0', fontWeight: 600 }}>{t('extract.corrected')}</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(f => {
            const conf = f.confidence ?? 1;
            const confPct = Math.round(conf * 100);
            return (
              <tr key={f.key} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '0.6rem 0', fontSize: '0.85rem', fontWeight: 600 }}>
                  {f.label}
                </td>
                <td style={{ padding: '0.6rem 0.5rem 0.6rem 0', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>{f.extractedValue ?? '—'}</div>
                  <div style={{
                    fontSize: '0.72rem',
                    color: conf < 0.7 ? '#d97706' : 'var(--text-muted)',
                    marginTop: 2,
                  }}>
                    {t('extract.confidence')}: {confPct}%
                  </div>
                </td>
                <td style={{ padding: '0.6rem 0' }}>
                  <input
                    type="text"
                    value={values[f.key] ?? ''}
                    onChange={e => setField(f.key, e.target.value)}
                    style={{
                      width: '100%', padding: '0.4rem 0.6rem', borderRadius: 6,
                      border: '1px solid var(--border)', fontSize: '0.85rem',
                      background: 'var(--bg-primary)', color: 'var(--text-primary)',
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onConfirm(values)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Check size={14} /> {t('extract.confirm')}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onMarkIncorrect}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#dc2626' }}
        >
          <X size={14} /> {t('extract.mark_incorrect')}
        </button>
      </div>
    </div>
  );
}
