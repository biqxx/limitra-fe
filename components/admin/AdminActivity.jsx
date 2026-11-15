'use client';
/* Activity log — wired to /admin/activity audit log endpoints with CSV export. */
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { adminActivityApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { AdmHead } from './AdminShared';
import { useAdminToast } from './AdminToastContext';

export function AdminActivity() {
  const toast = useAdminToast();
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);

  const load = useCallback(async () => {
    try {
      const params = { page, per_page: 25 };
      if (filter !== 'All') params.action = filter.toLowerCase();
      if (q.trim()) params.search = q.trim();
      const res = await adminActivityApi.list(params);
      const data = res?.data ?? res;
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setItems(list);
      setMeta(data?.pagination ?? res?.pagination ?? null);
    } catch (err) {
      toast(messageFrom(err));
    } finally {
      setLoaded(true);
    }
  }, [filter, page, q, toast]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!items.length) { toast('No activity rows to export'); return; }
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['ID', 'Action', 'Actor', 'Subject', 'Details', 'Timestamp'];
    const rows = items.map((a) => [
      a.id,
      a.action || a.event || '',
      a.actor?.email || a.actor?.name || a.actor_id || 'System',
      [a.subject_type, a.subject_id].filter(Boolean).join('#'),
      a.description || a.summary || (typeof a.metadata === 'object' ? JSON.stringify(a.metadata) : ''),
      a.created_at || '',
    ].map(esc).join(','));
    const csv = [headers.map(esc).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `limitra-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('Activity CSV exported');
  };

  const cats = ['All', 'Order', 'Inventory', 'Customer', 'Affiliate', 'Payout', 'Review', 'Refund', 'Rewards'];
  return (
    <>
      <AdmHead title="Activity log" sub="All audit events and recent store activity">
        <button className="adm-btn ghost" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
        <button className="adm-btn ghost" onClick={exportCsv}><Icon name="download" size={15} /> Export</button>
      </AdmHead>
      <div className="adm-filters" style={{ flexWrap: 'wrap', gap: 8 }}>
        {cats.map(c => <button key={c} className={'adm-chip' + (filter === c ? ' on' : '')} onClick={() => { setPage(1); setFilter(c); }}>{c}</button>)}
        <div className="adm-mini-search" style={{ marginLeft: 'auto' }}>
          <Icon name="search" size={15} className="muted" />
          <input placeholder="Search activity…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </div>
      </div>
      <div className="panel">
        <div className="adm-activity">
          {!loaded ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>Loading activity…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No activity yet.</div>
          ) : items.map((a, i) => {
            const action = String(a.action || a.event || 'activity');
            const actor = a.actor?.username || a.actor?.email || (a.actor_id ? `User #${a.actor_id}` : 'System');
            const desc = a.description || a.summary || [a.subject_type, a.subject_id].filter(Boolean).join(' #') || 'Audit event';
            const when = a.created_at ? new Date(a.created_at).toLocaleString() : '';
            return (
              <div className="adm-act-row" key={a.id || i}>
                <span className="adm-notif-ic blue"><Icon name="bell" size={16} /></span>
                <div className="adm-act-txt">
                  <div className="adm-act-top"><b>{action.replace(/[._-]+/g, ' ')}</b><span className="adm-pill muted">{actor}</span></div>
                  <small className="muted">{desc}</small>
                </div>
                <span className="adm-act-time muted">{when}</span>
              </div>
            );
          })}
        </div>
        {meta && meta.last_page > 1 && (
          <div className="row between" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <small className="muted">Page {meta.current_page} of {meta.last_page} ({meta.total} total)</small>
            <div className="row" style={{ gap: 8 }}>
              <button className="adm-btn ghost" disabled={meta.current_page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
              <button className="adm-btn ghost" disabled={meta.current_page >= meta.last_page} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
