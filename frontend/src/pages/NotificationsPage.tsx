import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  return (
    <>
      <div className="page-header">
        <h1>Alertas &amp; Notificações</h1>
        <p>As suas notificações de saúde e lembretes de medicação</p>
      </div>

      <div className="card" style={{ maxWidth: '640px' }}>
        <div className="empty-state" style={{ padding: '4rem 2rem' }}>
          <div className="empty-state-icon">
            <Bell size={32} style={{ color: 'var(--accent-teal)' }} />
          </div>
          <div className="empty-state-title">Sem notificações</div>
          <div className="empty-state-desc" style={{ maxWidth: '360px', margin: '0 auto' }}>
            Os alertas de triagem, lembretes de consultas e notificações de medicação aparecerão aqui.
            Estará disponível em breve.
          </div>
        </div>
      </div>
    </>
  );
}
