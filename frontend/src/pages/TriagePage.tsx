import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import type { TriageQuestion, TriageResult, TriageHistoryItem } from '../types';
import {
  Activity, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, ArrowLeft, RotateCcw, Bluetooth, Wifi, Thermometer,
  Heart, Droplets, Zap, Users, Trash2,
} from 'lucide-react';
import {
  isBluetoothAvailable, scanBluetooth, connectBluetooth, readBluetoothVitals,
  connectWifi, readWifiVitals,
} from '../utils/deviceApi';
import type { DeviceInfo, VitalReadings } from '../utils/deviceApi';

type Step = 'start' | 'questions' | 'result' | 'history';

type AgeGroup = 'adult' | 'pediatric';
type TriageCategory =
  | 'general'
  | 'respiratory'
  | 'cardiac'
  | 'neuro'
  | 'gi'
  | 'urinary'
  | 'skin'
  | 'injury'
  | 'mental'
  | 'womens'
  | 'medication'
  | 'chronic';

const LOCALE_MAP: Record<string, string> = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR' };

const QUESTION_LABELS: Record<string, string> = {
  fever:                    'Tem febre actualmente?',
  chest_pain:               'Tem dor no peito?',
  shortness_of_breath:      'Tem falta de ar ou dificuldade em respirar?',
  nausea:                   'Tem náuseas?',
  vomiting:                 'Tem vómitos?',
  headache:                 'Tem dor de cabeça?',
  dizziness:                'Tem tonturas ou sensação de desmaio?',
  abdominal_pain:           'Tem dor abdominal?',
  pain_scale:               'Numa escala de 1 a 10, como classifica a dor?',
  duration:                 'Há quanto tempo tem estes sintomas?',
  onset:                    'Os sintomas começaram de forma súbita ou gradual?',
  frequency:                'Com que frequência ocorrem os sintomas?',
  previous_episodes:        'Já teve episódios semelhantes anteriormente?',
  medications_taken:        'Tomou algum medicamento para aliviar os sintomas?',
  allergic_reaction:        'Tem algum sinal de reacção alérgica (erupção, inchaço)?',
  blood_pressure_high:      'Tem tensão arterial habitualmente elevada?',
  heart_palpitations:       'Sente palpitações ou batimentos cardíacos irregulares?',
  cough:                    'Tem tosse?',
  productive_cough:         'A tosse é produtiva (com expetoração)?',
  urinary_symptoms:         'Tem sintomas urinários (ardor, frequência, cor alterada)?',
  skin_rash:                'Tem erupção cutânea ou alterações na pele?',
  swelling:                 'Tem inchaço em alguma parte do corpo?',
  fatigue:                  'Tem cansaço ou fadiga intensa?',
  loss_of_consciousness:    'Perdeu ou quase perdeu a consciência?',
  severity:                 'Como avalia a gravidade geral do seu estado?',
  chronic_condition_flare:  'É um agravamento de uma condição crónica conhecida?',
  appetite_loss:            'Perdeu o apetite?',
  weight_loss:              'Tem perdido peso sem razão aparente?',
  night_sweats:             'Tem suores nocturnos?',
  blurred_vision:           'Tem visão turva ou alterações visuais?',
  ear_pain:                 'Tem dor de ouvido?',
  sore_throat:              'Tem dor de garganta?',
  runny_nose:               'Tem corrimento nasal?',
  back_pain:                'Tem dor nas costas?',
  joint_pain:               'Tem dor nas articulações?',
  muscle_pain:              'Tem dores musculares?',
  trauma:                   'Sofreu algum traumatismo ou queda recente?',
  bleeding:                 'Tem sangramento activo?',
  confusion:                'Tem confusão mental ou desorientação?',
  anxiety:                  'Sente ansiedade ou ataques de pânico?',
  depression_symptoms:      'Tem sentimentos de tristeza persistente ou depressão?',
};

export default function TriagePage() {
  const { t, lang } = useT();
  const location = useLocation();
  const locale = LOCALE_MAP[lang] || 'pt-PT';
  const [step, setStep] = useState<Step>('history');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('adult');
  const [category, setCategory] = useState<TriageCategory>('general');
  const [guardian, setGuardian] = useState(false);
  const [complaint, setComplaint] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [questions, setQuestions] = useState<TriageQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [result, setResult] = useState<TriageResult | null>(null);
  const [history, setHistory] = useState<TriageHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null); // triage id pending delete

  // ── Dependent selector ─────────────────────────────────────
  const [dependents, setDependents] = useState<{ id: string; name: string; is_minor: boolean }[]>([]);
  const [selectedDependent, setSelectedDependent] = useState<string>('me');

  // ── Vitals state ───────────────────────────────────────────
  const [vitals, setVitals] = useState<Partial<VitalReadings>>({});
  const [deviceTab, setDeviceTab] = useState<'manual' | 'bluetooth' | 'wifi'>('manual');
  const [btScanning, setBtScanning] = useState(false);
  const [btDevices, setBtDevices] = useState<DeviceInfo[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<DeviceInfo | null>(null);
  const [deviceReading, setDeviceReading] = useState(false);
  const [wifiIp, setWifiIp] = useState('');
  const [btError, setBtError] = useState('');

  useEffect(() => {
    loadHistory();
    // Load family members from backend
    api.get('/api/v1/family/me')
      .then((r: any) => setDependents(r.data.map((m: any) => ({ id: m.id, name: m.full_name, is_minor: m.is_minor }))))
      .catch(() => {});
    // Pre-select dependent if navigated from ProfilePage
    if (location.state?.dependent) {
      const dep = location.state.dependent;
      setSelectedDependent(dep.id);
      if (dep.is_minor) { setAgeGroup('pediatric'); setGuardian(true); }
      setStep('start');
    }
  }, []);

  // Vital colour coding
  const vitalStatus = (key: keyof VitalReadings, val?: number) => {
    if (val === undefined) return '';
    const thresholds: Record<string, [number, number]> = {
      systolic: [90, 140], diastolic: [60, 90], spo2: [95, 100],
      temperature: [36.0, 37.5], glucose: [70, 140],
    };
    const [lo, hi] = thresholds[key as string] ?? [0, 999];
    if (val < lo || val > hi) return '#ef4444';
    if (val === lo || val === hi) return '#eab308';
    return '#22c55e';
  };

  const handleBtScan = async () => {
    setBtError('');
    if (!isBluetoothAvailable()) { setBtError(t('vitals.not_supported')); return; }
    setBtScanning(true);
    try {
      const devices = await scanBluetooth();
      setBtDevices(devices);
    } catch (e: any) { setBtError(e.message); }
    setBtScanning(false);
  };

  const handleBtConnect = async (device: DeviceInfo) => {
    const connected = await connectBluetooth(device.id);
    setConnectedDevice(connected);
  };

  const handleReadDevice = async () => {
    setDeviceReading(true);
    try {
      let readings: VitalReadings;
      if (connectedDevice?.type === 'wifi') {
        readings = await readWifiVitals(wifiIp);
      } else {
        readings = await readBluetoothVitals(connectedDevice!.id);
      }
      setVitals(v => ({ ...v, ...readings }));
    } catch { /* ignore */ }
    setDeviceReading(false);
  };

  const handleWifiConnect = async () => {
    if (!wifiIp.trim()) return;
    const device = await connectWifi(wifiIp.trim());
    setConnectedDevice(device);
  };

  const loadHistory = async () => {
    try {
      const r = await api.get('/api/v1/triage/history');
      setHistory(r.data);
    } catch { /* ignore */ }
  };

  const deleteTriage = async (id: string) => {
    try {
      await api.delete(`/api/v1/triage/${id}`);
      setHistory(prev => prev.filter(h => h.id !== id && (h as any).session_id !== id));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao eliminar triagem.');
    }
    setDeleteConfirm(null);
  };

  const startTriage = async (e: FormEvent) => {
    e.preventDefault();
    if (!complaint.trim()) return;
    setLoading(true); setError('');
    try {
      const r = await api.post('/api/v1/triage/start', {
        chief_complaint: complaint,
        age_group: ageGroup,
        category,
        answered_by_guardian: ageGroup === 'pediatric' ? guardian : false,
        dependent_id: selectedDependent !== 'me' ? selectedDependent : undefined,
        vital_signs: Object.keys(vitals).length > 0 ? vitals : undefined,
      });
      setSessionId(r.data.triage_id ?? r.data.session_id);
      setQuestions(r.data.questions || []);
      setAnswers({});
      setStep('questions');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao iniciar triagem.');
    }
    setLoading(false);
  };

  const submitAnswers = async () => {
    setLoading(true); setError('');
    try {
      // Backend expects a list of {question_key, answer}
      const answerList = Object.entries(answers).map(([question_key, answer]) => ({ question_key, answer }));
      await api.post(`/api/v1/triage/${sessionId}/answers`, { answers: answerList });

      const r2 = await api.post(`/api/v1/triage/${sessionId}/complete`, {});
      setResult({
        id: r2.data.triage_id,
        triage_session_id: r2.data.triage_id,
        risk_level: r2.data.risk_level,
        recommended_action: r2.data.recommended_action,
        score: r2.data.score,
        reasoning: r2.data.reasoning || {},
        created_at: new Date().toISOString(),
      });
      setStep('result');
      loadHistory();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao submeter respostas.');
    }
    setLoading(false);
  };

  const riskData = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'URGENT': return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: t('risk.urgent'), icon: <AlertTriangle size={22} /> };
      case 'HIGH': return { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: t('risk.high'), icon: <AlertTriangle size={22} /> };
      case 'MEDIUM': return { color: '#eab308', bg: 'rgba(234,179,8,0.12)', label: t('risk.medium'), icon: <Clock size={22} /> };
      default: return { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: t('risk.low'), icon: <CheckCircle2 size={22} /> };
    }
  };

  const actionLabel = (action?: string) => {
    switch (action) {
      case 'ER_NOW': return t('triage.er_label');
      case 'DOCTOR_NOW': return t('triage.doctor_now_label');
      case 'DOCTOR_24H': return t('triage.doctor_24h_label');
      default: return t('triage.self_care_label');
    }
  };

  const riskBadge = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'URGENT': case 'HIGH': return 'badge-danger';
      case 'MEDIUM': return 'badge-warning';
      default: return 'badge-success';
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>{t('triage.title')}</h1>
        <p>{t('triage.subtitle')}</p>
      </div>

      {/* Tab nav */}
      <div className="tab-nav">
        <button className={step === 'history' ? 'active' : ''} onClick={() => setStep('history')}>{t('triage.history_tab')}</button>
        <button className={step === 'start' || step === 'questions' || step === 'result' ? 'active' : ''}
          onClick={() => { setStep('start'); setResult(null); setError(''); }}>
          {t('triage.new_tab')}
        </button>
      </div>

      {error && <div className="toast error" style={{ position: 'relative', top: 0, right: 0, marginBottom: '1rem' }}>{error}</div>}

      {/* ─── History ─── */}
      {step === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('triage.sessions')}</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setStep('start')}>
              <Activity size={14} /> {t('triage.new_btn')}
            </button>
          </div>
          {history.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <div className="empty-state-icon"><Activity size={24} style={{ color: 'var(--accent-teal)' }} /></div>
              <div className="empty-state-title">{t('triage.no_sessions')}</div>
              <div className="empty-state-desc">{t('triage.no_sessions_desc')}</div>
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('triage.chief_complaint')}</th>
                    <th>{t('table.risk')}</th>
                    <th>{t('table.recommendation')}</th>
                    <th>{t('table.score')}</th>
                    <th>{t('table.date')}</th>
                    <th style={{ width: '80px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => {
                    const rowId = (h as any).session_id || h.id;
                    const isPending = deleteConfirm === rowId;
                    return (
                      <tr key={rowId} style={isPending ? { background: 'rgba(239,68,68,0.04)' } : {}}>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{h.chief_complaint}</td>
                        <td><span className={`badge ${riskBadge(h.risk_level)}`}>{h.risk_level || h.status}</span></td>
                        <td style={{ fontSize: '0.8rem' }}>{h.recommended_action || '—'}</td>
                        <td>{h.score ?? '—'}</td>
                        <td>{new Date(h.created_at).toLocaleDateString(locale)}</td>
                        <td>
                          {isPending ? (
                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                              <button
                                className="btn btn-danger btn-sm"
                                style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
                                onClick={() => deleteTriage(rowId)}
                              >
                                Confirmar
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                                onClick={() => setDeleteConfirm(null)}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-ghost btn-sm"
                              title="Eliminar triagem"
                              style={{ color: 'var(--text-muted)', padding: '0.25rem 0.5rem' }}
                              onClick={() => setDeleteConfirm(rowId)}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Start ─── */}
      {step === 'start' && (
        <div className="card" style={{ maxWidth: '640px' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('triage.describe')}</h3>
          </div>
          <form onSubmit={startTriage} style={{ padding: '1.25rem' }}>

            {/* Dependent selector */}
            {dependents.length > 0 && (
              <div className="form-group">
                <label className="form-label">
                  <Users size={14} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />
                  {t('triage.for_whom')}
                </label>
                <select className="form-select" value={selectedDependent}
                  onChange={e => {
                    const id = e.target.value;
                    setSelectedDependent(id);
                    if (id !== 'me') {
                      const dep = dependents.find(d => d.id === id);
                      if (dep?.is_minor) { setAgeGroup('pediatric'); setGuardian(true); }
                    } else {
                      setAgeGroup('adult'); setGuardian(false);
                    }
                  }}>
                  <option value="me">{t('triage.for_me')}</option>
                  {dependents.map(d => (
                    <option key={d.id} value={d.id}>{d.name}{d.is_minor ? ' (Pediatria)' : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{t('triage.age_group')}</label>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${ageGroup === 'adult' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => { setAgeGroup('adult'); setGuardian(false); }}
                >
                  {t('triage.age_adult')}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${ageGroup === 'pediatric' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setAgeGroup('pediatric')}
                >
                  {t('triage.age_child')}
                </button>
              </div>
              {ageGroup === 'pediatric' && (
                <div style={{ marginTop: '0.75rem' }}>
                  <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={guardian} onChange={e => setGuardian(e.target.checked)} />
                    {t('triage.answered_by_parent')}
                  </label>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">{t('triage.category')}</label>
              <select className="form-select" value={category} onChange={e => setCategory(e.target.value as TriageCategory)}>
                <option value="general">{t('triage.cat_general')}</option>
                <option value="respiratory">{t('triage.cat_respiratory')}</option>
                <option value="cardiac">{t('triage.cat_cardiac')}</option>
                <option value="neuro">{t('triage.cat_neuro')}</option>
                <option value="gi">{t('triage.cat_gi')}</option>
                <option value="urinary">{t('triage.cat_urinary')}</option>
                <option value="skin">{t('triage.cat_skin')}</option>
                <option value="injury">{t('triage.cat_injury')}</option>
                <option value="mental">{t('triage.cat_mental')}</option>
                <option value="womens">{t('triage.cat_womens')}</option>
                <option value="medication">{t('triage.cat_medication')}</option>
                <option value="chronic">{t('triage.cat_chronic')}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('triage.chief_complaint')}</label>
              <textarea className="form-textarea" rows={3}
                placeholder={t('triage.describe_placeholder')}
                value={complaint} onChange={e => setComplaint(e.target.value)} required
                style={{
                  width: '100%', padding: '0.7rem 0.9rem',
                  background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text-primary)', fontSize: '0.88rem', resize: 'vertical',
                }} />
            </div>

            {/* ── Vitals Panel ── */}
            <div className="vitals-panel">
              <div className="vitals-panel__header">
                <Heart size={15} style={{ color: '#ef4444' }} />
                <span>{t('vitals.title')}</span>
              </div>

              {/* Tab switcher */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                {(['manual', 'bluetooth', 'wifi'] as const).map(tab => (
                  <button key={tab} type="button"
                    className={`btn btn-sm ${deviceTab === tab ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => setDeviceTab(tab)}>
                    {tab === 'manual' && <>{t('vitals.manual')}</>}
                    {tab === 'bluetooth' && <><Bluetooth size={12} /> Bluetooth</>}
                    {tab === 'wifi' && <><Wifi size={12} /> WiFi</>}
                  </button>
                ))}
              </div>

              {/* Manual entry */}
              {deviceTab === 'manual' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  {[
                    { key: 'systolic', label: t('vitals.bp_sys'), icon: <Heart size={12} />, unit: 'mmHg' },
                    { key: 'diastolic', label: t('vitals.bp_dia'), icon: <Heart size={12} />, unit: 'mmHg' },
                    { key: 'spo2', label: t('vitals.spo2'), icon: <Droplets size={12} />, unit: '%' },
                    { key: 'temperature', label: t('vitals.temp'), icon: <Thermometer size={12} />, unit: '°C' },
                    { key: 'glucose', label: t('vitals.glucose'), icon: <Zap size={12} />, unit: 'mg/dL' },
                  ].map(({ key, label, icon, unit }) => {
                    const val = vitals[key as keyof VitalReadings] as number | undefined;
                    const color = vitalStatus(key as keyof VitalReadings, val);
                    return (
                      <div key={key} style={{ position: 'relative' }}>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.2rem' }}>
                          {icon} {label}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <input type="number" className="form-input" style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                            placeholder="—"
                            value={val ?? ''}
                            onChange={e => setVitals((v: any) => ({ ...v, [key]: e.target.value ? Number(e.target.value) : undefined }))} />
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>{unit}</span>
                          {val !== undefined && (
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} title={color === '#22c55e' ? 'Normal' : color === '#eab308' ? 'Limite' : 'Fora do normal'} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bluetooth */}
              {deviceTab === 'bluetooth' && (
                <div>
                  {btError && <p style={{ fontSize: '0.78rem', color: '#ef4444', marginBottom: '0.5rem' }}>{btError}</p>}
                  {!connectedDevice ? (
                    <>
                      <button type="button" className="btn btn-sm btn-outline" onClick={handleBtScan} disabled={btScanning}
                        style={{ marginBottom: '0.75rem' }}>
                        <Bluetooth size={13} /> {btScanning ? t('vitals.bt_scanning') : t('vitals.bt_scan')}
                      </button>
                      {btDevices.map(d => (
                        <div key={d.id} className="device-row">
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{d.name}</span>
                          <button type="button" className="btn btn-sm btn-primary" style={{ fontSize: '0.75rem' }}
                            onClick={() => handleBtConnect(d)}>
                            {t('vitals.connect')}
                          </button>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#22c55e', fontWeight: 600 }}>✓ {t('vitals.connected')}: {connectedDevice.name}</span>
                      <button type="button" className="btn btn-sm btn-primary" onClick={handleReadDevice} disabled={deviceReading}>
                        {deviceReading ? '…' : t('vitals.read')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* WiFi */}
              {deviceTab === 'wifi' && (
                <div>
                  {!connectedDevice ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                          {t('vitals.wifi_label')}
                        </label>
                        <input className="form-input" style={{ fontSize: '0.85rem' }} type="text" placeholder="192.168.1.50"
                          value={wifiIp} onChange={e => setWifiIp(e.target.value)} />
                      </div>
                      <button type="button" className="btn btn-sm btn-outline" onClick={handleWifiConnect}>
                        <Wifi size={13} /> {t('vitals.connect')}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#22c55e', fontWeight: 600 }}>✓ {t('vitals.connected')}: {connectedDevice.name}</span>
                      <button type="button" className="btn btn-sm btn-primary" onClick={handleReadDevice} disabled={deviceReading}>
                        {deviceReading ? '…' : t('vitals.read')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Vitals preview badges */}
              {Object.keys(vitals).filter(k => k !== 'readAt').length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  {[
                    { key: 'systolic', label: 'SBP', unit: 'mmHg' },
                    { key: 'diastolic', label: 'DBP', unit: 'mmHg' },
                    { key: 'spo2', label: 'SpO₂', unit: '%' },
                    { key: 'temperature', label: 'Temp', unit: '°C' },
                    { key: 'glucose', label: 'Gli', unit: 'mg/dL' },
                  ].filter(({ key }) => vitals[key as keyof VitalReadings] !== undefined).map(({ key, label, unit }) => {
                    const val = vitals[key as keyof VitalReadings] as number;
                    const color = vitalStatus(key as keyof VitalReadings, val);
                    return (
                      <span key={key} style={{
                        padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600,
                        background: `${color}18`, color, border: `1px solid ${color}40`,
                      }}>
                        {label}: {val} {unit}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('triage.starting') : <><ChevronRight size={16} /> {t('triage.start_btn')}</>}
            </button>
          </form>
        </div>
      )}

      {/* ─── Questions ─── */}
      {step === 'questions' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{t('triage.answer_questions')}</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {t('triage.summary')}: <strong style={{ color: 'var(--text-primary)' }}>{(ageGroup === 'adult' ? t('triage.age_adult') : t('triage.age_child'))} • {t(`triage.cat_${category}`)}</strong> — {t('triage.chief_complaint')}: <strong style={{ color: 'var(--text-primary)' }}>{complaint}</strong>
            </p>
          </div>
          <div style={{ padding: '1.25rem' }}>
            {questions.map((q, qi) => (
              <div key={q.key} className="form-group triage-question-group">
                <label className="form-label" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  <span style={{ color: 'var(--accent-teal)', marginRight: '0.4rem', fontSize: '0.75rem' }}>{qi + 1}.</span>
                  {q.label && q.label.trim() ? q.label : (QUESTION_LABELS[q.key] ?? q.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}
                </label>
                {q.type === 'boolean' && (
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {[t('triage.yes'), t('triage.no')].map(opt => (
                      <button key={opt} type="button"
                        className={`btn btn-sm ${answers[q.key] === (opt === t('triage.yes')) ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setAnswers(a => ({ ...a, [q.key]: opt === t('triage.yes') }))}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === 'scale' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button key={n} type="button"
                        className={`btn btn-sm ${answers[q.key] === n ? 'btn-primary' : 'btn-outline'}`}
                        style={{ minWidth: '2rem', justifyContent: 'center' }}
                        onClick={() => setAnswers(a => ({ ...a, [q.key]: n }))}>
                        {n}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === 'select' && q.options && (
                  <select className="form-select" value={String(answers[q.key] || '')}
                    onChange={e => setAnswers(a => ({ ...a, [q.key]: e.target.value }))}>
                    <option value="">{t('common.select')}</option>
                    {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn btn-outline" onClick={() => setStep('start')}>
                <ArrowLeft size={16} /> {t('common.cancel')}
              </button>
              <button className="btn btn-primary" onClick={submitAnswers} disabled={loading}>
                {loading ? t('triage.submitting') : t('triage.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Result ─── */}
      {step === 'result' && result && (() => {
        const rd = riskData(result.risk_level);
        return (
          <div className="card" style={{ maxWidth: '600px' }}>
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: rd.bg, border: `2px solid ${rd.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem', color: rd.color,
              }}>
                {rd.icon}
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                {t('triage.risk_level')}: <span style={{ color: rd.color }}>{rd.label}</span>
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Score: {result.score} / 100
              </p>

              <div style={{
                padding: '1rem', borderRadius: '12px',
                background: rd.bg, border: `1px solid ${rd.color}30`,
                marginBottom: '1.5rem',
              }}>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: rd.color }}>
                  {actionLabel(result.recommended_action)}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => { setStep('start'); setComplaint(''); setResult(null); }}>
                  <RotateCcw size={16} /> {t('triage.new_again')}
                </button>
                <button className="btn btn-outline" onClick={() => { setStep('history'); loadHistory(); }}>
                  {t('triage.history_tab')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
