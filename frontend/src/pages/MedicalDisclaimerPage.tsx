import { Link } from 'react-router-dom';
import { Stethoscope, ArrowLeft, AlertTriangle } from 'lucide-react';

/**
 * Medical Disclaimer — placeholder for private beta.
 * ⚠️  This page contains draft placeholder text.
 *     Final wording MUST be reviewed and approved by a qualified lawyer
 *     and/or medical professional before the platform is made publicly available.
 */
export default function MedicalDisclaimerPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafc)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          color: 'var(--accent-teal, #0d9488)', textDecoration: 'none', fontSize: '0.875rem',
          marginBottom: '1.5rem' }}>
          <ArrowLeft size={15} /> Back
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Stethoscope size={28} style={{ color: 'var(--accent-teal, #0d9488)' }} />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>Medical Disclaimer</h1>
        </div>
        <p style={{ color: 'var(--text-muted, #64748b)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Last updated: April 2026 — Private Beta version
        </p>

        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px',
          padding: '0.875rem 1rem', marginBottom: '2rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ margin: 0, fontSize: '0.83rem', color: '#92400e', lineHeight: 1.5 }}>
            <strong>Draft — Pending Legal Review.</strong>{' '}
            This document is a placeholder for private beta testing only and has not been reviewed
            by a lawyer or clinical professional. Final wording must be approved before any
            public launch.
          </p>
        </div>

        {/* Emergency callout */}
        <div style={{ background: '#fee2e2', border: '2px solid #ef4444', borderRadius: '10px',
          padding: '1rem 1.25rem', marginBottom: '2rem' }}>
          <div style={{ fontWeight: 700, color: '#b91c1c', fontSize: '1rem', marginBottom: '0.4rem' }}>
            🚨 This platform is NOT an emergency service
          </div>
          <p style={{ margin: 0, color: '#7f1d1d', fontSize: '0.9rem', lineHeight: 1.6 }}>
            If you or someone you know is experiencing a medical emergency — including chest pain,
            difficulty breathing, loss of consciousness, severe bleeding, or any other life-threatening
            condition — <strong>call 112 (EU) or your local emergency number immediately</strong>{' '}
            and go to your nearest emergency department.{' '}
            <strong>Do not use this platform in an emergency.</strong>
          </p>
        </div>

        <LegalSection title="1. No Substitute for Professional Care">
          <p>
            Health Platform is a digital coordination tool. It is designed to <strong>support</strong>{' '}
            — not replace — in-person medical consultations, clinical examinations, laboratory tests,
            imaging, or any other professional healthcare assessment.
          </p>
          <p>
            Information, triage results, or AI-assisted suggestions provided by this platform are
            for informational purposes only. They do not constitute a medical diagnosis, clinical
            opinion, or treatment recommendation.
          </p>
          <p>
            Always consult a qualified and licensed healthcare professional for advice about your
            specific medical condition or treatment.
          </p>
        </LegalSection>

        <LegalSection title="2. Device Readings and Accuracy">
          <p>
            The platform may display health readings from connected devices (e.g. blood pressure
            monitors, glucometers, pulse oximeters, scales).
          </p>
          <ul>
            <li>Device readings are subject to measurement error, calibration drift, and
              user technique variation.</li>
            <li>Readings displayed on this platform should not be used alone to make clinical
              decisions.</li>
            <li>All device readings should be reviewed and interpreted by a qualified healthcare
              professional.</li>
            <li>If a reading appears abnormal, contact your healthcare provider rather than
              relying solely on the platform's guidance.</li>
          </ul>
        </LegalSection>

        <LegalSection title="3. Triage and AI-Assisted Features">
          <p>
            The triage tool and any AI-assisted features (including the health chatbot) are designed
            to help users understand possible next steps, not to diagnose conditions.
          </p>
          <ul>
            <li>Triage results indicate suggested urgency levels only.</li>
            <li>The AI chatbot does not have access to your full medical history and cannot provide
              clinical advice.</li>
            <li>AI responses may contain errors and should not be acted upon without professional
              verification.</li>
          </ul>
        </LegalSection>

        <LegalSection title="4. Teleconsultation Limitations">
          <p>
            Teleconsultations on this platform are conducted by independent, licensed healthcare
            professionals. However:
          </p>
          <ul>
            <li>Teleconsultation has inherent limitations compared to an in-person examination.</li>
            <li>The consulting professional may recommend an in-person visit if they believe it is
              necessary for safe assessment.</li>
            <li>Prescriptions issued via teleconsultation are subject to applicable national laws
              and the professional's clinical judgement.</li>
          </ul>
        </LegalSection>

        <LegalSection title="5. No Guarantee of Outcomes">
          <p>
            Use of this platform does not guarantee any particular health outcome. The platform and
            its operators are not responsible for clinical outcomes resulting from consultations with
            healthcare professionals or from user decisions based on platform content.
          </p>
        </LegalSection>

        <LegalSection title="6. Accuracy of Information">
          <p>
            We make reasonable efforts to ensure platform content is accurate and up to date.
            However, medical knowledge evolves and content may not reflect the latest clinical
            guidelines. Always cross-reference with your healthcare provider.
          </p>
        </LegalSection>

        <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border, #e2e8f0)',
          display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.83rem' }}>
          <Link to="/privacy" style={{ color: 'var(--accent-teal, #0d9488)' }}>Privacy Policy</Link>
          <Link to="/terms" style={{ color: 'var(--accent-teal, #0d9488)' }}>Terms of Service</Link>
          <Link to="/data-consent" style={{ color: 'var(--accent-teal, #0d9488)' }}>Data Consent</Link>
        </div>
      </div>
    </div>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '1.75rem' }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.6rem',
        color: 'var(--text, #0f172a)' }}>{title}</h2>
      <div style={{ fontSize: '0.9rem', lineHeight: 1.75, color: 'var(--text-muted, #475569)' }}>
        {children}
      </div>
    </section>
  );
}
