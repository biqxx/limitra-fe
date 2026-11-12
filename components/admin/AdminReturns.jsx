'use client';
/* Returns & Refunds admin — two related but separate resources: a Return is
   a customer's request to send items back (created by ordersApi.requestReturn,
   see components/pages/Account.jsx); a Refund is the actual money-movement
   record, which can also originate from a late payment, not just a return.
   Request/response shapes ARE documented in the spec here (unlike most of
   this API) but still unverified live — a 422 is more authoritative than
   this if one ever comes back. */
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { naira } from '@/lib/data';
import { adminReturnsApi, adminRefundsApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useAdminToast } from './AdminToastContext';
import { AdmHead } from './AdminShared';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Deliberately not toLocaleDateString — its output depends on the runtime's
// ICU data, which can differ between the Node server (SSR) and the browser
// (hydration), producing a React hydration mismatch (confirmed live
// elsewhere in this app).
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}

const asList = (res) => {
  const list = Array.isArray(res) ? res : (res?.data?.items ?? res?.items ?? res?.data ?? res?.results ?? []);
  return Array.isArray(list) ? list : [];
};

const RETURN_STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'received', 'completed'];
const RETURN_STATUS_CLS = { pending: 'warn', approved: 'info', rejected: 'bad', cancelled: 'muted', received: 'info', completed: 'ok' };
const RETURN_UPDATE_STATUSES = ['approved', 'rejected', 'received', 'completed'];

const REFUND_STATUSES = ['initiating', 'pending', 'processing', 'needs_attention', 'processed', 'failed'];
const REFUND_STATUS_CLS = { initiating: 'muted', pending: 'warn', processing: 'info', needs_attention: 'bad', processed: 'ok', failed: 'bad' };

function normalizeReturn(r) {
  return {
    id: r.id,
    orderId: r.order_id ?? r.order?.id,
    customer: r.customer_name ?? r.customer?.name ?? r.user?.name ?? r.order?.customer_name ?? 'Customer',
    reason: r.reason,
    status: String(r.status ?? 'pending').toLowerCase(),
    resolution: r.resolution,
    date: r.created_at ?? r.date,
    raw: r,
  };
}

function normalizeRefund(r) {
  return {
    id: r.id,
    amount: Number(r.amount ?? r.total ?? 0),
    method: r.method ?? r.provider,
    status: String(r.status ?? 'pending').toLowerCase(),
    source: r.source,
    date: r.created_at ?? r.date,
    raw: r,
  };
}

function Drawer({ title, sub, saving, canSave, onClose, onSave, saveLabel, children }) {
  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="adm-drawer-h">
          <div><h3>{title}</h3>{sub && <small className="muted">{sub}</small>}</div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">{children}</div>
        <div className="adm-drawer-f">
          <button className="adm-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="adm-btn primary" onClick={onSave} disabled={saving || !canSave}>{saving ? 'Saving…' : saveLabel}</button>
        </div>
      </aside>
    </>
  );
}

const SECTIONS = [['returns', 'Returns'], ['refunds', 'Refunds']];

export function AdminReturns() {
  const toast = useAdminToast();
  const [section, setSection] = useState('returns');

  const [returns, setReturns] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);

  const [updateDraft, setUpdateDraft] = useState(null);
  const [returnRefundDraft, setReturnRefundDraft] = useState(null);
  const [resolveDraft, setResolveDraft] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [r, f] = await Promise.all([
        adminReturnsApi.list({ per_page: 100 }),
        adminRefundsApi.list({ per_page: 100 }),
      ]);
      setReturns(asList(r).map(normalizeReturn));
      setRefunds(asList(f).map(normalizeRefund));
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  // Initial network hydration is intentionally triggered when the page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll(); }, [loadAll]);

  const switchSection = (key) => { setSection(key); setStatus('all'); setQ(''); };

  const submitUpdate = async () => {
    if (!updateDraft?.status) return;
    setSaving(true);
    try {
      await adminReturnsApi.update(updateDraft.ret.id, {
        status: updateDraft.status,
        reason: updateDraft.reason.trim() || undefined,
        notes: updateDraft.notes.trim() || undefined,
      });
      toast('Return updated');
      setUpdateDraft(null);
      await loadAll();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  const submitReturnRefund = async () => {
    if (!returnRefundDraft?.amount || !returnRefundDraft.reason.trim()) return;
    setSaving(true);
    try {
      await adminReturnsApi.refund(returnRefundDraft.ret.id, {
        amount: Number(returnRefundDraft.amount),
        method: returnRefundDraft.method,
        reason: returnRefundDraft.reason.trim(),
      });
      toast('Refund initiated for this return');
      setReturnRefundDraft(null);
      await loadAll();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  const submitResolve = async () => {
    if (!resolveDraft?.status || !resolveDraft.note.trim()) return;
    setSaving(true);
    try {
      await adminRefundsApi.resolve(resolveDraft.refund.id, {
        status: resolveDraft.status,
        note: resolveDraft.note.trim(),
        provider_reference: resolveDraft.provider_reference.trim() || undefined,
      });
      toast('Refund resolved');
      setResolveDraft(null);
      await loadAll();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  const retryRefund = async (refund) => {
    try {
      await adminRefundsApi.retry(refund.id);
      toast('Refund retry queued');
      await loadAll();
    } catch (error) { toast(messageFrom(error)); }
  };

  const returnTabs = ['all', ...RETURN_STATUSES];
  const refundTabs = ['all', ...REFUND_STATUSES];
  const visibleReturns = returns.filter(r => (status === 'all' || r.status === status) && (!q || String(r.id).includes(q) || (r.customer || '').toLowerCase().includes(q.toLowerCase())));
  const visibleRefunds = refunds.filter(r => (status === 'all' || r.status === status) && (!q || String(r.id).includes(q)));

  return (
    <>
      <AdmHead title="Returns & Refunds" sub="Customer return requests and the refunds that come out of them.">
      </AdmHead>

      <div className="adm-filters">
        {SECTIONS.map(([key, label]) => (
          <button key={key} className={'adm-chip' + (section === key ? ' on' : '')} onClick={() => switchSection(key)}>{label}</button>
        ))}
      </div>

      <div className="adm-filters">
        <div className="adm-mini-search"><Icon name="search" size={16} className="muted" /><input placeholder={section === 'returns' ? 'Search return # or customer…' : 'Search refund #…'} value={q} onChange={e => setQ(e.target.value)} /></div>
        {(section === 'returns' ? returnTabs : refundTabs).map(t => (
          <button key={t} className={'adm-chip' + (status === t ? ' on' : '')} onClick={() => setStatus(t)}>{t === 'all' ? 'All' : t.replace(/_/g, ' ')}</button>
        ))}
      </div>

      {section === 'returns' && (
        <div className="panel" style={{ padding: 0 }}>
          {!loaded ? <div className="adm-soon"><p>Loading returns…</p></div> : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Return</th><th>Order</th><th>Customer</th><th>Date</th><th>Reason</th><th>Status</th><th></th></tr></thead>
                <tbody>{visibleReturns.map(r => (
                  <tr key={r.id}>
                    <td><b style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5 }}>#{r.id}</b></td>
                    <td className="muted">{r.orderId ? `#${r.orderId}` : '—'}</td>
                    <td>{r.customer}</td>
                    <td className="muted">{fmtDate(r.date)}</td>
                    <td className="muted">{r.reason || '—'}</td>
                    <td><span className={'adm-pill ' + (RETURN_STATUS_CLS[r.status] || 'muted')}>{r.status.replace(/_/g, ' ')}</span></td>
                    <td><div className="adm-rowact">
                      <button title="Update return" onClick={() => setUpdateDraft({ ret: r, status: RETURN_UPDATE_STATUSES[0], reason: r.reason || '', notes: '' })}><Icon name="edit" size={15} /></button>
                      <button title="Refund this return" onClick={() => setReturnRefundDraft({ ret: r, amount: '', method: 'original_payment', reason: '' })}><Icon name="dollar" size={15} /></button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
              {visibleReturns.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No returns match your filters.</div>}
            </div>
          )}
        </div>
      )}

      {section === 'refunds' && (
        <div className="panel" style={{ padding: 0 }}>
          {!loaded ? <div className="adm-soon"><p>Loading refunds…</p></div> : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Refund</th><th>Amount</th><th>Method</th><th>Source</th><th>Date</th><th>Status</th><th></th></tr></thead>
                <tbody>{visibleRefunds.map(r => (
                  <tr key={r.id}>
                    <td><b style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5 }}>#{r.id}</b></td>
                    <td><b>{naira(r.amount)}</b></td>
                    <td className="muted">{r.method || '—'}</td>
                    <td className="muted">{r.source || '—'}</td>
                    <td className="muted">{fmtDate(r.date)}</td>
                    <td><span className={'adm-pill ' + (REFUND_STATUS_CLS[r.status] || 'muted')}>{r.status.replace(/_/g, ' ')}</span></td>
                    <td><div className="adm-rowact">
                      <button title="Resolve refund" onClick={() => setResolveDraft({ refund: r, status: 'processed', note: '', provider_reference: '' })}><Icon name="check" size={15} /></button>
                      <button title="Retry refund" onClick={() => retryRefund(r)}><Icon name="refresh" size={15} /></button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
              {visibleRefunds.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No refunds match your filters.</div>}
            </div>
          )}
        </div>
      )}

      {updateDraft && (
        <Drawer title={`Update return · #${updateDraft.ret.id}`} saving={saving} canSave={!!updateDraft.status} onClose={() => setUpdateDraft(null)} onSave={submitUpdate} saveLabel="Update return">
          <label className="adm-field"><span>New status</span>
            <select value={updateDraft.status} onChange={e => setUpdateDraft(c => ({ ...c, status: e.target.value }))}>
              {RETURN_UPDATE_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <label className="adm-field"><span>Reason</span><input value={updateDraft.reason} onChange={e => setUpdateDraft(c => ({ ...c, reason: e.target.value }))} placeholder="e.g. Item damaged in transit" autoFocus /></label>
          <label className="adm-field"><span>Notes (optional)</span><textarea rows="3" value={updateDraft.notes} onChange={e => setUpdateDraft(c => ({ ...c, notes: e.target.value }))} /></label>
        </Drawer>
      )}

      {returnRefundDraft && (
        <Drawer title={`Refund return · #${returnRefundDraft.ret.id}`} saving={saving} canSave={!!(Number(returnRefundDraft.amount) > 0 && returnRefundDraft.reason.trim())} onClose={() => setReturnRefundDraft(null)} onSave={submitReturnRefund} saveLabel="Submit refund">
          <div className="adm-field-row">
            <label className="adm-field"><span>Amount (₦)</span><input type="number" min="0" value={returnRefundDraft.amount} onChange={e => setReturnRefundDraft(c => ({ ...c, amount: e.target.value }))} autoFocus /></label>
            <label className="adm-field"><span>Refund to</span>
              <select value={returnRefundDraft.method} onChange={e => setReturnRefundDraft(c => ({ ...c, method: e.target.value }))}>
                <option value="original_payment">Original payment method</option>
                <option value="wallet">Wallet credit</option>
              </select>
            </label>
          </div>
          <label className="adm-field"><span>Reason</span><textarea rows="3" value={returnRefundDraft.reason} onChange={e => setReturnRefundDraft(c => ({ ...c, reason: e.target.value }))} placeholder="Why this return is being refunded (required)" /></label>
        </Drawer>
      )}

      {resolveDraft && (
        <Drawer title={`Resolve refund · #${resolveDraft.refund.id}`} saving={saving} canSave={!!resolveDraft.note.trim()} onClose={() => setResolveDraft(null)} onSave={submitResolve} saveLabel="Resolve refund">
          <label className="adm-field"><span>Outcome</span>
            <select value={resolveDraft.status} onChange={e => setResolveDraft(c => ({ ...c, status: e.target.value }))}>
              <option value="processed">Processed</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="adm-field"><span>Note</span><textarea rows="3" value={resolveDraft.note} onChange={e => setResolveDraft(c => ({ ...c, note: e.target.value }))} placeholder="What happened (required)" autoFocus /></label>
          <label className="adm-field"><span>Provider reference (optional)</span><input value={resolveDraft.provider_reference} onChange={e => setResolveDraft(c => ({ ...c, provider_reference: e.target.value }))} placeholder="e.g. Paystack refund ID" /></label>
        </Drawer>
      )}
    </>
  );
}
