import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, ExternalLink, FileSearch, RefreshCw, XCircle } from 'lucide-react';
import api from '../api';

type Dossier = {
  id: string; profession: string; legal_name: string; status: string; automated_score: number;
  licence_number: string; licence_country: string; practice_country: string; diploma_country: string;
  issuing_authority: string; diploma_institution: string; degree_title: string;
  missing_evidence: string[]; automated_checks: { code: string; passed: boolean; label: string }[];
  evidence: { id: string; kind: string; original_filename: string; size_bytes: number }[];
  registry?: { authority: string; url?: string; mode: string };
  licence_jurisdiction?: string;
  provider_checks: {
    id: string; provider: string; status: string; error_message?: string;
    extracted_data?: Record<string, { value?: string | number; confidence?: number }>;
  }[];
};

const statusLabel: Record<string, string> = {
  draft: 'Rascunho', needs_info: 'Precisa de informação', pending_review: 'Por rever',
  verified: 'Verificado', rejected: 'Rejeitado', suspended: 'Suspenso',
};

export default function AdminCredentialsPage() {
  const [items, setItems] = useState<Dossier[]>([]);
  const [selected, setSelected] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending_review');

  const load = () => {
    setLoading(true);
    api.get('/api/v1/credentials/admin', { params: filter ? { status: filter } : {} })
      .then(r => {
        setItems(r.data);
        setSelected(current => r.data.find((item: Dossier) => item.id === current?.id) || r.data[0] || null);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, [filter]);

  const decide = async (action: string) => {
    if (!selected) return;
    let notes = '';
    if (action !== 'approve') {
      notes = window.prompt(action === 'reject' ? 'Motivo obrigatório da rejeição:' : 'Informação adicional necessária:') || '';
      if (!notes.trim()) return;
    }
    await api.post(`/api/v1/credentials/admin/${selected.id}/decision`, { action, notes: notes || null });
    load();
  };

  const download = async (id: string, filename: string) => {
    const res = await api.get(`/api/v1/credentials/evidence/${id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="page-header">
        <h1>Credenciais clínicas</h1>
        <p>Revisão humana assistida para médicos e enfermeiros.</p>
      </div>
      <div className="tab-nav" style={{ marginBottom: '1rem' }}>
        {[
          ['pending_review', 'Por rever'], ['needs_info', 'Informação'], ['verified', 'Verificados'],
          ['rejected', 'Rejeitados'], ['', 'Todos'],
        ].map(([value, label]) => (
          <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
        ))}
        <button onClick={load}><RefreshCw size={13} /> Actualizar</button>
      </div>

      {loading ? <div className="page-loading"><div className="spinner" /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, .8fr) minmax(360px, 1.5fr)', gap: '1rem', alignItems: 'start' }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            {items.length === 0 ? <div className="empty-state" style={{ padding: '2.5rem 1rem' }}><FileSearch /><p>Sem processos neste estado.</p></div> :
              items.map(item => (
                <button key={item.id} onClick={() => setSelected(item)} style={{
                  width: '100%', border: 0, borderBottom: '1px solid var(--border)', textAlign: 'left',
                  padding: '1rem', cursor: 'pointer', background: selected?.id === item.id ? 'rgba(13,148,136,.08)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{item.legal_name}</strong>
                    <span className={`badge ${item.status === 'verified' ? 'badge-success' : item.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                      {item.automated_score}%
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '.76rem', marginTop: 5 }}>
                    {item.profession === 'doctor' ? 'Médico/a' : 'Enfermeiro/a'} · {statusLabel[item.status] || item.status}
                  </div>
                </button>
              ))}
          </div>

          {selected && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{selected.legal_name}</h2>
                  <p style={{ margin: '.3rem 0', color: 'var(--text-muted)', fontSize: '.8rem' }}>
                    {selected.issuing_authority} · licença {selected.licence_number}
                  </p>
                </div>
                {selected.registry?.url && <a className="btn btn-secondary btn-sm" href={selected.registry.url} target="_blank" rel="noreferrer">Abrir registo oficial <ExternalLink size={13} /></a>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '.7rem', margin: '1rem 0' }}>
                {[['Exercício', selected.practice_country], ['Licença', `${selected.licence_country}${selected.licence_jurisdiction ? ` · ${selected.licence_jurisdiction}` : ''}`], ['Diploma', selected.diploma_country], ['Formação', `${selected.degree_title} — ${selected.diploma_institution}`]].map(([label, value]) => (
                  <div key={label} style={{ padding: '.7rem', background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8 }}>
                    <div style={{ fontSize: '.68rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
                    <strong style={{ fontSize: '.8rem' }}>{value}</strong>
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: '.9rem' }}>Documentos privados</h3>
              {selected.evidence.map(item => (
                <button key={item.id} onClick={() => download(item.id, item.original_filename)} className="btn btn-secondary btn-sm" style={{ margin: '0 .45rem .45rem 0' }}>
                  <Download size={13} /> {item.kind} · {(item.size_bytes / 1024).toFixed(0)} KB
                </button>
              ))}

              <h3 style={{ fontSize: '.9rem', marginTop: '1rem' }}>Verificações</h3>
              {selected.automated_checks.map(check => (
                <div key={check.code} style={{ display: 'flex', gap: 7, margin: '.4rem 0', fontSize: '.8rem' }}>
                  {check.passed ? <CheckCircle2 size={15} color="#059669" /> : <AlertTriangle size={15} color="#d97706" />} {check.label}
                </div>
              ))}

              <h3 style={{ fontSize: '.9rem', marginTop: '1rem' }}>Fornecedores externos</h3>
              {selected.provider_checks?.length ? selected.provider_checks.map(check => (
                <div key={check.id} style={{ padding: '.7rem', border: '1px solid var(--border)', borderRadius: 8, marginBottom: '.55rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: '.8rem', textTransform: 'capitalize' }}>{check.provider}</strong>
                    <span className={`badge ${check.status === 'completed' ? 'badge-success' : check.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                      {check.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  {check.error_message && <div style={{ color: '#b91c1c', fontSize: '.72rem', marginTop: 5 }}>{check.error_message}</div>}
                  {Object.entries(check.extracted_data || {}).map(([field, value]) => (
                    <div key={field} style={{ color: 'var(--text-muted)', fontSize: '.72rem', marginTop: 4 }}>
                      {field}: <strong>{String(value.value ?? '')}</strong>
                      {typeof value.confidence === 'number' ? ` · ${Math.round(value.confidence * 100)}%` : ''}
                    </div>
                  ))}
                </div>
              )) : <p style={{ color: 'var(--text-muted)', fontSize: '.78rem' }}>Ainda não iniciados.</p>}

              {selected.status !== 'verified' && selected.status !== 'suspended' && (
                <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.2rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" disabled={selected.missing_evidence.length > 0} onClick={() => decide('approve')}>
                    <CheckCircle2 size={15} /> Aprovar
                  </button>
                  <button className="btn btn-secondary" onClick={() => decide('needs_info')}>
                    <AlertTriangle size={15} /> Pedir informação
                  </button>
                  <button className="btn btn-sm" onClick={() => decide('reject')} style={{ color: '#b91c1c', border: '1px solid #fecaca' }}>
                    <XCircle size={15} /> Rejeitar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
