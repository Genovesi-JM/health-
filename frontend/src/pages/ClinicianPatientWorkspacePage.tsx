import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowLeft, Calendar, CheckCircle2, ChevronRight,
  ClipboardList, Clock3, FileText, HeartPulse, MessageSquare, Pill, RefreshCw,
  ShieldAlert, Stethoscope, UserRound, Users, Video, X,
} from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';

type Patient360 = {
  access: {
    role: 'doctor' | 'nurse';
    scope: string;
    capabilities: Record<string, boolean>;
  };
  identity: {
    id: string; name: string; date_of_birth?: string | null; age?: number | null;
    gender?: string | null; blood_type?: string | null;
    emergency_contact_name?: string | null; emergency_contact_phone?: string | null;
  };
  safety: {
    allergies: string[];
    chronic_conditions: string[];
    risk_flags: Array<{ severity: string; type: string; label: string }>;
  };
  active_episode?: Consultation | null;
  latest_triage?: Triage | null;
  triages: Triage[];
  consultations: Consultation[];
  readings: Reading[];
  medications: Medication[];
  prescriptions: Array<Record<string, unknown>>;
  prescription_requests: Array<Record<string, unknown>>;
  referrals: Array<Record<string, unknown>>;
  consents: Array<{ type: string; accepted_at: string }>;
  emergency_family: Array<{ id: string; name: string; relationship: string; phone?: string | null }>;
};

type Consultation = {
  id: string; specialty: string; status: string; scheduled_at?: string | null;
  created_at?: string | null; messages_count: number; payment_status?: string;
  notes?: { subjective?: string | null; objective?: string | null; assessment?: string | null; plan?: string | null; outcome?: string | null } | null;
};
type Triage = {
  id: string; status: string; chief_complaint?: string | null; risk_level?: string | null;
  recommended_action?: string | null; score?: number | null; reasoning?: Record<string, unknown>;
  answers?: Array<{ question_key: string; value: unknown }>; photos_count?: number;
  created_at?: string | null; completed_at?: string | null;
};
type Reading = {
  id: string; type: string; value?: number | null; systolic?: number | null; diastolic?: number | null;
  pulse?: number | null; unit?: string | null; source?: string | null; device_brand?: string | null;
  device_model?: string | null; measured_at?: string | null;
};
type Medication = {
  id: string; name: string; dosage?: string | null; frequency?: string | null;
  reason?: string | null; prescribed_by?: string | null; is_current: boolean;
};

const PREVIEW_DATA: Patient360 = {
  access: {
    role: 'nurse',
    scope: 'active_episode',
    capabilities: {
      view_longitudinal_record: true, review_triage: true, request_triage_photos: false,
      message_patient: false, join_teleconsultation: true, record_nursing_observations: true,
      create_handoff: true, prescribe: false, refer: false, complete_consultation: false,
    },
  },
  identity: {
    id: 'preview-patient', name: 'Ana Manuel', date_of_birth: '1982-03-16', age: 44,
    gender: 'Feminino', blood_type: 'O+', emergency_contact_name: 'Mateus Manuel',
    emergency_contact_phone: '+244 923 000 111',
  },
  safety: {
    allergies: ['Penicilina'],
    chronic_conditions: ['Hipertensão', 'Diabetes tipo 2'],
    risk_flags: [
      { severity: 'high', type: 'allergy', label: 'Alergia documentada: Penicilina' },
      { severity: 'high', type: 'triage', label: 'Triagem recente de alto risco' },
    ],
  },
  active_episode: {
    id: 'consult-preview', specialty: 'Medicina Geral', status: 'requested',
    created_at: '2026-07-30T09:20:00Z', messages_count: 4, payment_status: 'paid',
  },
  latest_triage: {
    id: 'triage-preview', status: 'completed', chief_complaint: 'Febre e tosse persistente',
    risk_level: 'HIGH', recommended_action: 'DOCTOR_NOW', score: 8.2, photos_count: 2,
    created_at: '2026-07-30T09:12:00Z',
    reasoning: { red_flags: ['Febre persistente', 'Falta de ar ao esforço'] },
    answers: [
      { question_key: 'symptom_duration', value: '4 dias' },
      { question_key: 'temperature', value: '38.6 °C' },
      { question_key: 'breathing_difficulty', value: 'Moderada' },
    ],
  },
  triages: [],
  consultations: [
    {
      id: 'consult-preview', specialty: 'Medicina Geral', status: 'requested',
      created_at: '2026-07-30T09:20:00Z', messages_count: 4, payment_status: 'paid',
    },
    {
      id: 'consult-old', specialty: 'Cardiologia', status: 'completed',
      scheduled_at: '2026-06-14T11:00:00Z', messages_count: 7, payment_status: 'paid',
      notes: { assessment: 'Hipertensão arterial controlada', plan: 'Manter terapêutica e monitorização domiciliária', outcome: 'follow_up' },
    },
  ],
  readings: [
    { id: 'r1', type: 'blood_pressure', systolic: 148, diastolic: 92, pulse: 88, unit: 'mmHg', source: 'apple_health', device_brand: 'Omron', measured_at: '2026-07-30T08:45:00Z' },
    { id: 'r2', type: 'oxygen_saturation', value: 94, unit: '%', source: 'manual', device_brand: 'Beurer', measured_at: '2026-07-30T08:47:00Z' },
    { id: 'r3', type: 'temperature', value: 38.6, unit: '°C', source: 'manual', measured_at: '2026-07-30T08:49:00Z' },
    { id: 'r4', type: 'glucose', value: 156, unit: 'mg/dL', source: 'health_connect', measured_at: '2026-07-30T07:30:00Z' },
    { id: 'r5', type: 'weight', value: 72.4, unit: 'kg', source: 'renpho', device_brand: 'RENPHO', device_model: 'Elis 1', measured_at: '2026-07-29T07:20:00Z' },
  ],
  medications: [
    { id: 'm1', name: 'Metformina', dosage: '850 mg', frequency: '2× por dia', reason: 'Diabetes tipo 2', prescribed_by: 'Dra. Carla Silva', is_current: true },
    { id: 'm2', name: 'Losartan', dosage: '50 mg', frequency: '1× por dia', reason: 'Hipertensão', prescribed_by: 'Dr. Paulo Gomes', is_current: true },
  ],
  prescriptions: [{ id: 'p1', created_at: '2026-06-14T12:00:00Z' }],
  prescription_requests: [{ id: 'pr1', medication_name: 'Metformina', status: 'approved', created_at: '2026-05-02T10:00:00Z' }],
  referrals: [{ id: 'ref1', destination: 'Cardiologia', urgency: 'routine', created_at: '2026-06-14T12:00:00Z' }],
  consents: [
    { type: 'telemedicine_consent', accepted_at: '2026-01-10T10:00:00Z' },
    { type: 'health_data_processing', accepted_at: '2026-01-10T10:00:00Z' },
  ],
  emergency_family: [{ id: 'f1', name: 'Mateus Manuel', relationship: 'Cônjuge', phone: '+244 923 000 111' }],
};

const copy = {
  pt: {
    back: 'Voltar', workspace: 'Visão clínica 360°', live: 'Episódio ativo', teleconsult: 'Entrar na teleconsulta',
    message: 'Mensagens', handoff: 'Criar passagem de turno', prescribe: 'Prescrever', identity: 'Identificação',
    emergency: 'Contacto de emergência', safety: 'Segurança clínica', allergies: 'Alergias', conditions: 'Condições crónicas',
    overview: 'Resumo', triage: 'Triagem', readings: 'Medições e dispositivos', medications: 'Medicação',
    consultations: 'Consultas', coordination: 'Coordenação', recentVitals: 'Medições recentes',
    currentMeds: 'Medicação atual', activeCare: 'Episódio de cuidados', careTimeline: 'Linha clínica',
    noData: 'Sem informação registada', risk: 'Risco', action: 'Ação recomendada', complaint: 'Motivo principal',
    answers: 'Respostas da triagem', photos: 'fotografias clínicas', source: 'Origem', lastUpdate: 'Última atualização',
    consents: 'Consentimentos', capabilities: 'Permissões clínicas', roleNurse: 'Enfermagem', roleDoctor: 'Médico',
    patientContext: 'Toda a informação essencial para decidir, preparar e dar continuidade aos cuidados.',
  },
  en: {
    back: 'Back', workspace: '360° clinical view', live: 'Active episode', teleconsult: 'Join teleconsultation',
    message: 'Messages', handoff: 'Create handoff', prescribe: 'Prescribe', identity: 'Identity',
    emergency: 'Emergency contact', safety: 'Clinical safety', allergies: 'Allergies', conditions: 'Chronic conditions',
    overview: 'Overview', triage: 'Triage', readings: 'Measurements & devices', medications: 'Medication',
    consultations: 'Consultations', coordination: 'Coordination', recentVitals: 'Recent measurements',
    currentMeds: 'Current medication', activeCare: 'Care episode', careTimeline: 'Clinical timeline',
    noData: 'No information recorded', risk: 'Risk', action: 'Recommended action', complaint: 'Chief complaint',
    answers: 'Triage answers', photos: 'clinical photos', source: 'Source', lastUpdate: 'Last update',
    consents: 'Consents', capabilities: 'Clinical permissions', roleNurse: 'Nursing', roleDoctor: 'Doctor',
    patientContext: 'All essential information to decide, prepare and ensure continuity of care.',
  },
  fr: {
    back: 'Retour', workspace: 'Vue clinique 360°', live: 'Épisode actif', teleconsult: 'Rejoindre la téléconsultation',
    message: 'Messages', handoff: 'Créer une transmission', prescribe: 'Prescrire', identity: 'Identité',
    emergency: 'Contact d’urgence', safety: 'Sécurité clinique', allergies: 'Allergies', conditions: 'Maladies chroniques',
    overview: 'Résumé', triage: 'Triage', readings: 'Mesures et appareils', medications: 'Médicaments',
    consultations: 'Consultations', coordination: 'Coordination', recentVitals: 'Mesures récentes',
    currentMeds: 'Traitement actuel', activeCare: 'Épisode de soins', careTimeline: 'Chronologie clinique',
    noData: 'Aucune information enregistrée', risk: 'Risque', action: 'Action recommandée', complaint: 'Motif principal',
    answers: 'Réponses du triage', photos: 'photos cliniques', source: 'Source', lastUpdate: 'Dernière mise à jour',
    consents: 'Consentements', capabilities: 'Autorisations cliniques', roleNurse: 'Soins infirmiers', roleDoctor: 'Médecin',
    patientContext: 'Toutes les informations essentielles pour décider, préparer et assurer la continuité des soins.',
  },
  es: {
    back: 'Volver', workspace: 'Vista clínica 360°', live: 'Episodio activo', teleconsult: 'Entrar en la teleconsulta',
    message: 'Mensajes', handoff: 'Crear relevo clínico', prescribe: 'Prescribir', identity: 'Identificación',
    emergency: 'Contacto de emergencia', safety: 'Seguridad clínica', allergies: 'Alergias', conditions: 'Condiciones crónicas',
    overview: 'Resumen', triage: 'Triaje', readings: 'Mediciones y dispositivos', medications: 'Medicación',
    consultations: 'Consultas', coordination: 'Coordinación', recentVitals: 'Mediciones recientes',
    currentMeds: 'Medicación actual', activeCare: 'Episodio asistencial', careTimeline: 'Cronología clínica',
    noData: 'Sin información registrada', risk: 'Riesgo', action: 'Acción recomendada', complaint: 'Motivo principal',
    answers: 'Respuestas del triaje', photos: 'fotografías clínicas', source: 'Origen', lastUpdate: 'Última actualización',
    consents: 'Consentimientos', capabilities: 'Permisos clínicos', roleNurse: 'Enfermería', roleDoctor: 'Médico',
    patientContext: 'Toda la información esencial para decidir, preparar y garantizar la continuidad asistencial.',
  },
  zh: {
    back: '返回', workspace: '360°临床视图', live: '当前护理事件', teleconsult: '加入远程会诊',
    message: '消息', handoff: '创建交接', prescribe: '开具处方', identity: '身份信息',
    emergency: '紧急联系人', safety: '临床安全', allergies: '过敏', conditions: '慢性病',
    overview: '概览', triage: '分诊', readings: '测量与设备', medications: '用药',
    consultations: '会诊', coordination: '协作', recentVitals: '最近测量',
    currentMeds: '当前用药', activeCare: '护理事件', careTimeline: '临床时间线',
    noData: '暂无记录', risk: '风险', action: '建议措施', complaint: '主诉',
    answers: '分诊回答', photos: '临床照片', source: '来源', lastUpdate: '最后更新',
    consents: '知情同意', capabilities: '临床权限', roleNurse: '护理', roleDoctor: '医生',
    patientContext: '汇集决策、准备和连续护理所需的关键信息。',
  },
};

type Tab = 'overview' | 'triage' | 'readings' | 'medications' | 'consultations' | 'coordination';

export default function ClinicianPatientWorkspacePage({ preview = false }: { preview?: boolean }) {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { lang } = useT();
  const c = copy[lang as keyof typeof copy] || copy.en;
  const [data, setData] = useState<Patient360 | null>(preview ? PREVIEW_DATA : null);
  const [loading, setLoading] = useState(!preview);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showHandoff, setShowHandoff] = useState(false);

  const load = () => {
    if (preview) { setData(PREVIEW_DATA); return; }
    if (!patientId) return;
    setLoading(true);
    api.get(`/api/v1/clinician/patients/${patientId}/360`)
      .then(response => setData(response.data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [patientId, preview]);

  const latestByType = useMemo(() => {
    const map = new Map<string, Reading>();
    for (const reading of data?.readings || []) if (!map.has(reading.type)) map.set(reading.type, reading);
    return [...map.values()];
  }, [data?.readings]);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!data) return <div className="clinician-360-empty">{c.noData}</div>;

  const roleLabel = data.access.role === 'doctor' ? c.roleDoctor : c.roleNurse;
  const currentMedications = data.medications.filter(item => item.is_current);

  return (
    <div className="clinician-360">
      <button className="clinician-360-back" type="button" onClick={() => preview ? navigate('/preview/nurse') : navigate(-1)}>
        <ArrowLeft size={16} /> {c.back}
      </button>

      <header className="clinician-360-hero">
        <div className="clinician-360-avatar">{data.identity.name.split(' ').slice(0, 2).map(part => part[0]).join('')}</div>
        <div className="clinician-360-title">
          <span>{c.workspace} · {roleLabel}</span>
          <h1>{data.identity.name}</h1>
          <p>
            {data.identity.age ? `${data.identity.age} anos` : '—'} · {data.identity.gender || '—'} ·
            {' '}{data.identity.blood_type || '—'} · ID {data.identity.id.slice(0, 8)}
          </p>
        </div>
        <div className="clinician-360-actions">
          {data.active_episode && <span className="clinician-live-chip"><span /> {c.live}</span>}
          {data.access.capabilities.join_teleconsultation && (
            <Link className="clinician-action clinician-action--primary" to={data.access.role === 'doctor' ? '/doctor/consultas' : '#teleconsult'}>
              <Video size={16} /> {c.teleconsult}
            </Link>
          )}
          {data.access.capabilities.message_patient && (
            <Link className="clinician-action" to="/doctor/mensagens"><MessageSquare size={16} /> {c.message}</Link>
          )}
          {data.access.capabilities.create_handoff && (
            <button className="clinician-action" type="button" onClick={() => setShowHandoff(true)}>
              <ClipboardList size={16} /> {c.handoff}
            </button>
          )}
          {data.access.capabilities.prescribe && (
            <Link className="clinician-action" to="/doctor/prescricoes"><Pill size={16} /> {c.prescribe}</Link>
          )}
        </div>
      </header>

      <section className="clinician-safety-strip">
        <div><ShieldAlert size={20} /><span><strong>{c.safety}</strong><small>{c.patientContext}</small></span></div>
        <div className="clinician-safety-tags">
          {data.safety.allergies.map(item => <span key={item} className="danger">{c.allergies}: {item}</span>)}
          {data.safety.chronic_conditions.map(item => <span key={item}>{item}</span>)}
          {!data.safety.allergies.length && !data.safety.chronic_conditions.length && <span className="clear"><CheckCircle2 size={13} /> {c.noData}</span>}
        </div>
      </section>

      <nav className="clinician-360-tabs" aria-label={c.workspace}>
        {([
          ['overview', c.overview, HeartPulse],
          ['triage', c.triage, ShieldAlert],
          ['readings', c.readings, Activity],
          ['medications', c.medications, Pill],
          ['consultations', c.consultations, Video],
          ['coordination', c.coordination, Users],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} type="button" className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>
            <Icon size={16} /> {label}
            {key === 'triage' && data.latest_triage?.risk_level && <span className="tab-alert" />}
          </button>
        ))}
      </nav>

      <main className="clinician-360-content">
        {activeTab === 'overview' && (
          <div className="clinician-overview-grid">
            <section className="clinician-panel clinician-panel--span2">
              <PanelTitle icon={<Activity size={17} />} title={c.recentVitals} meta={`${latestByType.length}`} />
              <div className="clinician-vitals-grid">
                {latestByType.slice(0, 6).map(reading => <VitalCard key={reading.id} reading={reading} c={c} />)}
              </div>
            </section>
            <section className="clinician-panel">
              <PanelTitle icon={<Pill size={17} />} title={c.currentMeds} meta={`${currentMedications.length}`} />
              <div className="clinician-list">
                {currentMedications.map(item => (
                  <div key={item.id}><span className="list-icon purple"><Pill size={15} /></span><span><strong>{item.name} {item.dosage}</strong><small>{item.frequency} · {item.reason || '—'}</small></span></div>
                ))}
                {!currentMedications.length && <Empty text={c.noData} />}
              </div>
            </section>
            <section className="clinician-panel">
              <PanelTitle icon={<Stethoscope size={17} />} title={c.activeCare} />
              {data.active_episode ? (
                <div className="clinician-episode">
                  <span className="episode-status">{data.active_episode.status}</span>
                  <h3>{data.active_episode.specialty}</h3>
                  <p>{data.latest_triage?.chief_complaint || c.noData}</p>
                  <div><span><Clock3 size={14} /> {formatDate(data.active_episode.created_at)}</span><span><MessageSquare size={14} /> {data.active_episode.messages_count}</span></div>
                </div>
              ) : <Empty text={c.noData} />}
            </section>
            <section className="clinician-panel clinician-panel--span2">
              <PanelTitle icon={<Calendar size={17} />} title={c.careTimeline} meta={`${data.consultations.length}`} />
              <div className="clinician-timeline">
                {data.consultations.slice(0, 5).map(item => (
                  <div key={item.id}>
                    <span className={`timeline-dot ${item.status}`} />
                    <span><strong>{item.specialty}</strong><small>{formatDate(item.scheduled_at || item.created_at)} · {item.status}</small></span>
                    <ChevronRight size={16} />
                  </div>
                ))}
              </div>
            </section>
            <section className="clinician-panel">
              <PanelTitle icon={<UserRound size={17} />} title={c.emergency} />
              <div className="clinician-contact">
                <strong>{data.identity.emergency_contact_name || data.emergency_family[0]?.name || '—'}</strong>
                <span>{data.emergency_family[0]?.relationship || '—'}</span>
                <a href={`tel:${data.identity.emergency_contact_phone || data.emergency_family[0]?.phone || ''}`}>
                  {data.identity.emergency_contact_phone || data.emergency_family[0]?.phone || '—'}
                </a>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'triage' && (
          <div className="clinician-detail-grid">
            <section className="clinician-panel">
              <PanelTitle icon={<ShieldAlert size={17} />} title={c.triage} />
              {data.latest_triage ? (
                <div className="clinician-triage-summary">
                  <div className={`triage-score ${(data.latest_triage.risk_level || '').toLowerCase()}`}>
                    <strong>{data.latest_triage.risk_level || '—'}</strong><span>{c.risk}</span>
                  </div>
                  <Info label={c.complaint} value={data.latest_triage.chief_complaint || '—'} />
                  <Info label={c.action} value={data.latest_triage.recommended_action || '—'} />
                  <Info label="Score" value={String(data.latest_triage.score ?? '—')} />
                  <Info label={c.photos} value={String(data.latest_triage.photos_count || 0)} />
                </div>
              ) : <Empty text={c.noData} />}
            </section>
            <section className="clinician-panel">
              <PanelTitle icon={<ClipboardList size={17} />} title={c.answers} meta={`${data.latest_triage?.answers?.length || 0}`} />
              <div className="clinician-answer-list">
                {(data.latest_triage?.answers || []).map(answer => (
                  <div key={answer.question_key}><span>{answer.question_key.replaceAll('_', ' ')}</span><strong>{String(answer.value)}</strong></div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'readings' && (
          <section className="clinician-panel">
            <PanelTitle icon={<Activity size={17} />} title={c.readings} meta={`${data.readings.length}`} />
            <div className="clinician-readings-list">
              {data.readings.map(reading => (
                <div key={reading.id}>
                  <span className="reading-type"><Activity size={15} /> {reading.type.replaceAll('_', ' ')}</span>
                  <strong>{readingValue(reading)}</strong>
                  <span>{reading.device_brand || reading.source || 'manual'}</span>
                  <small>{formatDate(reading.measured_at)}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'medications' && (
          <div className="clinician-detail-grid">
            <section className="clinician-panel">
              <PanelTitle icon={<Pill size={17} />} title={c.currentMeds} meta={`${currentMedications.length}`} />
              <div className="clinician-medication-cards">
                {currentMedications.map(item => (
                  <article key={item.id}>
                    <span><Pill size={17} /></span><div><h3>{item.name}</h3><p>{item.dosage} · {item.frequency}</p><small>{item.reason || '—'} · {item.prescribed_by || '—'}</small></div>
                  </article>
                ))}
              </div>
            </section>
            <section className="clinician-panel">
              <PanelTitle icon={<FileText size={17} />} title={c.consultations} meta={`${data.prescriptions.length + data.prescription_requests.length}`} />
              <div className="clinician-metric-stack">
                <div><strong>{data.prescriptions.length}</strong><span>Prescrições de consultas</span></div>
                <div><strong>{data.prescription_requests.length}</strong><span>Pedidos de renovação</span></div>
                <div><strong>{data.referrals.length}</strong><span>Referências clínicas</span></div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'consultations' && (
          <section className="clinician-panel">
            <PanelTitle icon={<Video size={17} />} title={c.consultations} meta={`${data.consultations.length}`} />
            <div className="clinician-consultation-list">
              {data.consultations.map(item => (
                <article key={item.id}>
                  <span className={`consult-icon ${item.status}`}><Video size={18} /></span>
                  <div><h3>{item.specialty}</h3><p>{formatDate(item.scheduled_at || item.created_at)} · {item.status}</p></div>
                  <span><MessageSquare size={14} /> {item.messages_count}</span>
                  {item.notes && <div className="consult-plan"><strong>Plano</strong><span>{item.notes.plan || item.notes.assessment || '—'}</span></div>}
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'coordination' && (
          <div className="clinician-detail-grid">
            <section className="clinician-panel">
              <PanelTitle icon={<Users size={17} />} title={c.capabilities} />
              <div className="clinician-capabilities">
                {Object.entries(data.access.capabilities).map(([key, allowed]) => (
                  <div key={key} className={allowed ? 'allowed' : 'restricted'}>
                    {allowed ? <CheckCircle2 size={15} /> : <X size={15} />}<span>{key.replaceAll('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="clinician-panel">
              <PanelTitle icon={<FileText size={17} />} title={c.consents} meta={`${data.consents.length}`} />
              <div className="clinician-list">
                {data.consents.map(item => (
                  <div key={item.type}><span className="list-icon green"><CheckCircle2 size={15} /></span><span><strong>{item.type.replaceAll('_', ' ')}</strong><small>{formatDate(item.accepted_at)}</small></span></div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>

      {showHandoff && (
        <div className="clinician-modal-backdrop" onClick={() => setShowHandoff(false)}>
          <section className="clinician-modal" onClick={event => event.stopPropagation()}>
            <button type="button" onClick={() => setShowHandoff(false)}><X size={18} /></button>
            <ClipboardList size={27} />
            <h2>{c.handoff}</h2>
            <p>{data.identity.name} · {data.latest_triage?.risk_level || '—'} · {data.latest_triage?.chief_complaint || '—'}</p>
            <textarea defaultValue={`Situação: ${data.latest_triage?.chief_complaint || ''}\nRisco: ${data.latest_triage?.risk_level || ''}\nRecomendação: ${data.latest_triage?.recommended_action || ''}`} />
            <div className="clinician-modal-note">A persistência e envio da passagem de turno será ligada ao módulo de coordenação clínica.</div>
          </section>
        </div>
      )}
    </div>
  );
}

function PanelTitle({ icon, title, meta }: { icon: React.ReactNode; title: string; meta?: string }) {
  return <header className="clinician-panel-title"><span>{icon}</span><h2>{title}</h2>{meta && <strong>{meta}</strong>}</header>;
}

function VitalCard({ reading, c }: { reading: Reading; c: (typeof copy)['en'] }) {
  return (
    <article className="clinician-vital">
      <div><Activity size={16} /><span>{reading.type.replaceAll('_', ' ')}</span></div>
      <strong>{readingValue(reading)}</strong>
      <small>{reading.device_brand || reading.source || 'manual'} · {formatDate(reading.measured_at)}</small>
      <span className="vital-source">{c.source}: {reading.source || 'manual'}</span>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="clinician-info"><span>{label}</span><strong>{value}</strong></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="clinician-inline-empty"><CheckCircle2 size={20} /> {text}</div>;
}

function readingValue(reading: Reading) {
  if (reading.type === 'blood_pressure') return `${reading.systolic ?? '—'}/${reading.diastolic ?? '—'} ${reading.unit || 'mmHg'}`;
  return `${reading.value ?? '—'} ${reading.unit || ''}`.trim();
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
}
