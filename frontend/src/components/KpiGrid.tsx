import type { ReactNode } from 'react';

export interface KpiItem {
  id: string;
  label: string;
  value: string | number;
  icon: ReactNode;
  color: string;
  tone?: 'default' | 'attention' | 'positive';
  helper?: string;
}

export default function KpiGrid({ items, ariaLabel }: { items: KpiItem[]; ariaLabel: string }) {
  return (
    <section className="role-kpi-grid" aria-label={ariaLabel}>
      {items.map(item => (
        <article key={item.id} className={`role-kpi-card role-kpi-card--${item.tone || 'default'}`}>
          <div className="role-kpi-card__top">
            <span className="role-kpi-card__label">{item.label}</span>
            <span className="role-kpi-card__icon" style={{ color: item.color, background: `${item.color}14` }}>
              {item.icon}
            </span>
          </div>
          <strong className="role-kpi-card__value" style={{ color: item.color }}>{item.value}</strong>
          {item.helper && <span className="role-kpi-card__helper">{item.helper}</span>}
        </article>
      ))}
    </section>
  );
}
