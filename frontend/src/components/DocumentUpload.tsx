import { useRef, useState } from 'react';
import { Camera, Check, FileText, Loader2, Upload, X } from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';

interface Props {
  /** Backend evidence kind — e.g. "professional_card", "diploma", "insurance". */
  kind: string;
  /** Optional human label; defaults to i18n(`doc.${kind}`) if present. */
  label?: string;
  helper?: string;
  /** Called once the file uploads successfully. Receives the server response body. */
  onUploaded?: (payload: unknown) => void;
  /** Currently uploaded filename, if any — shows a green "already uploaded" state. */
  currentFilename?: string | null;
  /** Optional accept override — default: PDF + common image formats. */
  accept?: string;
  /** Max size in bytes — default 10 MB matches backend. */
  maxBytes?: number;
}

const DEFAULT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/heic,image/heif';
const DEFAULT_MAX = 10 * 1024 * 1024;

export default function DocumentUpload({
  kind, label, helper, onUploaded, currentFilename,
  accept = DEFAULT_ACCEPT, maxBytes = DEFAULT_MAX,
}: Props) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(currentFilename ?? null);
  const [error, setError] = useState<string | null>(null);

  const send = async (file: File) => {
    setError(null);
    if (file.size > maxBytes) {
      setError(t('doc.too_large'));
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post(
        `/api/v1/credentials/me/evidence/${kind}`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setUploaded(file.name);
      onUploaded?.(res.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err.response?.data?.detail || err.message || t('doc.upload_failed'));
    } finally {
      setUploading(false);
    }
  };

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) send(file);
    e.target.value = ''; // allow re-pick of same file
  };

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '1rem',
        background: uploaded ? 'rgba(16,185,129,0.06)' : 'var(--bg-primary)',
        marginBottom: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: uploaded ? 'rgba(16,185,129,0.15)' : 'rgba(15,118,110,0.08)',
          color: uploaded ? '#059669' : 'var(--brand-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {uploaded ? <Check size={18} /> : <FileText size={18} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            {label ?? t(`doc.${kind}`)}
          </div>
          {helper && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {helper}
            </div>
          )}
          {uploaded && (
            <div style={{
              marginTop: '0.35rem',
              fontSize: '0.8rem',
              color: '#059669',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Check size={14} /> {uploaded}
            </div>
          )}
          {error && (
            <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#dc2626' }}>
              {error}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
          {uploaded ? t('doc.replace') : t('doc.upload')}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Camera size={14} /> {t('doc.take_photo')}
        </button>
        {uploaded && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { setUploaded(null); setError(null); }}
            disabled={uploading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}
          >
            <X size={14} /> {t('common.remove')}
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        onChange={onFilePick}
        style={{ display: 'none' }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFilePick}
        style={{ display: 'none' }}
      />
    </div>
  );
}
