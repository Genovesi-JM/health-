import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Mail, MapPin, MessageSquare, Building2, Loader2, CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';

export default function ContactoPage() {
  const { t } = useT();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSending(true); setError('');
    try {
      await api.post('/api/v1/contact', {
        name: String(data.get('name') || ''),
        email: String(data.get('email') || ''),
        subject: String(data.get('subject') || 'Suporte geral'),
        message: String(data.get('message') || ''),
      });
      setSent(true);
      form.reset();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || t('contact.send_error'));
    } finally { setSending(false); }
  };

  return (
    <div className="landing-wrapper">
      <Navbar />

      <section className="lp-page-hero" style={{ paddingBottom: '2rem' }}>
        <div className="lp-tag">{t('contact.tag')}</div>
        <h1>{t('contact.title')}</h1>
        <p>{t('contact.subtitle')}</p>
      </section>

      <section className="lp-section">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', maxWidth: '800px', margin: '0 auto 3rem' }}>
          {[
            { icon: Mail,        label: t('contact.card_support'),  value: 'suporte@kaya.ao',    href: 'mailto:suporte@kaya.ao' },
            { icon: Building2,   label: t('contact.card_partners'), value: 'parcerias@kaya.ao',  href: 'mailto:parcerias@kaya.ao' },
            { icon: MessageSquare, label: t('contact.card_business'), value: 'empresas@kaya.ao',   href: 'mailto:empresas@kaya.ao' },
            { icon: MapPin,      label: t('contact.card_location'), value: 'Luanda, Angola',         href: undefined },
          ].map(c => (
            <div key={c.label} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)', borderRadius: '14px', padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <c.icon size={20} style={{ color: 'var(--accent-teal)' }} />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
              {c.href ? (
                <a href={c.href} style={{ color: 'var(--accent-teal)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>{c.value}</a>
              ) : (
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{c.value}</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ maxWidth: '600px', margin: '0 auto', background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>{t('contact.send_title')}</h3>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <CheckCircle2 size={44} style={{ color: '#22c55e', marginBottom: '0.5rem' }} />
              <p style={{ fontWeight: 700, margin: '0 0 0.35rem' }}>{t('contact.sent_title')}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>{t('contact.sent_sub')}</p>
            </div>
          ) : (
          <form onSubmit={sendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>{t('contact.name')}</label>
                <input name="name" type="text" required autoComplete="name" placeholder={t('contact.name_ph')} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontSize: '0.88rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>{t('contact.email')}</label>
                <input name="email" type="email" required autoComplete="email" placeholder="email@exemplo.com" style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontSize: '0.88rem', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>{t('contact.subject')}</label>
              <select name="subject" style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(15,23,42,0.8)', color: 'var(--text-primary)', fontSize: '0.88rem', boxSizing: 'border-box' }}>
                <option value="Suporte geral">{t('contact.subj_support')}</option>
                <option value="Médico independente — quero trabalhar no portal">{t('contact.subj_doctor')}</option>
                <option value="Parceria institucional (clínica / hospital)">{t('contact.subj_partner')}</option>
                <option value="Solução corporativa">{t('contact.subj_corporate')}</option>
                <option value="Media / imprensa">{t('contact.subj_media')}</option>
                <option value="Outro">{t('contact.subj_other')}</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>{t('contact.message')}</label>
              <textarea name="message" required rows={4} placeholder={t('contact.message_ph')} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontSize: '0.88rem', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            {error && <div style={{ color: '#ef4444', fontSize: '0.83rem' }}>{error}</div>}
            <button type="submit" disabled={sending} style={{ padding: '0.8rem', borderRadius: '10px', background: 'var(--gradient-primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: sending ? 0.7 : 1 }}>
              {sending ? <Loader2 size={16} className="spin" /> : <Mail size={16} />} {sending ? t('contact.sending') : t('contact.send_btn')}
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {t('contact.sent_sub')}
            </p>
          </form>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
