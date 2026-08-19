import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Search, Loader2, Phone, Clock, Ambulance, Home, Navigation } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import api from '../api';
import { useT } from '../i18n/LanguageContext';

type Facility = {
  id: string;
  organisation_id: string;
  org_type: string;
  org_type_label: string;
  org_name: string;
  name: string;
  address?: string | null;
  city?: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_hours?: string | null;
  services: string[];
  emergency_available: boolean;
  home_delivery: boolean;
  home_sample_collection: boolean;
  contact_phone?: string | null;
};

const TYPE_COLOR: Record<string, string> = {
  clinic: '#0d9488',
  laboratory: '#7c3aed',
  pharmacy_org: '#d97706',
  health_org: '#2563eb',
};

const TYPE_FILTERS = [
  { value: '', key: 'mapa.filter_all' },
  { value: 'clinic', key: 'mapa.filter_clinics' },
  { value: 'laboratory', key: 'mapa.filter_labs' },
  { value: 'pharmacy_org', key: 'mapa.filter_pharmacies' },
];

// Luanda — sensible default centre for the Angola pilot.
const DEFAULT_CENTER: [number, number] = [-8.839, 13.289];
const DEFAULT_ZOOM = 12;

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

/** Load Leaflet from CDN once; resolves when window.L is available. */
function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).L));
      existing.addEventListener('error', reject);
      if ((window as any).L) resolve((window as any).L);
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function pinIcon(L: any, color: string) {
  return L.divIcon({
    className: 'kaya-map-pin',
    html: `<span style="display:block;width:20px;height:20px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 20],
    popupAnchor: [0, -18],
  });
}

export default function MapaPage() {
  const { t } = useT();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mapError, setMapError] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const leafletRef = useRef<any>(null);

  // Fetch facilities.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError('');
      try {
        const res = await api.get('/api/v1/public/facilities');
        if (active) setFacilities(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (active) setError(t('mapa.load_error'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Init map once.
  useEffect(() => {
    let active = true;
    loadLeaflet()
      .then((L) => {
        if (!active || !mapDivRef.current || mapRef.current) return;
        leafletRef.current = L;
        const map = L.map(mapDivRef.current, { scrollWheelZoom: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);
        mapRef.current = map;
      })
      .catch(() => { if (active) setMapError(true); });
    return () => {
      active = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return facilities.filter(f => {
      if (typeFilter && f.org_type !== typeFilter) return false;
      if (!q) return true;
      return (
        f.org_name.toLowerCase().includes(q) ||
        (f.name || '').toLowerCase().includes(q) ||
        (f.city || '').toLowerCase().includes(q) ||
        (f.address || '').toLowerCase().includes(q)
      );
    });
  }, [facilities, typeFilter, query]);

  // Sync markers with filtered results.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    Object.values(markersRef.current).forEach((m: any) => map.removeLayer(m));
    markersRef.current = {};

    const bounds: [number, number][] = [];
    filtered.forEach(f => {
      if (f.latitude == null || f.longitude == null) return;
      const color = TYPE_COLOR[f.org_type] || '#2563eb';
      const marker = L.marker([f.latitude, f.longitude], { icon: pinIcon(L, color) }).addTo(map);
      marker.bindPopup(
        `<strong>${f.org_name}</strong><br/>${f.org_type_label}` +
        (f.address ? `<br/>${f.address}` : '') +
        (f.contact_phone ? `<br/>${f.contact_phone}` : ''),
      );
      marker.on('click', () => setSelectedId(f.id));
      markersRef.current[f.id] = marker;
      bounds.push([f.latitude, f.longitude]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [filtered, mapError]);

  const focusFacility = (f: Facility) => {
    setSelectedId(f.id);
    const map = mapRef.current;
    const marker = markersRef.current[f.id];
    if (map && marker && f.latitude != null && f.longitude != null) {
      map.setView([f.latitude, f.longitude], 15, { animate: true });
      marker.openPopup();
    }
  };

  return (
    <div className="landing-wrapper">
      <Navbar />

      <section className="lp-page-hero" style={{ paddingBottom: '1.5rem' }}>
        <div className="lp-tag">{t('mapa.tag')}</div>
        <h1>{t('mapa.title')}</h1>
        <p>{t('mapa.subtitle')}</p>
      </section>

      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 360px) 1fr', gap: '1.25rem', maxWidth: '1100px', margin: '0 auto', alignItems: 'stretch' }} className="mapa-grid">
          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', minWidth: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('mapa.search_ph')}
                style={{ width: '100%', padding: '0.7rem 0.7rem 0.7rem 2.3rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', fontSize: '0.88rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {TYPE_FILTERS.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => setTypeFilter(tf.value)}
                  style={{
                    padding: '0.4rem 0.75rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${typeFilter === tf.value ? 'var(--accent-teal)' : 'var(--border)'}`,
                    background: typeFilter === tf.value ? 'rgba(20,184,166,0.12)' : 'transparent',
                    color: typeFilter === tf.value ? 'var(--accent-teal)' : 'var(--text-secondary)',
                  }}
                >
                  {t(tf.key)}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '520px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {loading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                  <Loader2 size={22} className="spin" style={{ margin: '0 auto 0.5rem', display: 'block' }} /> {t('mapa.loading')}
                </div>
              ) : error ? (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', padding: '1rem 0' }}>{error}</div>
              ) : filtered.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1.5rem 0', textAlign: 'center' }}>
                  {facilities.length === 0 ? t('mapa.empty_none') : t('mapa.empty_search')}
                </div>
              ) : (
                filtered.map(f => (
                  <button
                    key={f.id}
                    onClick={() => focusFacility(f)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', width: '100%',
                      background: selectedId === f.id ? 'rgba(20,184,166,0.1)' : 'rgba(15,23,42,0.5)',
                      border: `1px solid ${selectedId === f.id ? 'var(--accent-teal)' : 'var(--border)'}`,
                      borderRadius: '12px', padding: '0.85rem 1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: TYPE_COLOR[f.org_type] || '#2563eb', flexShrink: 0 }} />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{f.org_name}</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      {f.org_type_label}{f.city ? ` · ${f.city}` : ''}
                    </div>
                    {f.address && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                        <MapPin size={13} style={{ marginTop: 2, flexShrink: 0, color: 'var(--text-muted)' }} /> {f.address}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                      {f.contact_phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Phone size={12} /> {f.contact_phone}</span>}
                      {f.opening_hours && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={12} /> {f.opening_hours}</span>}
                      {f.emergency_available && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444' }}><Ambulance size={12} /> {t('mapa.emergency')}</span>}
                      {(f.home_delivery || f.home_sample_collection) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Home size={12} /> {t('mapa.home_service')}</span>}
                    </div>
                    {f.latitude != null && f.longitude != null && (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${f.latitude}&mlon=${f.longitude}#map=17/${f.latitude}/${f.longitude}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.55rem', fontSize: '0.74rem', color: 'var(--accent-teal)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        <Navigation size={12} /> {t('mapa.directions')}
                      </a>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Map */}
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', minHeight: '480px', position: 'relative' }}>
            {mapError ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {t('mapa.map_error')}
              </div>
            ) : (
              <div ref={mapDivRef} style={{ width: '100%', height: '100%', minHeight: '480px' }} />
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
