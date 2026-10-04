import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, Mic, Play, ShieldCheck, Video } from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import { useAuth } from '../AuthContext';
import { approvedServerVideoRoom } from '../utils/video';
import { apiErrorMessage } from '../utils/apiError';

type Session = {
  id: string;
  consultation_id: string;
  reschedule_revision?: number;
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
  consultationId, role, preview = false, onEnterRoom,
}: {
  consultationId: string; role: 'doctor' | 'nurse' | 'patient'; preview?: boolean;
  onEnterRoom?: (roomUrl: string) => void;
}) {
  const { lang } = useT();
  const { user } = useAuth();
  const c = words[lang as keyof typeof words] || words.en;
  const [session, setSession] = useState<Session | null>(preview ? PREVIEW_SESSION : null);
  const [capability, setCapability] = useState<{ enabled: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [deviceReady, setDeviceReady] = useState(false);
  const [networkQuality, setNetworkQuality] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [roomLink, setRoomLink] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const busyRef = useRef(false);
  const currentId = useRef(consultationId);
  currentId.current = consultationId;

  const load = async () => {
    if (preview) return;
    const id = consultationId;
    setLoading(true); setError(''); setCapability(null); setRoomLink(null); setLoadFailed(false);
    const [capabilities, current] = await Promise.allSettled([
      api.get('/api/v1/teleconsultations/capabilities'),
      api.get(`/api/v1/teleconsultations/${id}`),
    ]);
    if (currentId.current !== id) return;
    if (capabilities.status === 'fulfilled') setCapability(capabilities.value.data);
    else { setLoadFailed(true); setError('Não foi possível verificar a disponibilidade do vídeo. Tente atualizar.'); }
    if (current.status === 'fulfilled') setSession(current.value.data);
    else if (current.reason?.response?.status === 404) setSession(null);
    else { setSession(null); setLoadFailed(true); setError('Não foi possível carregar a preparação da consulta. Tente atualizar.'); }
    setLoading(false);
  };
  useEffect(() => {
    currentId.current = consultationId;
    busyRef.current = false; setBusy(false);
    setSession(preview ? PREVIEW_SESSION : null); setDeviceReady(false); setConsent(false);
    setNetworkQuality(''); setRoomLink(null); void load();
    return () => { currentId.current = ''; };
  }, [consultationId, preview]); // eslint-disable-line react-hooks/exhaustive-deps

  const enabled = !preview && !loading && !loadFailed && capability?.enabled === true;
  const checkedIn = !!session?.participants.some(item => item.user_id === user?.id && item.checked_in_at);
  const closed = session?.status === 'completed';
  const action = async (work: () => Promise<void>) => {
    if (busyRef.current || !enabled || closed) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await work(); }
    catch (failure: unknown) {
      if (currentId.current !== consultationId) return;
      setError(apiErrorMessage(failure, c.error));
    } finally { if (currentId.current === consultationId) { busyRef.current = false; setBusy(false); } }
  };
  const applySession = (value: Session) => { if (currentId.current === consultationId) setSession(value); };
  const prepare = () => action(async () => { applySession((await api.post(`/api/v1/teleconsultations/${consultationId}/prepare`)).data); });
  const testDevice = () => action(async () => {
    setDeviceReady(false);
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Media unavailable');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const ready = stream.getVideoTracks().some(track => track.readyState === 'live') && stream.getAudioTracks().some(track => track.readyState === 'live');
    stream.getTracks().forEach(track => track.stop());
    if (!ready) throw new Error('Device unavailable');
    if (currentId.current === consultationId) setDeviceReady(true);
  });
  const checkIn = () => action(async () => {
    if (!deviceReady || !networkQuality || (role === 'patient' && !consent)) return;
    applySession((await api.post(`/api/v1/teleconsultations/${consultationId}/check-in`, {
      camera_ready: true, microphone_ready: true, network_quality: networkQuality,
      consent_confirmed: role === 'patient' && consent,
    }, { params: { expected_revision: session?.reschedule_revision ?? 0 } })).data);
  });
  const savePreflight = () => action(async () => {
    if (!session) return;
    applySession((await api.put(`/api/v1/teleconsultations/${consultationId}/preflight`, {
      ...session.preflight, preflight_note: session.preflight_note || undefined,
    }, { params: { expected_revision: session.reschedule_revision ?? 0 } })).data);
  });
  const startOrJoin = () => action(async () => {
    if (!session) return;
    if (role === 'doctor' && session.status !== 'in_progress') {
      applySession((await api.post(`/api/v1/teleconsultations/${consultationId}/start`, undefined, { params: { expected_revision: session.reschedule_revision ?? 0 } })).data);
    }
    if (currentId.current !== consultationId) return;
    const response = await api.post(`/api/v1/teleconsultations/${consultationId}/join`);
    if (currentId.current !== consultationId) return;
    const url = approvedServerVideoRoom(response.data.room_url);
    if (onEnterRoom) onEnterRoom(url);
    else setRoomLink(url);
  });
  const labels: Record<string, string> = {
    identity_confirmed: c.identity, consent_confirmed: c.consent, vitals_reviewed: c.vitals,
    medication_reviewed: c.medication, clinical_summary_ready: c.summary,
  };
  const statuses: Record<string, string> = { scheduled: 'Preparação', waiting: 'A aguardar', in_progress: 'Em curso', completed: 'Vídeo encerrado' };

  return <section className="teleconsult-control">
    <header><span><Video size={18} /></span><div><h3>{c.title}</h3><p>{c.subtitle}</p></div>
      {session && <strong className={`teleconsult-status ${session.status}`}>{statuses[session.status] || session.status}</strong>}
    </header>
    {preview ? <p role="status">Pré-visualização com dados de demonstração. Não existe uma chamada ativa.</p> : <button className="btn btn-sm" type="button" disabled={busy || loading} onClick={load}>Atualizar preparação</button>}
    {loading && <p role="status">A verificar disponibilidade…</p>}
    {!loading && !preview && !enabled && <div className="teleconsult-provider" role="status"><ShieldCheck size={16} /><span><strong>Vídeo indisponível</strong><small>{capability?.message || 'Não foi possível confirmar um fornecedor de vídeo disponível.'}</small><small>Contacte a equipa de cuidados para combinar uma alternativa. A consulta não foi iniciada por esta ação.</small></span></div>}
    {!loading && enabled && !session && (role === 'patient' ? <p>{c.notPrepared}</p> : <button className="teleconsult-primary" type="button" disabled={busy} onClick={prepare}>{c.prepare}</button>)}
    {session && <>
      <div className="teleconsult-provider"><ShieldCheck size={16} /><span><strong>{preview ? 'Demonstração' : session.provider}</strong><small>{session.provider_notice}</small></span></div>
      {closed && <p>O vídeo foi encerrado. O resumo clínico fica disponível quando o médico concluir a consulta.</p>}
      {enabled && !closed && <>
        <div className="teleconsult-readiness"><button type="button" disabled={busy} className={deviceReady ? 'ready' : ''} onClick={testDevice}><Camera size={16} /><Mic size={16} /> {deviceReady ? c.deviceReady : c.device}</button></div>
        <label style={{ display: 'grid', gap: 6, margin: '1rem 0' }}>Como está a sua ligação? (avaliação sua)
          <select className="form-input" value={networkQuality} onChange={event => setNetworkQuality(event.target.value)} disabled={busy}><option value="">Escolha uma opção</option><option value="poor">Fraca</option><option value="fair">Razoável</option><option value="good">Boa</option><option value="excellent">Excelente</option></select>
        </label>
        {role === 'patient' && <label style={{ display: 'block', margin: '1rem 0' }}><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /> Confirmo que quero participar nesta teleconsulta e que revi o consentimento de telemedicina.</label>}
        <button className="btn btn-sm" type="button" disabled={!deviceReady || !networkQuality || (role === 'patient' && !consent) || busy} onClick={checkIn}><CheckCircle2 size={16} /> {checkedIn ? c.checked : c.checkin}</button>
        {role === 'nurse' && <div className="teleconsult-checklist">
          {Object.entries(labels).map(([key, label]) => <label key={key}><input type="checkbox" disabled={busy} checked={!!session.preflight[key]} onChange={event => setSession({ ...session, preflight: { ...session.preflight, [key]: event.target.checked } })} /> {label}</label>)}
          <label>Nota de preparação<textarea maxLength={4000} value={session.preflight_note || ''} disabled={busy} onChange={event => setSession({ ...session, preflight_note: event.target.value })} /></label>
          <button className="teleconsult-save" type="button" disabled={busy} onClick={savePreflight}>{c.save}</button>
        </div>}
        <button className="teleconsult-primary" type="button" disabled={busy || !checkedIn || (role === 'doctor' ? !session.preflight_complete : session.status !== 'in_progress')} onClick={startOrJoin}>
          {busy ? <Loader2 size={15} className="spin" /> : <Play size={15} />}{role === 'doctor' && session.status !== 'in_progress' ? c.start : c.enter}
        </button>
        {roomLink && <a className="btn btn-primary" href={roomLink} target="_blank" rel="noopener noreferrer">Abrir sala de vídeo</a>}
      </>}
      <div className="teleconsult-participants">{session.participants.map(item => <span key={`${item.role}-${item.user_id || ''}`} className={item.checked_in_at ? 'online' : ''}><i /> {{ patient: 'Paciente', doctor: 'Médico', nurse: 'Enfermagem' }[item.role] || item.role} · {item.checked_in_at ? 'Check-in registado' : c.waiting}</span>)}</div>
    </>}
    {error && <div role="alert" className="teleconsult-error">{error}</div>}
  </section>;
}
