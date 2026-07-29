import { useEffect, useState } from 'react';
import { Camera, ImagePlus, ShieldCheck, TriangleAlert } from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import { apiErrorMessage } from '../utils/apiError';

interface TriagePhoto {
  id: string;
  view_type: 'orientation' | 'context' | 'closeup';
  content_url: string;
  technical_check?: { issues?: string[] };
}

interface ReviewPhoto extends TriagePhoto {
  objectUrl: string;
}

interface PhotoRequest {
  id: string;
  view_type: 'orientation' | 'context' | 'closeup';
  message?: string;
  status: 'requested' | 'fulfilled';
}

const VIEW_KEYS = {
  orientation: 'triage.photo_orientation',
  context: 'triage.photo_context',
  closeup: 'triage.photo_closeup',
} as const;

export default function TriagePhotoReview({ triageId }: { triageId: string }) {
  const { t } = useT();
  const [photos, setPhotos] = useState<ReviewPhoto[]>([]);
  const [requests, setRequests] = useState<PhotoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [requestView, setRequestView] = useState<PhotoRequest['view_type']>('closeup');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestError, setRequestError] = useState('');

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    setLoading(true);
    Promise.resolve()
      .then(async () => {
        const [metadata, requestData] = await Promise.all([
          api.get<TriagePhoto[]>(`/api/v1/triage/${triageId}/photos`),
          api.get<PhotoRequest[]>(`/api/v1/triage/${triageId}/photo-requests`),
        ]);
        const loaded = await Promise.all(metadata.data.map(async photo => {
          const content = await api.get(photo.content_url, { responseType: 'blob' });
          const objectUrl = URL.createObjectURL(content.data);
          objectUrls.push(objectUrl);
          return { ...photo, objectUrl };
        }));
        if (active) {
          setPhotos(loaded);
          setRequests(requestData.data);
        }
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

  const submitRequest = async () => {
    setRequesting(true);
    setRequestError('');
    try {
      const response = await api.post<PhotoRequest>(
        `/api/v1/triage/${triageId}/photo-requests`,
        { view_type: requestView, message: requestMessage.trim() || undefined },
      );
      setRequests(current => [
        response.data,
        ...current.filter(item => item.id !== response.data.id),
      ]);
      setRequestMessage('');
    } catch (error: any) {
      setRequestError(apiErrorMessage(error, t('triage.photo_request_error')));
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{t('triage.photo_review_loading')}</div>;
  }
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
      {photos.length > 0 ? (
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
      ) : (
        <p className="triage-photo-review__empty">{t('triage.photo_review_empty')}</p>
      )}
      <div className="triage-photo-review__request">
        <div className="triage-photo-review__request-title">
          <ImagePlus size={14} />
          <strong>{t('triage.photo_request_title')}</strong>
        </div>
        {requests.filter(request => request.status === 'requested').map(request => (
          <div className="triage-photo-review__request-pending" key={request.id}>
            {t(VIEW_KEYS[request.view_type])}
            {request.message ? ` — ${request.message}` : ''}
          </div>
        ))}
        <div className="triage-photo-review__request-form">
          <select
            className="form-select"
            value={requestView}
            onChange={event => setRequestView(event.target.value as PhotoRequest['view_type'])}
          >
            {(Object.keys(VIEW_KEYS) as PhotoRequest['view_type'][]).map(view => (
              <option key={view} value={view}>{t(VIEW_KEYS[view])}</option>
            ))}
          </select>
          <input
            className="form-input"
            maxLength={500}
            placeholder={t('triage.photo_request_placeholder')}
            value={requestMessage}
            onChange={event => setRequestMessage(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={requesting}
            onClick={() => void submitRequest()}
          >
            {requesting ? t('triage.photo_request_sending') : t('triage.photo_request_send')}
          </button>
        </div>
        {requestError && <div className="triage-photo-guide__error">{requestError}</div>}
      </div>
    </section>
  );
}
