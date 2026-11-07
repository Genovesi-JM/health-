import { HelpCircle, Mail, MessageSquare, Book, ExternalLink } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export default function DoctorSuportePage() {
  const { t } = useT();
  const faqs = [
    { q: t('dsup.q1'), a: t('dsup.a1') },
    { q: t('dsup.q2'), a: t('dsup.a2') },
    { q: t('dsup.q3'), a: t('dsup.a3') },
    { q: t('dsup.q4'), a: t('dsup.a4') },
  ];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <HelpCircle size={20} style={{ color: 'var(--brand-primary)' }} /> {t('dsup.title')}
      </h1>

      {/* Contact cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { icon: <Mail size={22} />, title: t('dsup.email'), sub: 'suporte@kaya.ao', color: '#3b82f6', action: t('dsup.email_action') },
          { icon: <MessageSquare size={22} />, title: t('dsup.chat'), sub: t('dsup.chat_sub'), color: '#059669', action: t('dsup.chat_action') },
        ].map(c => (
          <div key={c.title} className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ color: c.color, marginBottom: '0.5rem' }}>{c.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.85rem' }}>{c.sub}</div>
            <button style={{ padding: '0.5rem 1rem', borderRadius: '8px', background: c.color + '18', color: c.color, border: `1.5px solid ${c.color}33`, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>{c.action}</button>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Book size={16} style={{ color: 'var(--text-muted)' }} /> {t('dsup.faq')}
        </div>
        {faqs.map((f, i) => (
          <details key={i} style={{ marginBottom: '0.75rem' }}>
            <summary style={{ fontWeight: 600, fontSize: '0.87rem', cursor: 'pointer', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border)' }}>{f.q}</summary>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.a}</p>
          </details>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <a href="mailto:suporte@kaya.ao" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
          <ExternalLink size={14} /> {t('dsup.contact_kaya')}
        </a>
      </div>
    </div>
  );
}
