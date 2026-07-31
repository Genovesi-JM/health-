import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import api from '../api';
import OnboardingShell, { type OnboardingStepDef, type StepRenderContext } from '../components/OnboardingShell';
import DocumentUpload from '../components/DocumentUpload';
import ExtractedDataConfirmation, { type ExtractedField } from '../components/ExtractedDataConfirmation';
import { useT } from '../i18n/LanguageContext';

/* ── Small building blocks reused across steps ──────────────────────── */

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <label style={{ display: 'block', marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
        {label}
        {required
          ? <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>
          : <span style={{ marginLeft: 6, fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>opt</span>}
      </div>
      {children}
      {hint && <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{hint}</div>}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.8rem',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-primary)',
  fontSize: '0.9rem',
  color: 'var(--text-primary)',
};

function Text({ ctx, k, placeholder, type = 'text' }: { ctx: StepRenderContext; k: string; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={(ctx.data[k] as string) ?? ''}
      onChange={e => ctx.setField(k, e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
}

function Textarea({ ctx, k, placeholder, rows = 3 }: { ctx: StepRenderContext; k: string; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={(ctx.data[k] as string) ?? ''}
      onChange={e => ctx.setField(k, e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ ...inputStyle, resize: 'vertical' }}
    />
  );
}

function Toggle({ ctx, k, label }: { ctx: StepRenderContext; k: string; label: string }) {
  const checked = Boolean(ctx.data[k]);
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => ctx.setField(k, e.target.checked)}
        style={{ marginTop: 3, accentColor: 'var(--brand-primary)' }}
      />
      <span style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>{label}</span>
    </label>
  );
}

/* ── Provider-integrated step bodies ─────────────────────────────────── */

/** Step 3 — Sumsub identity kickoff. Backend call is idempotent so refresh is safe. */
function IdentityStep({ ctx }: { ctx: StepRenderContext }) {
  const { t } = useT();
  const started = Boolean(ctx.data.identity_reference);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const res = await api.post('/api/v1/verification/identity/start');
      ctx.setField('identity_reference', res.data.provider_reference);
      ctx.setField('identity_mode', res.data.mode);
      ctx.setField('identity_action_url', res.data.action_url ?? null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || 'Falha na verificação.');
    } finally {
      setBusy(false);
    }
  };

  if (started) {
    return (
      <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 6 }}>
          <ShieldCheck size={16} style={{ color: '#059669' }} /> {t('prob.s3_started')}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Ref: {String(ctx.data.identity_reference).slice(0, 24)}…
          {ctx.data.identity_mode === 'mock' && (
            <span style={{ marginLeft: 8, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>SANDBOX</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button type="button" className="btn btn-primary" onClick={start} disabled={busy}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {busy && <Loader2 size={14} className="spin" />} {t('prob.s3_start')}
      </button>
      {error && <div style={{ marginTop: 12, color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>}
    </div>
  );
}

/** Step 6 — Azure DI extraction demo (works against a locally-uploaded evidence). */
function ExtractionStep({ ctx }: { ctx: StepRenderContext }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fields, setFields] = useState<ExtractedField[] | null>(null);

  const run = async () => {
    setBusy(true); setNotice(null);
    try {
      // A real run needs a file; we send a small placeholder so backend
      // returns NOT_CONFIGURED when Azure DI creds are absent — the
      // frontend then shows a clear message rather than pretending.
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }), 'placeholder.pdf');
      const res = await api.post('/api/v1/verification/documents/extract', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.status === 'not_configured') {
        setNotice(res.data.message || 'Extração automática indisponível — preencha manualmente.');
      } else if (res.data.status === 'processing') {
        setNotice('Extração em curso. Voltará a esta página quando terminar.');
      } else {
        const extracted = res.data.extracted || {};
        const confidence = res.data.confidence || {};
        setFields(Object.keys(extracted).map(k => ({
          key: k, label: k, extractedValue: extracted[k], confidence: confidence[k] ?? 1,
        })));
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setNotice(err.response?.data?.detail || 'Falha na extração.');
    } finally { setBusy(false); }
  };

  return (
    <div>
      {!fields && (
        <button type="button" className="btn btn-primary btn-sm" onClick={run} disabled={busy}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {busy && <Loader2 size={14} className="spin" />} {t('prob.s6_run')}
        </button>
      )}
      {notice && (
        <div style={{ marginTop: 12, padding: '0.75rem 1rem', borderRadius: 8, background: 'rgba(20,184,166,0.06)', fontSize: '0.85rem' }}>
          {notice}
        </div>
      )}
      {fields && (
        <div style={{ marginTop: 12 }}>
          <ExtractedDataConfirmation
            fields={fields}
            onConfirm={(vals) => {
              ctx.setField('extracted_confirmed', vals);
              setNotice('Dados confirmados.');
            }}
            onMarkIncorrect={() => { setFields(null); setNotice('Recarregue o documento e tente novamente.'); }}
          />
        </div>
      )}
    </div>
  );
}

/** Step 7 — Veremark/Certn qualification check kickoff. */
function QualificationStep({ ctx }: { ctx: StepRenderContext }) {
  const { t } = useT();
  const started = Boolean(ctx.data.qualification_reference);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const res = await api.post('/api/v1/verification/qualifications/start');
      ctx.setField('qualification_reference', res.data.provider_reference);
      ctx.setField('qualification_mode', res.data.mode);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || 'Falha ao iniciar verificação.');
    } finally { setBusy(false); }
  };

  return started ? (
    <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
      <ShieldCheck size={16} style={{ color: '#059669', verticalAlign: 'middle', marginRight: 6 }} />
      Verificação submetida. Ref: {String(ctx.data.qualification_reference).slice(0, 20)}…
    </div>
  ) : (
    <div>
      <button type="button" className="btn btn-primary" onClick={start} disabled={busy}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {busy && <Loader2 size={14} className="spin" />} {t('prob.s7_start')}
      </button>
      {error && <div style={{ marginTop: 12, color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>}
    </div>
  );
}

/** Step 9 — Regulatory registry — always manual review. */
function RegistryStep({ ctx }: { ctx: StepRenderContext }) {
  const { t } = useT();
  const done = Boolean(ctx.data.registry_reference);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authority, setAuthority] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setError(null);
    try {
      const res = await api.post('/api/v1/verification/registry/check');
      ctx.setField('registry_reference', res.data.provider_reference || 'manual');
      const auth = res.data?.raw?.authority || res.data?.raw?.authority_home_url;
      if (auth) setAuthority(auth);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || 'Falha ao enviar para revisão.');
    } finally { setBusy(false); }
  };

  return done ? (
    <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: 'rgba(20,184,166,0.06)' }}>
      Registo enviado ao revisor de conformidade. {authority && <>Órgão: <strong>{authority}</strong></>}
    </div>
  ) : (
    <div>
      <button type="button" className="btn btn-primary" onClick={run} disabled={busy}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {busy && <Loader2 size={14} className="spin" />} {t('prob.s9_run')}
      </button>
      {error && <div style={{ marginTop: 12, color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function ProfessionalOnboardingPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialProfession = (params.get('role') as 'doctor' | 'nurse' | 'pharmacist') || 'doctor';
  const [done, setDone] = useState(false);

  const steps: OnboardingStepDef[] = useMemo(() => [
    // 1 — Account + role
    {
      key: 'account',
      title: t('prob.s1_title'),
      subtitle: t('prob.s1_sub'),
      defaults: { profession: initialProfession, practice_country: 'AO', preferred_language: 'pt' },
      render: (ctx) => (
        <>
          <Field label="Profissão" required>
            <select value={(ctx.data.profession as string) ?? 'doctor'} onChange={e => ctx.setField('profession', e.target.value)} style={inputStyle}>
              <option value="doctor">Médico(a)</option>
              <option value="nurse">Enfermeiro(a)</option>
              <option value="pharmacist">Farmacêutico(a)</option>
            </select>
          </Field>
          <Field label="País de exercício" required>
            <select value={(ctx.data.practice_country as string) ?? 'AO'} onChange={e => ctx.setField('practice_country', e.target.value)} style={inputStyle}>
              <option value="AO">Angola</option>
              <option value="PT">Portugal</option>
              <option value="ES">España</option>
              <option value="OTHER">Outro</option>
            </select>
          </Field>
          <Field label="Local principal de trabalho">
            <select value={(ctx.data.workplace_type as string) ?? ''} onChange={e => ctx.setField('workplace_type', e.target.value)} style={inputStyle}>
              <option value="">—</option>
              <option value="clinic">Clínica</option>
              <option value="hospital">Hospital</option>
              <option value="private_practice">Consultório privado</option>
              <option value="telemedicine_only">Apenas teleconsulta</option>
            </select>
          </Field>
        </>
      ),
    },

    // 2 — Verify contacts
    {
      key: 'verify',
      title: t('prob.s2_title'),
      subtitle: t('pob.s2_sub'),
      render: (ctx) => (
        <>
          <Field label="Email profissional" required>
            <Text ctx={ctx} k="email" type="email" placeholder="voce@clinica.example" />
          </Field>
          <Field label="Telemóvel">
            <Text ctx={ctx} k="phone" type="tel" placeholder="+244 900 000 000" />
          </Field>
        </>
      ),
      validate: (d) => {
        const email = String(d.email || '');
        return /.+@.+\..+/.test(email) ? null : 'Email inválido.';
      },
    },

    // 3 — Identity verification (Sumsub)
    {
      key: 'identity',
      title: t('prob.s3_title'),
      subtitle: t('prob.s3_sub'),
      render: (ctx) => <IdentityStep ctx={ctx} />,
      validate: (d) => d.identity_reference ? null : 'Inicie a verificação de identidade para continuar.',
    },

    // 4 — Professional registration
    {
      key: 'registration',
      title: t('prob.s4_title'),
      subtitle: '',
      render: (ctx) => (
        <>
          <Field label="Nome legal completo" required>
            <Text ctx={ctx} k="legal_name" placeholder="Como consta no documento" />
          </Field>
          <Field label="Autoridade emissora" required>
            <Text ctx={ctx} k="issuing_authority" placeholder="Ex: Ordem dos Médicos de Angola" />
          </Field>
          <Field label="Número da cédula" required>
            <Text ctx={ctx} k="licence_number" placeholder="Ex: AO-DR-12345" />
          </Field>
          <Field label="Data de emissão">
            <Text ctx={ctx} k="licence_issue_date" type="date" />
          </Field>
          <Field label="Data de validade">
            <Text ctx={ctx} k="licence_expiry_date" type="date" />
          </Field>
        </>
      ),
      validate: (d) => {
        if (!d.legal_name || !d.issuing_authority || !d.licence_number) return 'Preencha os campos obrigatórios.';
        return null;
      },
    },

    // 5 — Professional documents
    {
      key: 'documents',
      title: t('prob.s5_title'),
      subtitle: t('prob.s5_sub'),
      render: () => (
        <>
          <DocumentUpload kind="professional_card" />
          <DocumentUpload kind="diploma" />
          <DocumentUpload kind="insurance" />
        </>
      ),
    },

    // 6 — Azure DI extraction
    {
      key: 'extract',
      title: t('prob.s6_title'),
      subtitle: t('prob.s6_sub'),
      optional: true,
      render: (ctx) => <ExtractionStep ctx={ctx} />,
    },

    // 7 — Qualification check
    {
      key: 'qualification',
      title: t('prob.s7_title'),
      subtitle: t('prob.s7_sub'),
      render: (ctx) => <QualificationStep ctx={ctx} />,
      validate: (d) => d.qualification_reference ? null : 'Inicie a verificação de qualificações.',
    },

    // 8 — Digital credential (optional Entra VID)
    {
      key: 'digital_credential',
      title: t('prob.s8_title'),
      subtitle: t('prob.s8_sub'),
      optional: true,
      render: (ctx) => (
        <Field label="Credencial digital" hint="Cole ou anexe se a sua instituição emite uma credencial verificável Entra.">
          <Textarea ctx={ctx} k="digital_credential_blob" placeholder="{ optional JWT / VC blob }" rows={4} />
        </Field>
      ),
    },

    // 9 — Registry
    {
      key: 'registry',
      title: t('prob.s9_title'),
      subtitle: t('prob.s9_sub'),
      render: (ctx) => <RegistryStep ctx={ctx} />,
      validate: (d) => d.registry_reference ? null : 'Envie o registo para revisão.',
    },

    // 10 — Qualifications & experience
    {
      key: 'qualifications',
      title: t('prob.s10_title'),
      subtitle: '',
      render: (ctx) => (
        <>
          <Field label="Universidade" required><Text ctx={ctx} k="university" /></Field>
          <Field label="Curso / grau" required><Text ctx={ctx} k="degree_title" placeholder="Ex: Medicina" /></Field>
          <Field label="Ano de conclusão"><Text ctx={ctx} k="graduation_year" type="number" placeholder="2018" /></Field>
          <Field label="Especialidades">
            <Text ctx={ctx} k="specializations" placeholder="Ex: Cardiologia, Pediatria" />
          </Field>
          <Field label="Anos de experiência"><Text ctx={ctx} k="years_experience" type="number" /></Field>
          <Field label="Empregador atual"><Text ctx={ctx} k="current_employer" /></Field>
          <Field label="Biografia">
            <Textarea ctx={ctx} k="bio" placeholder="Uma breve descrição profissional (300 caracteres)" rows={3} />
          </Field>
        </>
      ),
      validate: (d) => (!d.university || !d.degree_title) ? 'Universidade e curso são obrigatórios.' : null,
    },

    // 11 — Clinical services
    {
      key: 'services',
      title: t('prob.s11_title'),
      subtitle: '',
      render: (ctx) => (
        <>
          <Field label="Condições tratadas">
            <Textarea ctx={ctx} k="conditions_treated" placeholder="Ex: hipertensão, diabetes, ansiedade" rows={3} />
          </Field>
          <Toggle ctx={ctx} k="offers_teleconsultation" label="Ofereço teleconsulta" />
          <Toggle ctx={ctx} k="offers_clinic" label="Ofereço consulta em clínica" />
          <Toggle ctx={ctx} k="offers_home_visit" label="Ofereço visita domiciliária" />
          <Toggle ctx={ctx} k="prescribing_authority" label="Tenho autoridade para prescrever" />
          <Toggle ctx={ctx} k="renews_chronic_rx" label="Faço renovações de medicação crónica" />
          <Field label="Faixas etárias atendidas">
            <Text ctx={ctx} k="age_groups" placeholder="Ex: 18–65, pediátrico" />
          </Field>
          <Field label="Capacidade máxima por dia">
            <Text ctx={ctx} k="daily_capacity" type="number" placeholder="20" />
          </Field>
        </>
      ),
    },

    // 12 — Languages & accessibility
    {
      key: 'languages',
      title: t('prob.s12_title'),
      subtitle: '',
      render: (ctx) => (
        <>
          <Field label="Idiomas (marque todos que fala)">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {['pt', 'en', 'fr', 'es', 'ln', 'kg'].map(code => {
                const selected = ((ctx.data.languages as string[]) ?? ['pt']).includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      const cur = (ctx.data.languages as string[]) ?? [];
                      ctx.setField('languages', selected ? cur.filter(x => x !== code) : [...cur, code]);
                    }}
                    style={{
                      padding: '0.4rem 0.9rem', borderRadius: 999,
                      border: `1px solid ${selected ? 'var(--brand-primary)' : 'var(--border)'}`,
                      background: selected ? 'var(--brand-primary)' : 'var(--bg-primary)',
                      color: selected ? '#fff' : 'var(--text-primary)',
                      fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                    }}
                  >{code.toUpperCase()}</button>
                );
              })}
            </div>
          </Field>
          <Toggle ctx={ctx} k="sign_language" label="Comunico em língua de sinais" />
          <Toggle ctx={ctx} k="wheelchair_accessible_clinic" label="Consultório acessível a cadeira de rodas" />
        </>
      ),
    },

    // 13 — Availability
    {
      key: 'availability',
      title: t('prob.s13_title'),
      subtitle: '',
      render: (ctx) => (
        <>
          <Field label="Dias de trabalho">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(d => {
                const selected = ((ctx.data.working_days as string[]) ?? []).includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      const cur = (ctx.data.working_days as string[]) ?? [];
                      ctx.setField('working_days', selected ? cur.filter(x => x !== d) : [...cur, d]);
                    }}
                    style={{
                      padding: '0.4rem 0.75rem', borderRadius: 8,
                      border: `1px solid ${selected ? 'var(--brand-primary)' : 'var(--border)'}`,
                      background: selected ? 'var(--brand-primary)' : 'var(--bg-primary)',
                      color: selected ? '#fff' : 'var(--text-primary)',
                      fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', textTransform: 'capitalize',
                    }}
                  >{d}</button>
                );
              })}
            </div>
          </Field>
          <Field label="Horário (ex: 09:00–18:00)"><Text ctx={ctx} k="working_hours" placeholder="09:00–18:00" /></Field>
          <Field label="Duração média da consulta (min)"><Text ctx={ctx} k="consult_duration" type="number" placeholder="30" /></Field>
          <Field label="Endereço da clínica (opcional)"><Text ctx={ctx} k="clinic_address" /></Field>
        </>
      ),
    },

    // 14 — Prices + payouts
    {
      key: 'pricing',
      title: t('prob.s14_title'),
      subtitle: '',
      render: (ctx) => (
        <>
          <Field label="Preço teleconsulta (Kz)"><Text ctx={ctx} k="fee_tele" type="number" placeholder="15000" /></Field>
          <Field label="Preço consulta presencial (Kz)"><Text ctx={ctx} k="fee_in_person" type="number" placeholder="25000" /></Field>
          <Field label="Preço visita domiciliária (Kz)"><Text ctx={ctx} k="fee_home" type="number" /></Field>
          <Field label="Nome do titular da conta bancária" required>
            <Text ctx={ctx} k="bank_holder_name" />
          </Field>
          <Field label="IBAN" required hint="Nunca voltará a ser mostrado após guardar.">
            <Text ctx={ctx} k="iban" placeholder="AO06 …" />
          </Field>
          <Field label="Nº de contribuinte"><Text ctx={ctx} k="tax_id" /></Field>
        </>
      ),
      validate: (d) => (!d.bank_holder_name || !d.iban) ? 'Preencha os dados de pagamento.' : null,
    },

    // 15 — Compliance agreements
    {
      key: 'compliance',
      title: t('prob.s15_title'),
      subtitle: '',
      render: (ctx) => (
        <>
          <Toggle ctx={ctx} k="agree_data_protection" label="Aceito o Acordo de Proteção de Dados." />
          <Toggle ctx={ctx} k="agree_conduct" label="Aceito o Código de Conduta Profissional." />
          <Toggle ctx={ctx} k="agree_clinical_responsibility" label="Aceito o Acordo de Responsabilidade Clínica." />
          <Toggle ctx={ctx} k="agree_telemedicine_rules" label="Aceito as Regras de Telemedicina." />
          <Toggle ctx={ctx} k="agree_prescription_rules" label="Aceito as Regras de Prescrição." />
          <Toggle ctx={ctx} k="agree_confidentiality" label="Aceito o Acordo de Confidencialidade." />
          <Toggle ctx={ctx} k="agree_insurance" label="Confirmo que possuo seguro profissional em vigor." />
          <Toggle ctx={ctx} k="agree_background_check" label="Autorizo verificações de antecedentes conforme aplicável." />
          <Toggle ctx={ctx} k="agree_commission" label="Aceito o Acordo Comercial e a comissão da plataforma." />
          <Toggle ctx={ctx} k="agree_complaints" label="Compreendo o processo de queixas e investigação." />
          <Toggle ctx={ctx} k="agree_suspension" label="Compreendo as regras de suspensão da conta." />
          <Toggle ctx={ctx} k="agree_renewal_obligations" label="Comprometo-me a renovar os documentos antes da caducidade." />
        </>
      ),
      validate: (d) => {
        for (const k of ['agree_data_protection','agree_conduct','agree_clinical_responsibility','agree_telemedicine_rules','agree_confidentiality','agree_insurance','agree_commission']) {
          if (!d[k]) return 'Todos os acordos obrigatórios devem ser aceites.';
        }
        return null;
      },
    },

    // 16 — Review
    {
      key: 'review',
      title: t('prob.s16_title'),
      subtitle: t('prob.s16_sub'),
      render: () => (
        <div style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          <p style={{ margin: '0 0 0.75rem' }}>
            Ao carregar em <strong>Concluir</strong>, submete a candidatura para revisão pela equipa de conformidade.
          </p>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Não poderá atender pacientes até à aprovação final. Notificações serão enviadas por email.
          </p>
        </div>
      ),
    },

    // 17 — Status dashboard (post-submit placeholder inside wizard)
    {
      key: 'status',
      title: t('prob.s17_title'),
      subtitle: '',
      render: () => (
        <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          A candidatura entra em revisão. Poderá acompanhar cada passo na página <strong>Verificação profissional</strong>.
        </div>
      ),
    },
  ], [t, initialProfession]);

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div className="card" style={{ padding: '2rem 1.75rem', maxWidth: 480, textAlign: 'center' }}>
          <CheckCircle2 size={56} style={{ color: '#22c55e', marginBottom: '0.75rem' }} />
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 800 }}>{t('prob.done_title')}</h1>
          <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)' }}>{t('prob.done_sub')}</p>
          <button className="btn btn-primary" onClick={() => navigate('/professional-verification')}>
            {t('prob.go_status')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', paddingTop: '2rem' }}>
      <OnboardingShell
        role="doctor"
        steps={steps}
        onSubmitted={() => setDone(true)}
      />
    </div>
  );
}
