import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Save } from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';

export interface OnboardingStepDef {
  key: string;
  title: string;
  subtitle?: string;
  helper?: string;
  optional?: boolean;
  defaults?: Record<string, unknown>;
  render: (ctx: StepRenderContext) => ReactNode;
  validate?: (data: Record<string, unknown>) => string | null;
}

export interface StepRenderContext {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  setData: (data: Record<string, unknown>) => void;
  error: string | null;
}

interface DraftShape {
  id: string;
  role: string;
  status: string;
  current_step: number;
  total_steps: number;
  completed_steps: number[];
  data: Record<string, Record<string, unknown>>;
}

interface Props {
  role: string;
  steps: OnboardingStepDef[];
  onSubmitted: (draft: DraftShape) => void;
  onExit?: () => void;
}

const AUTOSAVE_DEBOUNCE_MS = 900;

export default function OnboardingShell({ role, steps, onSubmitted, onExit }: Props) {
  const { t } = useT();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [stepData, setStepData] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const autosaveTimer = useRef<number | null>(null);

  const stepDef = steps[stepIdx];
  const stepNumber = stepIdx + 1;

  /* ── Load or create the draft on mount ───────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const started = await api.post('/api/v1/onboarding/start', { role });
        if (cancelled) return;
        const d = started.data as DraftShape;
        setDraft(d);
        const targetIdx = Math.min(Math.max(0, d.current_step - 1), steps.length - 1);
        setStepIdx(targetIdx);
        const stored = d.data?.[String(targetIdx + 1)] ?? {};
        const stepDefaults = steps[targetIdx]?.defaults ?? {};
        setStepData({ ...stepDefaults, ...stored });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setLoadError(msg);
      }
    })();
    return () => { cancelled = true; };
    // We intentionally re-init only when role changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  /* ── Autosave (debounced) — never marks the step complete ───────────── */
  useEffect(() => {
    if (!draft || draft.status === 'submitted') return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      api.post('/api/v1/onboarding/save', { step: stepNumber, data: stepData })
        .then(() => setSaving(false))
        .catch(() => setSaving(false));
      setSaving(true);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [stepData, stepNumber, draft]);

  const setField = useCallback((key: string, value: unknown) => {
    setStepData(prev => ({ ...prev, [key]: value }));
    setError(null);
  }, []);

  const goToStep = useCallback((idx: number) => {
    if (!draft) return;
    setStepIdx(idx);
    const stored = draft.data?.[String(idx + 1)] ?? {};
    const stepDefaults = steps[idx]?.defaults ?? {};
    // Seed defaults first so untouched fields have sensible values.
    setStepData({ ...stepDefaults, ...stored });
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [draft, steps]);

  const advance = useCallback(async () => {
    if (!draft || !stepDef) return;
    const validationError = stepDef.validate?.(stepData) ?? null;
    if (validationError) { setError(validationError); return; }

    try {
      const res = await api.put(`/api/v1/onboarding/steps/${stepNumber}`, {
        data: stepData,
        completed: true,
      });
      const updated = res.data as DraftShape;
      setDraft(updated);
      if (stepIdx + 1 < steps.length) {
        goToStep(stepIdx + 1);
      } else {
        // Last step marked complete — trigger submit.
        setSubmitting(true);
        const submitRes = await api.post('/api/v1/onboarding/submit');
        onSubmitted(submitRes.data as DraftShape);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: unknown } }; message?: string };
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : detail && typeof detail === 'object' && 'error' in detail
          ? (detail as { error: string }).error
          : err.message || t('onboarding.save_failed');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [draft, stepDef, stepData, stepNumber, stepIdx, steps.length, goToStep, onSubmitted, t]);

  const saveAndExit = useCallback(async () => {
    try {
      await api.post('/api/v1/onboarding/save', { step: stepNumber, data: stepData });
      if (onExit) onExit(); else navigate('/dashboard');
    } catch {
      // Best-effort — user is leaving anyway.
      if (onExit) onExit(); else navigate('/dashboard');
    }
  }, [stepNumber, stepData, navigate, onExit]);

  if (loadError) {
    return (
      <div className="page-loading" style={{ flexDirection: 'column', gap: 12 }}>
        <p style={{ color: 'var(--text-secondary)' }}>{t('onboarding.load_failed')}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (!draft || !stepDef) {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  const progressPct = Math.round((stepNumber / steps.length) * 100);
  const isLastStep = stepIdx === steps.length - 1;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      {/* ── Progress header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
          <span>{t('onboarding.step')} {stepNumber} {t('onboarding.of')} {steps.length}</span>
          <span aria-live="polite">
            {saving ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Loader2 size={12} className="spin" /> {t('onboarding.saving')}
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Check size={12} /> {t('onboarding.saved')}
              </span>
            )}
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-hover)', borderRadius: 999, overflow: 'hidden' }}>
          <div
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ width: `${progressPct}%`, height: '100%', background: 'var(--brand-primary)', transition: 'width 240ms ease' }}
          />
        </div>
      </div>

      {/* ── Step title ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.4rem', fontWeight: 800 }}>
          {stepDef.title}
          {stepDef.optional && (
            <span style={{ marginLeft: 8, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('onboarding.optional')}
            </span>
          )}
        </h1>
        {stepDef.subtitle && (
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {stepDef.subtitle}
          </p>
        )}
        {stepDef.helper && (
          <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {stepDef.helper}
          </p>
        )}
      </div>

      {/* ── Step body ───────────────────────────────────────────────── */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        {stepDef.render({ data: stepData, setField, setData: setStepData, error })}
        {error && (
          <div
            role="alert"
            style={{ marginTop: '1rem', padding: '0.7rem 0.9rem', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#b91c1c', fontSize: '0.85rem' }}
          >
            {error}
          </div>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => goToStep(Math.max(0, stepIdx - 1))}
          disabled={stepIdx === 0 || submitting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={16} /> {t('onboarding.back')}
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={saveAndExit}
            disabled={submitting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Save size={16} /> {t('onboarding.save_later')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={advance}
            disabled={submitting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {submitting ? (
              <><Loader2 size={16} className="spin" /> {t('onboarding.submitting')}</>
            ) : isLastStep ? (
              <>{t('onboarding.submit')} <Check size={16} /></>
            ) : (
              <>{t('onboarding.next')} <ArrowRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
