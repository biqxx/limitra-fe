'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { Kpi } from '@/components/charts/Charts';
import { adminMicrostoresApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useStore } from '@/components/store/StoreProvider';
import { hasPermission } from '@/lib/auth/permissions';
import { useAdminToast } from './AdminToastContext';
import { AdmHead, EmptyState, Pager, usePager } from './AdminShared';

const asList = (res) => (Array.isArray(res) ? res : res?.items || res?.data || []);

// MicroStore moderation (GET/moderate/feature on /admin/microstores) is a
// real, documented admin endpoint — used below as-is. There is no
// corresponding /admin/celebrity-stores endpoint at all (confirmed against
// the API spec), so AdminCelebrityStores below stays an honest empty state
// instead of reusing this console with an unverified "is this microstore
// actually a celebrity store" guess. Neither mode has a real admin-side
// creation endpoint either (only GET/moderate/feature are documented), so
// there's no "Create store" action here — stores are only created by their
// own owner, via /my-microstore or /my-celebrity-store.
function StoreConsole() {
  const { user } = useStore();
  const canManage = hasPermission(user, 'microstores.manage');
  const addToast = useAdminToast();

  const [stores, setStores] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const res = await adminMicrostoresApi.list({ per_page: 100 });
      setStores(asList(res));
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
    return stores.filter((s) => {
      if (statusFilter === 'featured' && !s.is_featured) return false;
      if (statusFilter !== 'all' && statusFilter !== 'featured' && String(s.moderation_status || s.status || '').toLowerCase() !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return `${s.name || ''} ${s.slug || ''} ${s.user?.username || ''} ${s.user?.email || ''}`.toLowerCase().includes(needle);
    });
  }, [q, statusFilter, stores]);

  const { shown, pagerProps } = usePager(filtered, q + statusFilter);

  const moderate = async (store, moderation_status) => {
    try {
      await adminMicrostoresApi.moderate(store.id, { moderation_status });
      addToast(`${store.name} marked as ${moderation_status}`);
      await load();
    } catch (err) {
      addToast(messageFrom(err));
    }
  };

  const toggleFeature = async (store) => {
    try {
      await adminMicrostoresApi.toggleFeatured(store.id, { is_featured: !store.is_featured });
      addToast(store.is_featured ? `${store.name} unfeatured` : `${store.name} featured`);
      await load();
    } catch (err) {
      addToast(messageFrom(err));
    }
  };

  const activeCount = stores.filter((s) => s.status === 'active' || s.moderation_status === 'approved').length;
  const pendingCount = stores.filter((s) => s.moderation_status === 'pending' || s.moderation_status === 'pending_review').length;
  const featuredCount = stores.filter((s) => Boolean(s.is_featured)).length;

  return (
    <>
      <AdmHead
        title="MicroStores"
        sub="Moderate creator storefronts, featured placements, and store status."
      >
        <button className="adm-btn ghost" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </AdmHead>

      <div className="kpi-grid">
        <Kpi ic="store" tint="#0438B6" label="Total stores" val={loaded ? stores.length : '—'} delta="" up />
        <Kpi ic="check" tint="#1F8A5B" label="Approved / Active" val={loaded ? activeCount : '—'} delta="" up />
        <Kpi ic="clock" tint="#F5A623" label="Pending review" val={loaded ? pendingCount : '—'} delta="" />
        <Kpi ic="star" tint="#7A5AE0" label="Featured" val={loaded ? featuredCount : '—'} delta="" up />
      </div>

      <div className="adm-filters">
        <div className="adm-mini-search">
          <Icon name="search" size={16} className="muted" />
          <input placeholder="Search store name, slug, owner…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {['all', 'approved', 'pending', 'suspended', 'featured'].map((st) => (
          <button key={st} className={'adm-chip' + (statusFilter === st ? ' on' : '')} onClick={() => setStatusFilter(st)} style={{ textTransform: 'capitalize' }}>
            {st}
          </button>
        ))}
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Owner</th>
                <th>Moderation</th>
                <th>Featured</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>Loading stores…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>No stores match your filters.</td></tr>
              ) : shown.map((s) => {
                const mod = String(s.moderation_status || s.status || 'pending').toLowerCase();
                return (
                  <tr key={s.id}>
                    <td>
                      <b>{s.name}</b>
                      <small className="muted" style={{ display: 'block' }}>/{s.slug}</small>
                    </td>
                    <td>
                      <div>{s.user?.username || s.user?.email || `User #${s.user_id}`}</div>
                      {s.user?.email && <small className="muted">{s.user.email}</small>}
                    </td>
                    <td>
                      <span className={'adm-pill ' + (mod === 'approved' || mod === 'active' ? 'ok' : mod === 'suspended' || mod === 'rejected' ? 'bad' : 'warn')} style={{ textTransform: 'capitalize' }}>
                        {mod.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={'adm-pill ' + (s.is_featured ? 'info' : 'muted')}>
                        {s.is_featured ? 'Featured' : 'Standard'}
                      </span>
                    </td>
                    <td>
                      {canManage && (
                        <div className="adm-rowact">
                          <button title={s.is_featured ? 'Unfeature' : 'Feature'} onClick={() => toggleFeature(s)}><Icon name="star" size={15} /></button>
                          <button title="Approve" onClick={() => moderate(s, 'approved')}><Icon name="check" size={15} /></button>
                          <button className="del" title="Suspend" onClick={() => moderate(s, 'suspended')}><Icon name="close" size={15} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pager {...pagerProps} />
        </div>
      </div>
    </>
  );
}

export function AdminMicrostores() {
  return <StoreConsole />;
}

// No /admin/celebrity-stores endpoint exists (confirmed against the API
// spec) — reusing the microstore console here would just show microstores
// mislabeled as celebrity stores, so this stays an honest empty state
// instead until the backend has a real endpoint for it.
export function AdminCelebrityStores() {
  return (
    <>
      <AdmHead title="Celebrity Stores" sub="Curate and feature verified celebrity storefronts." />
      <EmptyState
        icon="star"
        title="Not available yet"
        description="There's no admin endpoint for Celebrity Stores on the backend yet — this will populate once that's added."
      />
    </>
  );
}

