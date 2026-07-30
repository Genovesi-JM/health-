import { useEffect, useState } from 'react';
import { Camera, CheckCircle2, Loader2, Mic, Play, ShieldCheck, Video } from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';

type Session = {
  id: string;
  consultation_id: string;
  provider: string;
  provider_mode: string;
  status: string;
  preflight: Record<string, boolean>;
  preflight_complete: boolean;
  preflight_note?: string | null;
  participants: Array<{
    user_id?: string; role: string; camera_ready: boolean; microphone_ready: boolean;
    network_quality?: string | null; checked_in_at?: string | null;
  }>;
  provider_notice: string;
};

const words = {
  pt: {
    title: 'Preparação da teleconsulta', subtitle: 'Check-in, segurança e prontidão antes de abrir a sala.',
    prepare: 'Preparar sala', device: 'Testar câmara e microfone', deviceReady: 'Dispositivo pronto',
    checkin: 'Fazer check-in', checked: 'Check-in concluído', start: 'Iniciar teleconsulta',
    enter: 'Entrar na sala', save: 'Guardar checklist', identity: 'Identidade confirmada',
    consent: 'Consentimento confirmado', vitals: 'Sinais vitais revistos', medication: 'Medicação revista',
    summary: 'Resumo clínico pronto', pilot: 'Fornecedor piloto', waiting: 'A aguardar participantes',
    notPrepared: 'A equipa clínica ainda não preparou esta sala. Volte a tentar perto da hora marcada.',
    error: 'Não foi possível atualizar a teleconsulta.',
  },
  en: {
    title: 'Teleconsultation preparation', subtitle: 'Check-in, safety, and readiness before opening the room.',
    prepare: 'Prepare room', device: 'Test camera and microphone', deviceReady: 'Device ready',
    checkin: 'Check in', checked: 'Check-in complete', start: 'Start teleconsultation',
    enter: 'Enter room', save: 'Save checklist', identity: 'Identity confirmed',
    consent: 'Consent confirmed', vitals: 'Vitals reviewed', medication: 'Medication reviewed',
    summary: 'Clinical summary ready', pilot: 'Pilot provider', waiting: 'Waiting for participants',
    notPrepared: 'The clinical team has not prepared this room yet. Try again near the scheduled time.',
    error: 'The teleconsultation could not be updated.',
  },
  fr: {
    title: 'Préparation de la téléconsultation', subtitle: 'Enregistrement, sécurité et préparation avant l’ouverture de la salle.',
    prepare: 'Préparer la salle', device: 'Tester caméra et microphone', deviceReady: 'Appareil prêt',
    checkin: 'S’enregistrer', checked: 'Enregistrement terminé', start: 'Démarrer la téléconsultation',
    enter: 'Entrer dans la salle', save: 'Enregistrer la checklist', identity: 'Identité confirmée',
    consent: 'Consentement confirmé', vitals: 'Constantes vérifiées', medication: 'Médicaments vérifiés',
    summary: 'Résumé clinique prêt', pilot: 'Fournisseur pilote', waiting: 'En attente des participants',
    notPrepared: 'L’équipe clinique n’a pas encore préparé cette salle. Réessayez à l’approche du rendez-vous.',
    error: 'Impossible de mettre à jour la téléconsultation.',
  },
  es: {
    title: 'Preparación de la teleconsulta', subtitle: 'Registro, seguridad y preparación antes de abrir la sala.',
    prepare: 'Preparar sala', device: 'Probar cámara y micrófono', deviceReady: 'Dispositivo listo',
    checkin: 'Registrarse', checked: 'Registro completado', start: 'Iniciar teleconsulta',
    enter: 'Entrar en la sala', save: 'Guardar checklist', identity: 'Identidad confirmada',
    consent: 'Consentimiento confirmado', vitals: 'Signos vitales revisados', medication: 'Medicación revisada',
    summary: 'Resumen clínico listo', pilot: 'Proveedor piloto', waiting: 'Esperando participantes',
    notPrepared: 'El equipo clínico aún no ha preparado esta sala. Inténtelo cerca de la hora programada.',
    error: 'No se pudo actualizar la teleconsulta.',
  },
  zh: {
    title: '远程问诊准备', subtitle: '进入诊室前完成签到、安全确认及设备检查。',
    prepare: '准备诊室', device: '测试摄像头和麦克风', deviceReady: '设备已就绪',
    checkin: '签到', checked: '签到完成', start: '开始远程问诊',
    enter: '进入诊室', save: '保存检查表', identity: '身份已确认',
    consent: '同意已确认', vitals: '生命体征已复核', medication: '用药已复核',
    summary: '临床摘要已准备', pilot: '试点服务商', waiting: '等待参与者',
    notPrepared: '临床团队尚未准备此诊室。请在预约时间临近时重试。',
    error: '无法更新远程问诊。',
  },
};

const PREVIEW_SESSION: Session = {
  id: 'preview-session',
  consultation_id: 'consult-preview',
  provider: 'jitsi_pilot',
  provider_mode: 'pilot',
  status: 'waiting',
  preflight: {
    identity_confirmed: true,
    consent_confirmed: true,
    vitals_reviewed: true,
    medication_reviewed: false,
    clinical_summary_ready: true,
  },
  preflight_complete: false,
  participants: [
    { role: 'patient', camera_ready: true, microphone_ready: true, network_quality: 'good', checked_in_at: new Date().toISOString() },
    { role: 'nurse', camera_ready: true, microphone_ready: true, network_quality: 'excellent', checked_in_at: new Date().toISOString() },
  ],
  provider_notice: 'Sala piloto. Não utilizar como integração de vídeo certificada em produção.',
};

export default function TeleconsultationControl({
  consultationId,
  role,
  preview = false,
}: {
  consultationId: string;
  role: 'doctor' | 'nurse' | 'patient';
  preview?: boolean;
}) {
  const { lang } = useT();
  const c = words[lang as keyof typeof words] || words.en;
  const [session, setSession] = useState<Session | null>(preview ? PREVIEW_SESSION : null);
  const [deviceReady, setDeviceReady] = useState(preview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (preview) return;
    try {
      const response = await api.get(`/api/v1/teleconsultations/${consultationId}`);
      setSession(response.data);
    } catch (requestError: any) {
      if (requestError?.response?.status !== 404) setError(c.error);
    }
  };

  useEffect(() => { void load(); }, [consultationId, preview]);

  const prepare = async () => {
    setBusy(true); setError('');
    try {
      if (preview) setSession(PREVIEW_SESSION);
      else setSession((await api.post(`/api/v1/teleconsultations/${consultationId}/prepare`)).data);
    } catch { setError(c.error); } finally { setBusy(false); }
  };

  const testDevice = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => track.stop());
      setDeviceReady(true);
    } catch {
      setError(c.error);
    }
  };

  const checkedIn = session?.participants.some(item => item.role === role && item.checked_in_at);
  const checkIn = async () => {
    if (!session || !deviceReady) return;
    setBusy(true); setError('');
    try {
      if (preview) {
        setSession(current => current ? {
          ...current,
          participants: [...current.participants.filter(item => item.role !== role), {
            role, camera_ready: true, microphone_ready: true, network_quality: 'good', checked_in_at: new Date().toISOString(),
          }],
        } : current);
      } else {
        setSession((await api.post(`/api/v1/teleconsultations/${consultationId}/check-in`, {
          camera_ready: true, microphone_ready: true, network_quality: 'good', consent_confirmed: role === 'patient',
        })).data);
      }
    } catch { setError(c.error); } finally { setBusy(false); }
  };

  const togglePreflight = (key: string) => {
    setSession(current => current ? {
      ...current,
      preflight: { ...current.preflight, [key]: !current.preflight[key] },
    } : current);
  };

  const savePreflight = async () => {
    if (!session) return;
    setBusy(true); setError('');
    try {
      const payload = { ...session.preflight, preflight_note: session.preflight_note || undefined };
      if (preview) {
        const complete = Object.values(session.preflight).every(Boolean);
        setSession({ ...session, preflight_complete: complete });
      } else setSession((await api.put(`/api/v1/teleconsultations/${consultationId}/preflight`, payload)).data);
    } catch { setError(c.error); } finally { setBusy(false); }
  };

  const startOrJoin = async () => {
    if (!session) return;
    setBusy(true); setError('');
    try {
      if (preview) {
        setSession({ ...session, status: 'in_progress' });
        return;
      }
      if (role === 'doctor' && session.status !== 'in_progress') {
        setSession((await api.post(`/api/v1/teleconsultations/${consultationId}/start`)).data);
      }
      const response = await api.post(`/api/v1/teleconsultations/${consultationId}/join`);
      window.open(response.data.room_url, '_blank', 'noopener,noreferrer');
    } catch { setError(c.error); } finally { setBusy(false); }
  };

  const labels: Record<string, string> = {
    identity_confirmed: c.identity,
    consent_confirmed: c.consent,
    vitals_reviewed: c.vitals,
    medication_reviewed: c.medication,
    clinical_summary_ready: c.summary,
  };

  return (
    <section className="teleconsult-control">
      <header>
        <span><Video size={18} /></span>
        <div><h3>{c.title}</h3><p>{c.subtitle}</p></div>
        {session && <strong className={`teleconsult-status ${session.status}`}>{session.status}</strong>}
      </header>

      {!session ? (
        role === 'patient' ? (
          <div className="teleconsult-provider">
            <ShieldCheck size={16} /><span><strong>{c.waiting}</strong><small>{c.notPrepared}</small></span>
          </div>
        ) : (
          <button className="teleconsult-primary" type="button" disabled={busy} onClick={prepare}>
            {busy ? <Loader2 size={15} className="spin" /> : <Video size={15} />} {c.prepare}
          </button>
        )
      ) : (
        <>
          <div className="teleconsult-provider">
            <ShieldCheck size={16} /><span><strong>{session.provider_mode === 'pilot' ? c.pilot : session.provider}</strong><small>{session.provider_notice}</small></span>
          </div>
          <div className="teleconsult-readiness">
            <button type="button" className={deviceReady ? 'ready' : ''} onClick={testDevice}>
              <Camera size={16} /><Mic size={16} /> {deviceReady ? c.deviceReady : c.device}
            </button>
            <button type="button" className={checkedIn ? 'ready' : ''} disabled={!deviceReady || busy} onClick={checkIn}>
              <CheckCircle2 size={16} /> {checkedIn ? c.checked : c.checkin}
            </button>
          </div>

          {role === 'nurse' && (
            <div className="teleconsult-checklist">
              {Object.entries(labels).map(([key, label]) => (
                <button key={key} type="button" className={session.preflight[key] ? 'checked' : ''} onClick={() => togglePreflight(key)}>
                  <CheckCircle2 size={15} /> {label}
                </button>
              ))}
              <button className="teleconsult-save" type="button" disabled={busy} onClick={savePreflight}>{c.save}</button>
            </div>
          )}

          <div className="teleconsult-participants">
            {session.participants.map(item => (
              <span key={`${item.role}-${item.user_id || ''}`} className={item.checked_in_at ? 'online' : ''}>
                <i /> {item.role} · {item.network_quality || c.waiting}
              </span>
            ))}
          </div>

          <button
            className="teleconsult-primary"
            type="button"
            disabled={
              busy
              || !checkedIn
              || (role === 'doctor' ? !session.preflight_complete : session.status !== 'in_progress')
            }
            onClick={startOrJoin}
          >
            {busy ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
            {role === 'doctor' && session.status !== 'in_progress' ? c.start : c.enter}
          </button>
        </>
      )}
      {error && <div className="teleconsult-error">{error}</div>}
    </section>
  );
}
