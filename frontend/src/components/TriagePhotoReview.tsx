import { useEffect, useState } from 'react';
import { Camera, ShieldCheck, TriangleAlert } from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';

interface TriagePhoto {
  id: string;
  view_type: 'orientation' | 'context' | 'closeup';
  content_url: string;
  technical_check?: { issues?: string[] };
}

interface ReviewPhoto extends TriagePhoto {
  objectUrl: string;
}

const VIEW_KEYS = {
  orientation: 'triage.photo_orientation',
  context: 'triage.photo_context',
  closeup: 'triage.photo_closeup',
} as const;

export default function TriagePhotoReview({ triageId }: { triageId: string }) {
  const { t } = useT();
  const [photos, setPhotos] = useState<ReviewPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    setLoading(true);
    Promise.resolve()
      .then(async () => {
        const metadata = await api.get<TriagePhoto[]>(`/api/v1/triage/${triageId}/photos`);
        const loaded = await Promise.all(metadata.data.map(async photo => {
          const content = await api.get(photo.content_url, { responseType: 'blob' });
          const objectUrl = URL.createObjectURL(content.data);
          objectUrls.push(objectUrl);
          return { ...photo, objectUrl };
        }));
        if (active) setPhotos(loaded);
      })
      .catch(() => {
        if (active) setPhotos([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      objectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [triageId]);

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{t('triage.photo_review_loading')}</div>;
  }
  if (!photos.length) return null;

  return (
    <section className="triage-photo-review">
      <div className="triage-photo-review__title">
        <Camera size={15} />
        <strong>{t('triage.photo_review_title')}</strong>
        <span>{photos.length}</span>
      </div>
      <div className="triage-photo-review__boundary">
        <ShieldCheck size={14} />
        <span>{t('triage.photo_review_boundary')}</span>
      </div>
      <div className="triage-photo-review__grid">
        {photos.map(photo => (
          <figure key={photo.id}>
            <img src={photo.objectUrl} alt={t(VIEW_KEYS[photo.view_type])} />
            <figcaption>{t(VIEW_KEYS[photo.view_type])}</figcaption>
            {Boolean(photo.technical_check?.issues?.length) && (
              <div className="triage-photo-review__warning" title={photo.technical_check?.issues?.join(', ')}>
                <TriangleAlert size={12} /> {t('triage.photo_review_quality')}
              </div>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
