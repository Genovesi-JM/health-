import { Link } from 'react-router-dom';
import {
  Activity, ArrowRight, Droplets, Heart, HeartPulse,
  Scale, ThermometerSun, Weight, Wind,
} from 'lucide-react';
import { useT } from '../i18n/LanguageContext';

export interface ReadingSummaryItem {
  reading_type: string;
  value: number | null;
  unit: string | null;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  measured_at: string;
  source: string | null;
  device_brand: string | null;
  device_model: string | null;
  change: number | null;
  sample_count: number;
}

export interface ReadingSummary {
  period_days: number;
  total_readings: number;
  latest_measured_at: string | null;
  connected_sources: string[];
  items: ReadingSummaryItem[];
}

const META: Record<string, { labelKey: string; icon: typeof Activity; color: string }> = {
  weight: { labelKey: 'read.t_weight', icon: Weight, color: '#7c3aed' },
  body_fat: { labelKey: 'read.t_body_fat', icon: Activity, color: '#db2777' },
  blood_pressure: { labelKey: 'read.t_blood_pressure', icon: Heart, color: '#dc2626' },
  glucose: { labelKey: 'read.t_glucose', icon: Droplets, color: '#d97706' },
  oxygen_saturation: { labelKey: 'read.t_oxygen', icon: Wind, color: '#0284c7' },
  heart_rate: { labelKey: 'read.t_heart_rate', icon: HeartPulse, color: '#e11d48' },
  temperature: { labelKey: 'read.t_temperature', icon: ThermometerSun, color: '#ea580c' },
  bmi: { labelKey: 'read.t_bmi', icon: Scale, color: '#0d9488' },
  lean_body_mass: { labelKey: 'read.t_lean_mass', icon: Weight, color: '#2563eb' },
  body_water_mass: { labelKey: 'read.t_body_water', icon: Droplets, color: '#0891b2' },
  bone_mass: { labelKey: 'read.t_bone_mass', icon: Activity, color: '#64748b' },
  height: { labelKey: 'read.t_height', icon: Activity, color: '#4f46e5' },
  waist_circumference: { labelKey: 'read.t_waist', icon: Activity, color: '#9333ea' },
  basal_metabolic_rate: { labelKey: 'read.t_bmr', icon: Activity, color: '#059669' },
};

const PRIORITY = [
  'weight', 'body_fat', 'blood_pressure', 'glucose',
  'oxygen_saturation', 'heart_rate', 'temperature', 'bmi',
];

function displayValue(item: ReadingSummaryItem, locale: string) {
  if (item.reading_type === 'blood_pressure') {
    return item.systolic != null && item.diastolic != null
      ? `${item.systolic}/${item.diastolic}`
      : '—';
  }
  if (item.value == null) return '—';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(item.value);
}

function sourceLabel(source: string, t: (key: string) => string) {
  if (source === 'apple_health') return t('health.source_apple');
  if (source === 'health_connect') return t('health.source_android');
  if (source === 'renpho_csv') return 'RENPHO';
  return source.replace(/_/g, ' ');
}

export default function HealthSnapshot({ summary }: { summary: ReadingSummary | null }) {
  const { t, lang } = useT();
  const locale = { pt: 'pt-PT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', zh: 'zh-CN' }[lang] || 'pt-PT';
  const selected = summary?.items
    .slice()
    .sort((a, b) => {
      const aPriority = PRIORITY.indexOf(a.reading_type);
      const bPriority = PRIORITY.indexOf(b.reading_type);
      return (aPriority < 0 ? 99 : aPriority) - (bPriority < 0 ? 99 : bPriority);
    })
    .slice(0, 4) ?? [];

  return (
    <section className="health-snapshot" aria-labelledby="health-snapshot-title">
      <div className="health-snapshot__header">
        <div>
          <h2 id="health-snapshot-title">{t('health.snapshot_title')}</h2>
          <p>{t('health.snapshot_desc')}</p>
        </div>
        <Link to="/patient/readings">
          {t('health.view_measurements')} <ArrowRight size={14} />
        </Link>
      </div>

      {selected.length === 0 ? (
        <div className="health-snapshot__empty">
          <div className="health-snapshot__empty-icon"><HeartPulse size={23} /></div>
          <div>
            <strong>{t('health.no_data')}</strong>
            <span>{t('health.no_data_desc')}</span>
          </div>
          <Link to="/patient/readings" className="btn btn-primary btn-sm">
            {t('read.new')}
          </Link>
        </div>
      ) : (
        <>
          <div className="health-snapshot__grid">
            {selected.map(item => {
              const meta = META[item.reading_type] ?? {
                labelKey: `read.t_${item.reading_type}`,
                icon: Activity,
                color: '#0d9488',
              };
              const Icon = meta.icon;
              const unit = item.reading_type === 'blood_pressure'
                ? 'mmHg'
                : item.unit;
              return (
                <article className="health-snapshot__metric" key={item.reading_type}>
                  <div className="health-snapshot__metric-top">
                    <span className="health-snapshot__metric-icon" style={{ color: meta.color, background: `${meta.color}12` }}>
                      <Icon size={17} />
                    </span>
                    <span className="health-snapshot__metric-label">{t(meta.labelKey)}</span>
                  </div>
                  <div className="health-snapshot__value">
                    {displayValue(item, locale)}
                    {unit && <small>{unit}</small>}
                  </div>
                  <div className="health-snapshot__meta">
                    {item.change != null && item.change !== 0 ? (
                      <span className="health-snapshot__change">
                        {item.change > 0 ? '+' : ''}
                        {new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(item.change)}
                        {item.unit ? ` ${item.unit}` : ''}
                      </span>
                    ) : (
                      <span>
                        {item.sample_count} {t(item.sample_count === 1 ? 'health.sample' : 'health.samples')}
                      </span>
                    )}
                    <time dateTime={item.measured_at}>
                      {new Date(item.measured_at).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                    </time>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="health-snapshot__footer">
            <span>{summary!.total_readings} {t('health.total_records')}</span>
            {summary!.connected_sources.length > 0 && (
              <span className="health-snapshot__sources">
                {t('health.sources')}: {summary!.connected_sources.map(source => sourceLabel(source, t)).join(' · ')}
              </span>
            )}
            <span>{t('health.period')}: {summary!.period_days} {t('health.days')}</span>
          </div>
        </>
      )}
    </section>
  );
}
