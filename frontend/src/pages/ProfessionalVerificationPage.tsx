import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ExternalLink, FileCheck2, Loader2, ShieldCheck, Upload } from 'lucide-react';
import api from '../api';
import { useAuth } from '../AuthContext';
import { apiErrorMessage } from '../utils/apiError';

type Evidence = { id: string; kind: string; original_filename: string; size_bytes: number };
type Credential = {
  profession: 'doctor' | 'nurse'; legal_name: string; status: string; automated_score: number;
  practice_country: string; licence_country: string; diploma_country: string;
  licence_number: string; issuing_authority: string; evidence: Evidence[];
  missing_evidence: string[]; automated_checks: { code: string; passed: boolean; label: string }[];
  registry?: { authority: string; url?: string; mode: string };
  review_notes?: string; rejection_reason?: string;
};

const LABELS: Record<string, string> = {
  professional_card: 'Cédula / licença profissional',
  diploma: 'Diploma ou certificado de formação',
  recognition: 'Reconhecimento ou equivalência do diploma',
  local_registration: 'Inscrição profissional no país de exercício',
};

export default function ProfessionalVerificationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [credential, setCredential] = useState<Credential | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/api/v1/credentials/me')
      .then(r => setCredential(r.data))
      .catch(e => setError(apiErrorMessage(e, 'Não foi possível carregar o processo.')))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const requiredKinds = useMemo(() => {
    const base = ['professional_card', 'diploma'];
    if (credential?.practice_country !== credential?.diploma_country) base.push('recognition');
    if (credential?.practice_country !== credential?.licence_country) base.push('local_registration');
    return base;
  }, [credential]);

  if (user && !['doctor', 'nurse'].includes(user.role)) return <Navigate to="/dashboard" replace />;

  const upload = async (kind: string, file?: File) => {
    if (!file) return;
    setUploading(kind); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post(`/api/v1/credentials/me/evidence/${kind}`, form);
      setCredential(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'Não foi possível enviar o documento.'));
    } finally { setUploading(''); }
  };

  const submit = async () => {
    setSubmitting(true); setError('');
    try {
      const res = await api.post('/api/v1/credentials/me/submit');
      setCredential(res.data);
    } catch (e) {
      setError(apiErrorMessage(e, 'O processo ainda precisa de informação.'));
      load();
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!credential) return <div className="empty-state"><AlertCircle /><p>{error || 'Processo não encontrado.'}</p></div>;

  const locked = ['pending_review', 'verified', 'suspended'].includes(credential.status);
  const complete = requiredKinds.every(kind => credential.evidence.some(item => item.kind === kind));
  const statusText: Record<string, string> = {
    draft: 'Documentos por completar', needs_info: 'Informação adicional necessária',
    pending_review: 'Em revisão pela equipa KAYA', verified: 'Profissional verificado',
    rejected: 'Verificação recusada', suspended: 'Verificação suspensa',
  };

  return (
    <>
      <div className="page-header">
        <h1>Verificação profissional</h1>
        <p>Acesso clínico seguro para médicos e enfermeiros.</p>
      </div>
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, display: 'grid', placeItems: 'center', background: credential.status === 'verified' ? '#dcfce7' : '#ecfeff', color: credential.status === 'verified' ? '#15803d' : '#0f766e' }}>
            <ShieldCheck size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <strong>{statusText[credential.status] || credential.status}</strong>
            <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 3 }}>
              {credential.legal_name} · {credential.profession === 'doctor' ? 'Médico/a' : 'Enfermeiro/a'} · licença {credential.licence_number}
            </div>
          </div>
          <span className={`badge ${credential.status === 'verified' ? 'badge-success' : credential.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
            {credential.automated_score}% completo
          </span>
        </div>

        {(credential.review_notes || credential.rejection_reason) && (
          <div style={{ padding: '1rem', borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412' }}>
            <strong>Nota da revisão:</strong> {credential.rejection_reason || credential.review_notes}
          </div>
        )}

        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 .25rem' }}>Documentos obrigatórios</h3>
          <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '.82rem' }}>
            PDF, JPG ou PNG, até 10 MB. Os documentos são privados e acessíveis apenas pelo titular e revisores autorizados.
          </p>
          <div style={{ display: 'grid', gap: '.7rem' }}>
            {requiredKinds.map(kind => {
              const item = credential.evidence.find(e => e.kind === kind);
              return (
                <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: '.8rem', padding: '.85rem', border: '1px solid var(--border)', borderRadius: 10 }}>
                  {item ? <FileCheck2 size={20} color="#059669" /> : <Upload size={20} color="#64748b" />}
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '.86rem' }}>{LABELS[kind]}</strong>
                    <div style={{ fontSize: '.76rem', color: 'var(--text-muted)' }}>{item ? item.original_filename : 'Ainda não enviado'}</div>
                  </div>
                  {!locked && (
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                      {uploading === kind ? <Loader2 size={14} className="spin" /> : item ? 'Substituir' : 'Enviar'}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={e => upload(kind, e.target.files?.[0])} />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 .7rem' }}>Validação assistida</h3>
          {credential.automated_checks.map(check => (
            <div key={check.code} style={{ display: 'flex', gap: '.5rem', alignItems: 'center', fontSize: '.82rem', margin: '.45rem 0' }}>
              {check.passed ? <CheckCircle2 size={16} color="#059669" /> : <AlertCircle size={16} color="#d97706" />}
              {check.label}
            </div>
          ))}
          {credential.registry?.url && (
            <a href={credential.registry.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: '.7rem', color: 'var(--accent-teal)' }}>
              {credential.registry.authority} <ExternalLink size={13} />
            </a>
          )}
          <p style={{ fontSize: '.76rem', color: 'var(--text-muted)', margin: '.8rem 0 0' }}>
            A validação automática verifica completude e consistência; a aprovação final é sempre feita por um revisor autorizado.
          </p>
        </div>

        {error && <div className="toast error" style={{ position: 'relative', inset: 'auto' }}>{error}</div>}
        {credential.status === 'verified' ? (
          <button className="btn btn-primary btn-lg" onClick={() => navigate(user?.role === 'doctor' ? '/doctor/dashboard' : '/nurse')}>
            Entrar no painel clínico
          </button>
        ) : !locked && (
          <button className="btn btn-primary btn-lg" disabled={!complete || submitting} onClick={submit} style={{ justifyContent: 'center' }}>
            {submitting ? <><Loader2 size={16} className="spin" /> A enviar…</> : 'Submeter para revisão'}
          </button>
        )}
      </div>
    </>
  );
}
