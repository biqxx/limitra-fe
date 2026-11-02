'use client';
/* LIMITRA MicroStore Partner Dashboard — the seller-facing dashboard for a MicroStore
   Partner's own store (app/microstores/dashboard/*), built in the same shape as
   components/affiliate/Affiliate.jsx: one module with shared demo data/UI + a page
   component per sidebar section, routed via a local `partnerPath` helper (not the
   centralized lib/routes.js go() system, matching the Affiliate dashboard's own
   precedent for a standalone, route-pushing sub-app).

   No MicroStore/partner backend exists yet (same situation as lib/microstoresData.js),
   so every number here is illustrative demo data from lib/microstorePartner.js, not a
   real store's figures. There's no auth guard on this route either — like the public
   MicroStoresPage/MicroStorePage, it's reachable directly as a demo, not gated behind a
   real partner account. */
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { Thumb } from '@/components/ui/Shared';
import { SocialMark } from '@/components/ui/SocialMark';
import { Kpi, Donut, STATUS_CLS } from '@/components/charts/Charts';
import { useStore } from '@/components/store/StoreProvider';
import { naira } from '@/lib/data';
import {
  MY_STORE, PARTNER, MS_ORDERS, MS_ORDER_STATUS, MS_SALES_SERIES, MS_TOP_PRODUCTS,
  MS_CUSTOMERS, MS_REVIEWS, MS_TRANSACTIONS, MS_WITHDRAWALS,
} from '@/lib/microstorePartner';
import { useMsPartnerToast } from './MicroStorePartnerToastContext';

const fn = naira;
const MSTATUS = { ...STATUS_CLS, Paid: 'ok', Active: 'ok', Draft: 'warn', Archived: 'muted' };

const PARTNER_NAV = [
  ['Overview', [['dashboard', 'Dashboard', 'grid']]],
  ['Sales', [['orders', 'Orders', 'truck'], ['products', 'Products', 'bag'], ['inventory', 'Inventory', 'package'], ['customers', 'Customers', 'user']]],
  ['Growth', [['analytics', 'Analytics', 'spark'], ['promotion', 'Promotion', 'tag'], ['reviews', 'Reviews', 'star']]],
  ['Finance', [['earnings', 'Earnings', 'dollar'], ['withdrawals', 'Withdrawals', 'card'], ['transactions', 'Transactions', 'list']]],
  ['Store', [['storefront', 'Storefront', 'store'], ['settings', 'Store Settings', 'edit']]],
];

const partnerPath = (key) => '/microstores/dashboard' + (key === 'dashboard' ? '' : '/' + key);
function usePartnerGo() {
  const router = useRouter();
  return (section) => router.push(partnerPath(section));
}

/* ---- small shared bits (mirrors components/affiliate/Affiliate.jsx's FHead/Pill/usePager) ---- */
function MsHead({ title, sub, children }) {
  return <div className="adm-h"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="adm-h-actions">{children}</div>}</div>;
}
function Pill({ s }) { return <span className={'adm-pill ' + (MSTATUS[s] || 'muted')}>{s}</span>; }

function usePager(list, dep, per = 10) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [dep]);
  const pages = Math.max(1, Math.ceil(list.length / per));
  const cur = Math.min(page, pages);
  const shown = list.slice((cur - 1) * per, cur * per);
  return { shown, page: cur, pages, setPage };
}
function MsPager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const win = []; for (let i = 1; i <= pages; i++) { if (i === 1 || i === pages || Math.abs(i - page) <= 1) win.push(i); else if (win[win.length - 1] !== '…') win.push('…'); }
  return (
    <div className="aff-pager">
      <button className="aff-pg" disabled={page === 1} onClick={() => onPage(page - 1)}><Icon name="chevleft" size={16} /></button>
      {win.map((p, i) => p === '…' ? <span key={'g' + i} className="aff-pg-gap">…</span> : <button key={p} className={'aff-pg' + (p === page ? ' on' : '')} onClick={() => onPage(p)}>{p}</button>)}
      <button className="aff-pg" disabled={page === pages} onClick={() => onPage(page + 1)}><Icon name="chevright" size={16} /></button>
    </div>
  );
}

/* stat card with an extra "view details" link under the Kpi, matching the Overview mockup */
function MsStat({ ic, tint, label, val, delta, linkLabel, onLink }) {
  return (
    <div className="ms-stat-card">
      <Kpi ic={ic} tint={tint} label={label} val={val} delta={delta} up />
      {linkLabel && <button className="link-btn ms-stat-link" onClick={onLink}>{linkLabel} <Icon name="arrowr" size={12} /></button>}
    </div>
  );
}

/* lightweight inline SVG area/line chart — no chart library in this project, and the
   existing shared BarChart (components/charts/Charts.jsx) is a bar sparkline, not the
   smooth filled line the Sales Overview mockup shows. */
function MsLineChart({ labels, data }) {
  const max = Math.max(1, ...data);
  const min = Math.min(0, ...data);
  const range = max - min || 1;
  const W = 600, H = 180, pad = 8;
  const stepX = (W - pad * 2) / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => [pad + i * stepX, H - pad - ((v - min) / range) * (H - pad * 2)]);
  const line = pts.map(([x, y], i) => (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
  const area = line + ` L${pts[pts.length - 1][0].toFixed(1)},${H - pad} L${pts[0][0].toFixed(1)},${H - pad} Z`;
  return (
    <div className="ms-line-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="ms-line-svg">
        <defs>
          <linearGradient id="msLineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#msLineFill)" />
        <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4.5 : 3} fill={i === pts.length - 1 ? 'var(--accent)' : 'var(--primary)'} />)}
      </svg>
      <div className="ms-line-labels">{labels.map(l => <span key={l}>{l}</span>)}</div>
    </div>
  );
}

/* ============ OVERVIEW ============ */
function MsOverview() {
  const go = usePartnerGo();
  const [period, setPeriod] = useState('3D');
  const [view, setView] = useState('Personal');
  const series = MS_SALES_SERIES[period];
  const total = series.data.reduce((s, v) => s + v, 0);
  const statusTotal = MS_ORDER_STATUS.reduce((s, x) => s + x.v, 0);

  return (
    <>
      <MsHead title={'Good morning, ' + PARTNER.firstName} sub="Welcome back to your MicroStore! Here's how your store is doing today">
        <button className="adm-btn ghost" onClick={() => go('storefront')}><Icon name="chat" size={15} /> Preview Store</button>
        <button className="adm-btn primary" onClick={() => go('products')}><Icon name="heart" size={15} /> Add Products</button>
      </MsHead>
      <div className="kpi-grid">
        <MsStat ic="card" tint="#0438B6" label="Total Sales" val={fn(248500)} delta="18.3%" linkLabel="view details" onLink={() => go('earnings')} />
        <MsStat ic="cart" tint="#1F8A5B" label="Orders" val="42" delta="12.4%" linkLabel="view orders" onLink={() => go('orders')} />
        <MsStat ic="bag" tint="#F5A623" label="Products" val="48" delta="18.3%" linkLabel="Manage products" onLink={() => go('products')} />
        <MsStat ic="card" tint="#7A5AE0" label="Available Balance" val={fn(84500)} linkLabel="view earnings" onLink={() => go('earnings')} />
      </div>

      <div className="adm-row c2">
        <div className="panel">
          <div className="panel-h">
            <h3>Sales Overview</h3>
            <div className="ms-period-tabs">{['3D', '30D', '10M', '1Y'].map(p => <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>{p}</button>)}</div>
          </div>
          <div className="ms-sales-head">
            <div>
              <b className="ms-sales-total">{fn(total)}</b>
              <span className="adm-pill ok" style={{ marginLeft: 10 }}>↑ 18.3% compared to last periods</span>
            </div>
            <div className="ms-view-tabs">{['Personal', 'Products', 'Units Sold'].map(v => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v}</button>)}</div>
          </div>
          <MsLineChart labels={series.labels} data={series.data} />
        </div>
        <div className="panel">
          <div className="panel-h"><h3>Order Status</h3><button className="link-btn" onClick={() => go('orders')}>view details</button></div>
          <Donut segments={MS_ORDER_STATUS} centerValue={String(statusTotal)} centerLabel="orders" />
        </div>
      </div>

      <div className="adm-row c2">
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>Recent Orders</h3><button className="link-btn" onClick={() => go('orders')}>view details</button></div>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Item</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>{MS_ORDERS.slice(0, 5).map(o => (
              <tr key={o.id}><td><b>{o.id}</b></td><td>{o.customer}</td><td>{o.items}</td><td className="muted">{o.date}</td><td><b>{fn(o.total)}</b></td><td><Pill s={o.status} /></td></tr>
            ))}</tbody>
          </table></div>
        </div>
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>Top Performing Products</h3><button className="link-btn" onClick={() => go('products')}>view details</button></div>
          <div className="ms-top-list">
            {MS_TOP_PRODUCTS.map(p => (
              <div key={p.name} className="ms-top-row">
                <span className="adm-prod-thumb"><Thumb product={{ tint: MY_STORE?.products?.[0]?.tint }} /></span>
                <div className="ms-top-info"><b>{p.name}</b><small className="muted">{p.sold} sold</small></div>
                <b>{fn(p.revenue)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ============ ORDERS ============ */
function MsOrders() {
  const [tab, setTab] = useState('All');
  const tabs = ['All', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  const list = MS_ORDERS.filter(o => tab === 'All' || o.status === tab);
  const { shown, page, pages, setPage } = usePager(list, tab);
  return (
    <>
      <MsHead title="Orders" sub="Every order placed through your MicroStore." />
      <div className="adm-chip-row">{tabs.map(t => <button key={t} className={'adm-chip' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{t}</button>)}</div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Item</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>{shown.map(o => (
            <tr key={o.id}><td><b>{o.id}</b></td><td>{o.customer}</td><td>{o.items}</td><td className="muted">{o.date}</td><td><b>{fn(o.total)}</b></td><td><Pill s={o.status} /></td></tr>
          ))}</tbody>
        </table>{shown.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-faint)' }}>No orders in this status.</div>}<MsPager page={page} pages={pages} onPage={setPage} /></div>
      </div>
    </>
  );
}

/* ============ PRODUCTS ============ */
function MsProducts() {
  const toast = useMsPartnerToast();
  const products = MY_STORE?.products || [];
  return (
    <>
      <MsHead title="Products" sub={`${products.length} products in your store`}>
        <button className="adm-btn primary" onClick={() => toast('Demo store — product creation is not wired up here')}><Icon name="plus" size={15} /> Add product</button>
      </MsHead>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
          <tbody>{products.map(p => (
            <tr key={p.id}>
              <td><div className="adm-prod"><span className="adm-prod-thumb"><Thumb product={{ tint: p.tint }} /></span><div><b>{p.name}</b><small>{p.brand}</small></div></div></td>
              <td><b>{fn(p.price)}</b></td>
              <td>{p.stock}</td>
              <td><span className={'adm-pill ' + (p.stock === 0 ? 'bad' : p.stock <= 5 ? 'warn' : 'ok')}>{p.stock === 0 ? 'Out of stock' : p.stock <= 5 ? 'Low stock' : 'In stock'}</span></td>
              <td><div className="adm-rowact"><button title="Edit" onClick={() => toast('Demo store — editing is not wired up here')}><Icon name="edit" size={15} /></button></div></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}

/* ============ INVENTORY ============ */
function MsInventory() {
  const products = MY_STORE?.products || [];
  const low = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  const out = products.filter(p => p.stock === 0).length;
  return (
    <>
      <MsHead title="Inventory" sub="Stock levels across your store." />
      <div className="kpi-grid">
        <Kpi ic="package" tint="#0438B6" label="Total products" val={String(products.length)} />
        <Kpi ic="clock" tint="#F5A623" label="Low stock" val={String(low)} />
        <Kpi ic="close" tint="#E5484D" label="Out of stock" val={String(out)} />
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Product</th><th>In stock</th><th>Status</th></tr></thead>
          <tbody>{products.map(p => (
            <tr key={p.id}>
              <td><div className="adm-prod"><span className="adm-prod-thumb"><Thumb product={{ tint: p.tint }} /></span><b>{p.name}</b></div></td>
              <td>{p.stock}</td>
              <td><span className={'adm-pill ' + (p.stock === 0 ? 'bad' : p.stock <= 5 ? 'warn' : 'ok')}>{p.stock === 0 ? 'Out of stock' : p.stock <= 5 ? 'Low stock' : 'In stock'}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}

/* ============ CUSTOMERS ============ */
function MsCustomers() {
  return (
    <>
      <MsHead title="Customers" sub={`${MS_CUSTOMERS.length} customers have bought from your store.`} />
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Customer</th><th>Orders</th><th>Total spent</th></tr></thead>
          <tbody>{MS_CUSTOMERS.map(c => (
            <tr key={c.email}><td><div className="adm-prod"><span className="adm-li-av">{c.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span><div><b>{c.name}</b><small className="muted">{c.email}</small></div></div></td>
              <td>{c.orders}</td><td><b>{fn(c.spent)}</b></td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}

/* ============ ANALYTICS ============ */
function MsAnalytics() {
  const series = MS_SALES_SERIES['10M'];
  return (
    <>
      <MsHead title="Analytics" sub="How your store is performing over time." />
      <div className="kpi-grid">
        <Kpi ic="eye" tint="#7A5AE0" label="Store visits" val="3,240" delta="9%" up />
        <Kpi ic="cart" tint="#0438B6" label="Orders" val="42" delta="12.4%" up />
        <Kpi ic="spark" tint="#1F8A5B" label="Conversion" val="13.0%" delta="1.1%" up />
        <Kpi ic="dollar" tint="#F67208" label="Avg. order value" val={fn(5917)} delta="4%" up />
      </div>
      <div className="adm-row c2">
        <div className="panel"><div className="panel-h"><h3>Sales over time</h3></div><MsLineChart labels={series.labels} data={series.data} /></div>
        <div className="panel"><div className="panel-h"><h3>Sales by category</h3></div>
          <Donut segments={[{ label: 'Electronics', v: 162000, c: '#0438B6' }, { label: 'Fashion', v: 48000, c: '#F67208' }, { label: 'Accessories', v: 38500, c: '#1F8A5B' }]} centerLabel="sales" /></div>
      </div>
    </>
  );
}

/* ============ PROMOTION ============ */
function MsPromotion() {
  const toast = useMsPartnerToast();
  const [codes] = useState([
    { code: 'MEGA10', pct: 10, uses: 24, active: true },
    { code: 'WELCOME5', pct: 5, uses: 61, active: true },
    { code: 'BLACKFRI', pct: 20, uses: 140, active: false },
  ]);
  return (
    <>
      <MsHead title="Promotion" sub="Run discount codes and promotions for your store.">
        <button className="adm-btn primary" onClick={() => toast('Demo store — creating codes is not wired up here')}><Icon name="plus" size={15} /> New code</button>
      </MsHead>
      <div className="aff-code-grid">
        {codes.map(c => (
          <div key={c.code} className={'aff-code-card' + (c.active ? '' : ' off')}>
            <div className="aff-code-top"><span className="aff-code-val">{c.code}</span><span className={'adm-pill ' + (c.active ? 'ok' : 'muted')}>{c.active ? 'Active' : 'Ended'}</span></div>
            <div className="aff-code-pct">{c.pct}% off</div>
            <div className="aff-code-meta"><span><Icon name="tag" size={13} /> {c.uses} uses</span></div>
            <div className="aff-code-actions">
              <button className="adm-btn ghost sm" onClick={() => toast('Link copied')}><Icon name="copy" size={13} /> Copy</button>
              <button className="adm-btn ghost sm danger" onClick={() => toast('Demo store — not wired up here')}><Icon name="trash" size={13} /> End</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ============ REVIEWS ============ */
function MsReviews() {
  const avg = (MS_REVIEWS.reduce((s, r) => s + r.rating, 0) / MS_REVIEWS.length).toFixed(1);
  return (
    <>
      <MsHead title="Reviews" sub={`${MY_STORE?.rating ?? avg} average rating from ${MY_STORE?.reviews ?? MS_REVIEWS.length} reviews.`} />
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Product</th><th>Customer</th><th>Rating</th><th>Date</th><th>Comment</th></tr></thead>
          <tbody>{MS_REVIEWS.map((r, i) => (
            <tr key={i}><td><b>{r.product}</b></td><td>{r.customer}</td>
              <td>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</td>
              <td className="muted">{r.date}</td>
              <td className="muted" style={{ maxWidth: 320 }}>{r.comment}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}

/* ============ EARNINGS ============ */
function MsEarnings() {
  const go = usePartnerGo();
  return (
    <>
      <MsHead title="Earnings" sub="Your sales revenue and payout history.">
        <button className="adm-btn primary" onClick={() => go('withdrawals')}><Icon name="card" size={15} /> Withdraw</button>
      </MsHead>
      <div className="kpi-grid">
        <Kpi ic="dollar" tint="#1F8A5B" label="Total sales" val={fn(248500)} delta="18.3%" up />
        <Kpi ic="clock" tint="#F5A623" label="Pending" val={fn(20000)} up />
        <Kpi ic="check" tint="#0438B6" label="Paid out" val={fn(122000)} up />
        <Kpi ic="card" tint="#F67208" label="Available balance" val={fn(84500)} up />
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>Transaction history</h3></div>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Description</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{MS_TRANSACTIONS.map((t, i) => (
            <tr key={i}><td><b>{t.desc}</b></td><td className="muted">{t.date}</td>
              <td className={t.amount < 0 ? 'aff-neg' : 'aff-pos'}><b>{t.amount < 0 ? '−' + fn(-t.amount) : '+' + fn(t.amount)}</b></td>
              <td><Pill s={t.status} /></td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}

/* ============ WITHDRAWALS ============ */
function MsWithdrawals() {
  const toast = useMsPartnerToast();
  const bal = 84500, min = 5000;
  const [amt, setAmt] = useState('');
  const submit = () => {
    const v = parseInt(amt, 10);
    if (!v || v < min) { toast('Minimum withdrawal is ' + fn(min)); return; }
    if (v > bal) { toast('Amount exceeds available balance'); return; }
    toast('Withdrawal request submitted'); setAmt('');
  };
  return (
    <>
      <MsHead title="Withdrawals" sub="Request a payout to your bank account." />
      <div className="adm-row c2">
        <div className="panel aff-wd-card">
          <span className="aff-wd-label">Available balance</span>
          <div className="aff-wd-bal">{fn(bal)}</div>
          <label className="adm-field"><span>Amount to withdraw</span><input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder={'Min. ' + fn(min)} /></label>
          <div className="aff-wd-dest"><Icon name="card" size={16} /> GTBank ••••4821 · {PARTNER.name}</div>
          <button className="adm-btn primary block lg" onClick={submit}>Request withdrawal</button>
          <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>Payouts are processed within 1–3 business days.</p>
        </div>
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>Withdrawal history</h3></div>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
            <tbody>{MS_WITHDRAWALS.map((w, i) => (
              <tr key={i}><td className="muted">{w.date}</td><td><b>{fn(w.amount)}</b></td><td>{w.method}</td><td><Pill s={w.status} /></td></tr>
            ))}</tbody>
          </table></div>
        </div>
      </div>
    </>
  );
}

/* ============ TRANSACTIONS ============ */
function MsTransactions() {
  const { shown, page, pages, setPage } = usePager(MS_TRANSACTIONS, 'all');
  return (
    <>
      <MsHead title="Transactions" sub="Full ledger of sales, fees and withdrawals." />
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Description</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{shown.map((t, i) => (
            <tr key={i}><td><b>{t.desc}</b></td><td className="muted">{t.date}</td>
              <td className={t.amount < 0 ? 'aff-neg' : 'aff-pos'}><b>{t.amount < 0 ? '−' + fn(-t.amount) : '+' + fn(t.amount)}</b></td>
              <td><Pill s={t.status} /></td></tr>
          ))}</tbody>
        </table><MsPager page={page} pages={pages} onPage={setPage} /></div>
      </div>
    </>
  );
}

/* ============ STOREFRONT ============ */
function MsStorefront() {
  const { go, toast } = useStore();
  const url = 'limitra.com.ng/' + (MY_STORE?.slug || '');
  return (
    <>
      <MsHead title="Storefront" sub="Your public MicroStore link — share it anywhere." />
      <div className="panel">
        <div className="ms-store-url-row">
          <div><span className="muted" style={{ fontSize: 12 }}>Your store URL</span><div className="aff-link-row" style={{ marginTop: 6 }}><code>{url}</code><button className="btn btn-primary btn-sm" onClick={() => toast('Link copied to clipboard')}><Icon name="share" size={15} /> Copy</button></div></div>
        </div>
        <div className="aff-share-row" style={{ marginTop: 18 }}>
          {['WhatsApp', 'Instagram', 'TikTok', 'Facebook', 'X'].map(s => (
            <button key={s} className={'aff-share-btn ' + s.toLowerCase()} title={'Share on ' + s} onClick={() => toast('Share isn’t connected yet')}><SocialMark name={s} size={17} /></button>
          ))}
        </div>
        <button className="adm-btn primary" style={{ marginTop: 20 }} onClick={() => go('microstore', MY_STORE?.slug)}><Icon name="store" size={15} /> Preview storefront</button>
      </div>
    </>
  );
}

/* ============ STORE SETTINGS ============ */
function MsStoreSettings() {
  const toast = useMsPartnerToast();
  const [info, setInfo] = useState({
    name: MY_STORE?.name || '', desc: MY_STORE?.tagline || '', category: 'Gaming and Tech',
    email: 'megakfueb@gmail.com', location: (MY_STORE?.location || '') + ', Nigeria', phone: '',
  });
  const [links, setLinks] = useState({ instagram: '', facebook: '', tiktok: '', website: '' });
  const [policies, setPolicies] = useState({ shipping: '', returns: '', consolidation: '' });
  const set = (setter) => (key) => (e) => setter(s => ({ ...s, [key]: e.target.value }));

  return (
    <>
      <MsHead title="Store Settings" sub="Manage your store information, brand assets and policies">
        <button className="adm-btn primary" onClick={() => toast('Store settings saved')}><Icon name="heart" size={15} /> Save Changes</button>
      </MsHead>

      <div className="panel">
        <h3 style={{ marginBottom: 4 }}>Store Appearance</h3>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 18 }}>Update your store logo and cover image. These will be visible on your MicroStore.</p>
        <div className="ms-appearance-row">
          <div className="ms-appearance-card">
            <span className="adm-field-label">Profile picture</span>
            <div className="ms-avatar-upload" style={{ background: MY_STORE?.color }}><Icon name="store" size={26} /><button className="ms-upload-edit" onClick={() => toast('Demo store — uploads aren’t wired up here')}><Icon name="edit" size={12} /></button></div>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="adm-btn ghost sm" onClick={() => toast('Demo store — uploads aren’t wired up here')}>Change image</button>
              <button className="adm-btn ghost sm danger" onClick={() => toast('Demo store — uploads aren’t wired up here')}>Remove image</button>
            </div>
            <small className="muted" style={{ marginTop: 8, display: 'block' }}>Recommended: 500×500px · JPG, PNG, WEBP (max 2MB)</small>
          </div>
          <div className="ms-appearance-card" style={{ flex: 1 }}>
            <span className="adm-field-label">Cover image</span>
            <div className="ms-cover-upload"><Icon name="store" size={22} /><button className="ms-upload-edit" onClick={() => toast('Demo store — uploads aren’t wired up here')}><Icon name="edit" size={12} /></button></div>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="adm-btn ghost sm" onClick={() => toast('Demo store — uploads aren’t wired up here')}>Change image</button>
              <button className="adm-btn ghost sm danger" onClick={() => toast('Demo store — uploads aren’t wired up here')}>Remove image</button>
            </div>
            <small className="muted" style={{ marginTop: 8, display: 'block' }}>Recommended: 1600×400px · JPG, PNG, WEBP (max 2MB)</small>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginBottom: 4 }}>Store Information</h3>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 18 }}>Tell customers about your store and where you&rsquo;re located</p>
        <div className="adm-field-row">
          <label className="adm-field"><span>Store Name</span><input value={info.name} onChange={set(setInfo)('name')} /></label>
          <label className="adm-field"><span>Store Description</span><input value={info.desc} onChange={set(setInfo)('desc')} /></label>
        </div>
        <div className="adm-field-row">
          <label className="adm-field"><span>Store Category</span><input value={info.category} onChange={set(setInfo)('category')} /></label>
          <label className="adm-field"><span>Contact email</span><input type="email" value={info.email} onChange={set(setInfo)('email')} /></label>
        </div>
        <div className="adm-field-row">
          <label className="adm-field"><span>Store Location</span><input value={info.location} onChange={set(setInfo)('location')} /></label>
          <label className="adm-field"><span>Phone Number</span><input value={info.phone} onChange={set(setInfo)('phone')} placeholder="+234…" /></label>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginBottom: 4 }}>Store Links</h3>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 18 }}>Add your social media and website links</p>
        <div className="ms-links-grid">
          <label className="adm-field"><span>Instagram</span><input value={links.instagram} onChange={set(setLinks)('instagram')} placeholder="@yourstore" /></label>
          <label className="adm-field"><span>Facebook</span><input value={links.facebook} onChange={set(setLinks)('facebook')} placeholder="facebook.com/yourstore" /></label>
          <label className="adm-field"><span>Tiktok</span><input value={links.tiktok} onChange={set(setLinks)('tiktok')} placeholder="@yourstore" /></label>
          <label className="adm-field"><span>Website</span><input value={links.website} onChange={set(setLinks)('website')} placeholder="yourstore.com" /></label>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginBottom: 4 }}>Store Policies</h3>
        <p className="muted" style={{ fontSize: 13.5, marginBottom: 18 }}>Add your store policies to build trust with your customers</p>
        <div className="ms-links-grid three">
          <label className="adm-field"><span>Shipping Policy</span><input value={policies.shipping} onChange={set(setPolicies)('shipping')} /></label>
          <label className="adm-field"><span>Return &amp; Refund Policy</span><input value={policies.returns} onChange={set(setPolicies)('returns')} /></label>
          <label className="adm-field"><span>Consolidation Policy</span><input value={policies.consolidation} onChange={set(setPolicies)('consolidation')} /></label>
        </div>
      </div>
    </>
  );
}

export {
  PARTNER, MY_STORE, PARTNER_NAV, partnerPath, usePartnerGo, Pill, usePager, MsPager,
  MsOverview, MsOrders, MsProducts, MsInventory, MsCustomers, MsAnalytics, MsPromotion,
  MsReviews, MsEarnings, MsWithdrawals, MsTransactions, MsStorefront, MsStoreSettings,
};
