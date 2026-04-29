import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, AlertTriangle } from 'lucide-react';

/**
 * Terms of Service — placeholder for private beta.
 * ⚠️  This page contains draft placeholder text.
 *     Final wording MUST be reviewed and approved by a qualified lawyer
 *     before the platform is made publicly available.
 */
export default function TermsOfServicePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafc)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          color: 'var(--accent-teal, #0d9488)', textDecoration: 'none', fontSize: '0.875rem',
          marginBottom: '1.5rem' }}>
          <ArrowLeft size={15} /> Back
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <FileText size={28} style={{ color: 'var(--accent-teal, #0d9488)' }} />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>Terms of Service</h1>
        </div>
        <p style={{ color: 'var(--text-muted, #64748b)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Last updated: April 2026 — Private Beta version
        </p>

        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px',
          padding: '0.875rem 1rem', marginBottom: '2rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ margin: 0, fontSize: '0.83rem', color: '#92400e', lineHeight: 1.5 }}>
            <strong>Draft — Pending Legal Review.</strong>{' '}
            These terms are a placeholder for private beta testing only and have not been reviewed
            by a lawyer. Final terms must be approved before any public launch.
          </p>
        </div>

        <LegalSection title="1. Acceptance of Terms">
          <p>
            By creating an account and using Health Platform ("the platform", "the service"), you
            agree to be bound by these Terms of Service. If you do not agree, you must not use the
            platform.
          </p>
          <p>
            These terms apply to all users including patients, healthcare professionals, and
            corporate account holders.
          </p>
        </LegalSection>

        <LegalSection title="2. Description of Service">
          <p>
            Health Platform is a digital health coordination tool that allows users to:
          </p>
          <ul>
            <li>Complete health triage questionnaires.</li>
            <li>Book teleconsultations with registered healthcare professionals.</li>
            <li>Store and access health records, device readings, and prescriptions.</li>
            <li>Communicate with their care team.</li>
          </ul>
          <p>
            <strong>The platform is a coordination tool and does not provide medical diagnosis,
            treatment, or clinical care directly.</strong> All clinical decisions are made by
            the licensed healthcare professionals on the platform.
          </p>
        </LegalSection>

        <LegalSection title="3. Not an Emergency Service">
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px',
            padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
            <strong style={{ color: '#b91c1c' }}>⚠️ This platform is NOT an emergency service.</strong>
            <p style={{ margin: '0.25rem 0 0', color: '#7f1d1d', fontSize: '0.875rem' }}>
              If you are experiencing a medical emergency, call your local emergency number
              (e.g. 112 in the EU) or go to your nearest emergency department immediately.
              Do not use this platform in an emergency.
            </p>
          </div>
        </LegalSection>

        <LegalSection title="4. Eligibility">
          <ul>
            <li>You must be at least 18 years old (or have parental/guardian consent) to register.</li>
            <li>You must provide accurate registration information.</li>
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li><strong>[LEGAL REVIEW REQUIRED: Define minimum age and identity verification
              requirements.]</strong></li>
          </ul>
        </LegalSection>

        <LegalSection title="5. User Responsibilities">
          <ul>
            <li>Provide truthful and accurate health information.</li>
            <li>Use the platform only for lawful purposes.</li>
            <li>Not attempt to access other users' accounts or data.</li>
            <li>Not misuse the platform for self-diagnosis of serious conditions without consulting
              a professional.</li>
            <li>Keep contact and health information up to date.</li>
          </ul>
        </LegalSection>

        <LegalSection title="6. Healthcare Professional Terms">
          <p>
            Doctors and other healthcare professionals using the platform must:
          </p>
          <ul>
            <li>Hold a valid, current professional licence in their jurisdiction.</li>
            <li>Only provide clinical advice within their scope of practice.</li>
            <li>Comply with applicable professional codes of conduct and medical ethics.</li>
            <li>Not use the platform to substitute for emergency care referrals when needed.</li>
          </ul>
          <p>
            <strong>[LEGAL REVIEW REQUIRED: Define liability split between the platform and
            individual practitioners.]</strong>
          </p>
        </LegalSection>

        <LegalSection title="7. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, the platform and its operators are not liable
            for:
          </p>
          <ul>
            <li>Clinical decisions made by healthcare professionals using the platform.</li>
            <li>Errors or omissions in user-provided health data.</li>
            <li>Service interruptions, data loss, or technical failures beyond our reasonable
              control.</li>
          </ul>
          <p>
            <strong>[LEGAL REVIEW REQUIRED: Draft full limitation of liability clause
            compliant with applicable law.]</strong>
          </p>
        </LegalSection>

        <LegalSection title="8. Intellectual Property">
          <p>
            All platform content, software, and trademarks are owned by or licensed to the
            platform operator. You retain ownership of health data you enter. You grant us a
            limited licence to process your data to provide the service.
          </p>
        </LegalSection>

        <LegalSection title="9. Account Termination">
          <p>
            You may delete your account at any time from the Settings page. We may suspend or
            terminate accounts that violate these terms. Data deletion requests will be processed
            in accordance with our{' '}
            <Link to="/privacy" style={{ color: 'var(--accent-teal, #0d9488)' }}>Privacy Policy</Link>.
          </p>
        </LegalSection>

        <LegalSection title="10. Governing Law">
          <p>
            <strong>[LEGAL REVIEW REQUIRED: Define governing law and jurisdiction.]</strong>
          </p>
        </LegalSection>

        <LegalSection title="11. Changes to Terms">
          <p>
            We will give at least 30 days' notice before material changes to these terms.
            Continued use after the effective date constitutes acceptance.
          </p>
        </LegalSection>

        <LegalSection title="12. Contact">
          <p>
            <strong>[LEGAL REVIEW REQUIRED: Insert company contact details.]</strong>
          </p>
        </LegalSection>

        <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border, #e2e8f0)',
          display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.83rem' }}>
          <Link to="/privacy" style={{ color: 'var(--accent-teal, #0d9488)' }}>Privacy Policy</Link>
          <Link to="/medical-disclaimer" style={{ color: 'var(--accent-teal, #0d9488)' }}>Medical Disclaimer</Link>
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
