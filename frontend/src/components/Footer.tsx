import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export function Footer() {
  const { t } = useT();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <img src="/kaya-logo.svg" alt="KAYA" style={{ width: 30, height: 30, display: 'block' }} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>KAYA</span>
                <span style={{ fontSize: '0.6rem', color: '#0d9488' }}>Saúde na sua mão</span>
              </div>
            </div>
            <p>{t('footer.brand_desc')}</p>
          </div>

          {/* Plataforma */}
          <div>
            <h4>{t('footer.platform')}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <Link to="/about">{t('footer.about_us')}</Link>
              <Link to="/services">{t('footer.services')}</Link>
              <Link to="/login">{t('nav.portal')}</Link>
            </div>
          </div>

          {/* Serviços */}
          <div>
            <h4>{t('footer.services')}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{t('footer.services_list.triage')}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{t('footer.services_list.teleconsult')}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{t('footer.services_list.prescriptions')}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{t('footer.services_list.management')}</span>
            </div>
          </div>

          {/* Contactos */}
          <div>
            <h4>{t('footer.contact')}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <a href="mailto:suporte@healthplatform.com">suporte@healthplatform.com</a>
              <a href="tel:+244928917269">+244 928 917 269</a>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Luanda, Angola</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} KAYA. {t('footer.rights')}</span>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <Link to="/privacy">{t('footer.privacy')}</Link>
            <Link to="/terms">{t('footer.terms')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
