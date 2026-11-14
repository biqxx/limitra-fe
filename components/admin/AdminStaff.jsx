'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { Kpi } from '@/components/charts/Charts';
import { adminRolesApi, adminUsersApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useAdminToast } from './AdminToastContext';
import { AdmHead, AdmSelect, Pager, usePager } from './AdminShared';

const asList = (res) => (Array.isArray(res) ? res : res?.items || res?.data || []);

function initials(name, fallback = 'S') {
  return (
    String(name || fallback)
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || fallback
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isStaffMember(user) {
  const legacy = String(user?.role || '').toLowerCase();
  if (['admin', 'staff', 'super_admin', 'super-admin', 'manager', 'support'].includes(legacy)) {
    return true;
  }
  return Array.isArray(user?.roles) && user.roles.length > 0;
}

function roleLabel(user) {
  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    return user.roles.map((r) => r?.name || r?.slug).filter(Boolean).join(', ');
  }
  return user?.role || 'staff';
}

function InviteStaffDrawer({ roles, onInvited, onClose }) {
  const addToast = useAdminToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(() => (roles[0]?.id ? String(roles[0].id) : ''));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!roleId && roles.length > 0 && roles[0]?.id) {
      setRoleId(String(roles[0].id));
    }
  }, [roleId, roles]);

  const roleOptions = useMemo(
    () =>
      roles.map((r) => ({
        value: String(r.id),
        label: r.name || r.slug || `Role #${r.id}`,
      })),
    [roles]
  );

  const submit = async (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (!cleanName || !cleanEmail) {
      addToast('Enter both full name and email address');
      return;
    }
    setBusy(true);
    try {
      const payload = { name: cleanName, email: cleanEmail };
      if (roleId) {
        const numericId = Number(roleId);
        payload.role_id = Number.isNaN(numericId) ? roleId : numericId;
      }
      await adminRolesApi.inviteStaff(payload);
      addToast(`Staff invitation sent to ${cleanEmail}`);
      await onInvited();
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
      <aside className="adm-drawer" role="dialog" aria-label="Create staff account">
        <div className="adm-drawer-h">
          <div>
            <h3>Create staff account</h3>
            <small className="muted">Send an email invitation to provision staff access</small>
          </div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        <form className="adm-drawer-body" onSubmit={submit}>
          <div className="adm-field">
            <label>Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amina Bello"
              required
            />
          </div>

          <div className="adm-field" style={{ marginTop: 12 }}>
            <label>Work email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="amina@limitra.com"
              required
            />
          </div>

          <div className="adm-field" style={{ marginTop: 12 }}>
            <label>Assigned role</label>
            {roleOptions.length > 0 ? (
              <AdmSelect
                value={roleId}
                options={roleOptions}
                onChange={(val) => setRoleId(val)}
              />
            ) : (
              <input type="text" value="Default Staff Role" disabled />
            )}
          </div>

          <div
            className="adm-card"
            style={{
              marginTop: 16,
              padding: '12px 14px',
              background: 'var(--bg-subtle, #f8fafc)',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <b>Activation flow:</b> For security, staff members set their own username and password using the activation link sent to their email.
          </div>

          <div className="adm-drawer-foot" style={{ marginTop: 20 }}>
            <button type="button" className="adm-btn ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="adm-btn primary" disabled={busy}>
              <Icon name="plus" size={15} /> {busy ? 'Sending invite…' : 'Send staff invite'}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}

function StaffManageDrawer({ user, onAction, onClose }) {
  const addToast = useAdminToast();
  const [detail, setDetail] = useState(user);
  const [selectedRole, setSelectedRole] = useState(() => String(user?.role || 'staff').toLowerCase());
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    let active = true;
    adminUsersApi
      .get(user.id)
      .then((res) => {
        if (!active || !res) return;
        const next = { ...user, ...(res?.user || res) };
        setDetail(next);
        if (next.role) setSelectedRole(String(next.role).toLowerCase());
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  const status = String(detail.status || (detail.suspended_at ? 'suspended' : 'active')).toLowerCase();
  const suspended = status === 'suspended' || Boolean(detail.suspended_at);

  const run = async (fn, msg, closeAfter = true) => {
    setBusy(true);
    try {
      await fn();
      addToast(msg);
      await onAction();
      if (closeAfter) onClose();
    } catch (err) {
      addToast(messageFrom(err));
    } finally {
      setBusy(false);
    }
  };

  const roleChanged = selectedRole !== String(detail.role || 'staff').toLowerCase();

  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-label="Manage staff member">
        <div className="adm-drawer-h">
          <div>
            <h3>Manage staff member</h3>
            <small className="muted">Account #{detail.id}</small>
          </div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="adm-drawer-body">
          <div className="adm-cust-head">
            <span className="adm-li-av lg">{initials(detail.name || detail.username || detail.email)}</span>
            <div>
              <b style={{ fontSize: 18 }}>{detail.name || detail.username || 'Unnamed staff'}</b>
              <div className="muted" style={{ fontSize: 13 }}>{detail.email || '—'}</div>
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <span className={'adm-pill ' + (suspended ? 'bad' : 'ok')}>
                  {suspended ? 'Suspended' : 'Active'}
                </span>
                <span className="adm-pill info" style={{ textTransform: 'capitalize' }}>
                  {roleLabel(detail)}
                </span>
              </div>
            </div>
          </div>

          <div className="adm-list" style={{ marginTop: 14 }}>
            <div className="adm-li">
              <div className="adm-li-main">
                <b>Username</b>
                <small>{detail.username || '—'}</small>
              </div>
            </div>
            <div className="adm-li">
              <div className="adm-li-main">
                <b>Phone</b>
                <small>{detail.phone || '—'}</small>
              </div>
            </div>
            <div className="adm-li">
              <div className="adm-li-main">
                <b>Joined</b>
                <small>{formatDate(detail.created_at)}</small>
              </div>
            </div>
            <div className="adm-li">
              <div className="adm-li-main">
                <b>Email verified</b>
                <small>{detail.email_verified_at ? formatDate(detail.email_verified_at) : 'Pending'}</small>
              </div>
            </div>
          </div>

          <div className="adm-field" style={{ marginTop: 16 }}>
            <label>Account access level</label>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <AdmSelect
                  value={selectedRole}
                  options={[
                    { value: 'staff', label: 'Staff' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'customer', label: 'Customer (demote)' },
                  ]}
                  onChange={(val) => setSelectedRole(val)}
                />
              </div>
              <button
                type="button"
                className="adm-btn primary"
                disabled={busy || !roleChanged}
                onClick={() =>
                  run(
                    () => adminUsersApi.updateRole(detail.id, { role: selectedRole }),
                    `Updated ${detail.name || detail.email} role to ${selectedRole}`,
                    false
                  )
                }
              >
                Save role
              </button>
            </div>
          </div>

          <div className="adm-drawer-foot" style={{ marginTop: 20, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="adm-btn ghost"
              disabled={busy}
              onClick={() => run(() => adminUsersApi.passwordReset(detail.id), 'Password reset link sent', false)}
            >
              <Icon name="lock" size={15} /> Reset password
            </button>

            {suspended ? (
              <button
                type="button"
                className="adm-btn primary"
                disabled={busy}
                onClick={() =>
                  run(() => adminUsersApi.restore(detail.id), `${detail.name || detail.email} restored`)
                }
              >
                <Icon name="refresh" size={15} /> Restore account
              </button>
            ) : (
              <button
                type="button"
                className="adm-btn danger"
                disabled={busy}
                onClick={() =>
                  run(() => adminUsersApi.suspend(detail.id), `${detail.name || detail.email} suspended`)
                }
              >
                <Icon name="close" size={15} /> Suspend
              </button>
            )}

            {confirmRemove ? (
              <button
                type="button"
                className="adm-btn danger"
                disabled={busy}
                onClick={() =>
                  run(() => adminUsersApi.remove(detail.id), `${detail.name || detail.email} deactivated`)
                }
              >
                Confirm deactivate
              </button>
            ) : (
              <button
                type="button"
                className="adm-btn ghost"
                disabled={busy}
                onClick={() => setConfirmRemove(true)}
              >
                Deactivate
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export function AdminStaff() {
  const addToast = useAdminToast();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [tab, setTab] = useState('members');
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showInvite, setShowInvite] = useState(false);
  const [managing, setManaging] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [usersRes, rolesRes, invRes] = await Promise.allSettled([
        adminUsersApi.list({ per_page: 100 }),
        adminRolesApi.list(),
        adminRolesApi.invitations(),
      ]);
      if (usersRes.status === 'fulfilled') setUsers(asList(usersRes.value));
      if (rolesRes.status === 'fulfilled') setRoles(asList(rolesRes.value));
      if (invRes.status === 'fulfilled') setInvitations(asList(invRes.value));
    } catch (err) {
      addToast(messageFrom(err));
    } finally {
      setLoaded(true);
    }
  }, [addToast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const staffList = useMemo(() => users.filter(isStaffMember), [users]);

  const filteredStaff = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return staffList.filter((u) => {
      const uRole = String(u.role || 'staff').toLowerCase();
      const suspended = String(u.status || '').toLowerCase() === 'suspended' || Boolean(u.suspended_at);
      if (roleFilter !== 'all' && uRole !== roleFilter) return false;
      if (statusFilter === 'active' && suspended) return false;
      if (statusFilter === 'suspended' && !suspended) return false;
      if (!needle) return true;
      return `${u.name || ''} ${u.email || ''} ${u.username || ''} ${u.phone || ''} ${roleLabel(u)}`
        .toLowerCase()
        .includes(needle);
    });
  }, [q, roleFilter, staffList, statusFilter]);

  const filteredInvites = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return invitations;
    return invitations.filter((inv) =>
      `${inv.name || ''} ${inv.email || ''} ${inv.role?.name || inv.role_name || ''}`
        .toLowerCase()
        .includes(needle)
    );
  }, [invitations, q]);

  const { shown: shownStaff, pagerProps: staffPager } = usePager(filteredStaff, q + roleFilter + statusFilter + tab);
  const { shown: shownInvites, pagerProps: invPager } = usePager(filteredInvites, q + tab);

  const activeCount = staffList.filter(
    (u) => !u.suspended_at && String(u.status || 'active').toLowerCase() !== 'suspended'
  ).length;
  const suspendedCount = staffList.length - activeCount;
  const pendingInvites = invitations.filter(
    (i) => !i.accepted_at && String(i.status || 'pending').toLowerCase() === 'pending'
  ).length;

  const resendInvite = async (inv) => {
    setBusyId(`resend-${inv.id}`);
    try {
      await adminRolesApi.resendInvite(inv.id);
      addToast(`Invitation resent to ${inv.email}`);
      await load();
    } catch (err) {
      addToast(messageFrom(err));
    } finally {
      setBusyId(null);
    }
  };

  const revokeInvite = async (inv) => {
    setBusyId(`revoke-${inv.id}`);
    try {
      await adminRolesApi.revokeInvite(inv.id);
      addToast(`Invitation for ${inv.email} revoked`);
      await load();
    } catch (err) {
      addToast(messageFrom(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <AdmHead
        title="Staff & Team"
        sub="Create staff accounts, assign access roles, and manage team permissions."
        right={
          <button className="adm-btn primary" onClick={() => setShowInvite(true)}>
            <Icon name="plus" size={16} /> Create staff account
          </button>
        }
      />

      <div className="adm-kpis">
        <Kpi label="Total staff & admins" value={staffList.length} delta="Team accounts" up />
        <Kpi label="Active staff" value={activeCount} delta="Enabled access" up />
        <Kpi label="Suspended" value={suspendedCount} delta="Restricted" up={suspendedCount === 0} />
        <Kpi label="Pending invites" value={pendingInvites || invitations.length} delta="Awaiting activation" up />
      </div>

      <div className="adm-tabs" style={{ marginTop: 18 }}>
        <button
          className={'adm-tab' + (tab === 'members' ? ' active' : '')}
          onClick={() => setTab('members')}
        >
          Staff members ({staffList.length})
        </button>
        <button
          className={'adm-tab' + (tab === 'invites' ? ' active' : '')}
          onClick={() => setTab('invites')}
        >
          Invitations ({invitations.length})
        </button>
      </div>

      <div className="adm-card" style={{ marginTop: 14 }}>
        <div className="adm-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="adm-search" style={{ flex: '1 1 240px', maxWidth: 360 }}>
            <Icon name="search" size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tab === 'members' ? 'Search staff by name, email, or role…' : 'Search invitations…'}
            />
          </div>

          {tab === 'members' && (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <AdmSelect
                compact
                value={roleFilter}
                options={[
                  { value: 'all', label: 'All roles' },
                  { value: 'admin', label: 'Admins' },
                  { value: 'staff', label: 'Staff' },
                ]}
                onChange={(val) => setRoleFilter(val)}
              />
              <AdmSelect
                compact
                value={statusFilter}
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended' },
                ]}
                onChange={(val) => setStatusFilter(val)}
              />
            </div>
          )}
        </div>

        {tab === 'members' ? (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Staff member</th>
                    <th>Contact</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!loaded ? (
                    <tr>
                      <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                        Loading staff accounts…
                      </td>
                    </tr>
                  ) : shownStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                        No staff members match your filters.
                      </td>
                    </tr>
                  ) : (
                    shownStaff.map((u) => {
                      const suspended =
                        String(u.status || '').toLowerCase() === 'suspended' || Boolean(u.suspended_at);
                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                              <span className="adm-li-av">{initials(u.name || u.email)}</span>
                              <div>
                                <b>{u.name || u.username || 'Unnamed staff'}</b>
                                <div className="muted" style={{ fontSize: 12 }}>
                                  {u.username ? `@${u.username}` : `ID #${u.id}`}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div>{u.email || '—'}</div>
                            {u.phone && (
                              <div className="muted" style={{ fontSize: 12 }}>
                                {u.phone}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="adm-pill info" style={{ textTransform: 'capitalize' }}>
                              {roleLabel(u)}
                            </span>
                          </td>
                          <td>
                            <span className={'adm-pill ' + (suspended ? 'bad' : 'ok')}>
                              {suspended ? 'Suspended' : 'Active'}
                            </span>
                          </td>
                          <td>{formatDate(u.created_at)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="adm-btn ghost" onClick={() => setManaging(u)}>
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pager {...staffPager} />
          </>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Invitee</th>
                    <th>Assigned role</th>
                    <th>Status</th>
                    <th>Sent / Expires</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!loaded ? (
                    <tr>
                      <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                        Loading invitations…
                      </td>
                    </tr>
                  ) : shownInvites.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                        No staff invitations found. Click &ldquo;Create staff account&rdquo; to invite someone.
                      </td>
                    </tr>
                  ) : (
                    shownInvites.map((inv) => {
                      const invStatus = String(
                        inv.accepted_at ? 'accepted' : inv.status || 'pending'
                      ).toLowerCase();
                      const pillClass =
                        invStatus === 'accepted' ? 'ok' : invStatus === 'expired' ? 'bad' : 'warn';
                      return (
                        <tr key={inv.id}>
                          <td>
                            <b>{inv.name || 'Invited staff'}</b>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {inv.email || '—'}
                            </div>
                          </td>
                          <td>
                            <span className="adm-pill info" style={{ textTransform: 'capitalize' }}>
                              {inv.role?.name || inv.role_name || inv.role || 'Staff'}
                            </span>
                          </td>
                          <td>
                            <span className={'adm-pill ' + pillClass} style={{ textTransform: 'capitalize' }}>
                              {invStatus}
                            </span>
                          </td>
                          <td>
                            <div>{formatDate(inv.created_at)}</div>
                            {inv.expires_at && (
                              <div className="muted" style={{ fontSize: 12 }}>
                                Expires {formatDate(inv.expires_at)}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                              {invStatus !== 'accepted' && (
                                <button
                                  className="adm-btn ghost"
                                  disabled={busyId === `resend-${inv.id}`}
                                  onClick={() => resendInvite(inv)}
                                >
                                  Resend
                                </button>
                              )}
                              <button
                                className="adm-btn ghost"
                                disabled={busyId === `revoke-${inv.id}`}
                                onClick={() => revokeInvite(inv)}
                              >
                                Revoke
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pager {...invPager} />
          </>
        )}
      </div>

      {showInvite && (
        <InviteStaffDrawer
          roles={roles}
          onInvited={async () => {
            await load();
            setTab('invites');
          }}
          onClose={() => setShowInvite(false)}
        />
      )}

      {managing && (
        <StaffManageDrawer
          user={managing}
          onAction={load}
          onClose={() => setManaging(null)}
        />
      )}
    </>
  );
}

