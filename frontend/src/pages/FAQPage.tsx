import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useT } from '../i18n/LanguageContext';

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 0', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '0.95rem', fontWeight: 600, gap: '1rem' }}>
        {q}
        <ChevronDown size={18} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', color: 'var(--accent-teal)' }} />
      </button>
      {open && (
        <div style={{ padding: '0 0 1.1rem', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const { t } = useT();
  const faqs = Array.from({ length: 10 }, (_, i) => ({ q: t(`faq.q${i + 1}`), a: t(`faq.a${i + 1}`) }));
  return (
    <div className="landing-wrapper">
      <Navbar />

      <section className="lp-page-hero" style={{ paddingBottom: '2rem' }}>
        <div className="lp-tag">{t('faq.tag')}</div>
        <h1>{t('faq.title')}</h1>
        <p>{t('faq.subtitle')}</p>
      </section>

      <section className="lp-section" style={{ paddingTop: '2rem' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          {faqs.map(faq => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
        </div>
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{t('faq.not_found')}</p>
          <a href="mailto:suporte@kaya.ao" className="lp-cta lp-cta--outline" style={{ display: 'inline-flex' }}>
            {t('faq.contact_support')}
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
