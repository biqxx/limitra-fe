'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { naira } from '@/lib/data';
import { adminTransactionsApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { AdmHead, EmptyState, SkeletonRows } from './AdminShared';
import { useAdminToast } from './AdminToastContext';

const TYPES = [
  ['all', 'All'],
  ['deposit', 'Deposits'],
  ['payment', 'Payments'],
  ['order', 'Orders'],
  ['refund', 'Refunds'],
];

const STATUS_BADGE = {
  paid: 'ok',
  succeeded: 'ok',
  completed: 'ok',
  processed: 'ok',
  pending: 'warn',
  processing: 'warn',
  failed: 'err',
  cancelled: 'err',
  refunded: 'info',
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export function AdminTransactions() {
  const toast = useAdminToast();
  const [type, setType] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminTransactionsApi.list({
        type,
        q: q.trim() || undefined,
        page,
        per_page: 50,
      });
      setItems(Array.isArray(res?.items) ? res.items : []);
      setPagination(res?.pagination || null);
    } catch (e) {
      toast(messageFrom(e));
    } finally {
      setLoading(false);
    }
  }, [type, q, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const lastPage = Number(pagination?.last_page || 1);

  return (
    <div className="adm-page">
      <AdmHead
        title="Transactions"
        sub="Unified ledger of wallet deposits, Paystack payments, orders (including wallet credit offsets), and refunds."
      >
        <button className="adm-btn ghost" onClick={load} disabled={loading}>
          <Icon name="refresh" size={15} /> Refresh
        </button>
      </AdmHead>

      <div className="panel" style={{ padding: 16, marginBottom: 16 }}>
        <div className="row between" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {TYPES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`adm-btn ${type === key ? 'primary' : 'ghost'}`}
                onClick={() => { setType(key); setPage(1); }}
              >
                {label}
              </button>
            ))}
          </div>
          <form
            className="row"
            style={{ gap: 8 }}
            onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}
          >
            <input
              className="adm-in"
              style={{ minWidth: 240 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search reference, order #, or email…"
            />
            <button className="adm-btn ghost" type="submit">
              <Icon name="search" size={15} />
            </button>
          </form>
        </div>
      </div>

      <div className="panel">
        {loading ? (
          <SkeletonRows rows={8} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="dollar"
            title="No transactions found"
            description="No matching deposits, payments, orders, or refunds."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-tbl">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Method / Provider</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <span className="badge badge-soft" style={{ textTransform: 'capitalize' }}>
                        {tx.type}
                      </span>
                    </td>
                    <td>
                      <b>{tx.reference}</b>
                      {tx.order_number && tx.type !== 'order' && (
                        <div className="muted" style={{ fontSize: 12 }}>Order {tx.order_number}</div>
                      )}
                      {tx.reason && (
                        <div className="muted" style={{ fontSize: 12 }}>{tx.reason}</div>
                      )}
                    </td>
                    <td>
                      {tx.user ? (
                        <>
                          <div>{tx.user.name}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{tx.user.email}</div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize' }}>{tx.method || '—'}</span>
                      {tx.provider && (
                        <span className="muted" style={{ fontSize: 12 }}> · {tx.provider}</span>
                      )}
                    </td>
                    <td>
                      <b>{naira(Number(tx.amount || 0))}</b>
                      {Number(tx.wallet_credit || 0) > 0 && (
                        <div className="muted" style={{ fontSize: 11.5 }}>
                          Includes {naira(Number(tx.wallet_credit))} wallet credit
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`adm-pill ${STATUS_BADGE[tx.status] || 'warn'}`}>
                        {tx.status || 'unknown'}
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{fmtDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lastPage > 1 && (
          <div className="row between" style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <button
              className="adm-btn ghost"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="muted">Page {page} of {lastPage}</span>
            <button
              className="adm-btn ghost"
              disabled={page >= lastPage || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

