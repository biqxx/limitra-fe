'use client';
/* Admin app shell — ported from legacy/admin-app.jsx's `AdminShell` (sidebar, topbar,
   notifications, account dropdown, theme toggle, mobile collapse). Unlike the legacy version
   this is no longer a `page`/`PAGES` switch that renders `<Page />` itself — routing is real
   now, so `{children}` is the matched /admin/* route. Two mechanisms from the legacy global
   scope were replaced with real primitives (see components/admin/AdminToastContext.jsx and
   components/admin/AdminShared.jsx's `useHighlight`):
     - `window.admToast`            -> AdminToastProvider / useAdminToast()
     - `window.__admHL` (notif nav) -> `?highlight=<match>` query param, read by the
                                        destination page via useSearchParams()
   NOTE: CSS previously lived under legacy/ (per admin.html's <link> tags: styles.css,
   admin.css) but has since been relocated to /styles by another workstream. styles.css is
   already imported globally by the root app/layout.js, so only admin.css is imported here
   (same convention app/affiliate/dashboard/layout.js uses for its own admin.css + extra). */
import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import '@/styles/admin.css';
import { Icon } from '@/components/icons/Icon';
import { visibleAdminNav } from '@/components/admin/AdminShared';
import { AdminToastProvider } from '@/components/admin/AdminToastContext';
import { StoreProvider, useStore } from '@/components/store/StoreProvider';
import { canAccessAdminRoute, firstPermittedAdminPath, hasAnyAdminAccess, routeKeyFromPath } from '@/lib/auth/permissions';

const pathForKey = (key) => '/admin' + (key === 'dashboard' ? '' : '/' + key);

/* /admin isn't under the (site) route group, so it has no StoreProvider of its
   own by default — this layout mounts one just for the admin tree so the route
   guard and the account menu can read the real signed-in session instead of the
   old `lim_admin` localStorage stand-in. */
export default function AdminLayout({ children }) {
  return (
    <Suspense fallback={null}>
      <StoreProvider>
        <AdminShell>{children}</AdminShell>
      </StoreProvider>
    </Suspense>
  );
}

function AdminShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, authLoading, logout, theme, toggleTheme } = useStore();

  /* route guard — strictly permission-based via user.permissions (authApi.me()).
     Wait for authLoading so a permitted user isn't bounced during hydration. */
  const allowedAdmin = isAuthenticated && hasAnyAdminAccess(user);
  const allowedRoute = allowedAdmin && canAccessAdminRoute(user, pathname);

  useEffect(() => {
    if (authLoading) return;
    if (!allowedAdmin) {
      router.replace('/access-denied?need=admin');
      return;
    }
    if (!allowedRoute) {
      const fallback = firstPermittedAdminPath(user);
      if (pathname === '/admin' && fallback !== '/admin') {
        router.replace(fallback);
      } else {
        router.replace('/access-denied?need=' + encodeURIComponent(routeKeyFromPath(pathname)));
      }
    }
  }, [authLoading, allowedAdmin, allowedRoute, pathname, user, router]);

  const [collapsed, setCollapsed] = useState(false);
  const [mobOpen, setMobOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  useEffect(() => {
    if (!notifOpen) return;
    const onDoc = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setNotifOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [notifOpen]);

  const [acctOpen, setAcctOpen] = useState(false);

  // No notifications backend yet — starts empty rather than showing fake activity.
  const [notifs, setNotifs] = useState([]);

  const adminName = user?.username || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'Admin';
  const primaryRole = user?.roles?.[0]?.display_name || user?.roles?.[0]?.name || user?.role || 'Staff';
  const adm = {
    name: adminName,
    role: String(primaryRole).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    initials: adminName.slice(0, 2).toUpperCase(),
    email: user?.email || '',
  };

  if (authLoading || !allowedAdmin || !allowedRoute) return null;

  const unread = notifs.filter(n => !n.read).length;
  const counts = { orders: 0, affiliates: 0 };
  const navGroups = visibleAdminNav(user);

  const goTo = (key) => {
    const target = pathForKey(key);
    if (target !== pathname && typeof window !== 'undefined') window.dispatchEvent(new Event('lim:nav-start'));
    router.push(target);
    setMobOpen(false);
  };
  const notifClick = (i, nf) => {
    setNotifs(ns => ns.map((x, j) => j === i ? { ...x, read: true } : x));
    if (nf.go) {
      const target = pathForKey(nf.go);
      router.push(nf.match ? target + '?highlight=' + encodeURIComponent(nf.match) : target);
      setMobOpen(false);
    }
    setNotifOpen(false);
  };
  const signOut = async () => {
    try { await logout(); } catch (e) {}
    window.location.href = '/';
  };

  return (
    <AdminToastProvider>
      <div className={'adm' + (collapsed ? ' collapsed' : '') + (mobOpen ? ' mobopen' : '')}>
        {mobOpen && <div className="adm-scrim" onClick={() => setMobOpen(false)} />}
        <aside className="adm-side">
          <div className="adm-brand">
            <img src="/assets/logo.png" alt="Limitra" />
            <span className="adm-badge">Admin</span>
            <button className="adm-collapse-btn" onClick={() => setCollapsed(c => !c)} aria-label="Collapse sidebar" title="Collapse sidebar"><Icon name="chevleft" size={17} /></button>
          </div>
          <nav className="adm-nav">
            {navGroups.map(([grp, items]) => (
              <div key={grp}>
                <div className="adm-nav-grp">{grp}</div>
                {items.map(([key, label, ic]) => {
                  const base = pathForKey(key);
                  const on = key === 'dashboard'
                    ? pathname === base
                    : pathname === base || pathname.startsWith(base + '/');
                  return (
                    <button key={key} className={'adm-link' + (on ? ' on' : '')} onClick={() => goTo(key)} title={label}>
                      <Icon name={ic} size={18} /><span>{label}</span>
                      {counts[key] ? <span className="adm-count">{counts[key]}</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <div className="adm-main">
          <div className="adm-top">
            <button className="adm-burger" onClick={() => { if (window.matchMedia('(max-width: 860px)').matches) setMobOpen(o => !o); else setCollapsed(c => !c); }} aria-label="Toggle menu"><Icon name="menu" size={20} /></button>
            <div className="adm-top-actions">
              <Link className="adm-icon-btn" href="/" title="View store"><Icon name="store" size={19} /></Link>
              <button className="adm-icon-btn" onClick={toggleTheme} title="Theme"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} /></button>
              <div className="adm-notif-wrap" ref={notifRef}>
                <button className={'adm-icon-btn' + (notifOpen ? ' on' : '')} onClick={() => setNotifOpen(o => !o)} title="Notifications"><Icon name="bell" size={19} />{unread > 0 && <span className="adm-dot" />}</button>
                {notifOpen && (
                  <>
                    <div className="adm-notif-scrim" onClick={() => setNotifOpen(false)} />
                    <div className="adm-notif" role="menu">
                      <div className="adm-notif-h"><b>Notifications</b><button className="link-btn" onClick={() => setNotifs(ns => ns.map(n => ({ ...n, read: true })))}>Mark all read</button></div>
                      <div className="adm-notif-list">
                        {notifs.length === 0
                          ? <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 13.5 }}>No notifications yet.</div>
                          : notifs.map((nf, i) => (
                          <button key={i} className={'adm-notif-item' + (nf.read ? '' : ' unread')} onClick={() => notifClick(i, nf)}>
                            <span className={'adm-notif-ic ' + nf.tint}><Icon name={nf.ic} size={15} /></span>
                            <div className="adm-notif-txt"><b>{nf.title}</b><small>{nf.body}</small><span className="adm-notif-time">{nf.time}</span></div>
                            {!nf.read && <span className="adm-notif-unread" />}
                          </button>
                        ))}
                      </div>
                      <div className="adm-notif-f"><a onClick={() => { setNotifOpen(false); router.push('/admin/activity'); }} style={{ cursor: 'pointer' }}>View all activity</a></div>
                    </div>
                  </>
                )}
              </div>
              <div className="adm-acct-wrap">
                <button className="adm-avatar" onClick={() => setAcctOpen(o => !o)}>{adm.initials}</button>
                {acctOpen && (
                  <>
                    <div className="adm-notif-scrim" onClick={() => setAcctOpen(false)} />
                    <div className="adm-acct" role="menu">
                      <div className="adm-acct-head"><span className="adm-avatar" style={{ width: 42, height: 42 }}>{adm.initials}</span><div><b>{adm.name}</b><small>{adm.email}</small></div></div>
                      <div className="adm-acct-role"><span className="adm-pill info">{adm.role}</span></div>
                      <button className="adm-acct-item" onClick={() => { router.push('/admin/roles'); setAcctOpen(false); }}><Icon name="lock" size={16} /> Roles &amp; access</button>
                      <button className="adm-acct-item" onClick={() => { router.push('/admin/cms'); setAcctOpen(false); }}><Icon name="edit" size={16} /> Website settings</button>
                      <button className="adm-acct-item danger" onClick={signOut}><Icon name="lock" size={16} /> Sign out</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="adm-body" onClick={(e) => { const go = e.target.closest('[data-go]'); if (go) goTo(go.getAttribute('data-go')); }}>
            <Suspense fallback={null}>{children}</Suspense>
          </div>
        </div>
      </div>
    </AdminToastProvider>
  );
}
