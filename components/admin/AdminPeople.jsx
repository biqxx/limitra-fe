'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { Kpi } from '@/components/charts/Charts';
import { naira } from '@/lib/data';
import { adminAffiliatesApi, adminUsersApi, businessSettingsApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useAdminToast } from './AdminToastContext';
import { AdmHead, Pager, usePager, useHighlight } from './AdminShared';

const asList = res => (Array.isArray(res) ? res : res?.items || res?.data || []);

function initials(name, fallback = 'U') {
  return String(name || fallback)
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || fallback;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isStaffOrAdmin(user) {
  if (user?.linked_roles?.staff === true) return true;
  const legacy = String(user?.role || '').toLowerCase();
  if (['admin', 'staff', 'super_admin', 'super-admin', 'manager', 'support'].includes(legacy)) {
    return true;
  }
  if (Array.isArray(user?.roles)) {
    return user.roles.some((r) => {
      const n = String(r?.name || r?.slug || '').toLowerCase();
      return ['admin', 'staff', 'super_admin', 'super-admin', 'manager', 'support'].includes(n);
    });
  }
  return false;
}

/* ---------- CUSTOMERS & USERS ---------- */
function CustomerDrawer({ user, onAction, onClose }) {
  const addToast = useAdminToast();
  const [detail, setDetail] = useState(user);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    adminUsersApi.get(user.id)
      .then(res => { if (active && res) setDetail(prev => ({ ...prev, ...(res?.user || res) })); })
      .catch(() => {});
    return () => { active = false; };
  }, [user.id]);

  const status = String(detail.status || (detail.suspended_at ? 'suspended' : 'active')).toLowerCase();
  const suspended = status === 'suspended' || Boolean(detail.suspended_at);
  const role = String(detail.role || 'customer').toLowerCase();

  const run = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      addToast(msg);
      await onAction();
      onClose();
    } catch (err) {
      addToast(messageFrom(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-label="User profile">
        <div className="adm-drawer-h">
          <div><h3>User profile</h3><small className="muted">Account #{detail.id}</small></div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">
          <div className="adm-cust-head">
            <span className="adm-li-av lg">{initials(detail.name || detail.username || detail.email)}</span>
            <div>
              <b style={{ fontSize: 18 }}>{detail.name || detail.username || 'Unnamed user'}</b>
              <div className="muted" style={{ fontSize: 13 }}>{detail.email || '—'}</div>
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <span className={'adm-pill ' + (suspended ? 'bad' : 'ok')}>{suspended ? 'Suspended' : 'Active'}</span>
                <span className="adm-pill info" style={{ textTransform: 'capitalize' }}>{role}</span>
              </div>
            </div>
          </div>

          <div className="adm-cust-stats">
            <div><span className="muted">Orders</span><b>{detail.orders_count ?? 0}</b></div>
            <div><span className="muted">Lifetime spend</span><b>{naira(detail.total_spent ?? detail.lifetime_value ?? 0)}</b></div>
            <div><span className="muted">Joined</span><b>{formatDate(detail.created_at)}</b></div>
          </div>

          <div className="adm-list" style={{ marginTop: 14 }}>
            <div className="adm-li"><div className="adm-li-main"><b>Username</b><small>{detail.username || '—'}</small></div></div>
            <div className="adm-li"><div className="adm-li-main"><b>Phone</b><small>{detail.phone || '—'}</small></div></div>
            <div className="adm-li"><div className="adm-li-main"><b>Email verified</b><small>{detail.email_verified_at ? formatDate(detail.email_verified_at) : 'Unverified'}</small></div></div>
          </div>

          <div className="adm-drawer-foot">
            <button
              className="adm-btn ghost"
              disabled={busy}
              onClick={() => run(() => adminUsersApi.passwordReset(detail.id), 'Password reset link sent')}
            >
              <Icon name="lock" size={15} /> Reset password
            </button>
            {suspended ? (
              <button
                className="adm-btn primary"
                disabled={busy}
                onClick={() => run(() => adminUsersApi.restore(detail.id), `${detail.name || detail.email} restored`)}
              >
                <Icon name="refresh" size={15} /> Restore account
              </button>
            ) : (
              <button
                className="adm-btn danger"
                disabled={busy}
                onClick={() => run(() => adminUsersApi.suspend(detail.id), `${detail.name || detail.email} suspended`)}
              >
                <Icon name="close" size={15} /> Suspend
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export function AdminCustomers() {
  const addToast = useAdminToast();
  const [users, setUsers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [roleTab, setRoleTab] = useState('all');
  const [statusTab, setStatusTab] = useState('all');
  const [view, setView] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await adminUsersApi.list({ per_page: 100 });
      setUsers(asList(res));
    } catch (error) {
      addToast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [addToast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const customerUsers = useMemo(() => users.filter(u => !isStaffOrAdmin(u)), [users]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return customerUsers.filter(u => {
      const suspended = String(u.status || '').toLowerCase() === 'suspended' || Boolean(u.suspended_at);
      if (statusTab === 'active' && suspended) return false;
      if (statusTab === 'suspended' && !suspended) return false;
      if (!needle) return true;
      return `${u.name || ''} ${u.email || ''} ${u.username || ''} ${u.phone || ''}`.toLowerCase().includes(needle);
    });
  }, [customerUsers, q, statusTab]);

  const { shown: cShown, pagerProps: cPager } = usePager(list, q + roleTab + statusTab);

  const activeCount = customerUsers.filter(u => !u.suspended_at && String(u.status || 'active').toLowerCase() !== 'suspended').length;
  const suspendedCount = customerUsers.length - activeCount;
  const verifiedCount = customerUsers.filter(u => Boolean(u.email_verified_at)).length;

  const toggleSuspend = async (u) => {
    const suspended = String(u.status || '').toLowerCase() === 'suspended' || Boolean(u.suspended_at);
    try {
      if (suspended) await adminUsersApi.restore(u.id);
      else await adminUsersApi.suspend(u.id);
      addToast(`${u.name || u.email} ${suspended ? 'restored' : 'suspended'}`);
      await load();
    } catch (error) {
      addToast(messageFrom(error));
    }
  };

  const resetPassword = async (u) => {
    try {
      await adminUsersApi.passwordReset(u.id);
      addToast(`Password reset triggered for ${u.email}`);
    } catch (error) {
      addToast(messageFrom(error));
    }
  };

  const exportCsv = () => {
    const rows = [
      ['ID', 'Name', 'Email', 'Role', 'Status', 'Orders', 'Joined'].join(','),
      ...list.map(u => [
        u.id,
        `"${String(u.name || '').replace(/"/g, '""')}"`,
        `"${String(u.email || '').replace(/"/g, '""')}"`,
        u.role || 'customer',
        u.suspended_at ? 'suspended' : (u.status || 'active'),
        u.orders_count ?? 0,
        u.created_at || '',
      ].join(',')),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'limitra-users.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <AdmHead title="Customers" sub={`${customerUsers.length} registered customer accounts`}>
        <button className="adm-btn ghost" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
        <button className="adm-btn ghost" onClick={exportCsv} disabled={list.length === 0}><Icon name="download" size={15} /> Export CSV</button>
      </AdmHead>

      <div className="kpi-grid">
        <Kpi ic="user" tint="#0438B6" label="Total customers" val={loaded ? customerUsers.length : '—'} delta="" up />
        <Kpi ic="check" tint="#1F8A5B" label="Active" val={loaded ? activeCount : '—'} delta="" up />
        <Kpi ic="shield" tint="#7A5AE0" label="Verified email" val={loaded ? verifiedCount : '—'} delta="" up />
        <Kpi ic="close" tint="#E5484D" label="Suspended" val={loaded ? suspendedCount : '—'} delta="" />
      </div>

      <div className="adm-filters">
        <div className="adm-mini-search">
          <Icon name="search" size={16} className="muted" />
          <input placeholder="Search name, email, username…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {['all', 'active', 'suspended'].map(s => (
          <button key={s} className={'adm-chip' + (statusTab === s ? ' on' : '')} onClick={() => setStatusTab(s)} style={{ textTransform: 'capitalize' }}>
            {s === 'all' ? 'All status' : s}
          </button>
        ))}
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>User</th><th>Role</th><th>Orders</th><th>Joined</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {cShown.map(u => {
                const suspended = String(u.status || '').toLowerCase() === 'suspended' || Boolean(u.suspended_at);
                const role = String(u.role || 'customer').toLowerCase();
                return (
                  <tr key={u.id} className={suspended ? 'adm-row-susp' : ''}>
                    <td data-label="User">
                      <div className="adm-prod">
                        <span className="adm-li-av">{initials(u.name || u.username || u.email)}</span>
                        <div><b>{u.name || u.username || 'Unnamed'}</b><small>{u.email || '—'}</small></div>
                      </div>
                    </td>
                    <td data-label="Role"><span className="adm-pill info" style={{ textTransform: 'capitalize' }}>{role}</span></td>
                    <td data-label="Orders">{u.orders_count ?? 0}</td>
                    <td data-label="Joined" className="muted">{formatDate(u.created_at)}</td>
                    <td data-label="Status"><span className={'adm-pill ' + (suspended ? 'bad' : 'ok')}>{suspended ? 'Suspended' : 'Active'}</span></td>
                    <td data-label="Actions">
                      <div className="adm-rowact">
                        <button title="View details" onClick={() => setView(u)}><Icon name="eye" size={15} /></button>
                        <button title="Reset password" onClick={() => resetPassword(u)}><Icon name="lock" size={15} /></button>
                        {suspended
                          ? <button className="restore" title="Restore account" onClick={() => toggleSuspend(u)}><Icon name="refresh" size={15} /></button>
                          : <button className="del" title="Suspend account" onClick={() => toggleSuspend(u)}><Icon name="close" size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loaded ? <div className="adm-soon"><p>Loading accounts…</p></div>
            : list.length === 0 ? <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No accounts match your filter.</div> : null}
          <Pager {...cPager} />
        </div>
      </div>

      {view && <CustomerDrawer user={view} onAction={load} onClose={() => setView(null)} />}
    </>
  );
}

/* ---------- AFFILIATES ---------- */
function AffiliateDrawer({ aff, onAction, onClose }) {
  const addToast = useAdminToast();
  const [busy, setBusy] = useState(false);
  const name = aff.user?.name || aff.name || aff.code || `Affiliate #${aff.id}`;
  const email = aff.user?.email || aff.email || aff.channel || '—';
  const status = String(aff.status || 'active').toLowerCase();

  const updateStatus = async (nextStatus) => {
    setBusy(true);
    try {
      await adminAffiliatesApi.update(aff.id, { status: nextStatus });
      addToast(`${name} updated to ${nextStatus}`);
      await onAction();
      onClose();
    } catch (error) {
      addToast(messageFrom(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-label="Affiliate detail">
        <div className="adm-drawer-h">
          <div><h3>Affiliate partner</h3><small className="muted">Code: {aff.code || '—'}</small></div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">
          <div className="adm-cust-head">
            <span className="adm-li-av lg">{initials(name)}</span>
            <div>
              <b style={{ fontSize: 18 }}>{name}</b>
              <div className="muted" style={{ fontSize: 13 }}>{email}</div>
              <span className={'adm-pill ' + (status === 'active' || status === 'approved' ? 'ok' : status === 'pending' ? 'warn' : 'bad')} style={{ marginTop: 6, display: 'inline-block', textTransform: 'capitalize' }}>
                {status}
              </span>
            </div>
          </div>

          <div className="adm-cust-stats">
            <div><span className="muted">Referrals / Sales</span><b>{aff.conversions_count ?? aff.sales_count ?? 0}</b></div>
            <div><span className="muted">Total earned</span><b>{naira(aff.total_earnings ?? aff.earnings ?? 0)}</b></div>
            <div><span className="muted">Commission</span><b>{aff.commission_rate != null ? `${aff.commission_rate}%` : 'Default'}</b></div>
          </div>

          <div className="adm-drawer-foot">
            {status !== 'active' && (
              <button className="adm-btn primary" disabled={busy} onClick={() => updateStatus('active')}>
                <Icon name="check" size={15} /> Activate
              </button>
            )}
            {status !== 'suspended' && (
              <button className="adm-btn danger" disabled={busy} onClick={() => updateStatus('suspended')}>
                <Icon name="close" size={15} /> Suspend
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function InviteAffiliateDrawer({ onCreated, onClose }) {
  const addToast = useAdminToast();
  const [userId, setUserId] = useState('');
  const [code, setCode] = useState('');
  const [rate, setRate] = useState('10');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!userId.trim()) return;
    setSaving(true);
    try {
      const payload = { user_id: Number(userId) };
      if (code.trim()) payload.code = code.trim();
      if (rate !== '') payload.commission_rate = Number(rate);
      await adminAffiliatesApi.create(payload);
      addToast('Affiliate partner created');
      await onCreated();
      onClose();
    } catch (error) {
      addToast(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-label="Create affiliate">
        <div className="adm-drawer-h">
          <div><h3>Add affiliate partner</h3><small className="muted">Link an existing user account as an affiliate.</small></div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">
          <label className="adm-field"><span>User ID</span><input type="number" min="1" value={userId} onChange={e => setUserId(e.target.value)} placeholder="e.g. 12" /></label>
          <label className="adm-field"><span>Custom referral code (optional)</span><input value={code} onChange={e => setCode(e.target.value)} placeholder="Auto-generated if blank" /></label>
          <label className="adm-field"><span>Commission rate (%)</span><input type="number" min="0" max="100" step="0.5" value={rate} onChange={e => setRate(e.target.value)} /></label>
        </div>
        <div className="adm-drawer-f">
          <button className="adm-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="adm-btn primary" onClick={submit} disabled={saving || !userId.trim()}>{saving ? 'Saving…' : 'Create affiliate'}</button>
        </div>
      </aside>
    </>
  );
}

export function AdminAffiliates() {
  const addToast = useAdminToast();
  const highlight = useSearchParams().get('highlight');
  useHighlight(highlight);

  const [section, setSection] = useState('partners');
  const [affiliates, setAffiliates] = useState([]);
  const [applications, setApplications] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState(null);
  const [invite, setInvite] = useState(false);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');

  const loadAll = useCallback(async () => {
    try {
      const [affRes, appRes, wdRes] = await Promise.all([
        adminAffiliatesApi.list({ per_page: 100 }).catch(() => []),
        adminAffiliatesApi.applications({ per_page: 100 }).catch(() => []),
        adminAffiliatesApi.withdrawals({ per_page: 100 }).catch(() => []),
      ]);
      setAffiliates(asList(affRes));
      setApplications(asList(appRes));
      setWithdrawals(asList(wdRes));
    } catch (error) {
      addToast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [addToast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll(); }, [loadAll]);

  const activeRows = section === 'partners' ? affiliates : section === 'applications' ? applications : withdrawals;
  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return activeRows.filter(item => {
      const st = String(item.status || 'active').toLowerCase();
      if (tab !== 'all' && st !== tab) return false;
      if (!needle) return true;
      const text = `${item.user?.name || ''} ${item.user?.email || ''} ${item.name || ''} ${item.email || ''} ${item.code || ''} ${item.channel || ''}`.toLowerCase();
      return text.includes(needle);
    });
  }, [activeRows, q, tab]);

  const { shown, pagerProps } = usePager(filteredRows, q + tab + section);

  const totalEarnings = affiliates.reduce((s, a) => s + Number(a.total_earnings ?? a.earnings ?? 0), 0);
  const pendingApps = applications.filter(a => String(a.status || '').toLowerCase() === 'pending').length;
  const pendingWd = withdrawals.filter(w => String(w.status || '').toLowerCase() === 'pending').length;

  const act = async (fn, msg) => {
    try {
      await fn();
      addToast(msg);
      await loadAll();
    } catch (error) {
      addToast(messageFrom(error));
    }
  };

  const tabs = section === 'partners'
    ? ['all', 'active', 'suspended']
    : ['all', 'pending', 'approved', 'rejected'];

  return (
    <>
      <AdmHead title="Affiliates" sub="Manage affiliate partners, applications, and payout withdrawals">
        <button className="adm-btn ghost" onClick={loadAll}><Icon name="refresh" size={14} /> Refresh</button>
        <button className="adm-btn primary" onClick={() => setInvite(true)}><Icon name="plus" size={15} /> Add affiliate</button>
      </AdmHead>

      <div className="kpi-grid">
        <Kpi ic="share" tint="#0438B6" label="Total partners" val={loaded ? affiliates.length : '—'} delta="" up />
        <Kpi ic="dollar" tint="#1F8A5B" label="Total earnings" val={loaded ? naira(totalEarnings) : '—'} delta="" up />
        <Kpi ic="user" tint="#F67208" label="Pending applications" val={loaded ? pendingApps : '—'} delta="" up />
        <Kpi ic="truck" tint="#7A5AE0" label="Pending withdrawals" val={loaded ? pendingWd : '—'} delta="" up />
      </div>

      <div className="adm-filters">
        {[
          ['partners', `Partners (${affiliates.length})`],
          ['applications', `Applications (${applications.length})`],
          ['withdrawals', `Withdrawals (${withdrawals.length})`],
        ].map(([k, lbl]) => (
          <button key={k} className={'adm-chip' + (section === k ? ' on' : '')} onClick={() => { setSection(k); setTab('all'); }}>{lbl}</button>
        ))}
        <div className="adm-mini-search" style={{ marginLeft: 'auto' }}>
          <Icon name="search" size={16} className="muted" />
          <input placeholder="Search partner, code, email…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {tabs.map(t => (
          <button key={t} className={'adm-chip' + (tab === t ? ' on' : '')} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
        ))}
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap">
          {section === 'partners' && (
            <table className="adm-table">
              <thead><tr><th>Partner</th><th>Code</th><th>Commission</th><th>Earnings</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {shown.map(a => {
                  const name = a.user?.name || a.name || a.code || `Affiliate #${a.id}`;
                  const email = a.user?.email || a.email || '—';
                  const st = String(a.status || 'active').toLowerCase();
                  return (
                    <tr key={a.id} data-hlkey={name}>
                      <td data-label="Partner"><div className="adm-prod"><span className="adm-li-av">{initials(name)}</span><div><b>{name}</b><small>{email}</small></div></div></td>
                      <td data-label="Code"><code>{a.code || '—'}</code></td>
                      <td data-label="Commission">{a.commission_rate != null ? `${a.commission_rate}%` : 'Default'}</td>
                      <td data-label="Earnings"><b>{naira(a.total_earnings ?? a.earnings ?? 0)}</b></td>
                      <td data-label="Status"><span className={'adm-pill ' + (st === 'active' ? 'ok' : st === 'pending' ? 'warn' : 'bad')} style={{ textTransform: 'capitalize' }}>{st}</span></td>
                      <td data-label="Actions">
                        <div className="adm-rowact">
                          <button title="View" onClick={() => setView(a)}><Icon name="eye" size={15} /></button>
                          {st === 'active'
                            ? <button className="del" title="Suspend" onClick={() => act(() => adminAffiliatesApi.update(a.id, { status: 'suspended' }), `${name} suspended`)}><Icon name="close" size={15} /></button>
                            : <button title="Activate" onClick={() => act(() => adminAffiliatesApi.update(a.id, { status: 'active' }), `${name} activated`)}><Icon name="check" size={15} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {section === 'applications' && (
            <table className="adm-table">
              <thead><tr><th>Applicant</th><th>Channel</th><th>Submitted</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {shown.map(app => {
                  const name = app.user?.name || app.name || `Application #${app.id}`;
                  const st = String(app.status || 'pending').toLowerCase();
                  return (
                    <tr key={app.id}>
                      <td data-label="Applicant"><b>{name}</b><small style={{ display: 'block' }} className="muted">{app.user?.email || app.email || ''}</small></td>
                      <td data-label="Channel" className="muted">{app.channel || app.website || app.social_handle || '—'}</td>
                      <td data-label="Submitted" className="muted">{formatDate(app.created_at)}</td>
                      <td data-label="Status"><span className={'adm-pill ' + (st === 'approved' ? 'ok' : st === 'pending' ? 'warn' : 'bad')} style={{ textTransform: 'capitalize' }}>{st}</span></td>
                      <td data-label="Actions">
                        {st === 'pending' && (
                          <div className="adm-rowact">
                            <button title="Approve" onClick={() => act(() => adminAffiliatesApi.approveApplication(app.id), `${name} approved`)}><Icon name="check" size={15} /></button>
                            <button className="del" title="Reject" onClick={() => act(() => adminAffiliatesApi.rejectApplication(app.id), `${name} rejected`)}><Icon name="close" size={15} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {section === 'withdrawals' && (
            <table className="adm-table">
              <thead><tr><th>Affiliate</th><th>Amount</th><th>Requested</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {shown.map(wd => {
                  const name = wd.affiliate?.user?.name || wd.user?.name || `Withdrawal #${wd.id}`;
                  const st = String(wd.status || 'pending').toLowerCase();
                  return (
                    <tr key={wd.id}>
                      <td data-label="Affiliate"><b>{name}</b></td>
                      <td data-label="Amount"><b>{naira(wd.amount ?? wd.amount_ngn ?? 0)}</b></td>
                      <td data-label="Requested" className="muted">{formatDate(wd.created_at)}</td>
                      <td data-label="Status"><span className={'adm-pill ' + (st === 'paid' || st === 'approved' ? 'ok' : st === 'pending' ? 'warn' : 'bad')} style={{ textTransform: 'capitalize' }}>{st}</span></td>
                      <td data-label="Actions">
                        <div className="adm-rowact">
                          {st === 'pending' && (
                            <>
                              <button title="Approve" onClick={() => act(() => adminAffiliatesApi.approveWithdrawal(wd.id), 'Withdrawal approved')}><Icon name="check" size={15} /></button>
                              <button className="del" title="Reject" onClick={() => act(() => adminAffiliatesApi.rejectWithdrawal(wd.id), 'Withdrawal rejected')}><Icon name="close" size={15} /></button>
                            </>
                          )}
                          {st === 'approved' && (
                            <button title="Mark paid" onClick={() => act(() => adminAffiliatesApi.markPaidWithdrawal(wd.id), 'Marked as paid')}><Icon name="dollar" size={15} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loaded ? <div className="adm-soon"><p>Loading affiliate data…</p></div>
            : filteredRows.length === 0 ? <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No records match your filter.</div> : null}
          <Pager {...pagerProps} />
        </div>
      </div>

      {view && <AffiliateDrawer aff={view} onAction={loadAll} onClose={() => setView(null)} />}
      {invite && <InviteAffiliateDrawer onCreated={loadAll} onClose={() => setInvite(false)} />}
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
      const items = asList(response);
      setSettings(items);
      setDraft(Object.fromEntries(items.map(setting => [setting.key, displayValue(setting)])));
    } catch (error) {
      addToast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [addToast, displayValue]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const byKey = useMemo(() => Object.fromEntries(settings.map(setting => [setting.key, setting])), [settings]);
  const changed = useMemo(() => settings.filter(setting => (
    JSON.stringify(storedValue(setting, draft[setting.key])) !== JSON.stringify(setting.value)
  )), [draft, settings, storedValue]);
  const rewardAmount = Number(draft['referrals.reward_amount_minor']) || 0;
  const enabled = Boolean(draft['referrals.enabled']);
  const attributionDays = draft['referrals.attribution_days'] ?? '—';
  const dailyLimit = draft['referrals.invitation_daily_limit'] ?? '—';
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
      <AdmHead title="Referrals" sub="Lim Cash referral program configuration synced with Limitra API.">
        <button className="adm-btn primary" onClick={save} disabled={!loaded || saving || changed.length === 0}>
          <Icon name="check" size={15} /> {saving ? 'Saving…' : changed.length > 0 ? `Save ${changed.length} change${changed.length === 1 ? '' : 's'}` : 'All changes saved'}
        </button>
      </AdmHead>

      <div className="prc-kpis">
        <div className="prc-kpi accent">
          <div className="prc-kpi-top"><span>Reward per Referral</span><Icon name="gift" size={15} /></div>
          <b>{loaded ? naira(rewardAmount) : '—'}</b>
          <small>{draft['referrals.currency'] || 'NGN'} credit</small>
        </div>
        <div className="prc-kpi">
          <div className="prc-kpi-top"><span>Program Status</span><Icon name="check" size={15} /></div>
          <b>{loaded ? (enabled ? 'Active' : 'Paused') : '—'}</b>
          <small>Customer referral rewards</small>
        </div>
        <div className="prc-kpi">
          <div className="prc-kpi-top"><span>Attribution Window</span><Icon name="refresh" size={15} /></div>
          <b>{loaded ? `${attributionDays} days` : '—'}</b>
          <small>Signup credit window</small>
        </div>
        <div className={`prc-kpi${changed.length > 0 ? ' warn' : ''}`}>
          <div className="prc-kpi-top"><span>Daily Invite Limit</span><Icon name="mail" size={15} /></div>
          <b>{loaded ? dailyLimit : '—'}</b>
          <small>{changed.length > 0 ? `${changed.length} unsaved edit(s)` : 'Invitations per day'}</small>
        </div>
      </div>

      <section className="prc-section">
        <div className="prc-sec-head">
          <div className="prc-sec-title">
            <span className="prc-sec-ic"><Icon name="gift" size={17} /></span>
            <div>
              <h3>Referral Program Rules</h3>
              <small>Configure reward amount, attribution duration, and invitation throttling.</small>
            </div>
          </div>
          <button type="button" className={'toggle' + (enabled ? ' on' : '')} onClick={() => set('referrals.enabled', !enabled)} role="switch" aria-checked={enabled} aria-label="Enable referral program" />
        </div>

        {!loaded ? <div className="adm-soon"><p>Loading referral settings…</p></div> : (
          <div className="prc-grid">
            <label className="prc-rule">
              <div className="prc-rule-head"><b>Reward amount</b></div>
              <div className="prc-input-wrap">
                <input
                  type="number"
                  min={(constraints('referrals.reward_amount_minor').min || 0) / 100}
                  max={(constraints('referrals.reward_amount_minor').max || 100000000) / 100}
                  step="100"
                  value={draft['referrals.reward_amount_minor'] ?? ''}
                  onChange={e => set('referrals.reward_amount_minor', e.target.value)}
                />
                <span className="prc-unit">{draft['referrals.currency'] || 'NGN'}</span>
              </div>
              <p className="prc-rule-desc">{byKey['referrals.reward_amount_minor']?.description}</p>
            </label>

            <label className="prc-rule">
              <div className="prc-rule-head"><b>Reward currency</b></div>
              <div className="prc-input-wrap">
                <select value={draft['referrals.currency'] ?? 'NGN'} onChange={e => set('referrals.currency', e.target.value)}>
                  {(constraints('referrals.currency').options || ['NGN']).map(option => <option value={option} key={option}>{option}</option>)}
                </select>
              </div>
              <p className="prc-rule-desc">{byKey['referrals.currency']?.description}</p>
            </label>

            <label className="prc-rule">
              <div className="prc-rule-head"><b>Attribution window</b></div>
              <div className="prc-input-wrap">
                <input
                  type="number"
                  min={constraints('referrals.attribution_days').min || 1}
                  max={constraints('referrals.attribution_days').max || 365}
                  value={draft['referrals.attribution_days'] ?? ''}
                  onChange={e => set('referrals.attribution_days', e.target.value)}
                />
                <span className="prc-unit">days</span>
              </div>
              <p className="prc-rule-desc">{byKey['referrals.attribution_days']?.description}</p>
            </label>

            <label className="prc-rule">
              <div className="prc-rule-head"><b>Daily invitation limit</b></div>
              <div className="prc-input-wrap">
                <input
                  type="number"
                  min={constraints('referrals.invitation_daily_limit').min || 1}
                  max={constraints('referrals.invitation_daily_limit').max || 100}
                  value={draft['referrals.invitation_daily_limit'] ?? ''}
                  onChange={e => set('referrals.invitation_daily_limit', e.target.value)}
                />
                <span className="prc-unit">/ day</span>
              </div>
              <p className="prc-rule-desc">{byKey['referrals.invitation_daily_limit']?.description}</p>
            </label>

            <label className="prc-rule">
              <div className="prc-rule-head"><b>Invitation resend window</b></div>
              <div className="prc-input-wrap">
                <input
                  type="number"
                  min={constraints('referrals.invitation_resend_days').min || 1}
                  max={constraints('referrals.invitation_resend_days').max || 90}
                  value={draft['referrals.invitation_resend_days'] ?? ''}
                  onChange={e => set('referrals.invitation_resend_days', e.target.value)}
                />
                <span className="prc-unit">days</span>
              </div>
              <p className="prc-rule-desc">{byKey['referrals.invitation_resend_days']?.description}</p>
            </label>
          </div>
        )}
      </section>
    </>
  );
}
