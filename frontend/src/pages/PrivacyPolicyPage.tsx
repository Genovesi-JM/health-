import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, AlertTriangle } from 'lucide-react';

/**
 * Privacy Policy — placeholder for private beta.
 * ⚠️  This page contains draft placeholder text.
 *     Final wording MUST be reviewed and approved by a qualified lawyer
 *     before the platform is made publicly available.
 */
export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafc)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* Back */}
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          color: 'var(--accent-teal, #0d9488)', textDecoration: 'none', fontSize: '0.875rem',
          marginBottom: '1.5rem' }}>
          <ArrowLeft size={15} /> Back
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Shield size={28} style={{ color: 'var(--accent-teal, #0d9488)' }} />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>Privacy Policy</h1>
        </div>
        <p style={{ color: 'var(--text-muted, #64748b)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          Last updated: April 2026 — Private Beta version
        </p>

        {/* Legal-review banner */}
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px',
          padding: '0.875rem 1rem', marginBottom: '2rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ margin: 0, fontSize: '0.83rem', color: '#92400e', lineHeight: 1.5 }}>
            <strong>Draft — Pending Legal Review.</strong>{' '}
            This document is a placeholder for private beta testing only. It has not been reviewed
            by a lawyer. Final wording must be approved before any public launch.
          </p>
        </div>

        <LegalSection title="1. Who We Are">
          <p>
            Health Platform ("we", "our", "the platform") is a digital health service designed to
            support care coordination, appointment booking, and health monitoring for patients and
            healthcare professionals. We are currently operating in private beta.
          </p>
          <p>
            <strong>[LEGAL REVIEW REQUIRED: Insert registered company name, country, and data
            controller details here.]</strong>
          </p>
        </LegalSection>

        <LegalSection title="2. What Data We Collect">
          <ul>
            <li><strong>Account information:</strong> name, email address, password (hashed).</li>
            <li><strong>Health information:</strong> medical history, symptoms, triage responses,
              consultation notes, prescriptions, device readings, and family health data you choose
              to enter.</li>
            <li><strong>Usage data:</strong> pages visited, features used, timestamps (for service
              improvement and security).</li>
            <li><strong>Technical data:</strong> IP address, browser type, device identifiers
              (for security and fraud prevention).</li>
            <li><strong>Payment data:</strong> billing information processed via third-party payment
              processors (we do not store full card numbers).</li>
          </ul>
        </LegalSection>

        <LegalSection title="3. How We Use Your Data">
          <ul>
            <li>To provide the platform's health coordination services.</li>
            <li>To connect you with healthcare professionals.</li>
            <li>To send appointment reminders and health alerts you have requested.</li>
            <li>To improve and maintain the platform (using aggregated, anonymised analytics).</li>
            <li>To comply with legal obligations.</li>
          </ul>
          <p>
            We do <strong>not</strong> sell your personal or health data to third parties.
            We do <strong>not</strong> use your data for unsolicited advertising.
          </p>
        </LegalSection>

        <LegalSection title="4. Legal Basis for Processing">
          <p>
            <strong>[LEGAL REVIEW REQUIRED: Specify the legal basis under applicable law —
            e.g. explicit consent (Art. 9 GDPR for health data), contract performance,
            legitimate interest, or legal obligation.]</strong>
          </p>
          <p>
            We rely on your explicit consent for processing health-related data. You may withdraw
            consent at any time by contacting us or using the account deletion feature, though this
            may prevent you from using core services.
          </p>
        </LegalSection>

        <LegalSection title="5. Data Sharing">
          <p>We share data only as necessary to provide the service:</p>
          <ul>
            <li><strong>Healthcare professionals</strong> you book consultations with (limited to
              data relevant to your care).</li>
            <li><strong>Infrastructure providers</strong> (cloud hosting, database) operating under
              appropriate data processing agreements.</li>
            <li><strong>Payment processors</strong> (limited billing data only).</li>
            <li><strong>Authorities</strong> when required by law.</li>
          </ul>
        </LegalSection>

        <LegalSection title="6. Data Retention">
          <p>
            We retain your data for as long as your account is active or as required by law.
            Health records may be subject to minimum retention periods under applicable medical
            regulations. <strong>[LEGAL REVIEW REQUIRED: Define specific retention periods.]</strong>
          </p>
        </LegalSection>

        <LegalSection title="7. Your Rights">
          <p>Subject to applicable law, you may have the right to:</p>
          <ul>
            <li><strong>Access</strong> a copy of your personal data.</li>
            <li><strong>Correct</strong> inaccurate or incomplete data.</li>
            <li><strong>Delete</strong> your account and associated data (see the Settings page or
              contact us).</li>
            <li><strong>Export</strong> your data in a portable format.</li>
            <li><strong>Restrict</strong> or object to certain processing.</li>
            <li><strong>Withdraw consent</strong> for health data processing at any time.</li>
          </ul>
          <p>
            To exercise these rights, contact us at{' '}
            <strong>[LEGAL REVIEW REQUIRED: Insert contact email]</strong>.
          </p>
        </LegalSection>

        <LegalSection title="8. Security">
          <p>
            The platform is designed to support privacy and security. We use encrypted connections
            (HTTPS/TLS), hashed passwords, and access controls. However, no system is completely
            immune to security risks. We will notify affected users of any data breach as required
            by law.
          </p>
          <p>
            <strong>Note:</strong> This platform is not yet certified under GDPR, HIPAA, or any
            other specific regulation. Compliance work is ongoing and will be verified before
            public launch.
          </p>
        </LegalSection>

        <LegalSection title="9. Cookies">
          <p>
            We use session cookies for authentication. We do not currently use third-party tracking
            or advertising cookies. <strong>[LEGAL REVIEW REQUIRED: Add full cookie policy if
            analytics tools are added.]</strong>
          </p>
        </LegalSection>

        <LegalSection title="10. Changes to This Policy">
          <p>
            We will notify registered users by email before making material changes to this policy.
            Continued use of the platform after the effective date constitutes acceptance of the
            updated policy.
          </p>
        </LegalSection>

        <LegalSection title="11. Contact">
          <p>
            <strong>[LEGAL REVIEW REQUIRED: Insert company name, address, and DPO/privacy
            contact details here.]</strong>
          </p>
        </LegalSection>

        <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border, #e2e8f0)',
          display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.83rem' }}>
          <Link to="/terms" style={{ color: 'var(--accent-teal, #0d9488)' }}>Terms of Service</Link>
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
