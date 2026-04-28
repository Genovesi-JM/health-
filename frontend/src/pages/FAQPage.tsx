import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const FAQS = [
  { q: 'O CareFast+ faz diagnósticos?', a: 'Não. O CareFast+ nunca faz diagnósticos. A triagem orienta com base num protocolo clínico e sugere os próximos passos. Um médico real valida sempre.' },
  { q: 'A teleconsulta substitui uma consulta presencial?', a: 'Depende da situação. Para muitos casos, uma teleconsulta é suficiente. Quando não é, o médico indica a necessidade de consulta presencial ou exames.' },
  { q: 'Os meus dados médicos estão seguros?', a: 'Sim. Todos os dados são encriptados em trânsito e em repouso. Só você e o seu médico têm acesso ao seu historial clínico.' },
  { q: 'Posso gerir a saúde de toda a família?', a: 'Sim. Com o Family Plan pode criar perfis para filhos, pais e dependentes — incluindo perfis pediátricos para menores de 16 anos.' },
  { q: 'Como funciona o refill de medicação?', a: 'Submete o pedido pelo portal. Um médico parceiro avalia e, se adequado, emite uma nova receita digital. A decisão é sempre humana.' },
  { q: 'O que é o pré-alerta de urgência?', a: 'Antes de se dirigir a um hospital parceiro em caso de urgência, pode enviar os seus dados e sintomas. O hospital recebe o alerta e prepara-se para a sua chegada.' },
  { q: 'Posso usar no telemóvel?', a: 'Sim. O portal é totalmente responsive e funciona em qualquer dispositivo — computador, tablet ou telemóvel.' },
  { q: 'Como me torno parceiro (clínica ou médico)?', a: 'Entre em contacto connosco através de parcerias@carefast.ao. Verificamos e integramos novos parceiros após validação.' },
  { q: 'O serviço está disponível fora de Luanda?', a: 'De momento focamo-nos em Luanda. A expansão para outras províncias e países está no nosso roadmap.' },
  { q: 'Qual é a diferença entre o plano Basic e Premium?', a: 'O Basic é gratuito e inclui triagem e marcação de consultas. O Premium inclui teleconsulta, refill de medicação, vitals tracking e até 3 perfis.' },
];

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
  return (
    <div className="landing-wrapper">
      <Navbar />

      <section className="lp-page-hero" style={{ paddingBottom: '2rem' }}>
        <div className="lp-tag">Perguntas Frequentes</div>
        <h1>Perguntas Frequentes</h1>
        <p>Tudo o que precisa de saber sobre o CareFast+ — simples e transparente.</p>
      </section>

      <section className="lp-section" style={{ paddingTop: '2rem' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          {FAQS.map(faq => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
        </div>
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Não encontrou o que procurava?</p>
          <a href="mailto:suporte@carefast.ao" className="lp-cta lp-cta--outline" style={{ display: 'inline-flex' }}>
            Contactar suporte
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
