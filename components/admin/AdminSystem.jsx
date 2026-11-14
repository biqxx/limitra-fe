'use client';
/* System nav group (Content/CMS, Roles & Access, Reports) — ported verbatim from
   legacy/admin-sections.jsx. `window.admToast` calls replaced with `useAdminToast()`. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { adminRolesApi, adminContentApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useStore } from '@/components/store/StoreProvider';
import { hasPermission } from '@/lib/auth/permissions';
import { useAdminToast } from './AdminToastContext';
import { AdmHead, Pager, usePager } from './AdminShared';

const asList = res => (Array.isArray(res) ? res : res?.items || res?.data || []);

/* ---------- CMS (Content, Blog, Media, Newsletter) ---------- */
export function AdminCMS() {
  const { user } = useStore();
  const canManageCms = hasPermission(user, 'cms.manage');
  const canReadCms = hasPermission(user, 'cms.read') || canManageCms;
  const canReadMedia = hasPermission(user, 'media.read') || hasPermission(user, 'media.manage');
  const canManageMedia = hasPermission(user, 'media.manage');

  const addToast = useAdminToast();
  const [tab, setTab] = useState(canReadCms ? 'content' : 'media');
  const [entries, setEntries] = useState([]);
  const [posts, setPosts] = useState([]);
  const [media, setMedia] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [cRes, bRes, mRes, nRes] = await Promise.allSettled([
      canReadCms ? adminContentApi.list({ per_page: 100 }) : Promise.resolve([]),
      canReadCms ? adminContentApi.blogPosts({ per_page: 100 }) : Promise.resolve([]),
      canReadMedia ? adminContentApi.media({ per_page: 100 }) : Promise.resolve([]),
      canReadCms ? adminContentApi.newsletter({ per_page: 100 }) : Promise.resolve([]),
    ]);
    if (cRes.status === 'fulfilled') setEntries(asList(cRes.value));
    if (bRes.status === 'fulfilled') setPosts(asList(bRes.value));
    if (mRes.status === 'fulfilled') setMedia(asList(mRes.value));
    if (nRes.status === 'fulfilled') setSubscribers(asList(nRes.value));
    setLoaded(true);
  }, [canReadCms, canReadMedia]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const activeList = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const raw = tab === 'content' ? entries : tab === 'blog' ? posts : tab === 'media' ? media : subscribers;
    if (!needle) return raw;
    return raw.filter(it => JSON.stringify(it).toLowerCase().includes(needle));
  }, [entries, media, posts, q, subscribers, tab]);

  const { shown, pagerProps } = usePager(activeList, tab + q + activeList.length);

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      if (draft.kind === 'content') {
        const body = { key: draft.key.trim(), title: draft.title.trim(), type: draft.type || 'page', body: draft.body };
        if (draft.id) await adminContentApi.update(draft.id, body);
        else await adminContentApi.create(body);
        addToast(draft.id ? 'Content updated' : 'Content created');
      } else if (draft.kind === 'blog') {
        const body = { title: draft.title.trim(), slug: draft.slug?.trim() || undefined, excerpt: draft.excerpt || undefined, content: draft.body };
        if (draft.id) await adminContentApi.updateBlogPost(draft.id, body);
        else await adminContentApi.createBlogPost(body);
        addToast(draft.id ? 'Blog post updated' : 'Blog post created');
      }
      setDraft(null);
      await load();
    } catch (err) {
      addToast(messageFrom(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdmHead title="Content & CMS" sub="Manage content blocks, blog posts, media library, and newsletter subscribers.">
        <button className="adm-btn ghost" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
        {tab === 'content' && canManageCms && (
          <button className="adm-btn primary" onClick={() => setDraft({ kind: 'content', key: '', title: '', type: 'page', body: '' })}><Icon name="plus" size={15} /> New entry</button>
        )}
        {tab === 'blog' && canManageCms && (
          <button className="adm-btn primary" onClick={() => setDraft({ kind: 'blog', title: '', slug: '', excerpt: '', body: '' })}><Icon name="plus" size={15} /> New post</button>
        )}
      </AdmHead>

      <div className="adm-filters" style={{ flexWrap: 'wrap', gap: 8 }}>
        {canReadCms && <button className={'adm-chip' + (tab === 'content' ? ' on' : '')} onClick={() => setTab('content')}>Content ({entries.length})</button>}
        {canReadCms && <button className={'adm-chip' + (tab === 'blog' ? ' on' : '')} onClick={() => setTab('blog')}>Blog posts ({posts.length})</button>}
        {canReadMedia && <button className={'adm-chip' + (tab === 'media' ? ' on' : '')} onClick={() => setTab('media')}>Media ({media.length})</button>}
        {canReadCms && <button className={'adm-chip' + (tab === 'newsletter' ? ' on' : '')} onClick={() => setTab('newsletter')}>Newsletter ({subscribers.length})</button>}
        <div className="adm-mini-search" style={{ marginLeft: 'auto' }}>
          <Icon name="search" size={15} className="muted" />
          <input placeholder="Filter items…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              {tab === 'content' && <tr><th>Title / Key</th><th>Type</th><th>Status</th><th></th></tr>}
              {tab === 'blog' && <tr><th>Post</th><th>Slug</th><th>Status</th><th></th></tr>}
              {tab === 'media' && <tr><th>File</th><th>MIME / Size</th><th>URL</th><th></th></tr>}
              {tab === 'newsletter' && <tr><th>Email</th><th>Status</th><th>Subscribed</th><th></th></tr>}
            </thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 28 }}>Loading…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 28 }}>No items found.</td></tr>
              ) : shown.map((it) => {
                if (tab === 'content') {
                  return (
                    <tr key={it.id}>
                      <td><b>{it.title || it.key}</b>{it.key && <small className="muted" style={{ display: 'block' }}>{it.key}</small>}</td>
                      <td className="muted">{it.type || 'page'}</td>
                      <td><span className={'adm-pill ' + (it.status === 'published' || it.published_at ? 'ok' : 'muted')}>{it.status || (it.published_at ? 'published' : 'draft')}</span></td>
                      <td>{canManageCms && (
                        <div className="adm-rowact">
                          <button title="Publish" onClick={async () => { try { await adminContentApi.publish(it.id); addToast('Published'); load(); } catch (e) { addToast(messageFrom(e)); } }}><Icon name="check" size={15} /></button>
                          <button title="Edit" onClick={() => setDraft({ kind: 'content', id: it.id, key: it.key || '', title: it.title || '', type: it.type || 'page', body: typeof it.body === 'string' ? it.body : JSON.stringify(it.body || '', null, 2) })}><Icon name="edit" size={15} /></button>
                        </div>
                      )}</td>
                    </tr>
                  );
                }
                if (tab === 'blog') {
                  return (
                    <tr key={it.id}>
                      <td><b>{it.title}</b>{it.excerpt && <small className="muted" style={{ display: 'block' }}>{it.excerpt}</small>}</td>
                      <td className="muted">{it.slug || '—'}</td>
                      <td><span className={'adm-pill ' + (it.status === 'published' || it.published_at ? 'ok' : 'muted')}>{it.status || (it.published_at ? 'published' : 'draft')}</span></td>
                      <td>{canManageCms && (
                        <div className="adm-rowact">
                          <button title="Publish" onClick={async () => { try { await adminContentApi.publishBlogPost(it.id); addToast('Published'); load(); } catch (e) { addToast(messageFrom(e)); } }}><Icon name="check" size={15} /></button>
                          <button title="Edit" onClick={() => setDraft({ kind: 'blog', id: it.id, title: it.title || '', slug: it.slug || '', excerpt: it.excerpt || '', body: it.content || it.body || '' })}><Icon name="edit" size={15} /></button>
                          <button className="del" title="Delete" onClick={async () => { if (!window.confirm('Delete post?')) return; try { await adminContentApi.removeBlogPost(it.id); addToast('Deleted'); load(); } catch (e) { addToast(messageFrom(e)); } }}><Icon name="trash" size={15} /></button>
                        </div>
                      )}</td>
                    </tr>
                  );
                }
                if (tab === 'media') {
                  return (
                    <tr key={it.id}>
                      <td><b>{it.name || it.filename || `Media #${it.id}`}</b></td>
                      <td className="muted">{it.mime_type || '—'}</td>
                      <td className="muted" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.url || it.path || '—'}</td>
                      <td>{canManageMedia && (
                        <div className="adm-rowact">
                          <button className="del" title="Delete" onClick={async () => { if (!window.confirm('Delete media item?')) return; try { await adminContentApi.removeMedia(it.id); addToast('Deleted'); load(); } catch (e) { addToast(messageFrom(e)); } }}><Icon name="trash" size={15} /></button>
                        </div>
                      )}</td>
                    </tr>
                  );
                }
                return (
                  <tr key={it.id || it.email}>
                    <td><b>{it.email}</b></td>
                    <td><span className={'adm-pill ' + (it.status === 'unsubscribed' ? 'muted' : 'ok')}>{it.status || 'subscribed'}</span></td>
                    <td className="muted">{it.created_at ? String(it.created_at).slice(0, 10) : '—'}</td>
                    <td>{canManageCms && (
                      <div className="adm-rowact">
                        <button className="del" title="Remove" onClick={async () => { try { await adminContentApi.removeSubscriber(it.id); addToast('Subscriber removed'); load(); } catch (e) { addToast(messageFrom(e)); } }}><Icon name="trash" size={15} /></button>
                      </div>
                    )}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pager {...pagerProps} />
        </div>
      </div>

      {draft && (
        <div className="role-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDraft(null); }}>
          <div className="role-modal">
            <div className="role-modal-h">
              <div><h3 style={{ fontSize: 18 }}>{draft.id ? 'Edit' : 'Create'} {draft.kind === 'blog' ? 'blog post' : 'content entry'}</h3></div>
              <button className="role-modal-x" onClick={() => setDraft(null)} aria-label="Close"><Icon name="close" size={18} /></button>
            </div>
            <div className="role-modal-b">
              <label className="adm-field"><span>Title</span><input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} /></label>
              {draft.kind === 'content' ? (
                <div className="adm-field-row">
                  <label className="adm-field"><span>Key</span><input value={draft.key} onChange={e => setDraft(d => ({ ...d, key: e.target.value }))} placeholder="e.g. homepage_hero" /></label>
                  <label className="adm-field"><span>Type</span><input value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))} placeholder="page / banner / faq" /></label>
                </div>
              ) : (
                <>
                  <label className="adm-field"><span>Slug (optional)</span><input value={draft.slug} onChange={e => setDraft(d => ({ ...d, slug: e.target.value }))} /></label>
                  <label className="adm-field"><span>Excerpt</span><textarea rows={2} value={draft.excerpt} onChange={e => setDraft(d => ({ ...d, excerpt: e.target.value }))} /></label>
                </>
              )}
              <label className="adm-field"><span>Body / Content</span><textarea rows={8} value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} /></label>
            </div>
            <div className="role-modal-f">
              <button className="adm-btn ghost" onClick={() => setDraft(null)} disabled={saving}>Cancel</button>
              <button className="adm-btn primary" onClick={saveDraft} disabled={saving || !draft.title.trim()}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- ROLES & ACCESS ---------- */
const ROLE_COLORS = ['#0438B6', '#2F4BDB', '#1F8A5B', '#0E9BD6', '#F67208', '#7A5AE0'];

function permKey(p) {
  return typeof p === 'string' ? p : (p?.name || p?.key || p?.slug || '');
}

function RoleDrawer({ role, permissionsList, onSaved, onClose }) {
  const addToast = useAdminToast();
  const isNew = !role?.id;
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [selectedPerms, setSelectedPerms] = useState(() => new Set((role?.permissions || []).map(permKey)));
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(!isNew);
  const [memberUserId, setMemberUserId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let active = true;
    adminRolesApi.members(role.id)
      .then(res => { if (active) setMembers(asList(res)); })
      .catch(() => {})
      .finally(() => { if (active) setLoadingMembers(false); });
    return () => { active = false; };
  }, [isNew, role?.id]);

  const togglePerm = (key) => {
    setSelectedPerms(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const saveRole = async () => {
    if (!name.trim()) { addToast('Enter a role name'); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        permissions: [...selectedPerms],
      };
      if (isNew) await adminRolesApi.create(payload);
      else await adminRolesApi.update(role.id, payload);
      addToast(isNew ? 'Role created' : `${name} updated`);
      await onSaved();
      onClose();
    } catch (error) {
      addToast(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    if (!memberUserId.trim() || isNew) return;
    try {
      await adminRolesApi.addMember(role.id, { user_id: Number(memberUserId) });
      setMemberUserId('');
      const res = await adminRolesApi.members(role.id);
      setMembers(asList(res));
      await onSaved();
      addToast('Member added to role');
    } catch (error) {
      addToast(messageFrom(error));
    }
  };

  const removeMember = async (userId) => {
    try {
      await adminRolesApi.removeMember(role.id, userId);
      setMembers(prev => prev.filter(m => m.id !== userId));
      await onSaved();
      addToast('Member removed');
    } catch (error) {
      addToast(messageFrom(error));
    }
  };

  return (
    <div className="role-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="role-modal">
        <div className="role-modal-h">
          <div className="row" style={{ gap: 12 }}>
            <span className="kpi-ic" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><Icon name="lock" size={18} /></span>
            <div>
              <h3 style={{ fontSize: 18 }}>{isNew ? 'Create role' : `Edit · ${formatRoleName(role.display_name || role.name)}`}</h3>
              <small className="muted">Configure permissions and assigned members</small>
            </div>
          </div>
          <button className="role-modal-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>

        <div className="role-modal-b">
          <label className="adm-field"><span>Role name</span><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Catalog Manager" /></label>
          <label className="adm-field"><span>Description</span><input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short summary of access scope" /></label>

          {!isNew && (
            <div className="adm-field">
              <div className="row between" style={{ marginBottom: 8 }}>
                <span>Members ({members.length})</span>
                <div className="row" style={{ gap: 6 }}>
                  <input
                    type="number"
                    min="1"
                    value={memberUserId}
                    onChange={e => setMemberUserId(e.target.value)}
                    placeholder="User ID"
                    style={{ width: 96, padding: '6px 8px', fontSize: 12.5 }}
                  />
                  <button type="button" className="adm-btn ghost" style={{ padding: '6px 10px', fontSize: 12.5 }} onClick={addMember}>
                    <Icon name="plus" size={13} /> Assign
                  </button>
                </div>
              </div>
              {loadingMembers ? <small className="muted">Loading members…</small>
                : members.length === 0 ? <div className="role-members-empty">No members assigned to this role yet.</div>
                : (
                  <div className="role-members">
                    {members.map(mem => (
                      <div className="role-member" key={mem.id}>
                        <span className="adm-li-av">{String(mem.name || mem.email || 'U').slice(0, 2).toUpperCase()}</span>
                        <div className="role-member-info"><b>{mem.name || mem.username || `User #${mem.id}`}</b><small>{mem.email}</small></div>
                        <button type="button" className="role-member-x" title="Remove member" onClick={() => removeMember(mem.id)}><Icon name="trash" size={15} /></button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          <div className="adm-field">
            <span>Permissions ({selectedPerms.size})</span>
            <div className="role-perms">
              {permissionsList.map(p => {
                const key = permKey(p);
                const on = selectedPerms.has(key);
                return (
                  <label key={key} className="role-perm">
                    <span>{p?.label || key}</span>
                    <button type="button" className={'toggle' + (on ? ' on' : '')} onClick={() => togglePerm(key)} aria-label={key} />
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="role-modal-f">
          <button className="adm-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="adm-btn primary" onClick={saveRole} disabled={saving}>{saving ? 'Saving…' : isNew ? 'Create role' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}

function InviteStaffDrawer({ roles, onInvited, onClose }) {
  const addToast = useAdminToast();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState(roles[0]?.id || '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setSaving(true);
    try {
      await adminRolesApi.inviteStaff({
        email: email.trim(),
        name: name.trim() || undefined,
        role_id: roleId ? Number(roleId) : undefined,
      });
      addToast('Staff invitation sent');
      await onInvited();
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
      <aside className="adm-drawer" role="dialog" aria-label="Invite staff member">
        <div className="adm-drawer-h">
          <div><h3>Invite staff member</h3><small className="muted">Send a role-scoped invitation email.</small></div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">
          <label className="adm-field"><span>Full name</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" /></label>
          <label className="adm-field"><span>Work email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@limitra.com.ng" /></label>
          <label className="adm-field">
            <span>Assign role</span>
            <select value={roleId} onChange={e => setRoleId(e.target.value)}>
              {roles.map(r => <option key={r.id} value={r.id}>{formatRoleName(r.display_name || r.name)}</option>)}
            </select>
          </label>
        </div>
        <div className="adm-drawer-f">
          <button className="adm-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="adm-btn primary" onClick={submit} disabled={saving || !email.trim()}>{saving ? 'Sending…' : 'Send invite'}</button>
        </div>
      </aside>
    </>
  );
}

const formatRoleName = (name) =>
  String(name || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

export function AdminRoles() {
  const addToast = useAdminToast();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [edit, setEdit] = useState(null);
  const [inviting, setInviting] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [rolesRes, permsRes, invitesRes] = await Promise.all([
        adminRolesApi.list().catch(() => []),
        adminRolesApi.permissions().catch(() => []),
        adminRolesApi.invitations().catch(() => []),
      ]);
      setRoles(asList(rolesRes));
      setPermissions(asList(permsRes));
      setInvitations(asList(invitesRes));
    } catch (error) {
      addToast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [addToast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll(); }, [loadAll]);

  const { shown: shownInvites, pagerProps: invitePager } = usePager(invitations, invitations.length);

  const deleteRole = async (role) => {
    if (!window.confirm(`Delete role “${role.name}”?`)) return;
    try {
      await adminRolesApi.remove(role.id);
      addToast('Role deleted');
      await loadAll();
    } catch (error) {
      addToast(messageFrom(error));
    }
  };

  const resendInvite = async (inv) => {
    try {
      await adminRolesApi.resendInvite(inv.id);
      addToast(`Invitation resent to ${inv.email}`);
    } catch (error) {
      addToast(messageFrom(error));
    }
  };

  const revokeInvite = async (inv) => {
    try {
      await adminRolesApi.revokeInvite(inv.id);
      addToast('Invitation revoked');
      await loadAll();
    } catch (error) {
      addToast(messageFrom(error));
    }
  };

  return (
    <>
      <AdmHead title="Roles & Access" sub="Role-based permissions and staff invitations synced with Limitra API.">
        <button className="adm-btn ghost" onClick={() => setInviting(true)} disabled={roles.length === 0}><Icon name="mail" size={15} /> Invite staff</button>
        <button className="adm-btn primary" onClick={() => setEdit('new')}><Icon name="plus" size={15} /> Add role</button>
      </AdmHead>

      <div className="prc-kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="prc-kpi accent">
          <div className="prc-kpi-top"><span>Defined Roles</span><Icon name="lock" size={15} /></div>
          <b>{loaded ? roles.length : '—'}</b>
          <small>Access profiles</small>
        </div>
        <div className="prc-kpi">
          <div className="prc-kpi-top"><span>Permissions</span><Icon name="shield" size={15} /></div>
          <b>{loaded ? permissions.length : '—'}</b>
          <small>Granular capabilities</small>
        </div>
        <div className="prc-kpi">
          <div className="prc-kpi-top"><span>Staff Invitations</span><Icon name="mail" size={15} /></div>
          <b>{loaded ? invitations.length : '—'}</b>
          <small>Pending &amp; sent invites</small>
        </div>
      </div>

      {!loaded ? (
        <div className="panel"><div className="adm-soon"><p>Loading roles &amp; permissions…</p></div></div>
      ) : (
        <div className="adm-row c3" style={{ marginBottom: 20 }}>
          {roles.map((r, i) => {
            const color = ROLE_COLORS[i % ROLE_COLORS.length];
            const memberCount = r.users_count ?? r.members_count ?? r.members?.length ?? 0;
            const permCount = r.permissions_count ?? r.permissions?.length ?? 0;
            return (
              <div className="panel" key={r.id || r.name}>
                <div className="row between">
                  <span className="kpi-ic" style={{ background: color + '22', color }}><Icon name="lock" size={18} /></span>
                  <span className="adm-pill muted">{permCount} perm{permCount === 1 ? '' : 's'}</span>
                </div>
                <h3 style={{ margin: '12px 0 4px', fontSize: 16 }}>{formatRoleName(r.display_name || r.name)}</h3>
                <p className="muted" style={{ fontSize: 13 }}>{r.description || 'Custom access role'}</p>
                <div className="row between" style={{ marginTop: 14 }}>
                  <small className="muted" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                    {memberCount} member{memberCount === 1 ? '' : 's'}
                  </small>
                  <div className="row" style={{ gap: 10 }}>
                    <button type="button" className="link-btn" onClick={() => setEdit(r)}>Edit</button>
                    {!r.is_system && <button type="button" className="link-btn" style={{ color: 'var(--red)' }} onClick={() => deleteRole(r)}>Delete</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="panel" style={{ padding: 0 }}>
        <div className="panel-h" style={{ padding: '18px 20px 10px' }}>
          <h3>Staff Invitations <span className="muted" style={{ fontWeight: 400 }}>· {invitations.length}</span></h3>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Expires</th><th></th></tr></thead>
            <tbody>
              {shownInvites.map(inv => (
                <tr key={inv.id}>
                  <td data-label="Email"><b>{inv.email}</b>{inv.name && <small style={{ display: 'block' }} className="muted">{inv.name}</small>}</td>
                  <td data-label="Role"><span className="adm-pill info">{formatRoleName(inv.role?.display_name || inv.role?.name || inv.role_name || 'Staff')}</span></td>
                  <td data-label="Status"><span className={'adm-pill ' + (inv.accepted_at ? 'ok' : 'warn')}>{inv.accepted_at ? 'Accepted' : (inv.status || 'Pending')}</span></td>
                  <td data-label="Expires" className="muted">{inv.expires_at ? new Date(inv.expires_at).toLocaleDateString('en-NG') : '—'}</td>
                  <td data-label="Actions">
                    <div className="adm-rowact">
                      {!inv.accepted_at && <button title="Resend invite" onClick={() => resendInvite(inv)}><Icon name="refresh" size={15} /></button>}
                      <button className="del" title="Revoke invite" onClick={() => revokeInvite(inv)}><Icon name="trash" size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invitations.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-faint)' }}>No staff invitations yet.</div>}
          <Pager {...invitePager} />
        </div>
      </div>

      {edit && <RoleDrawer role={edit === 'new' ? null : edit} permissionsList={permissions} onSaved={loadAll} onClose={() => setEdit(null)} />}
      {inviting && <InviteStaffDrawer roles={roles} onInvited={loadAll} onClose={() => setInviting(false)} />}
    </>
  );
}

/* ---------- REPORTS ---------- */
export function AdminReports() {
  const reports = [['Sales report', 'Revenue, AOV, refunds', 'dollar'], ['Orders report', 'All orders & statuses', 'truck'], ['Customers report', 'Acquisition & retention', 'user'], ['Affiliates report', 'Earnings & payouts', 'share'], ['Referrals report', 'Lim Cash issued', 'gift'], ['Inventory report', 'Stock movements', 'package']];
  return (
    <>
      <AdmHead title="Reports & Exports" sub="Generate and download business reports" />
      <div className="adm-row c3">
        {reports.map((r, i) => (
          <div className="panel" key={i}>
            <span className="kpi-ic" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}><Icon name={r[2]} size={18} /></span>
            <h3 style={{ margin: '12px 0 4px', fontSize: 16 }}>{r[0]}</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{r[1]}</p>
            <div className="row" style={{ gap: 8 }}><button className="adm-btn ghost" style={{ flex: 1, justifyContent: 'center' }}>CSV</button><button className="adm-btn ghost" style={{ flex: 1, justifyContent: 'center' }}>Excel</button><button className="adm-btn ghost" style={{ flex: 1, justifyContent: 'center' }}>PDF</button></div>
          </div>
        ))}
      </div>
    </>
  );
}
