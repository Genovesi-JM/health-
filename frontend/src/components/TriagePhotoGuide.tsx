import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ImagePlus, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import { apiErrorMessage } from '../utils/apiError';

type ViewType = 'orientation' | 'context' | 'closeup';

interface PhotoSlot {
  viewType: ViewType;
  labelKey: string;
  helpKey: string;
}

interface PreparedPhoto {
  blob: Blob;
  previewUrl: string;
  technicalCheck: {
    original_width: number;
    original_height: number;
    sanitized_width: number;
    sanitized_height: number;
    average_brightness: number;
    issues: string[];
    metadata_removed: true;
  };
}

const PHOTO_SLOTS: PhotoSlot[] = [
  { viewType: 'orientation', labelKey: 'triage.photo_orientation', helpKey: 'triage.photo_orientation_help' },
  { viewType: 'context', labelKey: 'triage.photo_context', helpKey: 'triage.photo_context_help' },
  { viewType: 'closeup', labelKey: 'triage.photo_closeup', helpKey: 'triage.photo_closeup_help' },
];

async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = sourceUrl;
    await image.decode();

    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;
    const scale = Math.min(1, 1600 / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('canvas-unavailable');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const sampleCanvas = document.createElement('canvas');
    const sampleWidth = Math.min(160, width);
    const sampleHeight = Math.max(1, Math.round(height * (sampleWidth / width)));
    sampleCanvas.width = sampleWidth;
    sampleCanvas.height = sampleHeight;
    const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sampleContext) throw new Error('canvas-unavailable');
    sampleContext.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
    const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
    let brightnessTotal = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      brightnessTotal += (pixels[i] * 0.299) + (pixels[i + 1] * 0.587) + (pixels[i + 2] * 0.114);
    }
    const averageBrightness = Math.round(brightnessTotal / (pixels.length / 4));
    const issues: string[] = [];
    if (Math.min(originalWidth, originalHeight) < 640) issues.push('low_resolution');
    if (averageBrightness < 45) issues.push('too_dark');
    if (averageBrightness > 235) issues.push('too_bright');

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        value => value ? resolve(value) : reject(new Error('image-encode-failed')),
        'image/jpeg',
        0.88,
      );
    });
    return {
      blob,
      previewUrl: URL.createObjectURL(blob),
      technicalCheck: {
        original_width: originalWidth,
        original_height: originalHeight,
        sanitized_width: width,
        sanitized_height: height,
        average_brightness: averageBrightness,
        issues,
        metadata_removed: true,
      },
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export default function TriagePhotoGuide({ sessionId }: { sessionId: string }) {
  const { t } = useT();
  const [consented, setConsented] = useState(false);
  const [previews, setPreviews] = useState<Partial<Record<ViewType, string>>>({});
  const [photoIds, setPhotoIds] = useState<Partial<Record<ViewType, string>>>({});
  const [warnings, setWarnings] = useState<Partial<Record<ViewType, string[]>>>({});
  const [uploading, setUploading] = useState<ViewType | null>(null);
  const [deleting, setDeleting] = useState<ViewType | null>(null);
  const [error, setError] = useState('');
  const previewRef = useRef(previews);

  useEffect(() => {
    previewRef.current = previews;
  }, [previews]);

  useEffect(() => () => {
    Object.values(previewRef.current).forEach(url => {
      if (url) URL.revokeObjectURL(url);
    });
  }, []);

  const upload = async (slot: PhotoSlot, file?: File) => {
    if (!file || !consented || uploading) return;
    setError('');
    setUploading(slot.viewType);
    try {
      const prepared = await preparePhoto(file);
      const form = new FormData();
      form.append('file', prepared.blob, `${slot.viewType}.jpg`);
      form.append('view_type', slot.viewType);
      form.append('technical_check', JSON.stringify(prepared.technicalCheck));
      const response = await api.post(`/api/v1/triage/${sessionId}/photos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotoIds(current => ({ ...current, [slot.viewType]: response.data.id }));
      setPreviews(current => {
        const previous = current[slot.viewType];
        if (previous) URL.revokeObjectURL(previous);
        return { ...current, [slot.viewType]: prepared.previewUrl };
      });
      setWarnings(current => ({ ...current, [slot.viewType]: prepared.technicalCheck.issues }));
    } catch (uploadError: any) {
      setError(apiErrorMessage(uploadError, t('triage.photo_upload_error')));
    } finally {
      setUploading(null);
    }
  };

  const remove = async (viewType: ViewType) => {
    const photoId = photoIds[viewType];
    if (!photoId || deleting || !window.confirm(t('triage.photo_delete_confirm'))) return;
    setDeleting(viewType);
    setError('');
    try {
      await api.delete(`/api/v1/triage/${sessionId}/photos/${photoId}`);
      setPreviews(current => {
        const preview = current[viewType];
        if (preview) URL.revokeObjectURL(preview);
        const next = { ...current };
        delete next[viewType];
        return next;
      });
      setPhotoIds(current => {
        const next = { ...current };
        delete next[viewType];
        return next;
      });
      setWarnings(current => {
        const next = { ...current };
        delete next[viewType];
        return next;
      });
    } catch (deleteError: any) {
      setError(apiErrorMessage(deleteError, t('triage.photo_delete_error')));
    } finally {
      setDeleting(null);
    }
  };

  const warningLabel = (issue: string) => {
    if (issue === 'too_dark') return t('triage.photo_too_dark');
    if (issue === 'too_bright') return t('triage.photo_too_bright');
    return t('triage.photo_low_resolution');
  };

  return (
    <section className="triage-photo-guide" aria-labelledby="triage-photo-title">
      <div className="triage-photo-guide__heading">
        <div className="triage-photo-guide__icon"><Camera size={20} /></div>
        <div>
          <h4 id="triage-photo-title">{t('triage.photo_title')}</h4>
          <p>{t('triage.photo_intro')}</p>
        </div>
      </div>

      <div className="triage-photo-guide__boundary">
        <ShieldCheck size={17} />
        <span>{t('triage.photo_boundary')}</span>
      </div>

      <label className="triage-photo-guide__consent">
        <input
          type="checkbox"
          checked={consented}
          onChange={event => setConsented(event.target.checked)}
        />
        <span>{t('triage.photo_consent')}</span>
      </label>

      <div className="triage-photo-guide__grid">
        {PHOTO_SLOTS.map((slot, index) => {
          const preview = previews[slot.viewType];
          const slotWarnings = warnings[slot.viewType] || [];
          const isUploading = uploading === slot.viewType;
          const isDeleting = deleting === slot.viewType;
          return (
            <div className="triage-photo-slot" key={slot.viewType}>
              <div className="triage-photo-slot__number">{index + 1}</div>
              {preview ? (
                <img src={preview} alt={t(slot.labelKey)} className="triage-photo-slot__preview" />
              ) : (
                <div className="triage-photo-slot__placeholder"><ImagePlus size={24} /></div>
              )}
              <strong>{t(slot.labelKey)}</strong>
              <span>{t(slot.helpKey)}</span>
              <div className="triage-photo-slot__actions">
                <label className={`btn btn-sm ${preview ? 'btn-outline' : 'btn-primary'} triage-photo-slot__button`}>
                  {preview ? <CheckCircle2 size={14} /> : <Camera size={14} />}
                  {isUploading ? t('triage.photo_uploading') : preview ? t('triage.photo_replace') : t('triage.photo_add')}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    disabled={!consented || Boolean(uploading) || Boolean(deleting)}
                    onChange={event => {
                      void upload(slot, event.target.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {preview && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline triage-photo-slot__delete"
                    disabled={Boolean(uploading) || Boolean(deleting)}
                    onClick={() => void remove(slot.viewType)}
                    title={t('triage.photo_delete')}
                  >
                    <Trash2 size={14} />
                    {isDeleting ? t('triage.photo_deleting') : t('triage.photo_delete')}
                  </button>
                )}
              </div>
              {slotWarnings.length > 0 && (
                <div className="triage-photo-slot__warning">
                  <TriangleAlert size={13} />
                  <span>{slotWarnings.map(warningLabel).join(' · ')}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="triage-photo-guide__optional">{t('triage.photo_optional')}</p>
      {error && <div className="triage-photo-guide__error">{error}</div>}
    </section>
  );
}
