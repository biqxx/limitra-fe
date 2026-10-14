'use client';
/* People nav group (Customers, Affiliates, Referrals) — ported verbatim from
   legacy/admin-sections.jsx. `window.admToast` calls replaced with `useAdminToast()`;
   AdminAffiliates has `data-hlkey` rows so it reads the highlight query param too. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { naira } from '@/lib/data';
import { businessSettingsApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { Kpi, BarChart } from '@/components/charts/Charts';
import { useAdminToast } from './AdminToastContext';
import { AdmHead, Pager, usePager, AdmSelect, useHighlight } from './AdminShared';

/* ---------- CUSTOMERS ---------- */
// No customers backend yet — stays genuinely empty rather than fake accounts.
const ADMIN_CUSTOMERS = [];
function CustomerDrawer({ cust, status: extStatus, onStatusChange, onClose }) {
  const addToast = useAdminToast();
  const [status, setStatus] = useState(extStatus || cust[4]);
  const [resetSent, setResetSent] = useState(false);
  const suspended = status === 'Suspended';
  // No per-customer order/rewards backend yet — stays empty rather than fake history.
  const orders = [];
  const resetPwd = () => { setResetSent(true); addToast('Password reset link sent to ' + cust[1]); };
  const toggleSuspend = () => {
    const next = suspended ? 'Active' : 'Suspended';
    setStatus(next);
    onStatusChange && onStatusChange(next);
    addToast(cust[0] + (next === 'Suspended' ? ' suspended' : ' restored'));
  };
  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-label="Customer detail">
        <div className="adm-drawer-h">
          <h3>Customer profile</h3>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">
          <div className="adm-cust-head">
            <span className="adm-li-av lg">{cust[0].split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
            <div>
              <b style={{ fontSize: 18 }}>{cust[0]}</b>
              <div className="muted" style={{ fontSize: 13 }}>{cust[1]}</div>
              <span className={'adm-pill ' + (suspended ? 'bad' : 'ok')} style={{ marginTop: 6, display: 'inline-block' }}>{status}</span>
            </div>
          </div>

          <div className="adm-cust-stats">
            <div><span className="muted">Orders</span><b>{cust[2]}</b></div>
            <div><span className="muted">Lifetime value</span><b>{naira(cust[3])}</b></div>
            <div><span className="muted">Lim Cash</span><b>{naira(0)}</b></div>
          </div>

          <h4 className="adm-sec-label">Purchase history</h4>
          <div className="adm-cust-orders">
            {orders.length === 0
              ? <small className="muted">No orders yet.</small>
              : orders.map((o, i) => (
              <div className="adm-cust-order" key={i}>
                <div><b>{o[0]}</b><small className="muted">{o[3]}</small></div>
                <span className={'adm-pill ' + (o[1] === 'Delivered' ? 'ok' : o[1] === 'Cancelled' ? 'bad' : 'warn')}>{o[1]}</span>
                <b>{naira(o[2])}</b>
              </div>
            ))}
          </div>

          <h4 className="adm-sec-label">Rewards & referrals</h4>
          <div className="adm-cust-rewards">
            <small className="muted">No rewards or referrals yet.</small>
          </div>

          <h4 className="adm-sec-label">Reset password</h4>
          <div className="adm-cust-reset">
            <div><b>Send password reset link</b><small className="muted">{resetSent ? 'A reset link has been emailed to ' + cust[1] : 'Emails a secure reset link to the customer.'}</small></div>
            <button className="adm-btn ghost" onClick={resetPwd} disabled={resetSent}><Icon name={resetSent ? 'check' : 'mail'} size={15} /> {resetSent ? 'Sent' : 'Send link'}</button>
          </div>

          <div className="adm-drawer-foot">
            <button className="adm-btn ghost" onClick={resetPwd}><Icon name={resetSent ? 'check' : 'lock'} size={15} /> {resetSent ? 'Reset link sent' : 'Reset password'}</button>
            {suspended
              ? <button className="adm-btn primary" onClick={toggleSuspend}><Icon name="refresh" size={15} /> Restore account</button>
              : <button className="adm-btn danger" onClick={toggleSuspend}><Icon name="close" size={15} /> Suspend account</button>}
          </div>
        </div>
      </aside>
    </>
  );
}

export function AdminCustomers() {
  const addToast = useAdminToast();
  const [q, setQ] = useState('');
  const [view, setView] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const stOf = (c) => statusMap[c[1]] || c[4];
  const toggleSuspend = (c) => {
    const cur = stOf(c);
    const next = cur === 'Suspended' ? 'Active' : 'Suspended';
    setStatusMap(m => ({ ...m, [c[1]]: next }));
    addToast(c[0] + (next === 'Suspended' ? ' suspended' : ' restored'));
  };
  const list = ADMIN_CUSTOMERS.filter(c => !q || c[0].toLowerCase().includes(q.toLowerCase()) || c[1].includes(q.toLowerCase()));
  const { shown: cShown, page: cPage, pages: cPages, setPage: cSet } = usePager(list, q);
  return (
    <>
      <AdmHead title="Customers" sub={`${ADMIN_CUSTOMERS.length} registered customers`}><button className="adm-btn ghost"><Icon name="download" size={15} /> Export</button></AdmHead>
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <Kpi ic="user" tint="#0438B6" label="Total customers" val={ADMIN_CUSTOMERS.length} delta="" up />
        <Kpi ic="spark" tint="#1F8A5B" label="New this month" val="0" delta="" up />
        <Kpi ic="refresh" tint="#7A5AE0" label="Retention" val="0%" delta="" up />
      </div>
      <div className="adm-filters"><div className="adm-mini-search"><Icon name="search" size={16} className="muted" /><input placeholder="Search customers…" value={q} onChange={e => setQ(e.target.value)} /></div></div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Customer</th><th>Orders</th><th>Lifetime value</th><th>Status</th><th></th></tr></thead>
          <tbody>{cShown.map((c, i) => { const st = stOf(c); const susp = st === 'Suspended'; return (
            <tr key={i} className={susp ? 'adm-row-susp' : ''}>
              <td><div className="adm-prod"><span className="adm-li-av">{c[0].split(' ').map(w => w[0]).join('').slice(0, 2)}</span><div><b>{c[0]}</b><small>{c[1]}</small></div></div></td>
              <td>{c[2]}</td><td><b>{naira(c[3])}</b></td>
              <td><span className={'adm-pill ' + (susp ? 'bad' : 'ok')}>{st}</span></td>
              <td><div className="adm-rowact"><button title="View" onClick={() => setView(c)}><Icon name="eye" size={15} /></button><button title="Reset password" onClick={() => addToast('Password reset link sent')}><Icon name="lock" size={15} /></button>{susp
                ? <button className="restore" title="Restore" onClick={() => toggleSuspend(c)}><Icon name="refresh" size={15} /></button>
                : <button className="del" title="Suspend" onClick={() => toggleSuspend(c)}><Icon name="close" size={15} /></button>}</div></td>
            </tr>
          ); })}</tbody>
        </table>{list.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No customers yet.</div>}<Pager page={cPage} pages={cPages} onPage={cSet} /></div>
      </div>
      {view && <CustomerDrawer cust={view} status={stOf(view)} onStatusChange={(s) => setStatusMap(m => ({ ...m, [view[1]]: s }))} onClose={() => setView(null)} />}
    </>
  );
}

/* ---------- AFFILIATES ---------- */
// No affiliates backend yet — stays genuinely empty rather than fake partners.
const ADMIN_AFFILIATES = [];
function AffiliateDrawer({ aff, status, paid, onStatusChange, onPay, onClose }) {
  const addToast = useAdminToast();
  // No payout history backend yet — stays empty rather than fake records.
  const payouts = [];
  const act = (next, msg) => { onStatusChange && onStatusChange(next); addToast(msg); };
  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-label="Affiliate detail">
        <div className="adm-drawer-h"><h3>Affiliate profile</h3><button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button></div>
        <div className="adm-drawer-body">
          <div className="adm-cust-head">
            <span className="adm-li-av lg">{aff[0].split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
            <div>
              <b style={{ fontSize: 18 }}>{aff[0]}</b>
              <div className="muted" style={{ fontSize: 13 }}>{aff[1]}</div>
              <span className={'adm-pill ' + (status === 'Approved' ? 'ok' : status === 'Pending' ? 'warn' : 'bad')} style={{ marginTop: 6, display: 'inline-block' }}>{status}</span>
              {paid && <span className="adm-pill paid" style={{ marginTop: 6, marginLeft: 6, display: 'inline-block' }}><Icon name="check" size={11} stroke={3} /> Paid</span>}
            </div>
          </div>
          <div className="adm-cust-stats">
            <div><span className="muted">Sales</span><b>{aff[2]}</b></div>
            <div><span className="muted">Total earned</span><b>{naira(aff[3])}</b></div>
            <div><span className="muted">Commission</span><b>10%</b></div>
          </div>
          <h4 className="adm-sec-label">Payout history</h4>
          <div className="adm-cust-orders">
            {payouts.length === 0
              ? <small className="muted">No payouts yet.</small>
              : payouts.map((p, i) => (
              <div className="adm-cust-order" key={i}>
                <div><b>{naira(p[1])}</b><small className="muted">{p[0]}</small></div>
                <span className="adm-pill ok">{p[2]}</span>
                <button className="adm-btn ghost sm" onClick={() => addToast('Statement downloaded')}><Icon name="download" size={14} /></button>
              </div>
            ))}
          </div>
          <div className="adm-drawer-foot">
            {status === 'Pending' && <>
              <button className="adm-btn danger" onClick={() => { act('Suspended', aff[0] + ' rejected'); onClose(); }}><Icon name="close" size={15} /> Reject</button>
              <button className="adm-btn primary" onClick={() => act('Approved', aff[0] + ' approved')}><Icon name="check" size={15} /> Approve</button>
            </>}
            {status === 'Approved' && <>
              <button className="adm-btn danger" onClick={() => act('Suspended', aff[0] + ' suspended')}><Icon name="close" size={15} /> Suspend</button>
              {paid
                ? <button className="adm-btn ghost" disabled><Icon name="check" size={15} /> Paid out</button>
                : <button className="adm-btn primary" onClick={() => { onPay && onPay(); addToast('Payout of ' + naira(aff[3]) + ' sent to ' + aff[0]); }}><Icon name="dollar" size={15} /> Process payout</button>}
            </>}
            {status === 'Suspended' && <button className="adm-btn primary" onClick={() => act('Approved', aff[0] + ' reinstated')}><Icon name="refresh" size={15} /> Reinstate</button>}
          </div>
        </div>
      </aside>
    </>
  );
}

function InviteAffiliateDrawer({ onClose }) {
  const addToast = useAdminToast();
  const [f, setF] = useState({ name: '', email: '', channel: '', rate: '10' });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const send = () => {
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) { addToast('Enter a name and valid email'); return; }
    addToast('Invite sent to ' + f.email);
    onClose();
  };
  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <div className="adm-modal" role="dialog" aria-label="Invite affiliate">
        <div className="adm-drawer-h"><h3>Invite affiliate</h3><button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button></div>
        <div className="adm-drawer-body">
          <label className="adm-field"><span>Full name</span><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Chidinma Okeke" /></label>
          <label className="adm-field"><span>Email</span><input value={f.email} onChange={e => set('email', e.target.value)} placeholder="affiliate@email.com" /></label>
          <label className="adm-field"><span>Primary channel</span><input value={f.channel} onChange={e => set('channel', e.target.value)} placeholder="e.g. Instagram · 84k" /></label>
          <label className="adm-field"><span>Commission rate (%)</span><input type="number" value={f.rate} onChange={e => set('rate', e.target.value)} /></label>
          <div className="adm-drawer-foot">
            <button className="adm-btn ghost" onClick={onClose}>Cancel</button>
            <button className="adm-btn primary" onClick={send}><Icon name="mail" size={15} /> Send invite</button>
          </div>
        </div>
      </div>
    </>
  );
}

export function AdminAffiliates() {
  const addToast = useAdminToast();
  const highlight = useSearchParams().get('highlight');
  useHighlight(highlight);
  const [view, setView] = useState(null);
  const [invite, setInvite] = useState(false);
  const [statusMap, setStatusMap] = useState({});
  const [paidMap, setPaidMap] = useState({});
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('All');
  const stOf = (a) => statusMap[a[0]] || a[4];
  const setSt = (a, s) => setStatusMap(m => ({ ...m, [a[0]]: s }));
  const markPaid = (a) => setPaidMap(m => ({ ...m, [a[0]]: true }));
  const tabs = ['All', 'Approved', 'Pending', 'Suspended'];
  const list = ADMIN_AFFILIATES.filter(a => (tab === 'All' || stOf(a) === tab) && (!q || a[0].toLowerCase().includes(q.toLowerCase()) || a[1].toLowerCase().includes(q.toLowerCase())));
  const [pg, setPg] = useState(1);
  const perPage = 10;
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  const cur = Math.min(pg, pages);
  const shown = list.slice((cur - 1) * perPage, cur * perPage);
  useEffect(() => { setPg(1); }, [q, tab]);
  return (
    <>
      <AdmHead title="Affiliates" sub="Manage partners, commissions and payouts"><button className="adm-btn primary" onClick={() => setInvite(true)}><Icon name="plus" size={15} /> Invite affiliate</button></AdmHead>
      <div className="kpi-grid">
        <Kpi ic="share" tint="#0438B6" label="Active affiliates" val={ADMIN_AFFILIATES.length} delta="" up />
        <Kpi ic="dollar" tint="#1F8A5B" label="Affiliate revenue" val={naira(0)} delta="" up />
        <Kpi ic="eye" tint="#F67208" label="Avg conversion" val="0%" delta="" up />
        <Kpi ic="truck" tint="#7A5AE0" label="Pending payouts" val={naira(0)} delta="" up />
      </div>
      <div className="adm-filters">
        <div className="adm-mini-search"><Icon name="search" size={16} className="muted" /><input placeholder="Search affiliates or channel…" value={q} onChange={e => setQ(e.target.value)} /></div>
        {tabs.map(t => <button key={t} className={'adm-chip' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>All affiliates <span className="muted" style={{ fontWeight: 400 }}>· {list.length}</span></h3></div>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Affiliate</th><th>Channel</th><th>Sales</th><th>Earnings</th><th>Status</th><th></th></tr></thead>
          <tbody>{shown.map((a, i) => { const st = stOf(a); return (
            <tr key={i} data-hlkey={a[0]}>
              <td><div className="adm-prod"><span className="adm-li-av">{a[0].split(' ').map(w => w[0]).join('').slice(0, 2)}</span><div><b>{a[0]}</b></div></div></td>
              <td className="muted">{a[1]}</td><td>{a[2]}</td><td><b>{naira(a[3])}</b></td>
              <td><span className={'adm-pill ' + (st === 'Approved' ? 'ok' : st === 'Pending' ? 'warn' : 'bad')}>{st}</span>{paidMap[a[0]] && <span className="adm-pill paid" style={{ marginLeft: 6 }}><Icon name="check" size={11} stroke={3} /> Paid</span>}</td>
              <td><div className="adm-rowact">{st === 'Pending' ? <><button title="Approve" onClick={() => { setSt(a, 'Approved'); addToast(a[0] + ' approved'); }}><Icon name="check" size={15} /></button><button className="del" title="Reject" onClick={() => { setSt(a, 'Suspended'); addToast(a[0] + ' rejected'); }}><Icon name="close" size={15} /></button></> : <><button title="View" onClick={() => setView(a)}><Icon name="eye" size={15} /></button><button title="Pay out" className={paidMap[a[0]] ? 'paid' : ''} onClick={() => { markPaid(a); addToast('Payout of ' + naira(a[3]) + ' sent to ' + a[0]); }}><Icon name="dollar" size={15} /></button></>}</div></td>
            </tr>
          ); })}</tbody>
        </table>{list.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No affiliates match your search.</div>}
        <Pager page={cur} pages={pages} onPage={setPg} /></div>
      </div>
      {view && <AffiliateDrawer aff={view} status={stOf(view)} paid={!!paidMap[view[0]]} onStatusChange={(s) => setSt(view, s)} onPay={() => markPaid(view)} onClose={() => setView(null)} />}
      {invite && <InviteAffiliateDrawer onClose={() => setInvite(false)} />}
    </>
  );
}

/* ---------- REFERRALS ---------- */
export function AdminReferrals() {
  const addToast = useAdminToast();
  const [settings, setSettings] = useState([]);
  const [draft, setDraft] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const displayValue = useCallback(setting => {
    if (setting.key === 'referrals.reward_amount_minor') return Number(setting.value) / 100;
    return setting.value;
  }, []);

  const storedValue = useCallback((setting, value) => {
    if (setting.type === 'boolean') return Boolean(value);
    if (setting.key === 'referrals.reward_amount_minor') return Math.round(Number(value) * 100);
    if (setting.type === 'integer') return Math.round(Number(value));
    return String(value);
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await businessSettingsApi.list({ group: 'referrals' });
      const items = Array.isArray(response) ? response : response?.items || response?.data || [];
      setSettings(items);
      setDraft(Object.fromEntries(items.map(setting => [setting.key, displayValue(setting)])));
    } catch (error) {
      addToast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [addToast, displayValue]);

  // Initial network hydration is intentionally triggered when the page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const byKey = useMemo(() => Object.fromEntries(settings.map(setting => [setting.key, setting])), [settings]);
  const changed = useMemo(() => settings.filter(setting => (
    JSON.stringify(storedValue(setting, draft[setting.key])) !== JSON.stringify(setting.value)
  )), [draft, settings, storedValue]);
  const rewardAmount = Number(draft['referrals.reward_amount_minor']) || 0;
  const enabled = Boolean(draft['referrals.enabled']);
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const constraints = key => byKey[key]?.constraints || {};

  const save = async () => {
    if (!changed.length) return;
    setSaving(true);
    try {
      await businessSettingsApi.update(changed.map(setting => ({
        key: setting.key,
        value: storedValue(setting, draft[setting.key]),
      })));
      addToast('Referral settings saved.');
      await load();
    } catch (error) {
      addToast(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdmHead title="Referrals" sub="Lim Cash reward program">
        <button className="adm-btn primary" onClick={save} disabled={!loaded || saving || changed.length === 0}>
          <Icon name="check" size={15} /> {saving ? 'Saving…' : `Save ${changed.length || ''} change${changed.length === 1 ? '' : 's'}`}
        </button>
      </AdmHead>
      <div className="kpi-grid">
        <Kpi ic="dollar" tint="#1F8A5B" label="Reward per referral" val={loaded ? naira(rewardAmount) : '—'} delta="" up />
        <Kpi ic="user" tint="#0438B6" label="Successful referrals" val="0" delta="" up />
        <Kpi ic="gift" tint="#F67208" label="Lim Cash issued" val={naira(0)} delta="" up />
        <Kpi ic="refresh" tint="#7A5AE0" label="Redemption rate" val="0%" delta="" up />
      </div>
      <div className="adm-row c2">
        <div className="panel"><div className="panel-h"><h3>Referrals over time</h3></div><BarChart data={[0, 0, 0, 0, 0, 0, 0, 0]} labels={['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8']} alt /></div>
        <div className="panel"><div className="panel-h"><h3>Program settings</h3></div>
          {!loaded ? <div className="adm-soon"><p>Loading referral settings…</p></div> : (
            <div className="adm-list">
              <div className="adm-li">
                <div className="adm-li-main"><b>Reward amount</b><small>{byKey['referrals.reward_amount_minor']?.description}</small></div>
                <div style={{ position: 'relative' }}>
                  <span className="muted" style={{ position: 'absolute', left: 10, top: 8 }}>₦</span>
                  <input type="number" min={(constraints('referrals.reward_amount_minor').min || 0) / 100} max={(constraints('referrals.reward_amount_minor').max || 100000000) / 100} step="100" value={draft['referrals.reward_amount_minor'] ?? ''} onChange={event => set('referrals.reward_amount_minor', event.target.value)} style={{ width: 120, padding: '7px 8px 7px 25px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }} />
                </div>
              </div>
              <div className="adm-li">
                <div className="adm-li-main"><b>Reward currency</b><small>{byKey['referrals.currency']?.description}</small></div>
                <select value={draft['referrals.currency'] ?? 'NGN'} onChange={event => set('referrals.currency', event.target.value)} style={{ width: 100, padding: 7, border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                  {(constraints('referrals.currency').options || ['NGN']).map(option => <option value={option} key={option}>{option}</option>)}
                </select>
              </div>
              <div className="adm-li">
                <div className="adm-li-main"><b>Attribution window</b><small>{byKey['referrals.attribution_days']?.description}</small></div>
                <input type="number" min={constraints('referrals.attribution_days').min || 1} max={constraints('referrals.attribution_days').max || 365} value={draft['referrals.attribution_days'] ?? ''} onChange={event => set('referrals.attribution_days', event.target.value)} style={{ width: 90, textAlign: 'center', padding: 7, border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }} aria-label="Attribution window in days" />
              </div>
              <div className="adm-li">
                <div className="adm-li-main"><b>Daily invitation limit</b><small>{byKey['referrals.invitation_daily_limit']?.description}</small></div>
                <input type="number" min={constraints('referrals.invitation_daily_limit').min || 1} max={constraints('referrals.invitation_daily_limit').max || 100} value={draft['referrals.invitation_daily_limit'] ?? ''} onChange={event => set('referrals.invitation_daily_limit', event.target.value)} style={{ width: 90, textAlign: 'center', padding: 7, border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }} aria-label="Daily invitation limit" />
              </div>
              <div className="adm-li">
                <div className="adm-li-main"><b>Invitation resend window</b><small>{byKey['referrals.invitation_resend_days']?.description}</small></div>
                <input type="number" min={constraints('referrals.invitation_resend_days').min || 1} max={constraints('referrals.invitation_resend_days').max || 90} value={draft['referrals.invitation_resend_days'] ?? ''} onChange={event => set('referrals.invitation_resend_days', event.target.value)} style={{ width: 90, textAlign: 'center', padding: 7, border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }} aria-label="Invitation resend window in days" />
              </div>
              <div className="adm-li">
                <div className="adm-li-main"><b>Program active</b><small>{byKey['referrals.enabled']?.description}</small></div>
                <button type="button" className={'toggle' + (enabled ? ' on' : '')} onClick={() => set('referrals.enabled', !enabled)} role="switch" aria-checked={enabled} aria-label="Enable referral program" />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
