'use client';
/* Admin - Affiliates: applications (approve/reject), active affiliate accounts,
   withdrawal payouts, marketing resources, and program rules — five related
   but separate backend resources (adminAffiliatesApi, lib/api/endpoints.js).
   None of these request/response shapes are documented in the spec (every one
   has an empty schema), so every normalizer below reads fields defensively,
   same approach as AdminReturns.jsx/AdminSupport.jsx. This replaces the fully
   mock AdminAffiliates that used to live in AdminPeople.jsx (ADMIN_AFFILIATES
   was already an intentionally-empty placeholder — there was nothing real to
   carry over). */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { naira } from '@/lib/data';
import { adminAffiliatesApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { Kpi } from '@/components/charts/Charts';
import { useAdminToast } from './AdminToastContext';
import { AdmHead, useHighlight } from './AdminShared';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Deliberately not toLocaleDateString — see AdminReturns.jsx's identical note
// on the hydration mismatch this avoids.
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}
const asList = (res) => {
  const list = Array.isArray(res) ? res : (res?.data?.items ?? res?.items ?? res?.data ?? res?.results ?? []);
  return Array.isArray(list) ? list : [];
};
function initialsOf(name) { return String(name || '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'; }

const APP_STATUS_CLS = { pending: 'warn', approved: 'ok', rejected: 'bad' };
const AFF_STATUS_CLS = { active: 'ok', suspended: 'bad', pending: 'warn' };
const WD_STATUS_CLS = { pending: 'warn', processing: 'info', approved: 'ok', rejected: 'bad', paid: 'ok' };

function normalizeApplication(a) {
  return {
    id: a.id,
    name: a.name ?? a.full_name ?? a.user?.name ?? 'Applicant',
    email: a.email ?? a.user?.email ?? '',
    channel: a.channel ?? '',
    handle: a.handle ?? '',
    audience: a.audience_size ?? a.audience ?? '',
    status: String(a.status ?? 'pending').toLowerCase(),
    date: a.created_at ?? a.date,
    raw: a,
  };
}
function normalizeAffiliate(a) {
  return {
    id: a.id,
    name: a.name ?? a.user?.name ?? 'Affiliate',
    email: a.email ?? a.user?.email ?? '',
    channel: a.channel ?? '',
    rate: Number(a.commission_rate ?? a.rate ?? 0),
    sales: Number(a.total_sales ?? a.sales_count ?? a.orders_count ?? 0),
    earnings: Number(a.total_earnings ?? a.lifetime_earnings ?? 0),
    status: String(a.status ?? 'active').toLowerCase(),
    raw: a,
  };
}
function normalizeWithdrawal(w) {
  return {
    id: w.id,
    affiliate: w.affiliate_name ?? w.affiliate?.name ?? w.user?.name ?? 'Affiliate',
    amount: Number(w.amount ?? 0),
    method: w.method ?? w.payout_method ?? '—',
    status: String(w.status ?? 'pending').toLowerCase(),
    date: w.created_at ?? w.date,
    raw: w,
  };
}
function normalizeResource(r) {
  return { id: r.id, title: r.title ?? r.name ?? 'Resource', type: r.type ?? 'file', description: r.description ?? '', url: r.url ?? r.file_url ?? '', raw: r };
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

const SECTIONS = [['applications', 'Applications'], ['affiliates', 'Affiliates'], ['withdrawals', 'Withdrawals'], ['resources', 'Resources'], ['rules', 'Rules']];

export function AdminAffiliates() {
  const toast = useAdminToast();
  const highlight = useSearchParams().get('highlight');
  useHighlight(highlight);
  const [section, setSection] = useState('applications');

  const [applications, setApplications] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [resources, setResources] = useState([]);
  const [rules, setRules] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  const [rejectDraft, setRejectDraft] = useState(null);
  const [editAffDraft, setEditAffDraft] = useState(null);
  const [wdActionDraft, setWdActionDraft] = useState(null);
  const [newResource, setNewResource] = useState(null);
  const [maxCodesDraft, setMaxCodesDraft] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [appsRes, affRes, wdRes, resRes, rulesRes] = await Promise.all([
        adminAffiliatesApi.listApplications({ per_page: 100 }),
        adminAffiliatesApi.list({ per_page: 100 }),
        adminAffiliatesApi.withdrawals({ per_page: 100 }),
        adminAffiliatesApi.resources(),
        adminAffiliatesApi.getRules(),
      ]);
      setApplications(asList(appsRes).map(normalizeApplication));
      setAffiliates(asList(affRes).map(normalizeAffiliate));
      setWithdrawals(asList(wdRes).map(normalizeWithdrawal));
      setResources(asList(resRes).map(normalizeResource));
      const r = rulesRes?.data ?? rulesRes ?? {};
      setRules(r);
      setMaxCodesDraft(String(r.max_promo_codes ?? r.promo_code_limit ?? 1));
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  // Initial network hydration is intentionally triggered when the page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll(); }, [loadAll]);

  const switchSection = (key) => { setSection(key); setQ(''); };

  const approve = async (app) => {
    try { await adminAffiliatesApi.approveApplication(app.id); toast(app.name + ' approved'); await loadAll(); }
    catch (error) { toast(messageFrom(error)); }
  };
  const submitReject = async () => {
    if (!rejectDraft) return;
    setSaving(true);
    try {
      await adminAffiliatesApi.rejectApplication(rejectDraft.app.id, { reason: rejectDraft.reason.trim() || undefined });
      toast(rejectDraft.app.name + ' rejected');
      setRejectDraft(null);
      await loadAll();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  const submitEditAffiliate = async () => {
    if (!editAffDraft) return;
    setSaving(true);
    try {
      await adminAffiliatesApi.update(editAffDraft.aff.id, {
        commission_rate: Number(editAffDraft.rate) || 0,
        status: editAffDraft.status,
      });
      toast('Affiliate updated');
      setEditAffDraft(null);
      await loadAll();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  const startProcessing = async (w) => {
    try { await adminAffiliatesApi.startProcessingWithdrawal(w.id); toast('Withdrawal moved to processing'); await loadAll(); }
    catch (error) { toast(messageFrom(error)); }
  };
  const submitWdAction = async () => {
    if (!wdActionDraft) return;
    setSaving(true);
    try {
      const { kind, wd, note } = wdActionDraft;
      if (kind === 'approve') await adminAffiliatesApi.approveWithdrawal(wd.id, { note: note.trim() || undefined });
      else if (kind === 'reject') await adminAffiliatesApi.rejectWithdrawal(wd.id, { reason: note.trim() || undefined });
      else if (kind === 'paid') await adminAffiliatesApi.markPaidWithdrawal(wd.id, { reference: note.trim() || undefined });
      toast('Withdrawal updated');
      setWdActionDraft(null);
      await loadAll();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  const submitNewResource = async () => {
    if (!newResource?.title.trim()) return;
    setSaving(true);
    try {
      await adminAffiliatesApi.createResource({
        title: newResource.title.trim(),
        type: newResource.type,
        description: newResource.description.trim() || undefined,
        url: newResource.url.trim() || undefined,
      });
      toast('Resource added');
      setNewResource(null);
      await loadAll();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };
  const removeResource = async (r) => {
    try { await adminAffiliatesApi.removeResource(r.id); toast('Resource removed'); setResources(cur => cur.filter(x => x.id !== r.id)); }
    catch (error) { toast(messageFrom(error)); }
  };

  const saveRules = async () => {
    setSaving(true);
    try {
      const key = rules && 'promo_code_limit' in rules ? 'promo_code_limit' : 'max_promo_codes';
      await adminAffiliatesApi.updateRules({ [key]: Math.max(0, Math.min(10, Number(maxCodesDraft) || 0)) });
      toast('Program rules saved');
      await loadAll();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  const pendingApps = applications.filter(a => a.status === 'pending');
  const visibleApps = applications.filter(a => !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.email.toLowerCase().includes(q.toLowerCase()));
  const visibleAff = affiliates.filter(a => !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.email.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <AdmHead title="Affiliates" sub="Applications, active partners, payouts and program rules." />
      <div className="kpi-grid">
        <Kpi ic="user" tint="#F5A623" label="Pending applications" val={pendingApps.length} />
        <Kpi ic="share" tint="#0438B6" label="Active affiliates" val={affiliates.filter(a => a.status === 'active').length} />
        <Kpi ic="dollar" tint="#1F8A5B" label="Affiliate earnings" val={naira(affiliates.reduce((s, a) => s + a.earnings, 0))} />
        <Kpi ic="card" tint="#7A5AE0" label="Pending withdrawals" val={withdrawals.filter(w => ['pending', 'processing'].includes(w.status)).length} />
      </div>

      <div className="adm-filters">
        {SECTIONS.map(([key, label]) => (
          <button key={key} className={'adm-chip' + (section === key ? ' on' : '')} onClick={() => switchSection(key)}>{label}{key === 'applications' && pendingApps.length > 0 ? ` (${pendingApps.length})` : ''}</button>
        ))}
      </div>

      {(section === 'applications' || section === 'affiliates') && (
        <div className="adm-filters">
          <div className="adm-mini-search"><Icon name="search" size={16} className="muted" /><input placeholder="Search name or email…" value={q} onChange={e => setQ(e.target.value)} /></div>
        </div>
      )}

      {section === 'applications' && (
        <div className="panel" style={{ padding: 0 }}>
          {!loaded ? <div className="adm-soon"><p>Loading applications…</p></div> : (
            <div className="adm-table-wrap"><table className="adm-table">
              <thead><tr><th>Applicant</th><th>Channel</th><th>Audience</th><th>Applied</th><th>Status</th><th></th></tr></thead>
              <tbody>{visibleApps.map(a => (
                <tr key={a.id} data-hlkey={a.id}>
                  <td><div className="adm-prod"><span className="adm-li-av">{initialsOf(a.name)}</span><div><b>{a.name}</b><small className="muted">{a.email}</small></div></div></td>
                  <td className="muted">{a.channel}{a.handle ? ' · ' + a.handle : ''}</td>
                  <td className="muted">{a.audience || '—'}</td>
                  <td className="muted">{fmtDate(a.date)}</td>
                  <td><span className={'adm-pill ' + (APP_STATUS_CLS[a.status] || 'muted')}>{a.status}</span></td>
                  <td>{a.status === 'pending' && <div className="adm-rowact">
                    <button title="Approve" onClick={() => approve(a)}><Icon name="check" size={15} /></button>
                    <button className="del" title="Reject" onClick={() => setRejectDraft({ app: a, reason: '' })}><Icon name="close" size={15} /></button>
                  </div>}</td>
                </tr>
              ))}</tbody>
            </table>{visibleApps.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No applications match.</div>}</div>
          )}
        </div>
      )}

      {section === 'affiliates' && (
        <div className="panel" style={{ padding: 0 }}>
          {!loaded ? <div className="adm-soon"><p>Loading affiliates…</p></div> : (
            <div className="adm-table-wrap"><table className="adm-table">
              <thead><tr><th>Affiliate</th><th>Channel</th><th>Sales</th><th>Earnings</th><th>Rate</th><th>Status</th><th></th></tr></thead>
              <tbody>{visibleAff.map(a => (
                <tr key={a.id} data-hlkey={a.id}>
                  <td><div className="adm-prod"><span className="adm-li-av">{initialsOf(a.name)}</span><div><b>{a.name}</b><small className="muted">{a.email}</small></div></div></td>
                  <td className="muted">{a.channel || '—'}</td>
                  <td>{a.sales}</td><td><b>{naira(a.earnings)}</b></td><td>{a.rate}%</td>
                  <td><span className={'adm-pill ' + (AFF_STATUS_CLS[a.status] || 'muted')}>{a.status}</span></td>
                  <td><div className="adm-rowact"><button title="Edit" onClick={() => setEditAffDraft({ aff: a, rate: String(a.rate), status: a.status })}><Icon name="edit" size={15} /></button></div></td>
                </tr>
              ))}</tbody>
            </table>{visibleAff.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No affiliates match.</div>}</div>
          )}
        </div>
      )}

      {section === 'withdrawals' && (
        <div className="panel" style={{ padding: 0 }}>
          {!loaded ? <div className="adm-soon"><p>Loading withdrawals…</p></div> : (
            <div className="adm-table-wrap"><table className="adm-table">
              <thead><tr><th>Affiliate</th><th>Amount</th><th>Method</th><th>Requested</th><th>Status</th><th></th></tr></thead>
              <tbody>{withdrawals.map(w => (
                <tr key={w.id}>
                  <td><b>{w.affiliate}</b></td><td><b>{naira(w.amount)}</b></td><td className="muted">{w.method}</td><td className="muted">{fmtDate(w.date)}</td>
                  <td><span className={'adm-pill ' + (WD_STATUS_CLS[w.status] || 'muted')}>{w.status}</span></td>
                  <td><div className="adm-rowact">
                    {w.status === 'pending' && <button title="Start processing" onClick={() => startProcessing(w)}><Icon name="refresh" size={15} /></button>}
                    {w.status === 'processing' && <>
                      <button title="Approve" onClick={() => setWdActionDraft({ kind: 'approve', wd: w, note: '' })}><Icon name="check" size={15} /></button>
                      <button className="del" title="Reject" onClick={() => setWdActionDraft({ kind: 'reject', wd: w, note: '' })}><Icon name="close" size={15} /></button>
                    </>}
                    {w.status === 'approved' && <button title="Mark paid" onClick={() => setWdActionDraft({ kind: 'paid', wd: w, note: '' })}><Icon name="card" size={15} /></button>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>{withdrawals.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No withdrawal requests yet.</div>}</div>
          )}
        </div>
      )}

      {section === 'resources' && (
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>Marketing resources <span className="muted" style={{ fontWeight: 400 }}>· {resources.length}</span></h3><button className="adm-btn primary sm" onClick={() => setNewResource({ title: '', type: 'banner', description: '', url: '' })}><Icon name="plus" size={15} /> Add resource</button></div>
          {!loaded ? <div className="adm-soon"><p>Loading resources…</p></div> : (
            <div className="adm-table-wrap"><table className="adm-table">
              <thead><tr><th>Title</th><th>Type</th><th>Description</th><th></th></tr></thead>
              <tbody>{resources.map(r => (
                <tr key={r.id}><td><b>{r.title}</b></td><td className="muted">{r.type}</td><td className="muted">{r.description || '—'}</td>
                  <td><div className="adm-rowact"><button className="del" title="Remove" onClick={() => removeResource(r)}><Icon name="trash" size={15} /></button></div></td></tr>
              ))}</tbody>
            </table>{resources.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No marketing resources yet — affiliates see an empty Marketing Center until one is added.</div>}</div>
          )}
        </div>
      )}

      {section === 'rules' && (
        <div className="panel">
          <h3 style={{ marginBottom: 4 }}>Promo codes</h3>
          <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>How many discount codes each affiliate may create from their dashboard.</p>
          {!loaded ? <div className="adm-soon"><p>Loading rules…</p></div> : (
            <div className="adm-li"><div className="adm-li-main"><b>Codes allowed per affiliate</b><small>0 disables code creation</small></div>
              <input type="number" min="0" max="10" value={maxCodesDraft} onChange={e => setMaxCodesDraft(e.target.value)} style={{ width: 80, textAlign: 'center', padding: 7, border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }} />
            </div>
          )}
          <button className="adm-btn primary" style={{ marginTop: 16 }} onClick={saveRules} disabled={saving || !loaded}>{saving ? 'Saving…' : 'Save rules'}</button>
        </div>
      )}

      {rejectDraft && (
        <Drawer title={`Reject application · ${rejectDraft.app.name}`} saving={saving} canSave onClose={() => setRejectDraft(null)} onSave={submitReject} saveLabel="Reject">
          <label className="adm-field"><span>Reason (optional)</span><textarea rows="3" autoFocus value={rejectDraft.reason} onChange={e => setRejectDraft(c => ({ ...c, reason: e.target.value }))} placeholder="Shown to the applicant, if the backend sends it on" /></label>
        </Drawer>
      )}

      {editAffDraft && (
        <Drawer title={`Edit affiliate · ${editAffDraft.aff.name}`} saving={saving} canSave onClose={() => setEditAffDraft(null)} onSave={submitEditAffiliate} saveLabel="Save changes">
          <label className="adm-field"><span>Commission rate (%)</span><input type="number" min="0" max="100" autoFocus value={editAffDraft.rate} onChange={e => setEditAffDraft(c => ({ ...c, rate: e.target.value }))} /></label>
          <label className="adm-field"><span>Status</span>
            <select value={editAffDraft.status} onChange={e => setEditAffDraft(c => ({ ...c, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
        </Drawer>
      )}

      {wdActionDraft && (
        <Drawer
          title={(wdActionDraft.kind === 'approve' ? 'Approve' : wdActionDraft.kind === 'reject' ? 'Reject' : 'Mark paid') + ' · ' + naira(wdActionDraft.wd.amount)}
          sub={wdActionDraft.wd.affiliate}
          saving={saving} canSave onClose={() => setWdActionDraft(null)} onSave={submitWdAction}
          saveLabel={wdActionDraft.kind === 'approve' ? 'Approve' : wdActionDraft.kind === 'reject' ? 'Reject' : 'Mark paid'}
        >
          <label className="adm-field"><span>{wdActionDraft.kind === 'paid' ? 'Payment reference (optional)' : 'Note (optional)'}</span>
            <textarea rows="3" autoFocus value={wdActionDraft.note} onChange={e => setWdActionDraft(c => ({ ...c, note: e.target.value }))} />
          </label>
        </Drawer>
      )}

      {newResource && (
        <Drawer title="Add marketing resource" saving={saving} canSave={!!newResource.title.trim()} onClose={() => setNewResource(null)} onSave={submitNewResource} saveLabel="Add resource">
          <label className="adm-field"><span>Title</span><input autoFocus value={newResource.title} onChange={e => setNewResource(c => ({ ...c, title: e.target.value }))} placeholder="e.g. Promotional banners" /></label>
          <label className="adm-field"><span>Type</span>
            <select value={newResource.type} onChange={e => setNewResource(c => ({ ...c, type: e.target.value }))}>
              <option value="banner">Banner</option>
              <option value="image">Product image pack</option>
              <option value="video">Video</option>
              <option value="template">Social template</option>
              <option value="email">Email template</option>
              <option value="logo">Brand & logo kit</option>
            </select>
          </label>
          <label className="adm-field"><span>Link (optional)</span><input value={newResource.url} onChange={e => setNewResource(c => ({ ...c, url: e.target.value }))} placeholder="https://…" /></label>
          <label className="adm-field"><span>Description (optional)</span><textarea rows="2" value={newResource.description} onChange={e => setNewResource(c => ({ ...c, description: e.target.value }))} /></label>
        </Drawer>
      )}
    </>
  );
}
