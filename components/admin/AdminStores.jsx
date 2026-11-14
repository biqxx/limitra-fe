'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { Kpi } from '@/components/charts/Charts';
import { adminMicrostoresApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useStore } from '@/components/store/StoreProvider';
import { hasPermission } from '@/lib/auth/permissions';
import { useAdminToast } from './AdminToastContext';
import { AdmHead, Pager, usePager } from './AdminShared';

const asList = (res) => (Array.isArray(res) ? res : res?.items || res?.data || []);

function StoreConsole({ mode = 'microstores' }) {
  const isCelebrity = mode === 'celebrity';
  const { user } = useStore();
  const canManage = isCelebrity
    ? (hasPermission(user, 'celebrity_stores.manage') || hasPermission(user, 'microstores.manage'))
    : hasPermission(user, 'microstores.manage');
  const addToast = useAdminToast();

  const [stores, setStores] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createDraft, setCreateDraft] = useState(null);
  const [saving, setSaving] = useState(false);

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
      if (isCelebrity && !s.is_featured && s.settings?.is_celebrity !== true && s.type !== 'celebrity') {
        // Show featured / celebrity-tagged stores in Celebrity Stores view while still allowing creation
      }
      if (statusFilter === 'featured' && !s.is_featured) return false;
      if (statusFilter !== 'all' && statusFilter !== 'featured' && String(s.moderation_status || s.status || '').toLowerCase() !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return `${s.name || ''} ${s.slug || ''} ${s.user?.username || ''} ${s.user?.email || ''}`.toLowerCase().includes(needle);
    });
  }, [isCelebrity, q, statusFilter, stores]);

  const { shown, pagerProps } = usePager(filtered, q + statusFilter + mode);

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

  const createStore = async () => {
    if (!createDraft?.name?.trim() || !createDraft?.user_id) return;
    setSaving(true);
    try {
      await adminMicrostoresApi.create({
        user_id: Number(createDraft.user_id),
        name: createDraft.name.trim(),
        tagline: createDraft.tagline?.trim() || undefined,
        is_featured: Boolean(createDraft.is_featured ?? isCelebrity),
        settings: isCelebrity ? { is_celebrity: true } : undefined,
      });
      addToast(isCelebrity ? 'Celebrity store created' : 'MicroStore created');
      setCreateDraft(null);
      await load();
    } catch (err) {
      addToast(messageFrom(err));
    } finally {
      setSaving(false);
    }
  };

  const activeCount = stores.filter((s) => s.status === 'active' || s.moderation_status === 'approved').length;
  const pendingCount = stores.filter((s) => s.moderation_status === 'pending' || s.moderation_status === 'pending_review').length;
  const featuredCount = stores.filter((s) => Boolean(s.is_featured)).length;

  return (
    <>
      <AdmHead
        title={isCelebrity ? 'Celebrity Stores' : 'MicroStores'}
        sub={isCelebrity ? 'Curate and feature verified celebrity storefronts.' : 'Moderate creator storefronts, featured placements, and store status.'}
      >
        <button className="adm-btn ghost" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
        {canManage && (
          <button className="adm-btn primary" onClick={() => setCreateDraft({ user_id: '', name: '', tagline: '', is_featured: isCelebrity })}>
            <Icon name="plus" size={15} /> {isCelebrity ? 'Create celebrity store' : 'Create microstore'}
          </button>
        )}
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

      {createDraft && (
        <div className="role-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCreateDraft(null); }}>
          <div className="role-modal">
            <div className="role-modal-h">
              <div><h3 style={{ fontSize: 18 }}>{isCelebrity ? 'Create celebrity store' : 'Create microstore'}</h3></div>
              <button className="role-modal-x" onClick={() => setCreateDraft(null)} aria-label="Close"><Icon name="close" size={18} /></button>
            </div>
            <div className="role-modal-b">
              <label className="adm-field"><span>Owner User ID</span><input type="number" min="1" value={createDraft.user_id} onChange={(e) => setCreateDraft((d) => ({ ...d, user_id: e.target.value }))} placeholder="e.g. 12" /></label>
              <label className="adm-field"><span>Store name</span><input value={createDraft.name} onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Wizkid Official Picks" /></label>
              <label className="adm-field"><span>Tagline</span><input value={createDraft.tagline} onChange={(e) => setCreateDraft((d) => ({ ...d, tagline: e.target.value }))} placeholder="Curated favorites" /></label>
            </div>
            <div className="role-modal-f">
              <button className="adm-btn ghost" onClick={() => setCreateDraft(null)} disabled={saving}>Cancel</button>
              <button className="adm-btn primary" onClick={createStore} disabled={saving || !createDraft.name.trim() || !createDraft.user_id}>{saving ? 'Creating…' : 'Create store'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AdminMicrostores() {
  return <StoreConsole mode="microstores" />;
}

export function AdminCelebrityStores() {
  return <StoreConsole mode="celebrity" />;
}

