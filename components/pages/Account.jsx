'use client';
/* LIMITRA, Account, Wishlist, Order Tracking, Help — ported from legacy/pages-account.jsx */
import { useState, useEffect } from 'react';
import { Icon } from '@/components/icons/Icon';
import { useStore } from '@/components/store/StoreProvider';
import { SocialMark } from '@/components/ui/SocialMark';
import { Breadcrumbs, EmptyState, ProductCard } from '@/components/ui/Shared';
import { Modal, AddressForm, CardForm, CardBrandMark, Field } from '@/components/forms/Shared';
import { naira, SOCIAL_GLYPHS, byId } from '@/lib/data';
import { profileApi, ordersApi, favoritesApi, sharedWishlistsApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';

// GET /orders and /orders/{id} have no documented response shape (generic
// SuccessResponse) — every field below is read defensively under several
// plausible names. Only the `status` enum is confirmed by the spec itself:
// pending_payment, confirmed, processing, shipped, in_transit, delivered,
// cancelled.
const STATUS_LABEL = {
  pending_payment: 'Pending payment', confirmed: 'Confirmed', processing: 'Processing',
  shipped: 'Shipped', in_transit: 'In transit', delivered: 'Delivered', cancelled: 'Cancelled',
};
const STATUS_TINT = {
  pending_payment: 'warn', confirmed: 'info', processing: 'warn',
  shipped: 'info', in_transit: 'info', delivered: 'ok', cancelled: 'bad',
};

function normalizeOrder(o) {
  const items = o.items ?? o.order_items ?? o.line_items;
  const itemCount = o.items_count ?? o.item_count
    ?? (Array.isArray(items) ? items.reduce((s, it) => s + Number(it.quantity ?? it.qty ?? 1), 0) : null)
    ?? 0;
  const status = String(o.status ?? 'pending_payment').toLowerCase();
  return {
    id: o.id ?? o.order_id ?? o.order_number,
    status,
    date: o.created_at ?? o.date ?? o.placed_at,
    itemCount,
    total: Number(o.total ?? o.total_amount ?? o.grand_total ?? o.amount ?? 0),
    raw: o,
  };
}

// Shared by Dashboard, Orders and TrackingPage — each fetches independently
// since they need different filters, not shared state.
function useOrders(params) {
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const key = JSON.stringify(params || {});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await ordersApi.list(params);
        const list = Array.isArray(res) ? res : (res?.data ?? res?.items ?? res?.orders ?? []);
        if (!cancelled) setOrders((Array.isArray(list) ? list : []).map(normalizeOrder));
      } catch (e) {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { orders, loaded };
}

function displayName(user) {
  if (!user) return '';
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || user.email || '';
}
function initialsFor(user) {
  const name = displayName(user);
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const ACCT_TABS = [
  ['dashboard', 'Dashboard', 'grid'],
  ['orders', 'My orders', 'package'],
  ['tracking', 'Track order', 'truck'],
  ['wishlist', 'Wishlist', 'heart'],
  ['referrals', 'Refer & earn', 'spark'],
  ['rewards', 'My rewards', 'gift'],
  ['addresses', 'Addresses', 'location'],
  ['payments', 'Payment methods', 'card'],
  ['profile', 'Profile settings', 'user'],
];

function AccountShell({ active, children }) {
  const { go, user, isAuthenticated, authLoading, logout } = useStore();
  const [navOpen, setNavOpen] = useState(false);
  const activeTab = ACCT_TABS.find(t => t[0] === active);

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="page page-fade"><div className="wrap">
        <Breadcrumbs items={[{ label: 'Home', to: ['home'] }, { label: 'My account' }]} />
        <EmptyState icon="user" title="Sign in to view your account" body="Your orders, addresses, wishlist and settings live here once you're signed in." action="Sign in" onAction={() => go('auth', 'signin')} />
      </div></div>
    );
  }

  const signOut = async () => { await logout(); go('auth', 'signin'); };

  return (
    <div className="page page-fade"><div className="wrap">
      <Breadcrumbs items={[{ label: 'Home', to: ['home'] }, { label: 'My account' }]} />
      <div className="acct-layout">
        <aside className={'acct-side' + (navOpen ? ' nav-open' : '')}>
          <div className="acct-user">
            <span className="acct-avatar">{initialsFor(user)}</span>
            <div><b>{displayName(user)}</b><small className="muted">@{user.username || user.email}</small></div>
          </div>
          <button type="button" className="acct-nav-toggle" onClick={() => setNavOpen(o => !o)} aria-expanded={navOpen}>
            <span><Icon name={activeTab ? activeTab[2] : 'grid'} size={18} /> {activeTab ? activeTab[1] : 'Menu'}</span>
            <Icon name="chevdown" size={18} />
          </button>
          <nav className="acct-nav">
            {ACCT_TABS.map(([key, label, ic]) => (
              <button key={key} className={'acct-link' + (active === key ? ' on' : '')} onClick={() => { setNavOpen(false); go(key === 'tracking' ? 'tracking' : key === 'wishlist' ? 'wishlist' : 'account', key === 'dashboard' || key === 'wishlist' || key === 'tracking' ? undefined : key); }}>
                <Icon name={ic} size={18} /> {label}
              </button>
            ))}
            <button className="acct-link signout" onClick={signOut}><Icon name="lock" size={18} /> Sign out</button>
          </nav>
        </aside>
        <div className="acct-main">{children}</div>
      </div>
    </div></div>
  );
}

function StatusPill({ status }) {
  return <span className={'status-pill ' + (STATUS_TINT[status] || 'info')}>{STATUS_LABEL[status] || status}</span>;
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Dashboard() {
  const { go, wish, referral, user } = useStore();
  const { orders, loaded } = useOrders();
  const stats = [
    ['package', 'Total orders', orders.length, 'orders'],
    ['truck', 'In transit', orders.filter(o => o.status === 'in_transit' || o.status === 'shipped').length, 'orders'],
    ['heart', 'Wishlist', wish.length, 'wishlist'],
    ['limcash', 'Lim Cash', naira(referral.credit), 'referrals'],
  ];
  const firstName = (displayName(user).split(' ')[0]) || 'there';
  const recent = orders.slice(0, 3);
  return (
    <>
      <div className="acct-welcome">
        <div><h1 style={{ fontSize: 26 }}>Welcome back, {firstName} 👋</h1><p className="muted">Here’s what’s happening with your account.</p></div>
      </div>
      <div className="stat-grid">
        {stats.map(([ic, label, val, route]) => (
          <button key={label} className="stat-card" onClick={() => route && go(route === 'orders' ? 'orders' : route)}>
            <span className="stat-ic">{ic === 'limcash' ? <img src="/assets/limcash.png" alt="Lim Cash" className="limcash-ic" /> : <Icon name={ic} size={20} />}</span>
            <span className="stat-val">{val}</span>
            <span className="stat-lbl">{label}</span>
          </button>
        ))}
      </div>

      <div className="acct-panel">
        <div className="row between" style={{ marginBottom: 16 }}><h3>Recent orders</h3><button className="link-btn" onClick={() => go('orders')}>View all</button></div>
        {!loaded ? <p className="muted" style={{ fontSize: 14 }}>Loading orders…</p> : recent.length === 0
          ? <p className="muted" style={{ fontSize: 14 }}>No orders yet.</p>
          : <OrderList orders={recent} />}
      </div>
    </>
  );
}

function OrderList({ orders }) {
  const { go } = useStore();
  return (
    <div className="order-list">
      {orders.map(o => (
        <div className="order-row" key={o.id}>
          <div className="or-main">
            <div className="or-id"><b>{o.id}</b><StatusPill status={o.status} /></div>
            <span className="muted" style={{ fontSize: 13 }}>{fmtDate(o.date)} · {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}</span>
          </div>
          <div className="or-meta">
            <b>{naira(o.total)}</b>
          </div>
          <div className="or-actions">
            {o.status !== 'cancelled' && <button className="btn btn-outline btn-sm" onClick={() => go('tracking', o.id)}><Icon name="truck" size={15} /> Track</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => go('shop', 'all')}>Buy again</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Orders() {
  const [filter, setFilter] = useState('all');
  const { orders, loaded } = useOrders();
  const tabs = [['all', 'All'], ['active', 'Active'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
  const list = filter === 'all' ? orders
    : filter === 'active' ? orders.filter(o => !['delivered', 'cancelled'].includes(o.status))
    : orders.filter(o => o.status === filter);
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 18 }}>My orders</h1>
      <div className="pill-tabs">
        {tabs.map(([v, l]) => <button key={v} className={'pill-tab' + (filter === v ? ' on' : '')} onClick={() => setFilter(v)}>{l}</button>)}
      </div>
      {!loaded ? <p className="muted">Loading orders…</p> : list.length === 0
        ? <EmptyState icon="package" title="No orders here" body="Nothing to show for this filter yet." />
        : <div className="acct-panel"><OrderList orders={list} /></div>}
    </>
  );
}

function Addresses() {
  const { addresses, addressesLoading, saveAddress, removeAddress, setPrimaryAddress } = useStore();
  const [editing, setEditing] = useState(null); // address obj or 'new' or null
  const close = () => setEditing(null);
  // GET /addresses has no documented response shape at all — read defensively
  // under both the line1/line2 names the live create/update validation
  // actually wants and the address_line_1/2 names POST/PUT's (apparently
  // stale) docs show, in case a saved address comes back under either.
  const addressLine = (a) => [a.line1 ?? a.address_line_1, a.line2 ?? a.address_line_2].filter(Boolean).join(', ');
  return (
    <>
      <div className="row between" style={{ marginBottom: 18 }}><h1 style={{ fontSize: 26 }}>Saved addresses</h1><button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Add address</button></div>
      {addressesLoading ? (
        <div className="muted" style={{ padding: '40px 0', textAlign: 'center' }}>Loading addresses…</div>
      ) : addresses.length === 0 ? (
        <EmptyState icon="location" title="No saved addresses" body="Add a delivery address to speed up checkout." action="Add address" onAction={() => setEditing('new')} />
      ) : (
        <div className="addr-grid">
          {addresses.map(a => (
            <div key={a.id} className={'addr-card card' + (a.is_default ? ' primary' : '')}>
              <div className="row between">
                <span className="addr-label"><Icon name="location" size={15} /> {a.type === 'billing' ? 'Billing' : 'Delivery'}</span>
                {a.is_default && <span className="badge badge-soft">Default</span>}
              </div>
              {a.recipient_name && <p style={{ marginBottom: 2 }}><b>{a.recipient_name}</b>{a.phone && <span className="muted"> · {a.phone}</span>}</p>}
              <p><b>{addressLine(a)}</b><br />{a.city}{a.state ? ', ' + a.state : ''}{a.postal_code ? ' ' + a.postal_code : ''}{a.landmark && <><br /><span className="muted">Near {a.landmark}</span></>}</p>
              <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(a)}><Icon name="edit" size={14} /> Edit</button>
                {!a.is_default && <button className="btn btn-outline btn-sm" onClick={() => setPrimaryAddress(a.id)}>Set as default</button>}
                {!a.is_default && <button className="btn btn-ghost btn-sm danger" onClick={() => removeAddress(a.id)}><Icon name="trash" size={14} /></button>}
              </div>
            </div>
          ))}
          <button className="addr-add" onClick={() => setEditing('new')}><Icon name="plus" size={26} /><span>Add new address</span></button>
        </div>
      )}
      {editing && (
        <Modal title={editing === 'new' ? 'Add a new address' : 'Edit address'} sub="Where should we deliver your orders?" onClose={close}>
          <AddressForm initial={editing === 'new' ? null : editing} onSave={async d => { await saveAddress(d); close(); }} onCancel={close} />
        </Modal>
      )}
    </>
  );
}

function Payments() {
  const { cards, saveCard, removeCard, setPrimaryCard, user } = useStore();
  const [editing, setEditing] = useState(null);
  const close = () => setEditing(null);
  return (
    <>
      <div className="row between" style={{ marginBottom: 18 }}><h1 style={{ fontSize: 26 }}>Payment methods</h1><button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Add card</button></div>
      <div className="pay-cards">
        {cards.map(c => (
          <div key={c.id} className={'pay-card' + (c.brand === 'Visa' ? ' visa' : c.brand === 'Mastercard' ? ' mc' : ' other')}>
            <div className="row between"><CardBrandMark brand={c.brand} />{c.primary && <span className="pay-default">Default</span>}</div>
            <div className="pay-num">•••• •••• •••• {c.last}</div>
            <div className="row between pay-foot"><span>{c.name || displayName(user)}</span><span>{c.exp}</span></div>
            <div className="pay-actions">
              <button className="pay-act" onClick={() => setEditing(c)} title="Edit card"><Icon name="edit" size={15} /></button>
              {!c.primary && <button className="pay-act" onClick={() => setPrimaryCard(c.id)} title="Set as default"><Icon name="check" size={15} stroke={3} /></button>}
              {!c.primary && <button className="pay-act" onClick={() => removeCard(c.id)} title="Remove card"><Icon name="trash" size={15} /></button>}
            </div>
          </div>
        ))}
        <button className="addr-add" onClick={() => setEditing('new')} style={{ minHeight: 168 }}><Icon name="plus" size={26} /><span>Add new card</span></button>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 18, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="lock" size={15} /> Your payment information is encrypted and stored securely.</p>
      {editing && (
        <Modal title={editing === 'new' ? 'Add a new card' : 'Edit card'} sub="Cards are stored securely for faster checkout." width={460} onClose={close}>
          <CardForm initial={editing === 'new' ? null : editing} onSave={d => { saveCard(d); close(); }} onCancel={close} />
        </Modal>
      )}
    </>
  );
}

function Profile() {
  const { toast, go, user, refreshUser } = useStore();
  const [f, setF] = useState({ name: displayName(user), username: user?.username || '', email: user?.email || '', phone: user?.phone || '' });
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState({
    app: { connected: true, value: 'iPhone · this device' },
    email: { connected: true, value: user?.email || '' },
    WhatsApp: { connected: !!user?.phone, value: user?.phone || '' },
    Facebook: { connected: false, value: '' },
    Instagram: { connected: false, value: '' },
    X: { connected: false, value: '' },
  });
  const saveProfile = async () => {
    setSaving(true);
    const [first_name, ...rest] = f.name.trim().split(/\s+/);
    try {
      await profileApi.update({ first_name: first_name || undefined, last_name: rest.join(' ') || undefined, phone: f.phone || undefined });
      await refreshUser();
      toast('Profile saved');
    } catch (e) {
      toast(messageFrom(e), 'error');
    } finally {
      setSaving(false);
    }
  };
  const CH_META = {
    app:       { name: 'Mobile App', glyph: false, icon: 'phone', cls: 'app', ph: '', note: 'Shop, track & get notifications' },
    email:     { name: 'Email', glyph: false, icon: 'mail', cls: 'email', ph: 'you@email.com', note: 'Support & notifications' },
    WhatsApp:  { name: 'WhatsApp', glyph: true, cls: 'whatsapp', ph: '+234 800 000 0000', note: 'Shop & support via Elo AI' },
    Facebook:  { name: 'Facebook', glyph: true, cls: 'facebook', ph: 'facebook.com/yourpage', note: 'Shop & support via Elo AI' },
    Instagram: { name: 'Instagram', glyph: true, cls: 'instagram', ph: '@yourhandle', note: 'Shop & support via Elo AI' },
    X:         { name: 'X (Twitter)', glyph: true, cls: 'x', ph: '@yourhandle', note: 'Shop & support via Elo AI' },
  };
  const toggleCh = (k) => setChannels(s => ({ ...s, [k]: { ...s[k], connected: !s[k].connected } }));
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 18 }}>Profile settings</h1>
      <div className="acct-panel" style={{ maxWidth: 560 }}>
        <div className="row" style={{ gap: 16, marginBottom: 24 }}>
          <span className="acct-avatar" style={{ width: 64, height: 64, fontSize: 24 }}>{initialsFor(user)}</span>
          <div><b style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{f.name}</b><div className="muted" style={{ fontSize: 13 }}>@{f.username}</div><button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>Change photo</button></div>
        </div>
        <div className="form-grid">
          <Field label="Full name" full value={f.name} onChange={v => setF(s => ({ ...s, name: v }))} />
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Username</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center', padding: 0, overflow: 'hidden' }}>
              <span style={{ padding: '0 0 0 14px', color: 'var(--text-faint)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>@</span>
              <input value={f.username} onChange={e => setF(s => ({ ...s, username: e.target.value.replace(/[^a-z0-9_.]/gi, '').toLowerCase() }))} style={{ flex: 1, border: 'none', outline: 'none', background: 'none', padding: '13px 14px 13px 4px' }} placeholder="lucylimitra" />
            </div>
            <span className="muted" style={{ fontSize: 12, marginTop: 5, display: 'block' }}>limitra.ng/@{f.username || 'username'}</span>
          </div>
          <Field label="Email address" full value={f.email} onChange={v => setF(s => ({ ...s, email: v }))} />
          <Field label="Phone number" full value={f.phone} onChange={v => setF(s => ({ ...s, phone: v }))} />
        </div>
        <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={saving} onClick={saveProfile}>{saving ? 'Saving…' : 'Save changes'}</button>
      </div>
      <div className="acct-panel" style={{ maxWidth: 560, marginTop: 20 }}>
        <div className="row between" style={{ marginBottom: 4, alignItems: 'flex-start' }}>
          <h3 style={{ marginBottom: 4 }}>Connected channels</h3>
          <button className="link-btn" onClick={() => go('channels')}>How it works</button>
        </div>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 18 }}>Link your channels to one account so your cart, wishlist and orders stay in sync everywhere you shop.</p>
        <div className="chan-links">
          {Object.keys(CH_META).map(k => {
            const m = CH_META[k]; const c = channels[k];
            return (
              <div key={k} className={'chan-row ' + m.cls + (c.connected ? ' on' : '')}>
                <span className="chan-ic">{m.glyph ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={SOCIAL_GLYPHS[k]} /></svg> : <Icon name={m.icon} size={18} />}</span>
                <div className="chan-info">
                  <b>{m.name}</b>
                  <small className="muted">{c.connected && c.value ? c.value : m.note}</small>
                </div>
                {c.connected
                  ? <button className="chan-btn connected" onClick={() => toggleCh(k)}><Icon name="check" size={14} stroke={3} /> Linked</button>
                  : <button className="chan-btn" onClick={() => { toggleCh(k); toast(m.name + ' linked'); }}>Link</button>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="acct-panel" style={{ maxWidth: 560, marginTop: 20 }}>
        <h3 style={{ marginBottom: 6 }}>Password</h3>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>Last changed 3 months ago.</p>
        <button className="btn btn-outline btn-sm" onClick={() => go('auth', 'forgot')}>Change password</button>
      </div>
    </>
  );
}

function Referrals() {
  const { referral, REFERRAL_REWARD, toast, go } = useStore();
  const link = 'limitra.ng/r/' + referral.code;
  const completed = referral.referrals.filter(r => r.status === 'Completed').length;
  const enc = encodeURIComponent;
  const msg = `Shop premium tech, fashion & beauty on Limitra! Use my link and we both win: ${link}`;
  const share = (href, src) => { window.open(href, '_blank', 'noopener'); window.trackShare && window.trackShare('referral', src, 'referral-share'); };
  const channels = [
    ['whatsapp', 'WhatsApp', `https://wa.me/?text=${enc(msg)}`],
    ['facebook', 'Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}`],
    ['x', 'X', `https://twitter.com/intent/tweet?text=${enc(msg)}`],
  ];
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Refer &amp; earn</h1>
      <p className="muted" style={{ marginBottom: 22 }}>Invite a friend, when they place their first order, you earn <b style={{ color: 'var(--text)' }}>{naira(REFERRAL_REWARD)}</b> credit to spend on your next purchase.</p>

      <div className="ref-grid">
        <div className="ref-balance">
          <span className="rb-label"><img src="/assets/limcash.png" alt="" className="limcash-ic sm" /> Lim Cash</span>
          <span className="rb-amount">{naira(referral.credit)}</span>
          <span className="rb-note">Applied automatically at checkout</span>
          <button className="btn btn-block btn-light-on-navy" onClick={() => go('shop', 'all')} style={{ marginTop: 16 }}>Shop &amp; redeem</button>
        </div>
        <div className="ref-stats">
          <div className="ref-stat"><b>{completed}</b><small className="muted">Successful referrals</small></div>
          <div className="ref-stat"><b>{naira(completed * REFERRAL_REWARD)}</b><small className="muted">Total earned</small></div>
          <div className="ref-stat"><b>{referral.referrals.length}</b><small className="muted">Invites sent</small></div>
        </div>
      </div>

      <div className="acct-panel" style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 6 }}>Your referral link</h3>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 14 }}>Share your link or code. You earn {naira(REFERRAL_REWARD)} per friend’s first completed order.</p>
        <div className="aff-link-row" style={{ marginBottom: 14 }}>
          <code>{link}</code>
          <button className="btn btn-primary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(link); } catch (e) {} toast('Referral link copied'); }}><Icon name="copy" size={15} /> Copy</button>
        </div>
        <div className="ref-share">
          {channels.map(([k, label, href]) => (
            <button key={k} className={'vshare-btn ' + k} title={'Share on ' + label} onClick={() => share(href, k)}><SocialMark name={label} size={16} /></button>
          ))}
          <span className="ref-code-pill">Code: <b>{referral.code}</b></span>
        </div>
      </div>

      <div className="acct-panel" style={{ marginTop: 20 }}>
        <div className="row between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <h3>Referral history</h3>
        </div>
        {referral.referrals.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>No referrals yet, share your link to start earning.</p>
        ) : (
          <div className="ref-list">
            {referral.referrals.map((r, i) => (
              <div className="ref-row" key={i}>
                <span className="ref-av">{r.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                <div className="ref-row-main"><b>{r.name}</b><small className="muted">{r.date}</small></div>
                <StatusPill status={r.status === 'Completed' ? 'Delivered' : 'Processing'} />
                <b className="ref-reward">{r.reward > 0 ? '+' + naira(r.reward) : ','}</b>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ref-how">
        {[['share', 'Share your link', 'Send your unique link to friends via WhatsApp, social or your code.'], ['user', 'Friend orders', 'They sign up and complete their first order using your link.'], ['dollar', 'You earn ₦7,000', 'Credit lands in your account, auto-applied to your next checkout.']].map(([ic, t, s], i) => (
          <div className="ref-how-step" key={t}><span className="ref-how-num">{i + 1}</span><span className="ref-how-ic"><Icon name={ic} size={18} /></span><b>{t}</b><p className="muted">{s}</p></div>
        ))}
      </div>
    </>
  );
}

function MyRewards() {
  const { rewards, go, toast } = useStore();
  const fmtReward = (r) => r.kind === 'pct' ? Math.round(r.value * 100) + '% off' : r.kind === 'fixed' ? naira(r.value) + ' coupon' : 'Free shipping';
  return (
    <>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>My rewards</h1>
      <p className="muted" style={{ marginBottom: 22 }}>Coupons you’ve won. Active rewards are applied automatically at checkout.</p>
      {rewards.length === 0 ? (
        <EmptyState icon="gift" title="No rewards yet" body="Win discount coupons by spinning the welcome wheel and through seasonal promos." action="Start shopping" onAction={() => go('shop', 'all')} />
      ) : (
        <div className="rw-list">
          {rewards.map((r, i) => (
            <div className={'rw-card' + (r.status === 'Used' ? ' used' : '')} key={i}>
              <span className="rw-ic"><Icon name="gift" size={22} /></span>
              <div className="rw-main">
                <b>{fmtReward(r)}</b>
                <span className="rw-code">{r.code}</span>
                <div className="rw-meta">{r.status === 'Used' ? 'Redeemed' : 'Expires ' + r.expires} · won {r.won}</div>
              </div>
              {r.status === 'Used'
                ? <StatusPill status="Delivered" />
                : <button className="btn btn-outline btn-sm rw-copy" onClick={async () => { try { await navigator.clipboard.writeText(r.code); } catch (e) {} toast('Code copied'); }}><Icon name="copy" size={14} /> Copy</button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function AccountPage({ tab }) {
  const t = tab || 'dashboard';
  const map = { dashboard: <Dashboard />, orders: <Orders />, addresses: <Addresses />, payments: <Payments />, profile: <Profile />, referrals: <Referrals />, rewards: <MyRewards /> };
  return <AccountShell active={t}>{map[t] || <Dashboard />}</AccountShell>;
}

/* ---------------- WISHLIST ---------------- */
export function WishlistPage() {
  const { wish, go, toast } = useStore();
  const [sharing, setSharing] = useState(false);
  const items = wish.map(id => byId(id)).filter(Boolean);
  const shareWishlist = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const res = await favoritesApi.share();
      const data = res?.data ?? res;
      const token = data?.token ?? data?.share_token ?? data?.code;
      const url = data?.url ?? data?.share_url ?? data?.link
        ?? (token ? `${window.location.origin}/shared-wishlist/${token}` : null);
      if (!url) { toast('Could not generate a share link'); return; }
      try { await navigator.clipboard.writeText(url); toast('Wishlist link copied'); }
      catch (e) { toast(url); }
    } catch (e) {
      toast(messageFrom(e));
    } finally {
      setSharing(false);
    }
  };
  return (
    <AccountShell active="wishlist">
      <div className="row between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 26 }}>My wishlist <span className="muted" style={{ fontWeight: 600, fontSize: 16 }}>· {items.length} saved</span></h1>
        {items.length > 0 && <button className="btn btn-ghost btn-sm" onClick={shareWishlist} disabled={sharing}><Icon name="share" size={15} /> {sharing ? 'Sharing…' : 'Share wishlist'}</button>}
      </div>
      {items.length === 0
        ? <EmptyState icon="heart" title="Your wishlist is empty" body="Tap the heart on any product to save it here for later." action="Discover products" onAction={() => go('shop', 'all')} />
        : <div className="shop-grid">{items.map(p => <ProductCard key={p.id} product={p} />)}</div>}
    </AccountShell>
  );
}

/* ---------------- SHARED WISHLIST (public) ---------------- */
export function SharedWishlistPage({ token }) {
  const { go } = useStore();
  const [state, setState] = useState({ loaded: false, items: [], owner: null, error: false });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) { if (!cancelled) setState(s => ({ ...s, loaded: true, error: true })); return; }
      try {
        const res = await sharedWishlistsApi.get(token);
        const data = res?.data ?? res;
        const rawItems = data?.items ?? data?.favorites ?? data ?? [];
        const ids = (Array.isArray(rawItems) ? rawItems : [])
          .map(f => f.product_id ?? f.product?.id ?? f.id)
          .filter(id => id != null);
        const owner = data?.owner?.name ?? data?.user?.name
          ?? ([data?.user?.first_name, data?.user?.last_name].filter(Boolean).join(' ') || null);
        if (!cancelled) setState({ loaded: true, items: ids.map(byId).filter(Boolean), owner, error: false });
      } catch (e) {
        if (!cancelled) setState({ loaded: true, items: [], owner: null, error: true });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (!state.loaded) return <div className="page page-fade"><div className="wrap"><p className="muted" style={{ padding: '40px 0' }}>Loading wishlist…</p></div></div>;

  if (state.error) {
    return (
      <div className="page page-fade"><div className="wrap">
        <EmptyState icon="heart" title="This wishlist link isn't valid" body="It may have expired or been removed." action="Go to shop" onAction={() => go('shop', 'all')} />
      </div></div>
    );
  }

  return (
    <div className="page page-fade"><div className="wrap">
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>{state.owner ? `${state.owner}'s wishlist` : 'Shared wishlist'}</h1>
      <p className="muted" style={{ marginBottom: 18 }}>{state.items.length} item{state.items.length === 1 ? '' : 's'} saved</p>
      {state.items.length === 0
        ? <EmptyState icon="heart" title="This wishlist is empty" body="Nothing has been saved here yet." action="Go to shop" onAction={() => go('shop', 'all')} />
        : <div className="shop-grid">{state.items.map(p => <ProductCard key={p.id} product={p} />)}</div>}
    </div></div>
  );
}

/* ---------------- ORDER TRACKING ---------------- */
const TRACK_STEPS = [
  ['Order confirmed', 'Your order has been received', 'check'],
  ['Processing', 'Seller is preparing your package', 'package'],
  ['Shipped', 'Package handed to courier', 'truck'],
  ['Out for delivery', 'Arriving today', 'location'],
  ['Delivered', 'Package delivered', 'shield'],
];

const STEP_INDEX = { pending_payment: 0, confirmed: 0, processing: 1, shipped: 2, in_transit: 3, delivered: 4 };

export function TrackingPage({ id }) {
  const { go } = useStore();
  const [order, setOrder] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) { if (!cancelled) setLoaded(true); return; }
      try {
        const res = await ordersApi.get(id);
        const raw = res?.data ?? res;
        if (!cancelled) setOrder(raw ? normalizeOrder(raw) : null);
      } catch (e) {
        if (!cancelled) setOrder(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (!loaded) return <AccountShell active="tracking"><p className="muted">Loading…</p></AccountShell>;

  if (!order) {
    return (
      <AccountShell active="tracking">
        <EmptyState icon="truck" title="No order to track" body="We couldn't find that order." action="View orders" onAction={() => go('orders')} />
      </AccountShell>
    );
  }
  const isCancelled = order.status === 'cancelled';
  const current = STEP_INDEX[order.status] ?? 0;
  // Response shape is undocumented — courier/tracking-number fields are read
  // defensively and simply hidden (not fabricated) if the order has neither.
  const courier = order.raw.courier ?? order.raw.carrier ?? order.raw.delivery_partner;
  const trackingNumber = order.raw.tracking_number ?? order.raw.tracking_id ?? order.raw.waybill_number;
  return (
    <AccountShell active="tracking">
      <div className="row between" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 26 }}>Track order</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => go('orders')}><Icon name="list" size={15} /> All orders</button>
      </div>
      <p className="muted" style={{ marginBottom: 22 }}>Order <b style={{ color: 'var(--text)' }}>{order.id}</b> · placed {fmtDate(order.date)}</p>

      <div className="track-banner card">
        <div className="track-status">
          <span className="track-ic"><Icon name={isCancelled ? 'close' : 'truck'} size={26} /></span>
          <div>
            <StatusPill status={order.status} />
            <h3 style={{ margin: '8px 0 2px' }}>{isCancelled ? 'Order cancelled' : TRACK_STEPS[current][0]}</h3>
            <p className="muted" style={{ fontSize: 13.5 }}>{order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} · {naira(order.total)}</p>
          </div>
        </div>
        {(courier || trackingNumber) && (
          <div className="track-courier">
            {courier && <><small className="muted">Courier</small><b>{courier}</b></>}
            {trackingNumber && <><small className="muted" style={{ marginTop: 8 }}>Tracking ID</small><b>{trackingNumber}</b></>}
          </div>
        )}
      </div>

      {!isCancelled && (
        <div className="timeline">
          {TRACK_STEPS.map(([title, sub, ic], i) => (
            <div key={i} className={'tl-step' + (i <= current ? ' done' : '') + (i === current ? ' current' : '')}>
              <div className="tl-marker"><span className="tl-dot">{i < current ? <Icon name="check" size={14} stroke={3} /> : <Icon name={ic} size={14} />}</span>{i < TRACK_STEPS.length - 1 && <span className="tl-line" />}</div>
              <div className="tl-body">
                <b>{title}</b>
                <small className="muted">{sub}</small>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="track-help"><Icon name="headset" size={18} /><span>Having an issue with this order?</span><button className="link-btn" onClick={() => go('help', 'contact')}>Contact support</button></div>
    </AccountShell>
  );
}

/* ---------------- HELP CENTER ---------------- */
export function HelpPage({ section }) {
  const { go } = useStore();
  const [open, setOpen] = useState(0);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (section === 'contact') {
      const t = setTimeout(() => { const el = document.getElementById('help-contact'); if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 90; window.scrollTo({ top: y, behavior: 'smooth' }); } }, 120);
      return () => clearTimeout(t);
    }
  }, [section]);
  const cats = [
    ['package', 'Orders & delivery', 'Track, change or cancel orders'],
    ['refresh', 'Returns & refunds', 'Return an item, refund status'],
    ['card', 'Payments', 'Methods, promo codes, billing'],
    ['user', 'Account', 'Login, profile, security'],
    ['shield', 'Buyer protection', 'How you’re covered'],
    ['store', 'Selling on Limitra', 'Become a verified seller'],
  ];
  const faqs = [
    ['How long does delivery take?', 'Delivery takes 10–14 days nationwide. You’ll get live tracking updates at every step.'],
    ['What is Limitra’s return policy?', 'You can return most items within 7 days of delivery for a full refund, provided they’re in original condition. Some categories have specific terms shown on the product page.'],
    ['How do I know a product is genuine?', 'Every Limitra seller is verified and products are quality-checked before dispatch. All orders are covered by our buyer-protection guarantee.'],
    ['What payment methods are accepted?', 'We accept debit/credit cards, direct bank transfer, and pay-on-delivery in select cities. All payments are encrypted and secure.'],
    ['Can I change my delivery address after ordering?', 'Yes, if your order hasn’t shipped yet, you can update the address from My Orders. Once shipped, contact support and we’ll do our best to help.'],
  ];
  return (
    <div className="page page-fade">
      <div className="help-hero">
        <div className="wrap" style={{ textAlign: 'center' }}>
          <span className="badge badge-soft" style={{ marginBottom: 16 }}><Icon name="headset" size={14} /> Help Center</span>
          <h1 style={{ fontSize: 38, marginBottom: 10 }}>How can we help?</h1>
          <p className="muted" style={{ fontSize: 16, marginBottom: 24 }}>Search our knowledge base or browse popular topics below.</p>
          <div className="help-search">
            <Icon name="search" size={20} className="muted" />
            <input className="sb-input" placeholder="Search help articles…" value={q} onChange={e => setQ(e.target.value)} />
            <button className="sb-btn">Search</button>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="help-cats">
          {cats.map(([ic, t, sub]) => (
            <button key={t} className="help-cat card" onClick={() => go('help')}>
              <span className="help-cat-ic"><Icon name={ic} size={22} /></span>
              <b>{t}</b><small className="muted">{sub}</small>
            </button>
          ))}
        </div>

        <div className="help-faq">
          <h2 style={{ fontSize: 26, marginBottom: 6, textAlign: 'center' }}>Frequently asked questions</h2>
          <p className="muted" style={{ textAlign: 'center', marginBottom: 30 }}>Quick answers to the questions we hear most.</p>
          <div className="faq-list">
            {faqs.map(([qq, a], i) => (
              <div key={i} className={'faq-item' + (open === i ? ' open' : '')}>
                <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                  <span>{qq}</span>
                  <Icon name={open === i ? 'minus' : 'plus'} size={18} />
                </button>
                <div className="faq-a"><p>{a}</p></div>
              </div>
            ))}
          </div>
        </div>

        <div className="help-contact" id="help-contact">
          {[['headset', '24/7 support', 'Chat with our team any time', 'Start chat'], ['mail', 'Email us', 'support@limitra.com.ng · replies in 2 hrs', 'Send email'], ['phone', 'Call us', '+234 700 LIMITRA · 8am–8pm', 'Call now']].map(([ic, t, sub, cta]) => (
            <div key={t} className="contact-card card">
              <span className="contact-ic"><Icon name={ic} size={22} /></span>
              <b>{t}</b><small className="muted">{sub}</small>
              <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }}>{cta}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
