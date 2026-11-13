'use client';
/* LIMITRA Affiliate Dashboard — shared UI + all 11 page components.
   Originally a mechanical port of legacy/aff-sections.jsx + legacy/aff-dashboard.jsx
   with entirely hardcoded demo data (FREFERRALS/FTXNS/FWITHDRAWALS/FLEADERS, a static
   AFF profile, localStorage-only promo codes). Now wired to the real affiliateApi
   (lib/api/endpoints.js) — none of those request/response shapes are documented
   (the spec gives every one of them an empty schema), so every normalizer below
   reads fields defensively and degrades to an empty/zero state rather than
   fabricating data, the same approach used across the rest of this app's admin
   pages. AffLeaderboard is the one exception: there is no backend endpoint for a
   public leaderboard at all, so it stays a labeled preview. */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { Thumb, REAL_IMG } from '@/components/ui/Shared';
import { SocialMark } from '@/components/ui/SocialMark';
import { Kpi, BarChart, Donut } from '@/components/charts/Charts';
import { useStore } from '@/components/store/StoreProvider';
import { naira, byId } from '@/lib/data';
import { affiliateApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useAffiliateToast } from './AffiliateToastContext';

const FIcon = Icon;
const FThumb = Thumb;
const FREAL = REAL_IMG;
const fn = naira;

// Fallback shape only — used while the real profile is loading/unavailable, and
// by app/affiliate/dashboard/layout.js's header (that shell isn't wired to real
// data in this round; see useAffiliateSelf below for the pages that are).
const AFF = { name: 'Affiliate', handle: '', initials: 'A', email: '', id: '', channel: '', joined: '', tier: 'Standard', rate: 0 };
const SITE = 'https://limitra.ng';

const aff_link = (slug) => `${SITE}/product/${slug}?ref=${AFF.id}`;

const FAFF_NAV = [
  ['Overview', [['dashboard', 'Dashboard', 'grid'], ['analytics', 'Performance', 'spark']]],
  ['Promote', [['promote', 'Promotion Center', 'bag'], ['links', 'My Links', 'share'], ['resources', 'Marketing', 'gift']]],
  ['Earnings', [['earnings', 'Earnings', 'dollar'], ['withdraw', 'Withdrawals', 'card'], ['referrals', 'Referrals', 'user'], ['promocodes', 'Promo Codes', 'tag']]],
  ['Community', [['leaderboard', 'Leaderboard', 'flame']]],
  ['Account', [['settings', 'Profile & Settings', 'lock']]]];

/* demo data — AffLeaderboard only, since there is no backend endpoint for it */
const FLEADERS = [
  ['Bella Styles', 'TikTok · 220k', 540, 3120000],
  ['Halima Beauty', 'IG · 204k', 389, 2280000],
  ['Lola Trends', 'TikTok · 178k', 421, 2460000],
  ['Femi Gadgets', 'YouTube · 112k', 167, 1080000],
  ['Chuka Electronics', 'IG · 95k', 134, 860000],
];

const STATUS_CLS = {
  pending: 'warn', pending_review: 'warn', processing: 'info', approved: 'info', in_review: 'warn',
  paid: 'ok', completed: 'ok', success: 'ok', successful: 'ok', active: 'ok', confirmed: 'ok',
  cancelled: 'bad', rejected: 'bad', failed: 'bad', declined: 'bad',
};
function statusLabel(s) { const l = String(s || 'pending').replace(/_/g, ' '); return l.charAt(0).toUpperCase() + l.slice(1); }
function Pill({ s }) {
  const key = String(s || '').toLowerCase().replace(/\s+/g, '_');
  return <span className={'adm-pill ' + (STATUS_CLS[key] || 'muted')}>{statusLabel(s)}</span>;
}

/* routing — replaces the legacy shell's `page` useState + `go(section) => setPage(section)`.
   `affPath` is also used by app/affiliate/dashboard/layout.js so the sidebar's active-state
   check and its own `go` build the same URLs as this module's pages do. */
const affPath = (key) => '/affiliate/dashboard' + (key === 'dashboard' ? '' : '/' + key);
function useAffGo() {
  const router = useRouter();
  return (section) => router.push(affPath(section));
}

// Fetched once per page that needs the affiliate's own profile/rate (greeting,
// commission-rate math on Promote/Links, Settings form) — kept as a small local
// hook rather than a shared context, matching this app's existing per-page-fetch
// convention. Falls back to the static AFF skeleton on error so nothing crashes
// before the real shape is confirmed live.
function useAffiliateSelf() {
  const [self, setSelf] = useState(AFF);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    affiliateApi.dashboard().then(res => {
      if (!active) return;
      const d = res?.data ?? res ?? {};
      const p = d.affiliate ?? d.profile ?? d;
      setSelf({
        name: p.name ?? p.full_name ?? AFF.name,
        email: p.email ?? AFF.email,
        tier: p.tier ?? p.tier_name ?? AFF.tier,
        rate: Number(p.commission_rate ?? p.rate ?? p.commission_pct ?? 0) || AFF.rate,
        id: p.id ?? p.affiliate_id ?? AFF.id,
        initials: (p.name ?? p.full_name ?? '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || AFF.initials,
      });
    }).catch(() => { if (active) setSelf(AFF); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return { self, loading };
}

function pick(obj, ...keys) { for (const k of keys) { if (obj?.[k] != null) return obj[k]; } return null; }
function asList(res) { return Array.isArray(res) ? res : (res?.data?.items ?? res?.items ?? res?.data ?? (Array.isArray(res?.data) ? res.data : [])) || []; }

/* ---- small shared bits ---- */
function FHead({ title, sub, children }) {
  return <div className="adm-h"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="adm-h-actions">{children}</div>}</div>;
}
function Loading() { return <div className="panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}><FIcon name="refresh" size={20} /> Loading…</div>; }
function Empty({ icon = 'package', title, body }) {
  return <div className="panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>
    <FIcon name={icon} size={26} /><h3 style={{ margin: '10px 0 4px', color: 'var(--text)' }}>{title}</h3>{body && <p className="muted" style={{ fontSize: 13.5 }}>{body}</p>}
  </div>;
}

function CopyField({ value, label }) {
  const [copied, setCopied] = useState(false);
  const affToast = useAffiliateToast();
  const copy = async () => { try { await navigator.clipboard.writeText(value); } catch (e) {} setCopied(true); affToast((label || 'Link') + ' copied'); setTimeout(() => setCopied(false), 1800); };
  return (
    <div className="aff-copyfield">
      <input readOnly value={value} onFocus={e => e.target.select()} />
      <button className="adm-btn primary" onClick={copy}><FIcon name={copied ? 'check' : 'copy'} size={15} stroke={copied ? 3 : 2} /> {copied ? 'Copied' : 'Copy'}</button>
    </div>
  );
}

/* QR placeholder built from CSS grid (deterministic from string) */
function QR({ text, size = 120 }) {
  const cells = [];
  let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  const N = 11;
  for (let i = 0; i < N * N; i++) { h = (h * 1103515245 + 12345) >>> 0; cells.push(((h >> 16) & 1) === 1); }
  // force finder-pattern corners on
  const corner = (r, c) => (r < 3 && c < 3) || (r < 3 && c >= N - 3) || (r >= N - 3 && c < 3);
  return (
    <div className="aff-qr" style={{ width: size, height: size, gridTemplateColumns: `repeat(${N},1fr)` }} aria-label="QR code">
      {cells.map((on, i) => { const r = Math.floor(i / N), c = i % N; const fill = corner(r, c) ? ((r % 2 === 0 || c % 2 === 0)) : on; return <span key={i} className={fill ? 'on' : ''} />; })}
    </div>
  );
}

function ShareRow({ url, msg }) {
  const enc = encodeURIComponent;
  const affToast = useAffiliateToast();
  const targets = [
    ['whatsapp', 'WhatsApp', `https://wa.me/?text=${enc(msg + ' ' + url)}`, false],
    ['facebook', 'Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, false],
    ['x', 'X', `https://twitter.com/intent/tweet?text=${enc(msg)}&url=${enc(url)}`, false],
    ['instagram', 'Instagram', 'https://www.instagram.com/', true],
    ['tiktok', 'TikTok', 'https://www.tiktok.com/', true],
  ];
  return (
    <div className="aff-share-row">
      {targets.map(([cls, label, href, copyFirst]) => (
        <button key={cls} className={'aff-share-btn ' + cls} title={'Share on ' + label} onClick={async () => { if (copyFirst) { try { await navigator.clipboard.writeText(url); affToast('Link copied — paste it in ' + label); } catch (e) {} } window.open(href, '_blank', 'noopener,noreferrer'); }}>
          <SocialMark name={label === 'X' ? 'X' : label} size={16} />
        </button>
      ))}
    </div>
  );
}

/* styled select (custom popover; native options can't be themed) */
function FSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc); window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className={'fsel' + (open ? ' open' : '')} ref={ref}>
      <button type="button" className="fsel-trigger" onClick={() => setOpen(o => !o)}><span>{value}</span><FIcon name="chevdown" size={15} className="fsel-chev" /></button>
      {open && (
        <div className="fsel-pop" role="listbox">
          {options.map(o => (
            <button type="button" key={o} role="option" aria-selected={o === value} className={'fsel-opt' + (o === value ? ' on' : '')} onClick={() => { onChange && onChange(o); setOpen(false); }}>
              {o}{o === value && <FIcon name="check" size={15} stroke={3} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* pagination hook + component */
function usePager(list, dep, per = 10) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [dep]);
  const pages = Math.max(1, Math.ceil(list.length / per));
  const cur = Math.min(page, pages);
  const shown = list.slice((cur - 1) * per, cur * per);
  return { shown, page: cur, pages, setPage };
}
function FPager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const win = []; for (let i = 1; i <= pages; i++) { if (i === 1 || i === pages || Math.abs(i - page) <= 1) win.push(i); else if (win[win.length - 1] !== '…') win.push('…'); }
  return (
    <div className="aff-pager">
      <button className="aff-pg" disabled={page === 1} onClick={() => onPage(page - 1)}><FIcon name="chevleft" size={16} /></button>
      {win.map((p, i) => p === '…' ? <span key={'g' + i} className="aff-pg-gap">…</span> : <button key={p} className={'aff-pg' + (p === page ? ' on' : '')} onClick={() => onPage(p)}>{p}</button>)}
      <button className="aff-pg" disabled={page === pages} onClick={() => onPage(page + 1)}><FIcon name="chevright" size={16} /></button>
    </div>
  );
}

/* ============ normalizers ============ */
function normalizeReferral(r) {
  return {
    id: r.id,
    name: pick(r, 'customer_name', 'name') ?? r.customer?.name ?? 'Customer',
    signup: pick(r, 'created_at', 'signup_at', 'date'),
    purchase: pick(r, 'purchased_at', 'order_date', 'converted_at'),
    orderValue: Number(pick(r, 'order_total', 'order_value', 'amount') ?? 0),
    commission: Number(pick(r, 'commission', 'commission_amount') ?? 0),
    status: pick(r, 'status') ?? 'pending',
  };
}
function normalizeLedgerEntry(t) {
  const amount = Number(pick(t, 'amount', 'value') ?? 0);
  return {
    id: t.id,
    desc: pick(t, 'description', 'title', 'label') ?? pick(t, 'type') ?? 'Transaction',
    date: pick(t, 'created_at', 'date'),
    amount,
    status: pick(t, 'status') ?? 'completed',
  };
}
function normalizeWithdrawal(w) {
  return {
    id: w.id,
    date: pick(w, 'created_at', 'requested_at', 'date'),
    amount: Number(pick(w, 'amount') ?? 0),
    method: pick(w, 'method', 'payout_method', 'channel') ?? pick(w, 'payout_method_name') ?? 'Bank Transfer',
    status: pick(w, 'status') ?? 'pending',
  };
}
function normalizeLink(l) {
  return {
    id: l.id,
    productId: pick(l, 'product_id'),
    productName: l.product?.name ?? pick(l, 'name', 'title'),
    url: pick(l, 'url', 'short_url', 'link'),
    clicks: Number(pick(l, 'clicks', 'click_count') ?? 0),
    orders: Number(pick(l, 'orders', 'order_count', 'conversions') ?? 0),
    earned: Number(pick(l, 'earnings', 'commission', 'total_commission') ?? 0),
  };
}
function normalizePromoCode(c) {
  return {
    id: c.id,
    code: pick(c, 'code') ?? '',
    pct: Number(pick(c, 'discount_percentage', 'percentage') ?? 0) / 100,
    uses: Number(pick(c, 'uses', 'use_count', 'redemption_count') ?? 0),
    created: pick(c, 'created_at'),
  };
}
function normalizePayoutMethod(m) {
  return {
    id: m.id,
    type: pick(m, 'type', 'channel') ?? 'bank',
    label: pick(m, 'label', 'bank_name', 'name') ?? 'Payout method',
    accountNumber: pick(m, 'account_number', 'masked_account_number'),
    accountName: pick(m, 'account_name'),
    isDefault: Boolean(pick(m, 'is_default', 'default')),
    verified: Boolean(pick(m, 'verified', 'is_verified')),
  };
}
function normalizePromotable(p) {
  return {
    id: pick(p, 'product_id', 'id'),
    name: p.product?.name ?? pick(p, 'name', 'title') ?? 'Product',
    slug: p.product?.slug ?? pick(p, 'slug'),
    price: Number(p.product?.price ?? pick(p, 'price') ?? 0),
    rate: pick(p, 'commission_rate', 'rate') != null ? Number(pick(p, 'commission_rate', 'rate')) : null,
    image: p.product?.images?.[0]?.url ?? p.product?.image ?? null,
    raw: p,
  };
}
function normalizeResource(r) {
  return {
    id: r.id,
    title: pick(r, 'title', 'name') ?? 'Resource',
    type: pick(r, 'type', 'category') ?? 'file',
    description: pick(r, 'description', 'summary') ?? '',
  };
}

function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/* ============ OVERVIEW ============ */
function AffOverview() {
  const affToast = useAffiliateToast();
  const { self } = useAffiliateSelf();
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gen, setGen] = useState(false);
  const go = useAffGo();

  useEffect(() => {
    let active = true;
    Promise.all([affiliateApi.dashboard(), affiliateApi.referrals({ per_page: 5 })])
      .then(([dashRes, refRes]) => {
        if (!active) return;
        const d = dashRes?.data ?? dashRes ?? {};
        setStats({
          totalEarnings: Number(pick(d, 'total_earnings', 'lifetime_earnings', 'total_commission') ?? 0),
          pending: Number(pick(d, 'pending_earnings', 'pending_commission', 'pending') ?? 0),
          availableBalance: Number(pick(d, 'available_balance', 'balance', 'wallet_balance') ?? 0),
          referralSales: Number(pick(d, 'referral_sales', 'total_sales', 'sales_volume') ?? 0),
          totalClicks: Number(pick(d, 'total_clicks', 'clicks') ?? 0),
          orders: Number(pick(d, 'orders_count', 'total_orders', 'orders') ?? 0),
          conversion: pick(d, 'conversion_rate') != null ? Number(pick(d, 'conversion_rate')) : null,
          activeLinks: Number(pick(d, 'active_links', 'links_count') ?? 0),
          series: Array.isArray(d.earnings_over_time) ? d.earnings_over_time : [],
          sources: Array.isArray(d.traffic_sources) ? d.traffic_sources : [],
        });
        setReferrals(asList(refRes).map(normalizeReferral));
      })
      .catch(error => { if (active) affToast(messageFrom(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [affToast]);

  if (loading) return <><FHead title="Dashboard" /><Loading /></>;
  const s = stats || {};
  return (
    <>
      <FHead title={'Welcome back' + (self.name && self.name !== AFF.name ? ', ' + self.name.split(' ')[0] : '')} sub="Here’s how your Limitra partnership is performing.">
        <button className="adm-btn primary" onClick={() => setGen(true)}><FIcon name="plus" size={15} /> Generate a link</button>
      </FHead>
      {gen && <GenLinkModal onClose={() => setGen(false)} />}
      <div className="kpi-grid">
        <Kpi ic="dollar" tint="#1F8A5B" label="Total earnings" val={fn(s.totalEarnings)} />
        <Kpi ic="clock" tint="#F5A623" label="Pending" val={fn(s.pending)} />
        <Kpi ic="card" tint="#0438B6" label="Available balance" val={fn(s.availableBalance)} />
        <Kpi ic="bag" tint="#F67208" label="Referral sales" val={fn(s.referralSales)} />
      </div>
      <div className="kpi-grid" style={{ marginTop: 14 }}>
        <Kpi ic="eye" tint="#7A5AE0" label="Total clicks" val={s.totalClicks.toLocaleString()} />
        <Kpi ic="truck" tint="#0438B6" label="Orders" val={s.orders.toLocaleString()} />
        <Kpi ic="spark" tint="#1F8A5B" label="Conversion" val={s.conversion != null ? s.conversion.toFixed(1) + '%' : '—'} />
        <Kpi ic="share" tint="#F67208" label="Active links" val={s.activeLinks.toLocaleString()} />
      </div>
      {(s.series.length > 0 || s.sources.length > 0) && (
        <div className="adm-row c2">
          {s.series.length > 0 && <div className="panel"><div className="panel-h"><h3>Earnings over time</h3></div>
            <BarChart data={s.series.map(p => Number(p.value ?? p.amount ?? 0))} labels={s.series.map(p => p.label ?? p.date ?? '')} alt /></div>}
          {s.sources.length > 0 && <div className="panel"><div className="panel-h"><h3>Traffic sources</h3></div>
            <Donut segments={s.sources.map((t, i) => ({ label: t.label ?? t.source ?? 'Source', v: Number(t.value ?? t.clicks ?? 0), c: ['#F67208', '#1F8A5B', '#0438B6', '#7A5AE0'][i % 4] }))} /></div>}
        </div>
      )}
      <div className="panel" style={{ padding: 0 }}>
        <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>Recent referrals</h3><button className="link-btn" onClick={() => go('referrals')}>View all</button></div>
        {referrals.length === 0 ? <div style={{ padding: '28px 20px', color: 'var(--text-faint)' }}>No referrals yet — share a link to get started.</div> : (
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Referral</th><th>Purchase</th><th>Order value</th><th>Commission</th><th>Status</th></tr></thead>
          <tbody>{referrals.map(r => (
            <tr key={r.id}><td><div className="adm-prod"><span className="adm-li-av">{r.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span><b>{r.name}</b></div></td>
              <td className="muted">{r.purchase ? shortDate(r.purchase) : '—'}</td><td>{r.orderValue ? fn(r.orderValue) : '—'}</td><td><b>{r.commission ? fn(r.commission) : '—'}</b></td><td><Pill s={r.status} /></td></tr>
          ))}</tbody>
        </table></div>)}
      </div>
    </>
  );
}

/* ============ PERFORMANCE ============ */
function AffPerformance() {
  const affToast = useAffiliateToast();
  const [gran, setGran] = useState('Weekly');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    affiliateApi.analytics({ period: gran.toLowerCase() }).then(res => {
      if (!active) return;
      const d = res?.data ?? res ?? {};
      setData({
        revenue: Number(pick(d, 'revenue', 'revenue_generated', 'total_revenue') ?? 0),
        clicks: Number(pick(d, 'clicks', 'link_clicks') ?? 0),
        visitors: Number(pick(d, 'visitors', 'referred_visitors') ?? 0),
        conversion: pick(d, 'conversion_rate') != null ? Number(pick(d, 'conversion_rate')) : null,
        series: Array.isArray(d.series) ? d.series : (Array.isArray(d.chart) ? d.chart : []),
        topProducts: Array.isArray(d.top_products) ? d.top_products : [],
      });
    }).catch(error => { if (active) affToast(messageFrom(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [gran, affToast]);

  return (
    <>
      <FHead title="Performance" sub="Track clicks, conversions and revenue you’ve driven." />
      {loading ? <Loading /> : (
        <>
          <div className="kpi-grid">
            <Kpi ic="dollar" tint="#1F8A5B" label="Revenue generated" val={fn(data.revenue)} />
            <Kpi ic="eye" tint="#7A5AE0" label="Link clicks" val={data.clicks.toLocaleString()} />
            <Kpi ic="user" tint="#0438B6" label="Visitors referred" val={data.visitors.toLocaleString()} />
            <Kpi ic="spark" tint="#F67208" label="Conversion" val={data.conversion != null ? data.conversion.toFixed(1) + '%' : '—'} />
          </div>
          <div className="panel"><div className="panel-h"><h3>Earnings</h3><div className="seg">{['Daily', 'Weekly', 'Monthly'].map(g => <button key={g} className={gran === g ? 'on' : ''} onClick={() => { setGran(g); setLoading(true); }}>{g}</button>)}</div></div>
            {data.series.length > 0
              ? <BarChart key={gran} data={data.series.map(p => Number(p.value ?? p.amount ?? 0))} labels={data.series.map(p => p.label ?? p.date ?? '')} alt />
              : <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-faint)' }}>Not enough data yet for this period.</div>}
          </div>
          <div className="panel" style={{ padding: 0 }}>
            <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>Top performing products</h3></div>
            {data.topProducts.length === 0 ? <div style={{ padding: '28px 20px', color: 'var(--text-faint)' }}>No product activity yet.</div> : (
            <div className="adm-table-wrap"><table className="adm-table">
              <thead><tr><th>Product</th><th>Clicks</th><th>Orders</th><th>Revenue</th><th>Commission</th></tr></thead>
              <tbody>{data.topProducts.map((tp, i) => { const p = byId(tp.product_id); return (
                <tr key={tp.product_id ?? i}><td><div className="adm-prod">{p && <span className="adm-prod-thumb"><FThumb product={p} src={FREAL[p.id]} /></span>}<b>{p?.name?.split(',')[0] ?? tp.name ?? 'Product'}</b></div></td>
                  <td>{Number(tp.clicks ?? 0)}</td><td>{Number(tp.orders ?? 0)}</td><td>{fn(Number(tp.revenue ?? 0))}</td><td><b>{fn(Number(tp.commission ?? 0))}</b></td></tr>
              ); })}</tbody>
            </table></div>)}
          </div>
        </>
      )}
    </>
  );
}

/* ============ PROMOTION CENTER ============ */
function usePromotableProducts() {
  const affToast = useAffiliateToast();
  const [items, setItems] = useState(null);
  useEffect(() => {
    let active = true;
    affiliateApi.promotableProducts().then(res => {
      if (!active) return;
      setItems(asList(res).map(normalizePromotable));
    }).catch(error => { if (active) { affToast(messageFrom(error)); setItems([]); } });
    return () => { active = false; };
  }, [affToast]);
  return items; // null while loading
}

function AffPromote() {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const items = usePromotableProducts();
  const list = (items || []).filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  return (
    <>
      <FHead title="Promotion Center" sub="Browse products and generate your referral links instantly." />
      <div className="adm-filters"><div className="adm-mini-search"><FIcon name="search" size={16} className="muted" /><input placeholder="Search products to promote…" value={q} onChange={e => setQ(e.target.value)} /></div></div>
      {items === null ? <Loading /> : items.length === 0 ? <Empty icon="bag" title="No promotable products yet" /> : (
      <div className="aff-promo-grid">
        {list.map(p => (
          <div className="aff-promo-card" key={p.id}>
            <div className="aff-promo-thumb">{p.image ? <img src={p.image} alt="" /> : <FThumb product={{ id: p.id, name: p.name }} src={FREAL[p.id]} />}</div>
            <div className="aff-promo-body">
              <b className="aff-promo-name">{p.name}</b>
              <div className="aff-promo-meta"><span className="aff-promo-price">{fn(p.price)}</span>{p.rate != null && <span className="aff-promo-comm">{p.rate}% · {fn(Math.round(p.price * p.rate / 100))}</span>}</div>
              <button className="adm-btn primary block" onClick={() => setSel(p)}><FIcon name="share" size={15} /> Get link</button>
            </div>
          </div>
        ))}
      </div>)}
      {sel && <LinkModal product={sel} onClose={() => setSel(null)} />}
    </>
  );
}

function GenLinkModal({ onClose }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const items = usePromotableProducts();
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; }; }, [onClose]);
  if (sel) return <LinkModal product={sel} onClose={onClose} />;
  const list = (items || []).filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div className="role-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="role-modal">
        <div className="role-modal-h">
          <div><h3 style={{ fontSize: 18 }}>Generate a referral link</h3><small className="muted">Pick a product to create your link</small></div>
          <button className="role-modal-x" onClick={onClose}><FIcon name="close" size={18} /></button>
        </div>
        <div className="role-modal-b">
          <div className="gen-pick-search"><FIcon name="search" size={17} /><input autoFocus placeholder="Search products to promote…" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div className="gen-pick-list">
            {items === null ? <Loading /> : list.map(p => (
              <button key={p.id} className="gen-pick" onClick={() => setSel(p)}>
                <span className="adm-prod-thumb">{p.image ? <img src={p.image} alt="" /> : <FThumb product={{ id: p.id, name: p.name }} src={FREAL[p.id]} />}</span>
                <div className="gen-pick-info"><b>{p.name}</b><small className="muted">{fn(p.price)}{p.rate != null ? ` · ${p.rate}% commission` : ''}</small></div>
                <span className="gen-pick-go"><FIcon name="arrowr" size={16} /></span>
              </button>
            ))}
            {items !== null && list.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)' }}>No products match “{q}”.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkModal({ product, onClose }) {
  const affToast = useAffiliateToast();
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(true);
  const msg = `Check out ${product.name} on Limitra, ${fn(product.price)}`;
  useEffect(() => {
    let active = true;
    affiliateApi.createLink({ product_id: product.id }).then(res => {
      if (!active) return;
      const l = res?.data ?? res ?? {};
      setLink(pick(l, 'url', 'short_url', 'link') ?? (product.slug ? aff_link(product.slug) : `${SITE}/product/${product.id}`));
    }).catch(error => {
      if (!active) return;
      affToast(messageFrom(error));
      setLink(product.slug ? aff_link(product.slug) : `${SITE}/product/${product.id}`);
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [product, affToast]);
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="role-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="role-modal">
        <div className="role-modal-h">
          <div className="row" style={{ gap: 12 }}><span className="adm-prod-thumb" style={{ width: 44, height: 44 }}>{product.image ? <img src={product.image} alt="" /> : <FThumb product={{ id: product.id, name: product.name }} src={FREAL[product.id]} />}</span>
            <div><h3 style={{ fontSize: 17 }}>{product.name}</h3>{product.rate != null && <small className="muted">{product.rate}% commission · {fn(Math.round(product.price * product.rate / 100))} per sale</small>}</div></div>
          <button className="role-modal-x" onClick={onClose}><FIcon name="close" size={18} /></button>
        </div>
        <div className="role-modal-b">
          {busy ? <Loading /> : (<>
            <div className="aff-link-head"><span className="adm-field-label">Your referral link</span></div>
            <CopyField value={link} label="Referral link" />
            <div className="aff-qr-block">
              <QR text={link} size={130} />
              <div><b>Share QR code</b><p className="muted" style={{ fontSize: 13 }}>Download or share the QR code so shoppers can scan it and buy through your link.</p>
                <ShareRow url={link} msg={msg} /></div>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

/* ============ MY LINKS ============ */
function AffLinks() {
  const affToast = useAffiliateToast();
  const [links, setLinks] = useState(null);
  const load = useCallback(() => {
    affiliateApi.links().then(res => setLinks(asList(res).map(normalizeLink))).catch(error => { affToast(messageFrom(error)); setLinks([]); });
  }, [affToast]);
  useEffect(() => { load(); }, [load]);
  const { shown, page, pages, setPage } = usePager(links || [], links?.length);
  const remove = async (id) => {
    try { await affiliateApi.removeLink(id); setLinks(cur => cur.filter(l => l.id !== id)); affToast('Link removed'); }
    catch (error) { affToast(messageFrom(error)); }
  };
  return (
    <>
      <FHead title="My Links" sub="Every referral link you’ve generated, with live stats." />
      {links === null ? <Loading /> : links.length === 0 ? <Empty icon="share" title="No links yet" body="Generate one from the Promotion Center." /> : (
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Product</th><th>Link</th><th>Clicks</th><th>Orders</th><th>Earned</th><th></th></tr></thead>
          <tbody>{shown.map(l => { const p = byId(l.productId); return (
            <tr key={l.id}><td><div className="adm-prod">{p && <span className="adm-prod-thumb"><FThumb product={p} src={FREAL[p.id]} /></span>}<b>{p?.name?.split(',')[0] ?? l.productName ?? 'Product'}</b></div></td>
              <td><code className="aff-link-code">{l.url}</code></td>
              <td>{l.clicks}</td><td>{l.orders}</td><td><b>{fn(l.earned)}</b></td>
              <td><div className="adm-rowact">
                <button title="Copy link" onClick={async () => { try { await navigator.clipboard.writeText(l.url); } catch (e) {} affToast('Link copied'); }}><FIcon name="copy" size={15} /></button>
                <button className="del" title="Remove" onClick={() => remove(l.id)}><FIcon name="trash" size={15} /></button>
              </div></td></tr>
          ); })}</tbody>
        </table><FPager page={page} pages={pages} onPage={setPage} /></div>
      </div>)}
    </>
  );
}

/* ============ MARKETING RESOURCES ============ */
function AffResources() {
  const affToast = useAffiliateToast();
  const [resources, setResources] = useState(null);
  useEffect(() => {
    affiliateApi.resources().then(res => setResources(asList(res).map(normalizeResource))).catch(error => { affToast(messageFrom(error)); setResources([]); });
  }, [affToast]);
  const ICONS = { image: 'image', video: 'video', template: 'share', email: 'mail', banner: 'image', logo: 'spark' };
  const download = async (r) => {
    try {
      const res = await affiliateApi.downloadResource(r.id);
      const url = res?.data?.url ?? res?.url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      else affToast('Downloading ' + r.title + '…');
    } catch (error) { affToast(messageFrom(error)); }
  };
  return (
    <>
      <FHead title="Marketing Center" sub="Ready-made creatives to help you convert, one-click download." />
      {resources === null ? <Loading /> : resources.length === 0 ? <Empty icon="gift" title="No marketing resources yet" /> : (
      <div className="aff-res-grid">
        {resources.map(r => (
          <div className="aff-res-card" key={r.id}>
            <span className="aff-res-ic" style={{ background: '#0438B622', color: '#0438B6' }}><FIcon name={ICONS[r.type] || 'gift'} size={22} /></span>
            <b>{r.title}</b><small className="muted">{r.description}</small>
            <button className="adm-btn ghost block" onClick={() => download(r)}><FIcon name="download" size={15} /> Download</button>
          </div>
        ))}
      </div>)}
    </>
  );
}

/* ============ EARNINGS ============ */
function AffEarnings() {
  const affToast = useAffiliateToast();
  const go = useAffGo();
  const [stats, setStats] = useState(null);
  const [txns, setTxns] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.all([affiliateApi.dashboard(), affiliateApi.ledger()]).then(([dashRes, ledgerRes]) => {
      if (!active) return;
      const d = dashRes?.data ?? dashRes ?? {};
      setStats({
        total: Number(pick(d, 'total_earnings', 'lifetime_earnings') ?? 0),
        pending: Number(pick(d, 'pending_earnings', 'pending') ?? 0),
        approved: Number(pick(d, 'approved_earnings', 'approved') ?? 0),
        withdrawable: Number(pick(d, 'available_balance', 'balance') ?? 0),
      });
      setTxns(asList(ledgerRes).map(normalizeLedgerEntry));
    }).catch(error => { if (active) affToast(messageFrom(error)); }).finally(() => {});
    return () => { active = false; };
  }, [affToast]);
  const s = stats || { total: 0, pending: 0, approved: 0, withdrawable: 0 };
  return (
    <>
      <FHead title="Earnings" sub="Your commission breakdown and transaction history.">
        <button className="adm-btn primary" onClick={() => go('withdraw')}><FIcon name="card" size={15} /> Withdraw</button>
      </FHead>
      <div className="kpi-grid">
        <Kpi ic="dollar" tint="#1F8A5B" label="Total earned" val={fn(s.total)} />
        <Kpi ic="clock" tint="#F5A623" label="Pending" val={fn(s.pending)} />
        <Kpi ic="check" tint="#0438B6" label="Approved" val={fn(s.approved)} />
        <Kpi ic="card" tint="#F67208" label="Withdrawable" val={fn(s.withdrawable)} />
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>Transaction history</h3></div>
        {txns === null ? <Loading /> : txns.length === 0 ? <div style={{ padding: '28px 20px', color: 'var(--text-faint)' }}>No transactions yet.</div> : (
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Description</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>{txns.map(t => (
            <tr key={t.id}><td><b>{t.desc}</b></td><td className="muted">{shortDate(t.date)}</td>
              <td className={t.amount < 0 ? 'aff-neg' : 'aff-pos'}><b>{t.amount < 0 ? '−' + fn(-t.amount) : '+' + fn(t.amount)}</b></td>
              <td><Pill s={t.status} /></td></tr>
          ))}</tbody>
        </table></div>)}
      </div>
    </>
  );
}

/* ============ WITHDRAWALS ============ */
function AffWithdraw() {
  const affToast = useAffiliateToast();
  const [balance, setBalance] = useState(0);
  const [methods, setMethods] = useState(null);
  const [withdrawals, setWithdrawals] = useState(null);
  const [amt, setAmt] = useState('');
  const [methodId, setMethodId] = useState(null);
  const [busy, setBusy] = useState(false);
  const min = 5000;

  const load = useCallback(() => {
    Promise.all([affiliateApi.dashboard(), affiliateApi.payoutMethods(), affiliateApi.withdrawals()]).then(([dashRes, methodsRes, wdRes]) => {
      const d = dashRes?.data ?? dashRes ?? {};
      setBalance(Number(pick(d, 'available_balance', 'balance') ?? 0));
      const ms = asList(methodsRes).map(normalizePayoutMethod);
      setMethods(ms);
      setMethodId(cur => cur ?? ms.find(m => m.isDefault)?.id ?? ms[0]?.id ?? null);
      setWithdrawals(asList(wdRes).map(normalizeWithdrawal));
    }).catch(error => affToast(messageFrom(error)));
  }, [affToast]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const v = parseInt(amt, 10);
    if (!v || v < min) { affToast('Minimum withdrawal is ' + fn(min)); return; }
    if (v > balance) { affToast('Amount exceeds available balance'); return; }
    if (!methodId) { affToast('Add a payout method in Settings first'); return; }
    setBusy(true);
    try {
      await affiliateApi.requestWithdrawal({ amount: v, payout_method_id: methodId });
      affToast('Withdrawal request submitted'); setAmt(''); load();
    } catch (error) { affToast(messageFrom(error)); } finally { setBusy(false); }
  };

  const activeMethod = (methods || []).find(m => m.id === methodId);
  return (
    <>
      <FHead title="Withdrawals" sub="Request a payout to your bank or wallet." />
      <div className="adm-row c2">
        <div className="panel aff-wd-card">
          <span className="aff-wd-label">Available balance</span>
          <div className="aff-wd-bal">{fn(balance)}</div>
          <label className="adm-field"><span>Amount to withdraw</span><input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder={'Min. ' + fn(min)} /></label>
          {methods !== null && methods.length > 0 && (
            <div className="adm-field"><span>Payout method</span>
              <div className="aff-method-row">{methods.map(m => <button key={m.id} className={'aff-method' + (methodId === m.id ? ' on' : '')} onClick={() => setMethodId(m.id)}>{m.label}</button>)}</div>
            </div>
          )}
          {methods !== null && methods.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No payout method on file — add one from Settings before requesting a withdrawal.</p>}
          {activeMethod && <div className="aff-wd-dest"><FIcon name="card" size={16} /> {activeMethod.label}{activeMethod.accountNumber ? ' ••' + String(activeMethod.accountNumber).slice(-4) : ''}{activeMethod.accountName ? ' · ' + activeMethod.accountName : ''}</div>}
          <button className="adm-btn primary block lg" onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Request withdrawal'}</button>
          <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>Payouts are processed within 1–3 business days.</p>
        </div>
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>Withdrawal history</h3></div>
          {withdrawals === null ? <Loading /> : withdrawals.length === 0 ? <div style={{ padding: '28px 20px', color: 'var(--text-faint)' }}>No withdrawals yet.</div> : (
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
            <tbody>{withdrawals.map(w => (
              <tr key={w.id}><td className="muted">{shortDate(w.date)}</td><td><b>{fn(w.amount)}</b></td><td>{w.method}</td><td><Pill s={w.status} /></td></tr>
            ))}</tbody>
          </table></div>)}
        </div>
      </div>
    </>
  );
}

/* ============ REFERRALS ============ */
function AffReferrals() {
  const affToast = useAffiliateToast();
  const [all, setAll] = useState(null);
  const [tab, setTab] = useState('All');
  const tabs = ['All', 'Approved', 'Pending', 'Paid', 'Cancelled'];
  useEffect(() => {
    affiliateApi.referrals({ per_page: 100 }).then(res => setAll(asList(res).map(normalizeReferral))).catch(error => { affToast(messageFrom(error)); setAll([]); });
  }, [affToast]);
  const list = (all || []).filter(r => tab === 'All' || statusLabel(r.status) === tab);
  const { shown, page, pages, setPage } = usePager(list, tab);
  return (
    <>
      <FHead title="Referrals" sub="Everyone who shopped through your links." />
      <div className="adm-filters">{tabs.map(t => <button key={t} className={'adm-chip' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{t}</button>)}</div>
      {all === null ? <Loading /> : (
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Referral</th><th>Signup</th><th>Purchase</th><th>Order value</th><th>Commission</th><th>Status</th></tr></thead>
          <tbody>{shown.map(r => (
            <tr key={r.id}><td><div className="adm-prod"><span className="adm-li-av">{r.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span><b>{r.name}</b></div></td>
              <td className="muted">{r.signup ? shortDate(r.signup) : '—'}</td><td className="muted">{r.purchase ? shortDate(r.purchase) : '—'}</td>
              <td>{r.orderValue ? fn(r.orderValue) : '—'}</td><td><b>{r.commission ? fn(r.commission) : '—'}</b></td><td><Pill s={r.status} /></td></tr>
          ))}</tbody>
        </table>{list.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-faint)' }}>No referrals with this status.</div>}<FPager page={page} pages={pages} onPage={setPage} /></div>
      </div>)}
    </>
  );
}

/* ============ LEADERBOARD ============
   No backend endpoint exists for this at all (not in the spec under any tag) —
   kept as a clearly-labeled preview rather than silently faking live rankings. */
function AffLeaderboard() {
  const [opt, setOpt] = useState(true);
  const affToast = useAffiliateToast();
  const ranked = [...FLEADERS].sort((a, b) => b[3] - a[3]);
  return (
    <>
      <FHead title="Leaderboard" sub="Top affiliates this month across Limitra." />
      <div className="adm-note" style={{ marginBottom: 16 }}><FIcon name="info" size={14} /> This is a preview — the leaderboard isn’t connected to live data yet.</div>
      <div className="aff-podium">
        {[ranked[1], ranked[0], ranked[2]].map((r) => { const rank = r === ranked[0] ? 1 : r === ranked[1] ? 2 : 3; return (
          <div className={'aff-pod aff-pod-' + rank} key={r[0]}>
            <span className="aff-pod-rank">{rank}</span>
            <span className="adm-li-av lg">{r[0].split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
            <b>{r[0]}</b><small className="muted">{r[1]}</small>
            <span className="aff-pod-sales">{fn(r[3])}</span>
          </div>
        ); })}
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>#</th><th>Affiliate</th><th>Channel</th><th>Sales</th><th>Revenue</th></tr></thead>
          <tbody>{ranked.map((r, i) => (
            <tr key={r[0]}><td><b>{i + 1}</b></td>
              <td><div className="adm-prod"><span className="adm-li-av">{r[0].split(' ').map(w => w[0]).join('').slice(0, 2)}</span><b>{r[0]}</b></div></td>
              <td className="muted">{r[1]}</td><td>{r[2]}</td><td><b>{fn(r[3])}</b></td></tr>
          ))}</tbody>
        </table></div>
      </div>
      <label className="aff-optout"><input type="checkbox" checked={opt} onChange={e => { setOpt(e.target.checked); affToast(e.target.checked ? 'You’re visible on the public leaderboard' : 'You’ve opted out of public ranking'); }} /> Show me on the public leaderboard</label>
    </>
  );
}

/* ============ PROMO CODES ============ */
function AffPromoCodes() {
  const affToast = useAffiliateToast();
  const [codes, setCodes] = useState(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [pct, setPct] = useState(10);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const allPct = [5, 10, 15];

  const load = useCallback(() => {
    affiliateApi.promoCodes().then(res => setCodes(asList(res).map(normalizePromoCode))).catch(error => { affToast(messageFrom(error)); setCodes([]); });
  }, [affToast]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(c)) { setErr('4–16 letters or numbers, no spaces'); return; }
    setBusy(true);
    try {
      await affiliateApi.createPromoCode({ code: c, discount_percentage: pct });
      setCreating(false); setCode(''); setErr('');
      affToast('Promo code ' + c + ' created');
      load();
    } catch (error) { setErr(messageFrom(error)); } finally { setBusy(false); }
  };
  const remove = async (id) => {
    try { await affiliateApi.removePromoCode(id); setCodes(cur => cur.filter(x => x.id !== id)); affToast('Promo code removed'); }
    catch (error) { affToast(messageFrom(error)); }
  };

  return (
    <>
      <FHead title="Promo Codes" sub="Create discount codes for your audience — applied at checkout and attributed to you.">
        <button className="adm-btn primary" onClick={() => { setCreating(true); setErr(''); }}><FIcon name="plus" size={15} /> Create code</button>
      </FHead>

      {codes === null ? <Loading /> : <>
        {codes.length === 0 && !creating && (
          <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
            <span className="aff-empty-ic"><FIcon name="tag" size={26} /></span>
            <h3 style={{ margin: '12px 0 4px' }}>No promo code yet</h3>
            <p className="muted" style={{ marginBottom: 16 }}>Create a code your audience can use for a discount at checkout.</p>
            <button className="adm-btn primary" onClick={() => setCreating(true)}><FIcon name="plus" size={15} /> Create your code</button>
          </div>
        )}

        {codes.length > 0 && (
          <div className="aff-code-grid">
            {codes.map(c => (
              <div key={c.id} className="aff-code-card">
                <div className="aff-code-top"><span className="aff-code-val">{c.code}</span></div>
                <div className="aff-code-pct">{Math.round(c.pct * 100)}% off</div>
                <div className="aff-code-meta"><span><FIcon name="bag" size={13} /> {c.uses} uses</span>{c.created && <span><FIcon name="clock" size={13} /> {shortDate(c.created)}</span>}</div>
                <div className="aff-code-actions">
                  <button className="adm-btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(c.code); } catch (e) {} affToast('Code copied'); }}><FIcon name="copy" size={14} /> Copy</button>
                  <button className="adm-btn ghost sm danger" onClick={() => remove(c.id)} title="Delete"><FIcon name="trash" size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>}

      {creating && (
        <div className="role-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setCreating(false); }}>
          <div className="role-modal" style={{ maxWidth: 440 }}>
            <div className="role-modal-h"><div><h3 style={{ fontSize: 18 }}>Create promo code</h3><small className="muted">Shoppers enter this at checkout</small></div><button className="role-modal-x" onClick={() => setCreating(false)}><FIcon name="close" size={18} /></button></div>
            <div className="role-modal-b">
              <label className="adm-field"><span>Code</span><input value={code} onChange={e => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setErr(''); }} placeholder="e.g. CHIDINMA10" maxLength={16} /></label>
              {err && <span className="err-msg" style={{ display: 'block', marginTop: -6, marginBottom: 8 }}>{err}</span>}
              <div className="adm-field"><span>Discount</span>
                <div className="aff-pct-row">{allPct.map(p => <button key={p} className={'aff-pct' + (pct === p ? ' on' : '')} onClick={() => setPct(p)}>{p}% off</button>)}</div>
              </div>
              <div className="aff-code-preview"><span className="muted">Preview</span><div><b>{code || 'YOURCODE'}</b> — {pct}% off at checkout</div></div>
            </div>
            <div className="role-modal-f"><button className="adm-btn ghost" onClick={() => setCreating(false)}>Cancel</button><button className="adm-btn primary" onClick={create} disabled={busy}><FIcon name="check" size={15} /> {busy ? 'Creating…' : 'Create code'}</button></div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============ SETTINGS ============ */
function AffSettings() {
  const affToast = useAffiliateToast();
  const { self } = useAffiliateSelf();
  // null until the admin types — lets the fetched profile populate the field
  // without an effect+setState just to mirror it into local state.
  const [nameOverride, setNameOverride] = useState(null);
  const [emailOverride, setEmailOverride] = useState(null);
  const name = nameOverride ?? (self.name === AFF.name ? '' : self.name);
  const email = emailOverride ?? self.email;
  const [methods, setMethods] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    affiliateApi.payoutMethods().then(res => setMethods(asList(res).map(normalizePayoutMethod))).catch(() => setMethods([]));
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    try { await affiliateApi.updateSettings({ name, email }); affToast('Profile saved'); }
    catch (error) { affToast(messageFrom(error)); }
    finally { setSavingProfile(false); }
  };
  const setDefault = async (id) => {
    try { await affiliateApi.setDefaultPayoutMethod(id); setMethods(cur => cur.map(m => ({ ...m, isDefault: m.id === id }))); affToast('Default payout method updated'); }
    catch (error) { affToast(messageFrom(error)); }
  };
  const removeMethod = async (id) => {
    try { await affiliateApi.removePayoutMethod(id); setMethods(cur => cur.filter(m => m.id !== id)); affToast('Payout method removed'); }
    catch (error) { affToast(messageFrom(error)); }
  };

  return (
    <>
      <FHead title="Profile & Settings" sub="Manage your affiliate profile and payout details." />
      <div className="adm-row c2">
        <div className="panel">
          <h3 style={{ marginBottom: 16 }}>Profile</h3>
          <div className="row" style={{ gap: 14, marginBottom: 18 }}><span className="adm-li-av lg">{self.initials}</span><div><b style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{self.name}</b><span className="adm-pill info" style={{ marginTop: 6, display: 'inline-block' }}>{self.tier}{self.rate ? ` · ${self.rate}% commission` : ''}</span></div></div>
          <label className="adm-field"><span>Full name</span><input value={name} onChange={e => setNameOverride(e.target.value)} /></label>
          <label className="adm-field"><span>Email</span><input value={email} onChange={e => setEmailOverride(e.target.value)} /></label>
          <button className="adm-btn primary" style={{ marginTop: 6 }} onClick={saveProfile} disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button>
        </div>
        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <h3 style={{ marginBottom: 16 }}>Payout methods</h3>
            {methods === null ? <Loading /> : methods.length === 0 ? (
              <p className="muted" style={{ fontSize: 13.5 }}>No payout method on file yet. Add a bank account to request withdrawals — connect this once the backend&rsquo;s add-method flow (including any verification step) is confirmed live.</p>
            ) : (
              <div className="aff-code-grid" style={{ gridTemplateColumns: '1fr' }}>
                {methods.map(m => (
                  <div key={m.id} className="aff-wd-dest" style={{ justifyContent: 'space-between' }}>
                    <span><FIcon name="card" size={16} /> {m.label}{m.accountNumber ? ' ••' + String(m.accountNumber).slice(-4) : ''} {m.isDefault && <span className="adm-pill ok" style={{ marginLeft: 6 }}>Default</span>}</span>
                    <div className="adm-rowact">
                      {!m.isDefault && <button title="Make default" onClick={() => setDefault(m.id)}><FIcon name="check" size={14} /></button>}
                      <button className="del" title="Remove" onClick={() => removeMethod(m.id)}><FIcon name="trash" size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="panel">
            <h3 style={{ marginBottom: 14 }}>Notifications</h3>
            <p className="muted" style={{ fontSize: 13 }}>Notification preferences aren’t connected to the backend yet.</p>
          </div>
        </div>
      </div>
    </>
  );
}

export {
  AFF, aff_link, FAFF_NAV, FLEADERS, STATUS_CLS,
  Pill, CopyField, QR, ShareRow, FSelect, usePager, FPager, fn, affPath, useAffGo,
  GenLinkModal, LinkModal,
  AffOverview, AffPerformance, AffPromote, AffLinks, AffResources, AffEarnings,
  AffWithdraw, AffReferrals, AffPromoCodes, AffLeaderboard, AffSettings,
};
