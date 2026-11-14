'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { adminProcurementApi, adminReviewsApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useStore } from '@/components/store/StoreProvider';
import { hasPermission } from '@/lib/auth/permissions';
import { useAdminToast } from './AdminToastContext';
import { AdmHead, Pager, usePager } from './AdminShared';

const asList = (res) => (Array.isArray(res) ? res : res?.items || res?.data || []);

export function AdminProcurement() {
  const { user } = useStore();
  const canManage = hasPermission(user, 'procurement.manage');
  const addToast = useAdminToast();
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await adminProcurementApi.list({ per_page: 100 });
      setOrders(asList(res));
    } catch (err) {
      addToast(messageFrom(err));
    } finally {
      setLoaded(true);
    }
  }, [addToast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((o) => JSON.stringify(o).toLowerCase().includes(needle));
  }, [orders, q]);

  const { shown, pagerProps } = usePager(filtered, q + orders.length);

  const syncOrder = async (id) => {
    try {
      await adminProcurementApi.sync(id);
      addToast(`Procurement order #${id} synced`);
      await load();
    } catch (err) {
      addToast(messageFrom(err));
    }
  };

  return (
    <>
      <AdmHead title="Supplier Procurement" sub="Track supplier purchase orders, fulfillment sync, and upstream status.">
        <button className="adm-btn ghost" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </AdmHead>
      <div className="adm-filters">
        <div className="adm-mini-search">
          <Icon name="search" size={16} className="muted" />
          <input placeholder="Search procurement orders…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>PO #</th><th>Supplier</th><th>Order Ref</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>Loading procurement orders…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>No procurement orders found.</td></tr>
              ) : shown.map((o) => (
                <tr key={o.id}>
                  <td><b>#{o.id}</b></td>
                  <td>{o.supplier || o.provider || '—'}</td>
                  <td className="muted">{o.external_order_id || o.order_id || '—'}</td>
                  <td><span className="adm-pill info" style={{ textTransform: 'capitalize' }}>{String(o.status || 'pending').replace(/_/g, ' ')}</span></td>
                  <td>
                    {canManage && (
                      <div className="adm-rowact">
                        <button title="Sync supplier status" onClick={() => syncOrder(o.id)}><Icon name="refresh" size={15} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager {...pagerProps} />
        </div>
      </div>
    </>
  );
}

export function AdminReviews() {
  const { user } = useStore();
  const canModerate = hasPermission(user, 'reviews.moderate');
  const addToast = useAdminToast();
  const [reviews, setReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await adminReviewsApi.list({ per_page: 100 });
      setReviews(asList(res));
    } catch (err) {
      addToast(messageFrom(err));
    } finally {
      setLoaded(true);
    }
  }, [addToast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return reviews;
    return reviews.filter((r) => JSON.stringify(r).toLowerCase().includes(needle));
  }, [q, reviews]);

  const { shown, pagerProps } = usePager(filtered, q + reviews.length);

  const moderate = async (rev, status) => {
    try {
      await adminReviewsApi.moderate(rev.id, { status });
      addToast(`Review #${rev.id} ${status}`);
      await load();
    } catch (err) {
      addToast(messageFrom(err));
    }
  };

  return (
    <>
      <AdmHead title="Product Reviews" sub="Moderate customer ratings and written feedback.">
        <button className="adm-btn ghost" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </AdmHead>
      <div className="adm-filters">
        <div className="adm-mini-search">
          <Icon name="search" size={16} className="muted" />
          <input placeholder="Search reviews…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Product / Author</th><th>Rating</th><th>Comment</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>Loading reviews…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>No reviews found.</td></tr>
              ) : shown.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.product?.name || `Product #${r.product_id || ''}`}</b><small className="muted" style={{ display: 'block' }}>{r.user?.username || r.user?.email || 'Customer'}</small></td>
                  <td><b>{r.rating ?? '—'} ★</b></td>
                  <td className="muted" style={{ maxWidth: 320 }}>{r.comment || r.body || '—'}</td>
                  <td><span className={'adm-pill ' + (r.status === 'approved' ? 'ok' : r.status === 'rejected' ? 'bad' : 'warn')}>{r.status || 'pending'}</span></td>
                  <td>
                    {canModerate && (
                      <div className="adm-rowact">
                        <button title="Approve" onClick={() => moderate(r, 'approved')}><Icon name="check" size={15} /></button>
                        <button className="del" title="Reject" onClick={() => moderate(r, 'rejected')}><Icon name="close" size={15} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager {...pagerProps} />
        </div>
      </div>
    </>
  );
}
