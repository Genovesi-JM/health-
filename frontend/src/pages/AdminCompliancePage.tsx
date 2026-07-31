import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Filter, Loader2, Search, ShieldCheck } from 'lucide-react';
import api from '../api';
import { useT } from '../i18n/LanguageContext';
import CaseDetailDrawer from '../components/CaseDetailDrawer';

interface CaseRow {
  credential_id: string;
  user_id: string;
  profession: string;
  legal_name: string;
  licence_country: string;
  licence_number: string;
  issuing_authority: string;
  status: string;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
  latest_transition: null | {
    new_status: string;
    reason_code: string | null;
    actor_kind: string;
    at: string;
  };
}

interface CaseListResponse {
  total: number;
  limit: number;
  offset: number;
  items: CaseRow[];
}

/* ── Status colour vocabulary — keeps chips consistent everywhere ────── */
const STATUS_COLOURS: Record<string, { bg: string; fg: string; label: string }> = {
  draft:              { bg: 'rgba(100,116,139,0.12)', fg: '#475569', label: 'Rascunho' },
  pending_review:     { bg: 'rgba(37,99,235,0.10)',   fg: '#1d4ed8', label: 'Em revisão' },
  submitted:          { bg: 'rgba(37,99,235,0.10)',   fg: '#1d4ed8', label: 'Submetido' },
  processing:         { bg: 'rgba(124,58,237,0.10)',  fg: '#6d28d9', label: 'A processar' },
  action_required:    { bg: 'rgba(234,179,8,0.15)',   fg: '#a16207', label: 'Aguarda utilizador' },
  needs_info:         { bg: 'rgba(234,179,8,0.15)',   fg: '#a16207', label: 'Aguarda utilizador' },
  manual_review:      { bg: 'rgba(217,119,6,0.12)',   fg: '#c2410c', label: 'Revisão manual' },
  verified:           { bg: 'rgba(16,185,129,0.15)',  fg: '#047857', label: 'Verificado' },
  completed:          { bg: 'rgba(16,185,129,0.15)',  fg: '#047857', label: 'Verificado' },
  partially_verified: { bg: 'rgba(234,179,8,0.15)',   fg: '#a16207', label: 'Parcialmente verificado' },
  unable_to_verify:   { bg: 'rgba(148,163,184,0.15)', fg: '#64748b', label: 'Não verificável' },
  rejected:           { bg: 'rgba(239,68,68,0.10)',   fg: '#b91c1c', label: 'Rejeitado' },
  failed:             { bg: 'rgba(239,68,68,0.10)',   fg: '#b91c1c', label: 'Falhou' },
  suspended:          { bg: 'rgba(148,163,184,0.15)', fg: '#475569', label: 'Suspenso' },
  revoked:            { bg: 'rgba(15,23,42,0.10)',    fg: '#0f172a', label: 'Revogado' },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS_COLOURS[status] ?? { bg: 'rgba(100,116,139,0.12)', fg: '#475569', label: status };
  return (
    <span style={{
      padding: '0.22rem 0.6rem', borderRadius: 999,
      background: s.bg, color: s.fg,
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em',
    }}>{s.label}</span>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function AdminCompliancePage() {
  const { t } = useT();
  const [items, setItems] = useState<CaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [professionFilter, setProfessionFilter] = useState('');
  const [search, setSearch] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (countryFilter) params.set('country', countryFilter);
      if (professionFilter) params.set('profession', professionFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await api.get<CaseListResponse>(`/api/v1/compliance/cases?${params}`);
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || 'Não foi possível carregar os processos.');
    } finally { setLoading(false); }
  }, [statusFilter, countryFilter, professionFilter, search]);

  useEffect(() => { load(); }, [load]);

  const statusChoices = useMemo(() => [
    { value: '', label: t('admc.all') },
    { value: 'pending_review', label: 'Em revisão' },
    { value: 'action_required', label: 'Aguarda utilizador' },
    { value: 'manual_review', label: 'Revisão manual' },
    { value: 'verified', label: 'Verificado' },
    { value: 'rejected', label: 'Rejeitado' },
    { value: 'suspended', label: 'Suspenso' },
  ], [t]);

  return (
    <div style={{ padding: '1.5rem 1.25rem 4rem' }}>
      <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={22} style={{ color: 'var(--brand-primary)' }} /> {t('admc.title')}
      </h1>
      <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
        {t('admc.subtitle')}
      </p>

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <Filter size={14} /> Filtros
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '0.35rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', fontSize: '0.85rem' }}>
            {statusChoices.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
            style={{ padding: '0.35rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', fontSize: '0.85rem' }}>
            <option value="">{t('admc.all')} ({t('admc.filter_country')})</option>
            <option value="AO">Angola</option>
            <option value="PT">Portugal</option>
            <option value="ES">España</option>
          </select>
          <select value={professionFilter} onChange={e => setProfessionFilter(e.target.value)}
            style={{ padding: '0.35rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', fontSize: '0.85rem' }}>
            <option value="">{t('admc.all')} ({t('admc.filter_profession')})</option>
            <option value="doctor">Médicos</option>
            <option value="nurse">Enfermeiros</option>
            <option value="pharmacist">Farmacêuticos</option>
          </select>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('admc.search')}
              style={{ width: '100%', padding: '0.4rem 0.6rem 0.4rem 2rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-primary)', fontSize: '0.85rem' }}
            />
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={16} className="spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
            {t('admc.loading')}
          </div>
        ) : error ? (
          <div style={{ padding: '1.25rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} /> {error}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {t('admc.empty')}
          </div>
        ) : (
          <>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {items.length} de {total}
            </div>
            {items.map(row => (
              <button
                key={row.credential_id}
                type="button"
                onClick={() => setSelectedId(row.credential_id)}
                style={{
                  display: 'flex', width: '100%', alignItems: 'center', gap: '1rem',
                  padding: '0.85rem 1rem', textAlign: 'left', cursor: 'pointer',
                  border: 'none', background: 'transparent',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {row.legal_name}
                    <span style={{ marginLeft: 8, fontWeight: 500, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      · {row.profession} · {row.licence_country}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {row.issuing_authority} — {row.licence_number}
                  </div>
                </div>
                <StatusChip status={row.status} />
              </button>
            ))}
          </>
        )}
      </div>

      {selectedId && (
        <CaseDetailDrawer
          credentialId={selectedId}
          onClose={() => setSelectedId(null)}
          onCaseUpdated={() => load()}
        />
      )}
    </div>
  );
}
