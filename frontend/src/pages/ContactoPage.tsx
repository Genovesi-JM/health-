import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Mail, MapPin, MessageSquare, Building2 } from 'lucide-react';

export default function ContactoPage() {
  return (
    <div className="landing-wrapper">
      <Navbar />

      <section className="lp-page-hero" style={{ paddingBottom: '2rem' }}>
        <div className="lp-tag">Contacto</div>
        <h1>Fale connosco.</h1>
        <p>Tem dúvidas, quer ser parceiro ou explorar soluções corporativas? Estamos disponíveis.</p>
      </section>

      <section className="lp-section">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', maxWidth: '800px', margin: '0 auto 3rem' }}>
          {[
            { icon: Mail,        label: 'Suporte geral',    value: 'suporte@carefast.ao',    href: 'mailto:suporte@carefast.ao' },
            { icon: Building2,   label: 'Parcerias',        value: 'parcerias@carefast.ao',  href: 'mailto:parcerias@carefast.ao' },
            { icon: MessageSquare, label: 'Empresas',       value: 'empresas@carefast.ao',   href: 'mailto:empresas@carefast.ao' },
            { icon: MapPin,      label: 'Localização',      value: 'Luanda, Angola',         href: undefined },
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
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Enviar mensagem</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Nome</label>
                <input type="text" placeholder="O seu nome" style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontSize: '0.88rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Email</label>
                <input type="email" placeholder="email@exemplo.com" style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontSize: '0.88rem', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Assunto</label>
              <select style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(15,23,42,0.8)', color: 'var(--text-primary)', fontSize: '0.88rem', boxSizing: 'border-box' }}>
                <option>Suporte geral</option>
                <option>Médico independente — quero trabalhar no portal</option>
                <option>Parceria institucional (clínica / hospital)</option>
                <option>Solução corporativa</option>
                <option>Media / imprensa</option>
                <option>Outro</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Mensagem</label>
              <textarea rows={4} placeholder="A sua mensagem..." style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontSize: '0.88rem', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <button style={{ padding: '0.8rem', borderRadius: '10px', background: 'var(--gradient-primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Mail size={16} /> Enviar mensagem
            </button>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Respondemos em até 24 horas úteis.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// placeholder to avoid missing import
