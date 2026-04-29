import { Users } from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export default function FamilyPage() {
  const { t } = useT();

  return (
    <>
      <div className="page-header">
        <h1>{t('family.title')}</h1>
        <p>{t('family.subtitle')}</p>
      </div>

      <div className="card" style={{ maxWidth: '640px' }}>
        <div className="empty-state" style={{ padding: '4rem 2rem' }}>
          <div className="empty-state-icon">
            <Users size={32} style={{ color: 'var(--accent-teal)' }} />
          </div>
          <div className="empty-state-title">{t('family.none')}</div>
          <div className="empty-state-desc" style={{ maxWidth: '360px', margin: '0 auto' }}>
            Esta funcionalidade permite gerir perfis de menores e dependentes ligados à sua conta.
            Estará disponível em breve.
          </div>
        </div>
      </div>
    </>
  );
}
