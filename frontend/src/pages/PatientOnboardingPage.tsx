import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import OnboardingShell, { type OnboardingStepDef, type StepRenderContext } from '../components/OnboardingShell';
import { useT } from '../i18n/LanguageContext';

/* ── Small building blocks ────────────────────────────────────────────── */

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

function Toggle({ ctx, k, label }: { ctx: StepRenderContext; k: string; label: string }) {
  const checked = Boolean(ctx.data[k]);
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
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

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function PatientOnboardingPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  const steps: OnboardingStepDef[] = useMemo(() => [
    // Step 1 — Language + communication
    {
      key: 'lang',
      title: t('pob.s1_title'),
      subtitle: t('pob.s1_sub'),
      defaults: { language: 'pt', channel: 'email' },
      render: (ctx) => {
        // Seed defaults into the draft so they persist even if the user doesn't touch the selects.
        const lang = (ctx.data.language as string) ?? 'pt';
        const channel = (ctx.data.channel as string) ?? 'email';
        return (
          <>
            <Field label={t('pob.s1_title')} required>
              <select value={lang} onChange={e => ctx.setField('language', e.target.value)} style={inputStyle}>
                <option value="pt">Português</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
                <option value="zh">中文</option>
              </select>
            </Field>
            <Field label={t('pob.s1_sub')} required>
              <select value={channel} onChange={e => ctx.setField('channel', e.target.value)} style={inputStyle}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="both">Email + SMS</option>
              </select>
            </Field>
          </>
        );
      },
    },

    // Step 2 — Verify contacts (placeholder — real code sent via /auth/verify-*)
    {
      key: 'verify',
      title: t('pob.s2_title'),
      subtitle: t('pob.s2_sub'),
      helper: 'Códigos de verificação por email e SMS serão enviados na fase de piloto — por enquanto, confirme o contacto.',
      render: (ctx) => (
        <>
          <Field label="Email" required>
            <Text ctx={ctx} k="email" type="email" placeholder="voce@exemplo.com" />
          </Field>
          <Field label="Telemóvel" hint="Formato internacional (+244 …)">
            <Text ctx={ctx} k="phone" type="tel" placeholder="+244 900 000 000" />
          </Field>
        </>
      ),
      validate: (d) => {
        const email = String(d.email || '');
        return /.+@.+\..+/.test(email) ? null : 'Introduza um email válido.';
      },
    },

    // Step 3 — Personal info
    {
      key: 'personal',
      title: t('pob.s3_title'),
      subtitle: t('pob.s3_sub'),
      render: (ctx) => (
        <>
          <Field label="Nome legal completo" required>
            <Text ctx={ctx} k="full_name" placeholder="Nome como aparece no documento" />
          </Field>
          <Field label="Nome preferido">
            <Text ctx={ctx} k="preferred_name" placeholder="Como quer ser chamado" />
          </Field>
          <Field label="Data de nascimento" required>
            <Text ctx={ctx} k="dob" type="date" />
          </Field>
          <Field label="Nacionalidade">
            <Text ctx={ctx} k="nationality" placeholder="Ex: Angolana" />
          </Field>
          <Field label="Sexo (quando clinicamente relevante)">
            <select value={(ctx.data.sex as string) ?? ''} onChange={e => ctx.setField('sex', e.target.value)} style={inputStyle}>
              <option value="">— {t('pob.prefer_not')} —</option>
              <option value="female">Feminino</option>
              <option value="male">Masculino</option>
              <option value="intersex">Intersexo</option>
              <option value="other">Outro</option>
            </select>
          </Field>
        </>
      ),
      validate: (d) => {
        if (!d.full_name) return 'O nome legal é obrigatório.';
        if (!d.dob) return 'A data de nascimento é obrigatória.';
        return null;
      },
    },

    // Step 4 — Location
    {
      key: 'location',
      title: t('pob.s4_title'),
      subtitle: t('pob.s4_sub'),
      defaults: { country: 'AO' },
      render: (ctx) => (
        <>
          <Field label="País" required>
            <select value={(ctx.data.country as string) ?? 'AO'} onChange={e => ctx.setField('country', e.target.value)} style={inputStyle}>
              <option value="AO">Angola</option>
              <option value="PT">Portugal</option>
              <option value="ES">España</option>
              <option value="BR">Brasil</option>
              <option value="OTHER">Outro</option>
            </select>
          </Field>
          <Field label="Província">
            <Text ctx={ctx} k="province" placeholder="Ex: Luanda" />
          </Field>
          <Field label="Cidade">
            <Text ctx={ctx} k="city" placeholder="Ex: Luanda" />
          </Field>
          <Field label="Endereço" hint="Opcional — só é necessário para visitas ao domicílio.">
            <Text ctx={ctx} k="address" placeholder="Rua, número, bairro" />
          </Field>
        </>
      ),
    },

    // Step 5 — Basic health profile (all optional, all with "don't know")
    {
      key: 'health',
      title: t('pob.s5_title'),
      subtitle: t('pob.s5_sub'),
      optional: true,
      render: (ctx) => (
        <>
          <Field label="Grupo sanguíneo">
            <select value={(ctx.data.blood_type as string) ?? 'unknown'} onChange={e => ctx.setField('blood_type', e.target.value)} style={inputStyle}>
              <option value="unknown">{t('pob.dont_know')}</option>
              <option value="A+">A+</option><option value="A-">A−</option>
              <option value="B+">B+</option><option value="B-">B−</option>
              <option value="AB+">AB+</option><option value="AB-">AB−</option>
              <option value="O+">O+</option><option value="O-">O−</option>
            </select>
          </Field>
          <Field label="Alergias" hint="Separe por vírgulas — deixe em branco se nenhuma.">
            <Text ctx={ctx} k="allergies" placeholder="Ex: penicilina, marisco" />
          </Field>
          <Field label="Condições crónicas">
            <Text ctx={ctx} k="chronic" placeholder="Ex: hipertensão, diabetes tipo 2" />
          </Field>
          <Field label="Medicação atual">
            <Text ctx={ctx} k="medications" placeholder="Ex: metformina 500 mg" />
          </Field>
          <Field label="Cirurgias prévias importantes">
            <Text ctx={ctx} k="surgeries" placeholder={t('pob.none')} />
          </Field>
        </>
      ),
    },

    // Step 6 — Emergency contact
    {
      key: 'emergency',
      title: t('pob.s6_title'),
      subtitle: t('pob.s6_sub'),
      render: (ctx) => (
        <>
          <Field label="Nome do contacto" required>
            <Text ctx={ctx} k="ec_name" placeholder="Nome completo" />
          </Field>
          <Field label="Relação">
            <Text ctx={ctx} k="ec_relation" placeholder="Ex: cônjuge, irmão" />
          </Field>
          <Field label="Telefone" required>
            <Text ctx={ctx} k="ec_phone" type="tel" placeholder="+244 900 000 000" />
          </Field>
          <Field label="Telefone alternativo">
            <Text ctx={ctx} k="ec_alt_phone" type="tel" />
          </Field>
          <Toggle ctx={ctx} k="ec_consent" label="Confirmo que este contacto autorizou ser chamado em caso de emergência." />
        </>
      ),
      validate: (d) => {
        if (!d.ec_name) return 'O nome do contacto é obrigatório.';
        if (!d.ec_phone) return 'O telefone do contacto é obrigatório.';
        if (!d.ec_consent) return 'Confirme o consentimento do contacto de emergência.';
        return null;
      },
    },

    // Step 7 — Consent (separate toggles, not bundled)
    {
      key: 'consent',
      title: t('pob.s7_title'),
      subtitle: t('pob.s7_sub'),
      render: (ctx) => (
        <>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Obrigatórios para usar o serviço
          </div>
          <Toggle ctx={ctx} k="c_terms" label="Aceito os Termos de Serviço." />
          <Toggle ctx={ctx} k="c_privacy" label="Aceito a Política de Privacidade." />
          <Toggle ctx={ctx} k="c_health" label="Autorizo o processamento dos meus dados de saúde para fins clínicos." />
          <Toggle ctx={ctx} k="c_telemedicine" label="Aceito receber cuidados por teleconsulta." />

          <div style={{ height: '1rem' }} />
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Opcionais — pode mudar mais tarde
          </div>
          <Toggle ctx={ctx} k="c_family_share" label="Permito partilhar informação com familiares que eu autorize." />
          <Toggle ctx={ctx} k="c_analytics" label="Autorizo estatísticas anónimas para melhorar o serviço." />
          <Toggle ctx={ctx} k="c_marketing" label="Aceito receber comunicações de marketing." />
          <Toggle ctx={ctx} k="c_research" label="Autorizo o uso anonimizado dos meus dados em investigação." />
        </>
      ),
      validate: (d) => {
        for (const k of ['c_terms', 'c_privacy', 'c_health', 'c_telemedicine']) {
          if (!d[k]) return 'Todos os consentimentos obrigatórios devem ser aceites.';
        }
        return null;
      },
    },

    // Step 8 — Review
    {
      key: 'review',
      title: t('pob.s8_title'),
      subtitle: t('pob.s8_sub'),
      render: () => (
        <div style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          <p style={{ margin: '0 0 0.75rem' }}>
            Ao carregar em <strong>Concluir</strong>, a sua conta será criada com todas as respostas acima.
          </p>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Pode alterar qualquer secção nas Definições depois.
          </p>
        </div>
      ),
    },
  ], [t]);

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div className="card" style={{ padding: '2rem 1.75rem', maxWidth: 460, textAlign: 'center' }}>
          <CheckCircle2 size={56} style={{ color: '#22c55e', marginBottom: '0.75rem' }} />
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 800 }}>{t('pob.done_title')}</h1>
          <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)' }}>{t('pob.done_sub')}</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            {t('pob.go_dashboard')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', paddingTop: '2rem' }}>
      <OnboardingShell
        role="patient"
        steps={steps}
        onSubmitted={() => setDone(true)}
      />
    </div>
  );
}
