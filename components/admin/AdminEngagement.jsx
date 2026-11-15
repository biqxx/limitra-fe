'use client';
/* Engagement nav group (Spin & Win, Videos) — wired to /admin/reward-campaigns and /admin/videos. */
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { Thumb, REAL_IMG } from '@/components/ui/Shared';
import { useStore } from '@/components/store/StoreProvider';
import { naira, PRODUCTS } from '@/lib/data';
import { Kpi } from '@/components/charts/Charts';
import { adminRewardCampaignsApi, adminVideosApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { VIDEOS, VID_POSTER, fmtViews } from '@/components/video/Video';
import { useAdminToast } from './AdminToastContext';
import { AdmHead, Pager, usePager, Toggle, AdmSelect } from './AdminShared';

/* ---------- SPIN & WIN ---------- */
export function AdminSpin() {
  const addToast = useAdminToast();
  const PALETTE = ['#0438B6', '#2F4BDB', '#F67208', '#7A5AE0', '#1F8A5B', '#0E9BD6', '#D6247C', '#F5A623', '#E5484D', '#0EA5A5'];
  const [campaignId, setCampaignId] = useState(null);
  const [campaignActive, setCampaignActive] = useState(true);
  const [expiryDays, setExpiryDays] = useState(7);
  const [prizes, setPrizes] = useState([
    { name: '5% OFF', weight: 35, color: '#0438B6' },
    { name: '10% OFF', weight: 25, color: '#2F4BDB' },
    { name: '₦5,000', weight: 15, color: '#F67208' },
    { name: '20% OFF', weight: 8, color: '#7A5AE0' },
    { name: '₦1,000', weight: 10, color: '#1F8A5B' },
    { name: '₦2,500', weight: 5, color: '#0E9BD6' },
    { name: 'Free Shipping', weight: 0, color: '#D6247C' },
    { name: 'Mystery Gift', weight: 2, color: '#F5A623' },
  ]);
  const [stats, setStats] = useState({ spins: 0, coupons: 0, redeemed: 0, revenue: 0 });
  const [saving, setSaving] = useState(false);
  const [swatch, setSwatch] = useState(-1);
  const upd = (i, k, v) => setPrizes(ps => ps.map((p, j) => j === i ? { ...p, [k]: v } : p));
  const total = prizes.reduce((s, p) => s + (Number(p.weight) || 0), 0);
  const t = (m) => addToast(m);

  useEffect(() => {
    let cancelled = false;
    adminRewardCampaignsApi.list({ per_page: 20 })
      .then((res) => {
        if (cancelled) return;
        const list = res?.items ?? res?.data?.items ?? res?.data ?? [];
        const active = Array.isArray(list) ? (list.find((c) => c.is_active) || list[0]) : null;
        if (!active) return;
        setCampaignId(active.id);
        setCampaignActive(active.is_active !== false);
        if (active.expiry_days != null) setExpiryDays(Number(active.expiry_days));
        if (Array.isArray(active.prizes) && active.prizes.length > 0) {
          setPrizes(active.prizes.map((p, idx) => ({
            name: p.name || p.label || `Reward ${idx + 1}`,
            weight: Number(p.weight ?? p.probability ?? 0),
            color: p.color || PALETTE[idx % PALETTE.length],
          })));
        }
        setStats({
          spins: Number(active.spins_count ?? active.total_spins ?? 0),
          coupons: Number(active.coupons_generated ?? active.wins_count ?? 0),
          redeemed: Number(active.coupons_redeemed ?? 0),
          revenue: Number(active.revenue_attributed ?? 0),
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveRewards = async () => {
    setSaving(true);
    try {
      const payload = {
        name: 'Spin & Win',
        is_active: campaignActive,
        expiry_days: Number(expiryDays) || 7,
        prizes: prizes.map((p) => ({ name: p.name, weight: Number(p.weight) || 0, color: p.color })),
      };
      if (campaignId) {
        await adminRewardCampaignsApi.update(campaignId, payload);
      } else {
        const created = await adminRewardCampaignsApi.create(payload);
        setCampaignId(created?.id ?? created?.data?.id ?? null);
      }
      t('Reward configuration saved');
    } catch (err) {
      t(messageFrom(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdmHead title="Spin & Win" sub="Signup roulette rewards & probabilities">
        <button className="adm-btn ghost" onClick={() => setPrizes(ps => [...ps, { name: 'New reward', weight: 0, color: PALETTE[ps.length % PALETTE.length] }])}><Icon name="plus" size={15} /> Add reward</button>
      </AdmHead>
      <div className="kpi-grid">
        <Kpi ic="gift" tint="#F67208" label="Total spins" val={String(stats.spins)} delta="" up />
        <Kpi ic="tag" tint="#0438B6" label="Coupons generated" val={String(stats.coupons)} delta="" up />
        <Kpi ic="check" tint="#1F8A5B" label="Coupons redeemed" val={String(stats.redeemed)} delta="" up />
        <Kpi ic="dollar" tint="#7A5AE0" label="Revenue attributed" val={naira(stats.revenue)} delta="" up />
      </div>
      <div className="adm-row c2">
        <div className="panel"><div className="panel-h"><h3>Reward probabilities</h3><span className={'muted' + (total !== 100 ? ' warn-text' : '')} style={{ fontSize: 12.5, fontWeight: 700, color: total !== 100 ? 'var(--gold)' : 'var(--success)' }}>{total}% total</span></div>
          <div className="cfg-grid">{prizes.map((p, i) => (
            <div className="cfg-row" key={i}>
              <div className="cfg-sw-wrap">
                <button className="cfg-sw" style={{ background: p.color }} onClick={() => setSwatch(swatch === i ? -1 : i)} aria-label="Change colour" />
                {swatch === i && (
                  <>
                    <div className="cfg-sw-scrim" onClick={() => setSwatch(-1)} />
                    <div className="cfg-sw-pop">{PALETTE.map(c => <button key={c} className={'cfg-sw-opt' + (p.color === c ? ' on' : '')} style={{ background: c }} onClick={() => { upd(i, 'color', c); setSwatch(-1); }} />)}</div>
                  </>
                )}
              </div>
              <input className="cfg-name" value={p.name} onChange={e => upd(i, 'name', e.target.value)} placeholder="Reward name" />
              <input className="cfg-val" type="number" value={p.weight} onChange={e => upd(i, 'weight', e.target.value)} />
              <span className="pct-tag">%</span>
              <button className="cfg-del" onClick={() => setPrizes(ps => ps.filter((_, j) => j !== i))} aria-label="Remove reward"><Icon name="trash" size={14} /></button>
            </div>
          ))}</div>
          <button className="adm-btn primary" style={{ marginTop: 14 }} disabled={saving} onClick={saveRewards}>{saving ? 'Saving…' : 'Save rewards'}</button>
        </div>
        <div className="panel"><div className="panel-h"><h3>Settings &amp; Preview</h3></div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{ position: 'relative', width: 148, height: 148 }}>
              <div
                style={{
                  width: 148,
                  height: 148,
                  borderRadius: '50%',
                  border: '4px solid var(--surface)',
                  boxShadow: 'var(--shadow-sm)',
                  background: total > 0
                    ? `conic-gradient(${prizes.reduce((acc, p) => {
                        const w = Math.max(0, Number(p.weight) || 0);
                        const start = (acc.sum / total) * 360;
                        const end = ((acc.sum + w) / total) * 360;
                        return { sum: acc.sum + w, parts: [...acc.parts, `${p.color || '#0438B6'} ${start}deg ${end}deg`] };
                      }, { sum: 0, parts: [] }).parts.join(', ')})`
                    : 'var(--surface-2)',
                }}
              />
              <div style={{ position: 'absolute', inset: 46, borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--border)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>
                {prizes.length} slices
              </div>
            </div>
          </div>
          <div className="adm-list">
            <div className="adm-li"><div className="adm-li-main"><b>Wheel enabled</b><small>Show on signup</small></div><Toggle checked={campaignActive} onChange={setCampaignActive} /></div>
            <div className="adm-li"><div className="adm-li-main"><b>Coupon expiry</b><small>Days valid after win</small></div><input type="number" style={{ width: 70, textAlign: 'center', padding: 7, border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }} value={expiryDays} onChange={e => setExpiryDays(Number(e.target.value) || 7)} /></div>
            <div className="adm-li"><div className="adm-li-main"><b>One spin per account</b><small>Anti-abuse lock</small></div><Toggle defaultOn locked /></div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- VIDEOS ---------- */
export function AdminVideos() {
  const addToast = useAdminToast();
  useStore();
  const [videos, setVideos] = useState(VIDEOS || []);
  const [edit, setEdit] = useState(null);
  const [assign, setAssign] = useState(null);
  const t = (m) => addToast(m);

  const loadVideos = useCallback(async () => {
    try {
      const res = await adminVideosApi.list({ per_page: 100 });
      const list = res?.items ?? res?.data?.items ?? res?.data ?? [];
      if (Array.isArray(list) && list.length > 0) {
        setVideos(list.map((v) => ({
          id: v.id,
          title: v.title || 'Untitled video',
          cat: v.category || v.cat || 'Demos',
          dur: v.duration || v.dur || '0:30',
          views: Number(v.views_count ?? v.views ?? 0),
          products: Array.isArray(v.product_ids) ? v.product_ids : Array.isArray(v.products) ? v.products.map((p) => p.id ?? p) : [],
          poster: v.thumbnail_url || v.poster_url || VID_POSTER[v.id],
          url: v.video_url || v.url || '',
        })));
      }
    } catch {
      // Keep fallback local list if API returns empty/error
    }
  }, []);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  const { shown: vShown, pagerProps: vPager } = usePager(videos, String(videos.length));
  const totalViews = videos.reduce((s, v) => s + Number(v.views || 0), 0);

  const saveVideo = async (draft) => {
    try {
      const payload = { title: draft.title, category: draft.cat, url: draft.url || undefined, is_published: true };
      if (draft._new) await adminVideosApi.create(payload);
      else await adminVideosApi.update(draft.id, payload);
      t(draft._new ? 'Video uploaded' : 'Video updated');
      setEdit(null);
      await loadVideos();
    } catch (err) {
      t(messageFrom(err));
    }
  };

  const saveTags = async (ids) => {
    try {
      await adminVideosApi.update(assign.id, { product_ids: ids });
      t(ids.length + ' product(s) tagged to ' + assign.title);
      setAssign(null);
      await loadVideos();
    } catch (err) {
      t(messageFrom(err));
    }
  };

  return (
    <>
      <AdmHead title="Videos" sub={`${videos.length} videos · demos, reviews, reels`}><button className="adm-btn primary" onClick={() => setEdit({ _new: true, title: '', cat: 'Demos', dur: '0:30', url: '' })}><Icon name="plus" size={15} /> Upload video</button></AdmHead>
      <div className="kpi-grid">
        <Kpi ic="eye" tint="#0438B6" label="Total views" val={fmtViews(totalViews)} delta="" up />
        <Kpi ic="clock" tint="#1F8A5B" label="Avg watch time" val="0s" delta="" up />
        <Kpi ic="bag" tint="#F67208" label="Product clicks" val="0" delta="" up />
        <Kpi ic="dollar" tint="#7A5AE0" label="Sales from video" val={naira(0)} delta="" up />
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Video</th><th>Category</th><th>Views</th><th>Shoppable</th><th>Status</th><th></th></tr></thead>
          <tbody>{vShown.map(v => (
            <tr key={v.id}>
              <td><div className="adm-prod"><span className="adm-prod-thumb"><img src={v.poster || VID_POSTER[v.id]} alt="" /></span><div><b>{v.title}</b><small>{v.dur}</small></div></div></td>
              <td>{v.cat}</td><td>{fmtViews(v.views)}</td>
              <td>{v.products?.length ? <span className="adm-pill ok">{v.products.length} tagged</span> : <span className="adm-pill muted">None</span>}</td>
              <td><span className="adm-pill ok">Live</span></td>
              <td><div className="adm-rowact"><button title="Edit" onClick={() => setEdit({ ...v })}><Icon name="edit" size={15} /></button><button title="Assign products" onClick={() => setAssign({ ...v, products: [...(v.products || [])] })}><Icon name="bag" size={15} /></button></div></td>
            </tr>
          ))}</tbody>
        </table><Pager {...vPager} /></div>
      </div>
      {edit && <VideoEditDrawer draft={edit} onClose={() => setEdit(null)} onSave={saveVideo} />}
      {assign && <VideoAssignModal draft={assign} onClose={() => setAssign(null)} onSave={saveTags} />}
    </>
  );
}

/* module-scope, mirrors the legacy `window.ADMIN_VIDEO_CATS` mutable global */
let ADMIN_VIDEO_CATS = ['Demos', 'Unboxing', 'Reviews', 'How-to', 'Lookbook', 'Brand', 'Promo'];

function VideoEditDrawer({ draft, onClose, onSave }) {
  const addToast = useAdminToast();
  const [f, setF] = useState(draft);
  const [, vforce] = useState(0);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const addVCat = (name) => {
    if (!ADMIN_VIDEO_CATS.includes(name)) ADMIN_VIDEO_CATS.push(name);
    set('cat', name); vforce(n => n + 1);
    addToast('Category “' + name + '” added');
  };
  return (
    <div className="role-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="role-modal">
        <div className="role-modal-h">
          <div className="row" style={{ gap: 12 }}>
            <span className="kpi-ic" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="video" size={18} /></span>
            <div><h3 style={{ fontSize: 18 }}>{f._new ? 'Upload video' : 'Edit video'}</h3><small className="muted">Video details & assignment</small></div>
          </div>
          <button className="role-modal-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>
        <div className="role-modal-b">
          <label className="adm-img-drop" style={{ height: 160 }}>
            {f.id && !f._file ? <img src={VID_POSTER[f.id]} alt="" className="adm-img-preview" /> : f._file ? <span className="adm-img-empty"><Icon name="check" size={26} stroke={3} /><b>{f._file}</b><small>Ready to upload</small></span> : <span className="adm-img-empty"><Icon name="video" size={26} /><b>Upload video file</b><small>MP4, MOV or WEBM · up to 500MB</small></span>}
            <input type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => { const fl = e.target.files && e.target.files[0]; if (fl) { set('_file', fl.name); addToast('Video attached'); } }} />
          </label>
          <label className="adm-field"><span>Title</span><input value={f.title} onChange={e => set('title', e.target.value)} placeholder="Video title" /></label>
          <div className="adm-field-row">
            <label className="adm-field"><span>Category</span>
              <AdmSelect value={f.cat} options={ADMIN_VIDEO_CATS} onChange={v => set('cat', v)} creatable onCreate={addVCat} />
            </label>
            <label className="adm-field"><span>Duration</span><input value={f.dur || ''} readOnly placeholder="Auto-detected" title="Duration is detected automatically from the uploaded file" style={{ opacity: .7, cursor: 'not-allowed' }} /></label>
          </div>
          <div className="adm-li" style={{ padding: '4px 0' }}><div className="adm-li-main"><b>Published</b><small>Visible on storefront</small></div><Toggle defaultOn /></div>
        </div>
        <div className="role-modal-f"><button className="adm-btn ghost" onClick={onClose}>Cancel</button><button className="adm-btn primary" onClick={() => onSave(f)}>{f._new ? 'Upload' : 'Save changes'}</button></div>
      </div>
    </div>
  );
}

function VideoAssignModal({ draft, onClose, onSave }) {
  const [sel, setSel] = useState(draft.products || []);
  const [q, setQ] = useState('');
  const list = PRODUCTS.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  const toggle = (id) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <div className="adm-modal" role="dialog" aria-label="Assign products">
        <div className="adm-drawer-h"><h3>Tag products · {draft.title}</h3><button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button></div>
        <div className="adm-drawer-body" style={{ paddingTop: 14 }}>
          <div className="adm-mini-search" style={{ marginBottom: 12 }}><Icon name="search" size={16} className="muted" /><input placeholder="Search products to tag…" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div className="adm-assign-list">
            {list.map(p => (
              <button key={p.id} className={'adm-assign-row' + (sel.includes(p.id) ? ' on' : '')} onClick={() => toggle(p.id)}>
                <span className="adm-prod-thumb"><Thumb product={p} src={REAL_IMG[p.id]} /></span>
                <div className="adm-assign-info"><b>{p.name.split(',')[0]}</b><small>{naira(p.price)}</small></div>
                <span className="adm-assign-check">{sel.includes(p.id) && <Icon name="check" size={14} stroke={3} />}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="adm-drawer-f"><span className="muted" style={{ flex: 1, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600 }}>{sel.length} selected</span><button className="adm-btn ghost" onClick={onClose}>Cancel</button><button className="adm-btn primary" onClick={() => onSave(sel)}>Save tags</button></div>
      </div>
    </>
  );
}

// AdminElo moved to its own file (components/admin/AdminElo.jsx) — it needs
// real API wiring (conversations/knowledge base/settings) substantial enough
// to no longer fit this shared-mock-sections file.
