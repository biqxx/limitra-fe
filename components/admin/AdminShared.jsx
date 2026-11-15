'use client';
/* Shared admin primitives + nav/dataset — ported verbatim from legacy/admin.jsx (ADMIN_NAV,
   ADMIN_ORDERS) and legacy/admin-sections.jsx (AdmHead, Pager, usePager, Toggle, AdmSelect,
   AdmDate). Also provides `useHighlight`, the query-param replacement for the legacy
   `window.__admHL` cross-page row-highlight mechanism (see AdminOrders/AdminAffiliates/
   AdminInventory, the three pages that had `data-hlkey` rows). */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/icons/Icon';
import { useAdminToast } from './AdminToastContext';
import { ADMIN_SCREEN_PERMISSIONS, hasAnyPermission } from '@/lib/auth/permissions';

// No orders-listing backend yet — stays genuinely empty rather than
// synthesizing fake orders from the product catalog.
export const ADMIN_ORDERS = [];

export const ADMIN_NAV = [
['Overview', [['dashboard', 'Dashboard', 'grid'], ['analytics', 'Analytics', 'spark']]],
['Catalog', [['products', 'Products', 'bag'], ['categories', 'Categories', 'list'], ['sourcing', 'Product sourcing', 'search'], ['sourcing-queue', 'Product queue', 'clock'], ['procurement', 'Procurement', 'package'], ['pricing', 'Pricing rules', 'dollar'], ['inventory', 'Inventory', 'package'], ['orders', 'Orders', 'truck'], ['returns', 'Returns & Refunds', 'refresh'], ['coupons', 'Coupons & Promos', 'tag'], ['delivery', 'Delivery & Shipping', 'truck'], ['reviews', 'Product Reviews', 'star']]],
['People & Stores', [['customers', 'Customers', 'user'], ['staff', 'Staff & Team', 'user'], ['affiliates', 'Affiliates', 'share'], ['referrals', 'Referrals', 'dollar'], ['microstores', 'MicroStores', 'store'], ['celebrity-stores', 'Celebrity Stores', 'star']]],
['Engagement', [['spin', 'Spin & Win', 'gift'], ['videos', 'Videos', 'video'], ['elo', 'Elo AI', 'headset']]],
['System', [['cms', 'Content', 'edit'], ['careers', 'Careers', 'user'], ['roles', 'Roles & Access', 'lock'], ['reports', 'Reports', 'download'], ['support', 'Support Tickets', 'headset'], ['activity', 'Activity Log', 'clock'], ['queues', 'Queue Monitor', 'refresh'], ['notifications', 'Notifications', 'bell'], ['mail-logs', 'Mail Logs', 'info'], ['settings', 'Settings', 'lock']]]];

export function visibleAdminNav(user) {
  return ADMIN_NAV
    .map(([grp, items]) => [
      grp,
      items.filter(([key]) => {
        const req = ADMIN_SCREEN_PERMISSIONS[key];
        return !req || hasAnyPermission(user, req);
      }),
    ])
    .filter(([, items]) => items.length > 0);
}

/* ---------- shared bits ---------- */
export function AdmHead({ title, sub, children }) {
  return <div className="adm-h"><div><h1>{title}</h1><p>{sub}</p></div><div className="adm-h-actions">{children}</div></div>;
}

export function SkeletonRows({ rows = 5 }) {
  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="row" style={{ gap: 12 }}>
          <div className="adm-skel" style={{ width: 38, height: 38, borderRadius: 8, flex: 'none' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="adm-skel" style={{ width: `${55 + (i % 3) * 14}%`, height: 13 }} />
            <div className="adm-skel" style={{ width: `${30 + (i % 2) * 15}%`, height: 10 }} />
          </div>
          <div className="adm-skel" style={{ width: 72, height: 22, borderRadius: 99 }} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title = 'Nothing here yet', description, action }) {
  return (
    <div className="adm-empty">
      <div className="adm-empty-ic"><Icon name={icon} size={22} /></div>
      <h4>{title}</h4>
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function Pager({ page, pages, onPage, perPage, onPerPage, total }) {
  // windowed page list with ellipsis: 1 … (p-1) p (p+1) … last
  const nums = [];
  const push = (n) => { if (!nums.includes(n) && n >= 1 && n <= pages) nums.push(n); };
  push(1); push(2);
  push(page - 1); push(page); push(page + 1);
  push(pages - 1); push(pages);
  const seq = [...new Set(nums)].sort((a, b) => a - b);
  const withGaps = [];
  seq.forEach((n, i) => {
    if (i > 0 && n - seq[i - 1] > 1) withGaps.push('…');
    withGaps.push(n);
  });
  return (
    <div className="adm-pager-wrap">
      {onPerPage && (
        <div className="adm-per-page">
          <span>Rows:</span>
          <select value={perPage} onChange={e => onPerPage(Number(e.target.value))} aria-label="Rows per page">
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {typeof total === 'number' && (
            <small className="muted">
              {total === 0 ? '0 items' : `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total}`}
            </small>
          )}
        </div>
      )}
      <div className="adm-pager">
        <button className="pg" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon name="chevleft" size={16} /></button>
        {withGaps.map((n, i) => n === '…'
          ? <span key={'g' + i} className="pg-gap">…</span>
          : <button key={n} className={'pg' + (page === n ? ' on' : '')} onClick={() => onPage(n)}>{n}</button>)}
        <button className="pg" disabled={page >= pages} onClick={() => onPage(page + 1)}><Icon name="chevright" size={16} /></button>
      </div>
    </div>
  );
}

export function usePager(list, q, extra, initialPer = 10) {
  const [pg, setPg] = useState(1);
  const [per, setPer] = useState(initialPer);
  const pages = Math.max(1, Math.ceil(list.length / per));
  const cur = Math.min(pg, pages);
  useEffect(() => { setPg(1); }, [q, extra, per]);
  return {
    shown: list.slice((cur - 1) * per, cur * per),
    page: cur,
    pages,
    setPage: setPg,
    perPage: per,
    setPerPage: setPer,
    total: list.length,
    pagerProps: { page: cur, pages, onPage: setPg, perPage: per, onPerPage: setPer, total: list.length },
  };
}

export function Toggle({ defaultOn, locked }) {
  const [on, setOn] = useState(!!defaultOn);
  const addToast = useAdminToast();
  return <button className={'toggle' + (on ? ' on' : '') + (locked ? ' locked' : '')} onClick={() => { if (!locked) setOn(o => !o); else addToast('This control is locked for security'); }} aria-label="Toggle" title={locked ? 'Locked' : ''}>{locked && <Icon name="lock" size={11} />}</button>;
}

export function AdmDate({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const init = value ? new Date(value + 'T00:00:00') : new Date();
  const [view, setView] = useState({ y: init.getFullYear(), m: init.getMonth() });
  const ref = useRef(null);
  const trigRef = useRef(null);
  const openCal = () => setOpen(o => !o);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const MN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const first = new Date(view.y, view.m, 1).getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const sel = value ? new Date(value + 'T00:00:00') : null;
  const isSel = (d) => sel && sel.getFullYear() === view.y && sel.getMonth() === view.m && sel.getDate() === d;
  const today = new Date();
  const isToday = (d) => today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d;
  const pick = (d) => { const mm = String(view.m + 1).padStart(2, '0'); const dd = String(d).padStart(2, '0'); onChange(`${view.y}-${mm}-${dd}`); setOpen(false); };
  const shift = (n) => setView(v => { let m = v.m + n, y = v.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } return { y, m }; });
  const label = value ? new Date(value + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return (
    <div className={'adm-sel adm-date' + (open ? ' open' : '')} ref={ref}>
      <button type="button" ref={trigRef} className="adm-sel-trigger" onClick={openCal}>
        <span style={value ? null : { color: 'var(--text-faint)' }}>{label || placeholder || 'Select date'}</span><Icon name="clock" size={15} className="adm-sel-chev" />
      </button>
      {open && (
        <div className="adm-cal" role="dialog">
          <div className="adm-cal-h">
            <button type="button" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="chevleft" size={16} /></button>
            <b>{MN[view.m]} {view.y}</b>
            <button type="button" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevright" size={16} /></button>
          </div>
          <div className="adm-cal-grid">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="adm-cal-dow">{d}</span>)}
            {Array.from({ length: first }).map((_, i) => <span key={'e' + i} />)}
            {Array.from({ length: days }).map((_, i) => {
              const d = i + 1;
              return <button type="button" key={d} className={'adm-cal-day' + (isSel(d) ? ' on' : '') + (isToday(d) ? ' today' : '')} onClick={() => pick(d)}>{d}</button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdmSelect({ value, options, onChange, creatable, onCreate, compact, icon, title }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState('');
  const [coords, setCoords] = useState(null);
  const ref = useRef(null);
  const trigRef = useRef(null);
  const popRef = useRef(null);
  const place = () => {
    if (!trigRef.current) return;
    const r = trigRef.current.getBoundingClientRect();
    if (compact) { const w = 208; setCoords({ left: Math.max(8, r.right - w), top: r.bottom + 5, width: w }); }
    else setCoords({ left: r.left, top: r.bottom + 5, width: r.width });
  };
  useEffect(() => {
    if (!open) return;
    const onScroll = () => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const popH = popRef.current?.offsetHeight || 220;
      const up = window.innerHeight - r.bottom < popH + 16 && r.top > popH + 16;
      setPos({ left: r.left, width: r.width, top: up ? r.top - 6 : r.bottom + 6, up });
    };
    onScroll();
    const onDoc = (e) => {
      if ((ref.current && ref.current.contains(e.target)) || (popRef.current && popRef.current.contains(e.target))) return;
      setOpen(false); setAdding(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setAdding(false); } };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); };
  }, [open]);
  const norm = options.map(o => typeof o === 'string' ? { value: o, label: o } : o);
  const cur = norm.find(o => o.value === value) || norm[0];
  const commit = () => {
    const name = nv.trim();
    if (!name) { setAdding(false); return; }
    onCreate && onCreate(name);
    setNv(''); setAdding(false); setOpen(false);
  };
  return (
    <div className={'adm-sel' + (open ? ' open' : '') + (compact ? ' compact' : '')} ref={ref}>
      <button type="button" ref={trigRef} className="adm-sel-trigger" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open} title={title || (cur ? cur.label : '')}>
        {compact
          ? <><Icon name={icon || 'sort'} size={16} /><Icon name="chevdown" size={13} className="adm-sel-chev" /></>
          : <><span>{cur ? cur.label : 'Select…'}</span><Icon name="chevdown" size={15} className="adm-sel-chev" /></>}
      </button>
      {open && coords && typeof document !== 'undefined' && createPortal(
          <div ref={popRef} className="adm-sel-pop fixed" role="listbox" style={{ position: 'fixed', left: coords.left, top: coords.top, width: coords.width, maxHeight: `min(260px, calc(100vh - ${Math.round(coords.top + 12)}px))`, overflowY: 'auto' }}>
            {compact && title && <div className="adm-sel-title">{title}</div>}
            {norm.map(o => (
              <button type="button" key={o.value} role="option" aria-selected={o.value === value}
                className={'adm-sel-opt' + (o.value === value ? ' on' : '')}
                onClick={() => { onChange(o.value); setOpen(false); }}>
                {o.label}{o.value === value && <Icon name="check" size={15} stroke={3} />}
              </button>
            ))}
            {creatable && (adding ? (
              <div className="adm-sel-create">
                <input autoFocus value={nv} onChange={e => setNv(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') setAdding(false); }} placeholder="New category name" />
                <button type="button" className="adm-sel-add" onClick={commit} aria-label="Add"><Icon name="check" size={15} stroke={3} /></button>
              </div>
            ) : (
              <button type="button" className="adm-sel-opt create" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> New category</button>
            ))}
          </div>,
          document.body
      )}
    </div>
  );
}

/* ---------- highlight-on-navigate (replaces legacy `window.__admHL`) ----------
   AdminShell used to set `window.__admHL = {page, match, ts}` on a notification click and
   poll for `[data-hlkey]` on the destination page. Now the destination path carries
   `?highlight=<match>` (see app/admin/layout.js's notification click handler) and each page
   that has `data-hlkey` rows (AdminOrders, AdminAffiliates, AdminInventory) calls this hook
   with `useSearchParams().get('highlight')`. */
export function useHighlight(match) {
  useEffect(() => {
    if (!match) return;
    let tries = 0;
    let id;
    const run = () => {
      const rows = document.querySelectorAll('.adm-body [data-hlkey]');
      let hit = null;
      rows.forEach(r => { if (!hit && (r.getAttribute('data-hlkey') || '').toLowerCase().includes(match.toLowerCase())) hit = r; });
      if (hit) {
        hit.classList.add('row-flash');
        try { hit.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
        setTimeout(() => hit.classList.remove('row-flash'), 2600);
      } else if (tries++ < 8) { id = setTimeout(run, 120); }
    };
    id = setTimeout(run, 160);
    return () => clearTimeout(id);
  }, [match]);
}
