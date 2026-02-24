import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Heart size={22} style={{ color: 'var(--accent-teal)' }} />
              <span style={{ fontWeight: 700, letterSpacing: '2px', fontSize: '0.95rem' }}>HEALTH PLATFORM</span>
            </div>
            <p>
              Plataforma digital de triagem inteligente e teleconsulta médica.
              Conectamos pacientes a profissionais de saúde de forma segura e eficiente.
            </p>
          </div>

          {/* Plataforma */}
          <div>
            <h4>Plataforma</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <Link to="/about">Sobre Nós</Link>
              <Link to="/services">Serviços</Link>
              <Link to="/login">Portal</Link>
            </div>
          </div>

          {/* Serviços */}
          <div>
            <h4>Serviços</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Triagem Inteligente</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Teleconsulta</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Prescrições Digitais</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Gestão Clínica</span>
            </div>
          </div>

          {/* Contactos */}
          <div>
            <h4>Contacto</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <a href="mailto:suporte@healthplatform.com">suporte@healthplatform.com</a>
              <a href="tel:+244928917269">+244 928 917 269</a>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Luanda, Angola</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} Health Platform. Todos os direitos reservados.</span>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <Link to="/privacy">Privacidade</Link>
            <Link to="/terms">Termos</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
