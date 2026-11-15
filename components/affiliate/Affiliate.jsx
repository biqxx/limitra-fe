'use client';
/* LIMITRA Affiliate Dashboard — wired to /api/affiliate/* endpoints via affiliateApi. */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { Icon } from '@/components/icons/Icon';
import { SocialMark } from '@/components/ui/SocialMark';
import { Kpi, BarChart, Donut } from '@/components/charts/Charts';
import { useStore } from '@/components/store/StoreProvider';
import { naira } from '@/lib/data';
import { affiliateApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { hasAffiliateAccess } from '@/lib/auth/permissions';
import { useAffiliateToast } from './AffiliateToastContext';

const FIcon = Icon;
const fn = naira;

const FAFF_NAV = [
  ['Overview', [['dashboard', 'Dashboard', 'grid'], ['analytics', 'Performance', 'spark']]],
  ['Promote', [['promote', 'Promotion Center', 'bag'], ['links', 'My Links', 'share'], ['resources', 'Marketing', 'gift']]],
  ['Earnings', [['earnings', 'Earnings', 'dollar'], ['withdraw', 'Withdrawals', 'card'], ['referrals', 'Referrals', 'user'], ['promocodes', 'Promo Codes', 'tag']]],
  ['Community', [['leaderboard', 'Tier & Ranking', 'flame']]],
  ['Account', [['settings', 'Profile & Settings', 'lock']]],
];

const FSTATUS = {
  Approved: 'info',
  Pending: 'warn',
  Paid: 'ok',
  Active: 'ok',
  Inactive: 'muted',
  Paused: 'muted',
  Cancelled: 'bad',
  Rejected: 'bad',
  Processing: 'info',
  Credit: 'ok',
  Debit: 'warn',
  Hold: 'warn',
  Release: 'info',
};

function capStatus(val) {
  if (!val) return 'Pending';
  const s = String(val).replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initialsOf(name) {
  return String(name || 'AF')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'AF';
}

function siteOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://limitra.ng';
}

/* ---- Affiliate shared context ---- */
const AffiliateCtx = createContext(null);
export function useAffiliate() {
  return useContext(AffiliateCtx);
}

export function AffiliateProvider({ children }) {
  const { user, isAuthenticated, authLoading } = useStore();
  const [dashboard, setDashboard] = useState(null);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const allowed = isAuthenticated && hasAffiliateAccess(user);

  const refreshDashboard = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const [dash, ledger] = await Promise.all([
        affiliateApi.dashboard(),
        affiliateApi.ledger({ per_page: 1 }).catch(() => null),
      ]);
      setDashboard(dash || null);
      const bal = ledger?.available_balance ?? dash?.pending_balance ?? 0;
      setAvailableBalance(Number(bal) || 0);
    } catch (e) {
      setError(messageFrom(e, 'Could not load affiliate dashboard'));
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    if (authLoading) return;
    if (!allowed) {
      setLoading(false);
      return;
    }
    refreshDashboard();
  }, [authLoading, allowed, refreshDashboard]);

  return (
    <AffiliateCtx.Provider value={{ dashboard, availableBalance, loading, error, refreshDashboard }}>
      {children}
    </AffiliateCtx.Provider>
  );
}

/* ---- Routing helpers ---- */
const affPath = (key) => '/affiliate/dashboard' + (key === 'dashboard' ? '' : '/' + key);
function useAffGo() {
  const router = useRouter();
  return (section) => router.push(affPath(section));
}

/* ---- Shared UI primitives ---- */
function FHead({ title, sub, children }) {
  return (
    <div className="adm-h">
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {children && <div className="adm-h-actions">{children}</div>}
    </div>
  );
}

function Pill({ s }) {
  const label = capStatus(s);
  return <span className={'adm-pill ' + (FSTATUS[label] || 'muted')}>{label}</span>;
}

function CopyField({ value, label }) {
  const [copied, setCopied] = useState(false);
  const affToast = useAffiliateToast();
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); } catch (e) {}
    setCopied(true);
    affToast((label || 'Link') + ' copied');
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="aff-copyfield">
      <input readOnly value={value} onFocus={(e) => e.target.select()} />
      <button className="adm-btn primary" onClick={copy}>
        <FIcon name={copied ? 'check' : 'copy'} size={15} stroke={copied ? 3 : 2} /> {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function QR({ text, size = 120 }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!text) {
      setSrc('');
      return;
    }
    QRCode.toDataURL(String(text), {
      width: size * 2,
      margin: 1,
      color: { dark: '#0B1324', light: '#FFFFFF' },
    })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setSrc(''); });
    return () => { cancelled = true; };
  }, [text, size]);

  return (
    <div
      className="aff-qr"
      style={{ width: size, height: size, padding: 6, background: '#FFFFFF', display: 'grid', placeItems: 'center' }}
      aria-label="QR code"
    >
      {src ? <img src={src} alt={`QR code for ${text}`} width={size - 12} height={size - 12} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 4 }} /> : null}
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
        <button
          key={cls}
          className={'aff-share-btn ' + cls}
          title={'Share on ' + label}
          onClick={async () => {
            if (copyFirst) {
              try {
                await navigator.clipboard.writeText(url);
                affToast('Link copied — paste it in ' + label);
              } catch (e) {}
            }
            window.open(href, '_blank', 'noopener,noreferrer');
          }}
        >
          <SocialMark name={label === 'X' ? 'X' : label} size={16} />
        </button>
      ))}
    </div>
  );
}

function FSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className={'fsel' + (open ? ' open' : '')} ref={ref}>
      <button type="button" className="fsel-trigger" onClick={() => setOpen((o) => !o)}>
        <span>{value}</span><FIcon name="chevdown" size={15} className="fsel-chev" />
      </button>
      {open && (
        <div className="fsel-pop" role="listbox">
          {options.map((o) => (
            <button
              type="button"
              key={o}
              role="option"
              aria-selected={o === value}
              className={'fsel-opt' + (o === value ? ' on' : '')}
              onClick={() => { onChange && onChange(o); setOpen(false); }}
            >
              {o}{o === value && <FIcon name="check" size={15} stroke={3} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FPager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const win = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) win.push(i);
    else if (win[win.length - 1] !== '…') win.push('…');
  }
  return (
    <div className="aff-pager">
      <button className="aff-pg" disabled={page === 1} onClick={() => onPage(page - 1)}><FIcon name="chevleft" size={16} /></button>
      {win.map((p, i) => p === '…'
        ? <span key={'g' + i} className="aff-pg-gap">…</span>
        : <button key={p} className={'aff-pg' + (p === page ? ' on' : '')} onClick={() => onPage(p)}>{p}</button>)}
      <button className="aff-pg" disabled={page === pages} onClick={() => onPage(page + 1)}><FIcon name="chevright" size={16} /></button>
    </div>
  );
}

function EmptyState({ icon = 'info', title, desc, action }) {
  return (
    <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
      <span className="aff-empty-ic"><FIcon name={icon} size={24} /></span>
      <h3 style={{ margin: '12px 0 4px' }}>{title}</h3>
      {desc && <p className="muted" style={{ marginBottom: action ? 16 : 0 }}>{desc}</p>}
      {action}
    </div>
  );
}

/* ============ OVERVIEW ============ */
function AffOverview() {
  const { user } = useStore();
  const { dashboard, availableBalance, loading, error, refreshDashboard } = useAffiliate();
  const [gen, setGen] = useState(false);
  const [series, setSeries] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [activeLinksCount, setActiveLinksCount] = useState(0);
  const go = useAffGo();

  const loadExtras = useCallback(async () => {
    try {
      const [analyticsRes, commRes, linksRes] = await Promise.all([
        affiliateApi.analytics().catch(() => null),
        affiliateApi.commissions({ per_page: 5 }).catch(() => null),
        affiliateApi.links({ per_page: 50 }).catch(() => null),
      ]);
      setSeries(Array.isArray(analyticsRes?.series) ? analyticsRes.series : []);
      setCommissions(Array.isArray(commRes?.items) ? commRes.items : []);
      const linkItems = Array.isArray(linksRes?.items) ? linksRes.items : [];
      setActiveLinksCount(linkItems.filter((l) => l.is_active !== false).length);
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const firstName = (user?.name || user?.username || 'Affiliate').split(' ')[0];
  const m = dashboard?.metrics || {};
  const lastDays = series.slice(-10);
  const chartData = lastDays.map((d) => Number(d.earnings || 0));
  const chartLabels = lastDays.map((d) => String(d.date || '').slice(5));

  const directSales = Number(m.direct_sales ?? dashboard?.direct_sales ?? 0);
  const indirectSales = Number(m.indirect_sales ?? dashboard?.indirect_sales ?? 0);
  const pendingComm = Number(m.pending_commissions ?? dashboard?.pending_commissions ?? 0);
  const approvedComm = Number(m.approved_commissions ?? dashboard?.approved_commissions ?? 0);

  const donutSegments = (directSales + indirectSales) > 0
    ? [
        { label: 'Direct sales', v: directSales, c: '#F67208' },
        { label: 'Indirect sales', v: indirectSales, c: '#0438B6' },
      ]
    : [
        { label: 'Approved', v: approvedComm || 0, c: '#1F8A5B' },
        { label: 'Pending', v: pendingComm || 0, c: '#F5A623' },
      ];

  return (
    <>
      <FHead title={'Welcome back, ' + firstName} sub={dashboard?.code ? `Affiliate code: ${dashboard.code} · ${dashboard.current_tier || 'Bronze'} tier (${dashboard.commission_rate ?? 0}%)` : 'Here’s how your Limitra partnership is performing.'}>
        <button className="adm-btn primary" onClick={() => setGen(true)}><FIcon name="plus" size={15} /> Generate a link</button>
      </FHead>
      {error && <div className="panel" style={{ borderColor: 'var(--red)', color: 'var(--red)', marginBottom: 14 }}>{error}</div>}
      {gen && <GenLinkModal onClose={() => setGen(false)} onCreated={() => { refreshDashboard(); loadExtras(); }} />}
      <div className="kpi-grid">
        <Kpi ic="dollar" tint="#1F8A5B" label="Total earnings" val={loading ? '…' : fn(Number(dashboard?.total_earnings || 0))} delta="" up />
        <Kpi ic="clock" tint="#F5A623" label="Pending balance" val={loading ? '…' : fn(Number(dashboard?.pending_balance || 0))} delta="" up />
        <Kpi ic="card" tint="#0438B6" label="Available balance" val={loading ? '…' : fn(Number(availableBalance || 0))} delta="" up />
        <Kpi ic="bag" tint="#F67208" label="Total paid" val={loading ? '…' : fn(Number(dashboard?.total_paid || 0))} delta="" up />
      </div>
      <div className="kpi-grid" style={{ marginTop: 14 }}>
        <Kpi ic="eye" tint="#7A5AE0" label="Total clicks" val={loading ? '…' : String(m.total_clicks ?? 0)} delta="" up />
        <Kpi ic="truck" tint="#0438B6" label="Total sales" val={loading ? '…' : String(m.total_sales ?? dashboard?.total_sales ?? 0)} delta="" up />
        <Kpi ic="spark" tint="#1F8A5B" label="Conversion" val={loading ? '…' : `${Number(m.conversion_rate_percentage ?? 0)}%`} delta="" up />
        <Kpi ic="share" tint="#F67208" label="Active links" val={loading ? '…' : String(activeLinksCount)} delta="" up />
      </div>
      <div className="adm-row c2">
        <div className="panel">
          <div className="panel-h"><h3>Earnings over time</h3><span className="adm-pill info">Last 10 days</span></div>
          {chartData.some((v) => v > 0)
            ? <BarChart data={chartData} labels={chartLabels} alt />
            : <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>No earnings recorded in this period yet.</p>}
        </div>
        <div className="panel">
          <div className="panel-h"><h3>{(directSales + indirectSales) > 0 ? 'Sales breakdown' : 'Commissions status'}</h3></div>
          {donutSegments.some((s) => s.v > 0)
            ? <Donut segments={donutSegments} />
            : <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>No sales or commissions recorded yet.</p>}
        </div>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="panel-h" style={{ padding: '18px 20px 0' }}>
          <h3>Recent commissions</h3>
          <button className="link-btn" onClick={() => go('earnings')}>View all</button>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Product</th><th>Date</th><th>Sale amount</th><th>Commission</th><th>Status</th></tr></thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.sale?.product?.name || `Order #${c.sale?.order_id || c.affiliate_sale_id || c.id}`}</b></td>
                  <td className="muted">{fmtDate(c.created_at)}</td>
                  <td>{c.sale?.sale_amount ? fn(Number(c.sale.sale_amount)) : '—'}</td>
                  <td><b>{fn(Number(c.commission_amount || 0))}</b></td>
                  <td><Pill s={c.payment_status} /></td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }} className="muted">No commissions recorded yet. Share your links to start earning!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ============ PERFORMANCE ============ */
function AffPerformance() {
  const { dashboard } = useAffiliate();
  const [range, setRange] = useState('30D');
  const [series, setSeries] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const days = range === '7D' ? 7 : range === '90D' ? 90 : 30;
    const toDate = new Date();
    const fromDate = new Date(Date.now() - days * 86400000);
    const fmt = (d) => d.toISOString().slice(0, 10);

    setLoading(true);
    Promise.all([
      affiliateApi.analytics({ from_date: fmt(fromDate), to_date: fmt(toDate) }).catch(() => null),
      affiliateApi.sales({ from_date: fmt(fromDate), to_date: fmt(toDate), per_page: 50 }).catch(() => null),
    ]).then(([aRes, sRes]) => {
      if (!active) return;
      setSeries(Array.isArray(aRes?.series) ? aRes.series : []);
      setSales(Array.isArray(sRes?.items) ? sRes.items : []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [range]);

  const totalRevenue = series.reduce((s, d) => s + Number(d.sales_volume || 0), 0);
  const totalClicks = series.reduce((s, d) => s + Number(d.clicks || 0), 0);
  const totalSales = series.reduce((s, d) => s + Number(d.sales || 0), 0);
  const totalEarned = series.reduce((s, d) => s + Number(d.earnings || 0), 0);
  const convRate = totalClicks > 0 ? ((totalSales / totalClicks) * 100).toFixed(2) : '0.00';

  const chartSlice = series.slice(-14);
  const chartData = chartSlice.map((d) => Number(d.earnings || 0));
  const chartLabels = chartSlice.map((d) => String(d.date || '').slice(5));

  // Group sales by product
  const byProdMap = new Map();
  sales.forEach((s) => {
    const pid = s.product_id || s.product?.id || s.id;
    const name = s.product?.name || `Product #${pid}`;
    const prev = byProdMap.get(pid) || { id: pid, name, orders: 0, revenue: 0, commission: 0 };
    prev.orders += 1;
    prev.revenue += Number(s.sale_amount || 0);
    prev.commission += Number(s.commission?.commission_amount || 0);
    byProdMap.set(pid, prev);
  });
  const topProducts = Array.from(byProdMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  return (
    <>
      <FHead title="Performance" sub="Track clicks, conversions and revenue you’ve driven." />
      <div className="kpi-grid">
        <Kpi ic="dollar" tint="#1F8A5B" label="Revenue generated" val={loading ? '…' : fn(totalRevenue)} delta="" up />
        <Kpi ic="eye" tint="#7A5AE0" label="Link clicks" val={loading ? '…' : String(totalClicks)} delta="" up />
        <Kpi ic="bag" tint="#0438B6" label="Orders" val={loading ? '…' : String(totalSales)} delta="" up />
        <Kpi ic="spark" tint="#F67208" label="Conversion" val={loading ? '…' : `${convRate}%`} delta="" up />
      </div>
      <div className="panel">
        <div className="panel-h">
          <h3>Earnings ({fn(totalEarned)})</h3>
          <div className="seg">
            {['7D', '30D', '90D'].map((g) => (
              <button key={g} className={range === g ? 'on' : ''} onClick={() => setRange(g)}>{g}</button>
            ))}
          </div>
        </div>
        {chartData.some((v) => v > 0)
          ? <BarChart key={range} data={chartData} labels={chartLabels} alt />
          : <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>No earnings data for this range yet.</p>}
      </div>
      {dashboard?.tier_progress && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-h"><h3>Tier progression</h3><span className="adm-pill info">{dashboard.current_tier || 'Bronze'}</span></div>
          <p className="muted" style={{ fontSize: 13 }}>
            {dashboard.tier_progress.next_tier
              ? `Next tier: ${dashboard.tier_progress.next_tier} · ${dashboard.tier_progress.progress_percentage ?? 0}% progress`
              : 'You are at the highest available tier.'}
          </p>
        </div>
      )}
      <div className="panel" style={{ padding: 0 }}>
        <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>Top performing products</h3></div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Product</th><th>Orders</th><th>Revenue</th><th>Commission</th></tr></thead>
            <tbody>
              {topProducts.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.name}</b></td>
                  <td>{p.orders}</td>
                  <td>{fn(p.revenue)}</td>
                  <td><b>{fn(p.commission)}</b></td>
                </tr>
              ))}
              {topProducts.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24 }} className="muted">No product sales recorded in this period yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ============ PROMOTION CENTER ============ */
function AffPromote() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pages, setPages] = useState(1);
  const [rate, setRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      affiliateApi.promotableProducts({ search: q || undefined, page, per_page: 12 })
        .then((res) => {
          if (!active) return;
          setItems(Array.isArray(res?.items) ? res.items : []);
          setPages(res?.pagination?.last_page || 1);
          setRate(Number(res?.commission_rate ?? 0));
        })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [q, page]);

  return (
    <>
      <FHead title="Promotion Center" sub="Browse active products and generate tracked referral links." />
      <div className="adm-filters">
        <div className="adm-mini-search">
          <FIcon name="search" size={16} className="muted" />
          <input placeholder="Search products to promote…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </div>
      {loading && <p className="muted" style={{ padding: 16 }}>Loading products…</p>}
      {!loading && items.length === 0 && (
        <EmptyState icon="bag" title="No promotable products found" desc={q ? `No active products match "${q}".` : 'No active products are available right now.'} />
      )}
      <div className="aff-promo-grid">
        {items.map((p) => (
          <div className="aff-promo-card" key={p.id}>
            <div className="aff-promo-body">
              <span className="pc-brand" style={{ fontSize: 11 }}>{p.category || 'Catalog'}</span>
              <b className="aff-promo-name">{p.name}</b>
              <div className="aff-promo-meta">
                <span className="aff-promo-price">{fn(Number(p.price || 0))}</span>
                <span className="aff-promo-comm">{p.commission_rate ?? rate}% · {fn(Number(p.estimated_commission || 0))}</span>
              </div>
              <button className="adm-btn primary block" onClick={() => setSel(p)}><FIcon name="share" size={15} /> Get link</button>
            </div>
          </div>
        ))}
      </div>
      <FPager page={page} pages={pages} onPage={setPage} />
      {sel && <LinkModal product={sel} onClose={() => setSel(null)} />}
    </>
  );
}

function GenLinkModal({ onClose, onCreated }) {
  const [q, setQ] = useState('');
  const [campaign, setCampaign] = useState('');
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      affiliateApi.promotableProducts({ search: q || undefined, per_page: 8 })
        .then((res) => { if (active) setItems(Array.isArray(res?.items) ? res.items : []); })
        .catch(() => {});
    }, 150);
    return () => { active = false; clearTimeout(t); };
  }, [q]);

  if (sel) return <LinkModal product={sel.product} campaign={sel.campaign} onClose={onClose} onCreated={onCreated} />;

  return (
    <div className="role-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="role-modal">
        <div className="role-modal-h">
          <div><h3 style={{ fontSize: 18 }}>Generate a referral link</h3><small className="muted">Pick a product or create a general store link</small></div>
          <button className="role-modal-x" onClick={onClose}><FIcon name="close" size={18} /></button>
        </div>
        <div className="role-modal-b">
          <label className="adm-field" style={{ marginBottom: 12 }}>
            <span>Campaign label (optional)</span>
            <input placeholder="e.g. ig-story-nov" value={campaign} onChange={(e) => setCampaign(e.target.value)} />
          </label>
          <button className="adm-btn ghost block" style={{ marginBottom: 14 }} onClick={() => setSel({ product: null, campaign })}>
            <FIcon name="share" size={15} /> Create general store link
          </button>
          <div className="gen-pick-search">
            <FIcon name="search" size={17} />
            <input autoFocus placeholder="Search products to promote…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="gen-pick-list">
            {items.map((p) => (
              <button key={p.id} className="gen-pick" onClick={() => setSel({ product: p, campaign })}>
                <div className="gen-pick-info">
                  <b>{p.name}</b>
                  <small className="muted">{fn(Number(p.price || 0))} · {p.commission_rate}% ({fn(Number(p.estimated_commission || 0))})</small>
                </div>
                <span className="gen-pick-go"><FIcon name="arrowr" size={16} /></span>
              </button>
            ))}
            {items.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)' }}>No products match “{q}”.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkModal({ product, campaign, existingLink, onClose, onCreated }) {
  const affToast = useAffiliateToast();
  const [trackedUrl, setTrackedUrl] = useState(existingLink ? `${siteOrigin()}/l/${existingLink.slug}` : '');
  const [creating, setCreating] = useState(!existingLink);
  const [err, setErr] = useState('');

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  useEffect(() => {
    if (existingLink) return;
    let active = true;
    setCreating(true);
    affiliateApi.createLink({
      product_id: product?.id || null,
      campaign: campaign || null,
    }).then((res) => {
      if (!active) return;
      const slug = res?.link?.slug;
      const url = res?.tracked_url || (slug ? `${siteOrigin()}/l/${slug}` : '');
      setTrackedUrl(url);
      affToast('Referral link created');
      onCreated && onCreated(res);
    }).catch((e) => {
      if (!active) return;
      setErr(messageFrom(e, 'Could not create link'));
    }).finally(() => {
      if (active) setCreating(false);
    });
    return () => { active = false; };
  }, [product, campaign, existingLink]);

  const title = product?.name || existingLink?.product?.name || existingLink?.campaign || 'Limitra Store Link';
  const msg = product ? `Check out ${product.name} on Limitra, ${fn(Number(product.price || 0))}` : 'Shop on Limitra with my link';

  return (
    <div className="role-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="role-modal">
        <div className="role-modal-h">
          <div>
            <h3 style={{ fontSize: 17 }}>{title}</h3>
            {product && <small className="muted">{product.commission_rate}% commission · {fn(Number(product.estimated_commission || 0))} per sale</small>}
          </div>
          <button className="role-modal-x" onClick={onClose}><FIcon name="close" size={18} /></button>
        </div>
        <div className="role-modal-b">
          {creating && <p className="muted" style={{ padding: 16 }}>Generating tracked link…</p>}
          {err && <p style={{ color: 'var(--red)' }}>{err}</p>}
          {!creating && trackedUrl && (
            <>
              <div className="aff-link-head"><span className="adm-field-label">Your tracked referral link</span></div>
              <CopyField value={trackedUrl} label="Referral link" />
              <div className="aff-qr-block">
                <QR text={trackedUrl} size={130} />
                <div>
                  <b>Share QR code</b>
                  <p className="muted" style={{ fontSize: 13 }}>Share this link or QR code so shoppers can buy through your attribution.</p>
                  <ShareRow url={trackedUrl} msg={msg} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ MY LINKS ============ */
function AffLinks() {
  const affToast = useAffiliateToast();
  const [links, setLinks] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [gen, setGen] = useState(false);
  const [statsLink, setStatsLink] = useState(null);
  const [statsData, setStatsData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await affiliateApi.links({ page, per_page: 15 });
      setLinks(Array.isArray(res?.items) ? res.items : []);
      setPages(res?.pagination?.last_page || 1);
    } catch (e) {
      affToast(messageFrom(e, 'Could not load links'));
    } finally {
      setLoading(false);
    }
  }, [page, affToast]);

  useEffect(() => { load(); }, [load]);

  const openStats = async (link) => {
    setStatsLink(link);
    setStatsData(null);
    try {
      setStatsData(await affiliateApi.linkAnalytics(link.id));
    } catch (e) {
      affToast(messageFrom(e, 'Could not load link analytics'));
    }
  };

  const deactivate = async (id) => {
    try {
      await affiliateApi.deleteLink(id);
      affToast('Link deactivated');
      load();
    } catch (e) {
      affToast(messageFrom(e, 'Failed to deactivate link'));
    }
  };

  return (
    <>
      <FHead title="My Links" sub="Every tracked referral link you’ve generated.">
        <button className="adm-btn primary" onClick={() => setGen(true)}><FIcon name="plus" size={15} /> Generate link</button>
      </FHead>
      {gen && <GenLinkModal onClose={() => setGen(false)} onCreated={load} />}
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Product / Campaign</th><th>Tracked slug</th><th>Status</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {links.map((l) => {
                const url = `${siteOrigin()}/l/${l.slug}`;
                return (
                  <tr key={l.id}>
                    <td><b>{l.product?.name || l.campaign || 'General Store Link'}</b></td>
                    <td><code className="aff-link-code">/l/{l.slug}</code></td>
                    <td><Pill s={l.is_active === false ? 'Inactive' : 'Active'} /></td>
                    <td className="muted">{fmtDate(l.created_at)}</td>
                    <td>
                      <div className="adm-rowact">
                        <button title="Copy link" onClick={async () => { try { await navigator.clipboard.writeText(url); } catch (e) {} affToast('Link copied'); }}><FIcon name="copy" size={15} /></button>
                        <button title="Link analytics" onClick={() => openStats(l)}><FIcon name="spark" size={15} /></button>
                        {l.is_active !== false && <button title="Deactivate" onClick={() => deactivate(l.id)}><FIcon name="trash" size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && links.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 28 }} className="muted">No links generated yet. Click “Generate link” to create your first tracked link.</td></tr>
              )}
            </tbody>
          </table>
          <FPager page={page} pages={pages} onPage={setPage} />
        </div>
      </div>

      {statsLink && (
        <div className="role-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setStatsLink(null); }}>
          <div className="role-modal" style={{ maxWidth: 460 }}>
            <div className="role-modal-h">
              <div><h3 style={{ fontSize: 17 }}>Link Analytics</h3><small className="muted">/l/{statsLink.slug}</small></div>
              <button className="role-modal-x" onClick={() => setStatsLink(null)}><FIcon name="close" size={18} /></button>
            </div>
            <div className="role-modal-b">
              {!statsData ? <p className="muted">Loading stats…</p> : (
                <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div className="panel" style={{ padding: 12 }}><small className="muted">Clicks</small><div style={{ fontSize: 20, fontWeight: 700 }}>{statsData.clicks_count}</div></div>
                  <div className="panel" style={{ padding: 12 }}><small className="muted">Conversions</small><div style={{ fontSize: 20, fontWeight: 700 }}>{statsData.conversions_count}</div></div>
                  <div className="panel" style={{ padding: 12 }}><small className="muted">Rate</small><div style={{ fontSize: 20, fontWeight: 700 }}>{statsData.conversion_rate_percentage}%</div></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============ MARKETING RESOURCES ============ */
function AffResources() {
  const affToast = useAffiliateToast();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    affiliateApi.resources({ page, per_page: 20 })
      .then((res) => {
        setItems(Array.isArray(res?.items) ? res.items : []);
        setPages(res?.pagination?.last_page || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const handleDownload = async (r) => {
    setDownloadingId(r.id);
    try {
      await affiliateApi.downloadResource(r.id, r.title);
      affToast(`Downloaded ${r.title}`);
    } catch (e) {
      affToast(messageFrom(e, 'Could not download resource'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <FHead title="Marketing Center" sub="Ready-made creatives published for affiliates." />
      {loading && <p className="muted" style={{ padding: 16 }}>Loading resources…</p>}
      {!loading && items.length === 0 && (
        <EmptyState icon="gift" title="No marketing resources yet" desc="Marketing kits and banners published by the Limitra team will appear here." />
      )}
      <div className="aff-res-grid">
        {items.map((r) => (
          <div className="aff-res-card" key={r.id}>
            <span className="aff-res-ic" style={{ background: '#0438B622', color: '#0438B6' }}><FIcon name="gift" size={22} /></span>
            <b>{r.title}</b>
            <small className="muted">{r.category || r.file_type || 'Asset'} · {r.downloads_count ?? 0} downloads</small>
            <button className="adm-btn ghost block" disabled={downloadingId === r.id} onClick={() => handleDownload(r)}>
              <FIcon name="download" size={15} /> {downloadingId === r.id ? 'Downloading…' : 'Download'}
            </button>
          </div>
        ))}
      </div>
      <FPager page={page} pages={pages} onPage={setPage} />
    </>
  );
}

/* ============ EARNINGS ============ */
function AffEarnings() {
  const go = useAffGo();
  const { dashboard, availableBalance, loading } = useAffiliate();
  const [tab, setTab] = useState('ledger');
  const [ledgerItems, setLedgerItems] = useState([]);
  const [commItems, setCommItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    if (tab === 'ledger') {
      affiliateApi.ledger({ page, per_page: 20 })
        .then((res) => {
          setLedgerItems(Array.isArray(res?.items) ? res.items : []);
          setPages(res?.pagination?.last_page || 1);
        })
        .catch(() => {});
    } else {
      affiliateApi.commissions({ page, per_page: 20 })
        .then((res) => {
          setCommItems(Array.isArray(res?.items) ? res.items : []);
          setPages(res?.pagination?.last_page || 1);
        })
        .catch(() => {});
    }
  }, [tab, page]);

  return (
    <>
      <FHead title="Earnings" sub="Your commission breakdown and ledger history.">
        <button className="adm-btn primary" onClick={() => go('withdraw')}><FIcon name="card" size={15} /> Withdraw</button>
      </FHead>
      <div className="kpi-grid">
        <Kpi ic="dollar" tint="#1F8A5B" label="Total earned" val={loading ? '…' : fn(Number(dashboard?.total_earnings || 0))} delta="" up />
        <Kpi ic="clock" tint="#F5A623" label="Pending" val={loading ? '…' : fn(Number(dashboard?.pending_balance || 0))} delta="" up />
        <Kpi ic="check" tint="#0438B6" label="Held in payout" val={loading ? '…' : fn(Number(dashboard?.held_balance || 0))} delta="" up />
        <Kpi ic="card" tint="#F67208" label="Available" val={loading ? '…' : fn(Number(availableBalance || 0))} delta="" up />
      </div>
      <div className="adm-filters">
        <button className={'adm-chip' + (tab === 'ledger' ? ' on' : '')} onClick={() => { setTab('ledger'); setPage(1); }}>Ledger entries</button>
        <button className={'adm-chip' + (tab === 'commissions' ? ' on' : '')} onClick={() => { setTab('commissions'); setPage(1); }}>Commissions</button>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap">
          {tab === 'ledger' ? (
            <table className="adm-table">
              <thead><tr><th>Description / Type</th><th>Date</th><th>Amount</th><th>Status / Type</th></tr></thead>
              <tbody>
                {ledgerItems.map((t) => {
                  const amt = Number(t.amount || 0);
                  const neg = t.direction === 'debit' || t.entry_type === 'hold' || t.entry_type === 'withdrawal' || amt < 0;
                  return (
                    <tr key={t.id}>
                      <td><b>{t.description || t.notes || capStatus(t.entry_type || 'Entry')}</b></td>
                      <td className="muted">{fmtDate(t.created_at)}</td>
                      <td className={neg ? 'aff-neg' : 'aff-pos'}><b>{neg ? '−' + fn(Math.abs(amt)) : '+' + fn(Math.abs(amt))}</b></td>
                      <td><Pill s={t.entry_type || t.direction || 'Credit'} /></td>
                    </tr>
                  );
                })}
                {ledgerItems.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24 }} className="muted">No ledger entries yet.</td></tr>}
              </tbody>
            </table>
          ) : (
            <table className="adm-table">
              <thead><tr><th>Product</th><th>Date</th><th>Rate</th><th>Commission</th><th>Status</th></tr></thead>
              <tbody>
                {commItems.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.sale?.product?.name || `Sale #${c.affiliate_sale_id || c.id}`}</b></td>
                    <td className="muted">{fmtDate(c.created_at)}</td>
                    <td>{c.commission_percent}%</td>
                    <td><b>{fn(Number(c.commission_amount || 0))}</b></td>
                    <td><Pill s={c.payment_status} /></td>
                  </tr>
                ))}
                {commItems.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }} className="muted">No commissions recorded yet.</td></tr>}
              </tbody>
            </table>
          )}
          <FPager page={page} pages={pages} onPage={setPage} />
        </div>
      </div>
    </>
  );
}

/* ============ WITHDRAWALS ============ */
function AffWithdraw() {
  const affToast = useAffiliateToast();
  const go = useAffGo();
  const { availableBalance, refreshDashboard } = useAffiliate();
  const [amt, setAmt] = useState('');
  const [methods, setMethods] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [mRes, wRes] = await Promise.all([
        affiliateApi.payoutMethods().catch(() => []),
        affiliateApi.withdrawals({ page, per_page: 15 }).catch(() => null),
      ]);
      const mList = Array.isArray(mRes) ? mRes : [];
      setMethods(mList);
      if (mList.length > 0) {
        const def = mList.find((m) => m.is_default) || mList[0];
        setSelectedId((prev) => prev || def.id);
      }
      setWithdrawals(Array.isArray(wRes?.items) ? wRes.items : []);
      setPages(wRes?.pagination?.last_page || 1);
    } catch (e) {}
  }, [page]);

  useEffect(() => { loadData(); }, [loadData]);

  const submit = async () => {
    const v = Number(amt);
    if (!v || v <= 0) { affToast('Enter a valid withdrawal amount'); return; }
    if (v > availableBalance) { affToast('Amount exceeds available balance'); return; }
    if (!selectedId) { affToast('Please add a payout method in Settings first'); return; }
    setSubmitting(true);
    try {
      const idem = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `wth-${Date.now()}`;
      await affiliateApi.requestWithdrawal({ amount: v, payout_method_id: selectedId }, idem);
      affToast('Withdrawal request submitted');
      setAmt('');
      await Promise.all([loadData(), refreshDashboard()]);
    } catch (e) {
      affToast(messageFrom(e, 'Withdrawal request failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <FHead title="Withdrawals" sub="Request a payout to your saved bank account." />
      <div className="adm-row c2">
        <div className="panel aff-wd-card">
          <span className="aff-wd-label">Available balance</span>
          <div className="aff-wd-bal">{fn(availableBalance)}</div>
          <label className="adm-field">
            <span>Amount to withdraw</span>
            <input type="number" min="1" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="Enter amount in NGN" />
          </label>
          <div className="adm-field">
            <span>Payout method</span>
            {methods.length > 0 ? (
              <div className="aff-method-row" style={{ flexWrap: 'wrap' }}>
                {methods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={'aff-method' + (selectedId === m.id ? ' on' : '')}
                    onClick={() => setSelectedId(m.id)}
                  >
                    {m.bank_name} · {m.account_number_masked}
                  </button>
                ))}
              </div>
            ) : (
              <div className="aff-wd-dest">
                No bank account saved yet. <button type="button" className="link-btn" onClick={() => go('settings')}>Add in Settings</button>
              </div>
            )}
          </div>
          <button className="adm-btn primary block lg" disabled={submitting || methods.length === 0} onClick={submit}>
            {submitting ? 'Submitting…' : 'Request withdrawal'}
          </button>
          <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 8 }}>Payouts are processed within 1–3 business days.</p>
        </div>
        <div className="panel" style={{ padding: 0 }}>
          <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>Withdrawal history</h3></div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td className="muted">{fmtDate(w.created_at)}</td>
                    <td><b>{fn(Number(w.amount || 0))}</b></td>
                    <td>{w.payout_method ? `${w.payout_method.bank_name} ${w.payout_method.account_number_masked || ''}` : (w.reference || 'Bank Transfer')}</td>
                    <td><Pill s={w.status} /></td>
                  </tr>
                ))}
                {withdrawals.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24 }} className="muted">No withdrawals requested yet.</td></tr>
                )}
              </tbody>
            </table>
            <FPager page={page} pages={pages} onPage={setPage} />
          </div>
        </div>
      </div>
    </>
  );
}

/* ============ REFERRALS ============ */
function AffReferrals() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    affiliateApi.referrals({ page, per_page: 20 })
      .then((res) => {
        setItems(Array.isArray(res?.items) ? res.items : []);
        setPages(res?.pagination?.last_page || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <>
      <FHead title="Referrals" sub="Users who signed up through your affiliate links." />
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>User</th><th>Email / Username</th><th>Joined</th></tr></thead>
            <tbody>
              {items.map((r) => {
                const name = r.user?.name || r.user?.username || `User #${r.user_id}`;
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="adm-prod">
                        <span className="adm-li-av">{initialsOf(name)}</span>
                        <b>{name}</b>
                      </div>
                    </td>
                    <td className="muted">{r.user?.email || r.user?.username || '—'}</td>
                    <td className="muted">{fmtDate(r.joined_at)}</td>
                  </tr>
                );
              })}
              {!loading && items.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 28 }} className="muted">No referrals yet.</td></tr>
              )}
            </tbody>
          </table>
          <FPager page={page} pages={pages} onPage={setPage} />
        </div>
      </div>
    </>
  );
}

/* ============ TIER & RANKING ============ */
function AffLeaderboard() {
  const { dashboard } = useAffiliate();
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    affiliateApi.tierHistory({ page, per_page: 15 })
      .then((res) => {
        setHistory(Array.isArray(res?.items) ? res.items : []);
        setPages(res?.pagination?.last_page || 1);
      })
      .catch(() => {});
  }, [page]);

  return (
    <>
      <FHead title="Tier & Ranking" sub="Your affiliate tier status and progression history." />
      <div className="kpi-grid">
        <Kpi ic="flame" tint="#F67208" label="Current tier" val={dashboard?.current_tier || 'Bronze'} delta="" up />
        <Kpi ic="spark" tint="#1F8A5B" label="Commission rate" val={`${Number(dashboard?.commission_rate ?? 0)}%`} delta="" up />
        <Kpi ic="bag" tint="#0438B6" label="Total sales" val={String(dashboard?.total_sales ?? 0)} delta="" up />
        <Kpi ic="dollar" tint="#7A5AE0" label="Lifetime earnings" val={fn(Number(dashboard?.total_earnings || 0))} delta="" up />
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>Tier progression history</h3></div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Previous tier</th><th>New tier</th><th>Rate</th><th>Date</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="muted">{h.old_tier || h.previous_tier || '—'}</td>
                  <td><b>{h.new_tier || h.tier || '—'}</b></td>
                  <td>{h.new_commission_rate != null ? `${h.new_commission_rate}%` : '—'}</td>
                  <td className="muted">{fmtDate(h.created_at)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24 }} className="muted">No tier changes recorded yet. Keep driving sales to unlock higher commission tiers!</td></tr>
              )}
            </tbody>
          </table>
          <FPager page={page} pages={pages} onPage={setPage} />
        </div>
      </div>
    </>
  );
}

/* ============ PROMO CODES ============ */
function AffPromoCodes() {
  const affToast = useAffiliateToast();
  const allPct = [5, 10, 15, 20];
  const [codes, setCodes] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState('');
  const [pct, setPct] = useState(10);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await affiliateApi.promoCodes({ page, per_page: 20 });
      setCodes(Array.isArray(res?.items) ? res.items : []);
      setPages(res?.pagination?.last_page || 1);
    } catch (e) {
      affToast(messageFrom(e, 'Could not load promo codes'));
    } finally {
      setLoading(false);
    }
  }, [page, affToast]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{4,30}$/.test(c)) {
      setErr('4–30 characters (letters, numbers, - or _)');
      return;
    }
    setSubmitting(true);
    setErr('');
    try {
      await affiliateApi.createPromoCode({ code: c, discount_percent: pct });
      affToast('Promo code ' + c + ' created');
      setCreating(false);
      setCode('');
      load();
    } catch (e) {
      setErr(messageFrom(e, 'Could not create promo code'));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    try {
      await affiliateApi.deletePromoCode(id);
      affToast('Promo code deactivated');
      load();
    } catch (e) {
      affToast(messageFrom(e, 'Failed to deactivate promo code'));
    }
  };

  return (
    <>
      <FHead title="Promo Codes" sub="Create discount codes for your audience — applied at checkout and attributed to you.">
        <button className="adm-btn primary" onClick={() => { setCreating(true); setErr(''); }}><FIcon name="plus" size={15} /> Create code</button>
      </FHead>

      {!loading && codes.length === 0 && !creating && (
        <EmptyState
          icon="tag"
          title="No promo codes yet"
          desc="Create a code your audience can use for a discount at checkout."
          action={<button className="adm-btn primary" onClick={() => setCreating(true)}><FIcon name="plus" size={15} /> Create your code</button>}
        />
      )}

      {codes.length > 0 && (
        <div className="aff-code-grid">
          {codes.map((c) => (
            <div key={c.id} className={'aff-code-card' + (c.is_active ? '' : ' off')}>
              <div className="aff-code-top">
                <span className="aff-code-val">{c.code}</span>
                <span className={'adm-pill ' + (c.is_active ? 'ok' : 'muted')}>{c.is_active ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="aff-code-pct">{Number(c.discount_percent || 0)}% off</div>
              <div className="aff-code-meta"><span><FIcon name="clock" size={13} /> {fmtDate(c.created_at)}</span></div>
              <div className="aff-code-actions">
                <button className="adm-btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(c.code); } catch (e) {} affToast('Code copied'); }}><FIcon name="copy" size={14} /> Copy</button>
                {c.is_active && <button className="adm-btn ghost sm danger" onClick={() => remove(c.id)} title="Deactivate"><FIcon name="trash" size={14} /> Deactivate</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <FPager page={page} pages={pages} onPage={setPage} />

      {creating && (
        <div className="role-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCreating(false); }}>
          <div className="role-modal" style={{ maxWidth: 440 }}>
            <div className="role-modal-h">
              <div><h3 style={{ fontSize: 18 }}>Create promo code</h3><small className="muted">Shoppers enter this at checkout</small></div>
              <button className="role-modal-x" onClick={() => setCreating(false)}><FIcon name="close" size={18} /></button>
            </div>
            <div className="role-modal-b">
              <label className="adm-field">
                <span>Code</span>
                <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '')); setErr(''); }} placeholder="e.g. LIMITRA10" maxLength={30} />
              </label>
              {err && <span className="err-msg" style={{ display: 'block', marginTop: -6, marginBottom: 8 }}>{err}</span>}
              <div className="adm-field">
                <span>Discount</span>
                <div className="aff-pct-row">
                  {allPct.map((p) => <button key={p} type="button" className={'aff-pct' + (pct === p ? ' on' : '')} onClick={() => setPct(p)}>{p}% off</button>)}
                </div>
              </div>
              <div className="aff-code-preview"><span className="muted">Preview</span><div><b>{code || 'YOURCODE'}</b> — {pct}% off at checkout</div></div>
            </div>
            <div className="role-modal-f">
              <button className="adm-btn ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button className="adm-btn primary" disabled={submitting} onClick={create}><FIcon name="check" size={15} /> {submitting ? 'Creating…' : 'Create code'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============ SETTINGS ============ */
const BANKS = ['Access Bank', 'First Bank', 'GTBank', 'Kuda', 'Opay', 'Palmpay', 'Stanbic IBTC', 'Sterling Bank', 'UBA', 'Union Bank', 'Wema Bank', 'Zenith Bank'];

function AffSettings() {
  const { user } = useStore();
  const affToast = useAffiliateToast();
  const [settings, setSettings] = useState(null);
  const [methods, setMethods] = useState([]);
  const [bank, setBank] = useState('GTBank');
  const [bankCode, setBankCode] = useState('');
  const [acctNum, setAcctNum] = useState('');
  const [acctName, setAcctName] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [savingMethod, setSavingMethod] = useState(false);
  const [notifs, setNotifs] = useState({
    referral_signup: true,
    referral_purchase: true,
    commission_earned: true,
    withdrawal_updates: true,
    weekly_summary: false,
  });

  const loadAll = useCallback(async () => {
    try {
      const [sRes, mRes] = await Promise.all([
        affiliateApi.settings().catch(() => null),
        affiliateApi.payoutMethods().catch(() => []),
      ]);
      if (sRes) {
        setSettings(sRes);
        if (sRes.payout_details?.notifications) {
          setNotifs((prev) => ({ ...prev, ...sRes.payout_details.notifications }));
        }
      }
      setMethods(Array.isArray(mRes) ? mRes : []);
    } catch (e) {}
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const verifyBank = async () => {
    if (!bankCode.trim() || !acctNum.trim()) {
      affToast('Enter bank code and account number to verify');
      return;
    }
    setVerifying(true);
    try {
      const res = await affiliateApi.verifyPayoutMethod({ bank_code: bankCode.trim(), account_number: acctNum.trim() });
      if (res?.account_name) {
        setAcctName(res.account_name);
        affToast('Account resolved: ' + res.account_name);
      } else {
        affToast('Could not auto-resolve account name; enter it manually');
      }
    } catch (e) {
      affToast(messageFrom(e, 'Verification failed'));
    } finally {
      setVerifying(false);
    }
  };

  const addMethod = async () => {
    if (!acctNum.trim() || !acctName.trim()) {
      affToast('Account number and account name are required');
      return;
    }
    setSavingMethod(true);
    try {
      await affiliateApi.createPayoutMethod({
        bank_name: bank,
        bank_code: bankCode.trim() || undefined,
        account_number: acctNum.trim(),
        account_name: acctName.trim(),
        is_default: methods.length === 0,
      });
      affToast('Payout method added');
      setAcctNum('');
      setAcctName('');
      setBankCode('');
      loadAll();
    } catch (e) {
      affToast(messageFrom(e, 'Could not add payout method'));
    } finally {
      setSavingMethod(false);
    }
  };

  const setDefault = async (id) => {
    try {
      await affiliateApi.setDefaultPayoutMethod(id);
      affToast('Default payout method updated');
      loadAll();
    } catch (e) {
      affToast(messageFrom(e, 'Failed to update default method'));
    }
  };

  const removeMethod = async (id) => {
    try {
      await affiliateApi.deletePayoutMethod(id);
      affToast('Payout method removed');
      loadAll();
    } catch (e) {
      affToast(messageFrom(e, 'Could not remove payout method'));
    }
  };

  const saveNotifs = async (next) => {
    setNotifs(next);
    try {
      await affiliateApi.updateSettings({
        payout_details: {
          ...(settings?.payout_details || {}),
          notifications: next,
        },
      });
      affToast('Preferences saved');
    } catch (e) {
      affToast(messageFrom(e, 'Could not save preferences'));
    }
  };

  const displayName = user?.name || user?.username || 'Affiliate';

  return (
    <>
      <FHead title="Profile & Settings" sub="Manage your affiliate profile, bank accounts and preferences." />
      <div className="adm-row c2">
        <div className="panel">
          <h3 style={{ marginBottom: 16 }}>Affiliate Profile</h3>
          <div className="row" style={{ gap: 14, marginBottom: 18 }}>
            <span className="adm-li-av lg">{initialsOf(displayName)}</span>
            <div>
              <b style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{displayName}</b>
              <div className="muted" style={{ fontSize: 13 }}>{user?.email || '—'}</div>
              <span className="adm-pill info" style={{ marginTop: 6, display: 'inline-block' }}>
                {settings?.current_tier || 'Bronze'} · {settings?.commission_rate ?? 0}% commission
              </span>
            </div>
          </div>
          <label className="adm-field"><span>Affiliate code</span><input value={settings?.code || ''} readOnly className="adm-readonly" /></label>
          <label className="adm-field"><span>Referral slug</span><input value={settings?.slug || ''} readOnly className="adm-readonly" /></label>
          <label className="adm-field"><span>Email</span><input value={user?.email || ''} readOnly className="adm-readonly" /></label>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <h3 style={{ marginBottom: 12 }}>Saved Payout Methods</h3>
            {methods.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>No payout methods added yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {methods.map((m) => (
                  <div key={m.id} className="adm-prod" style={{ justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div>
                      <b>{m.bank_name}</b> · <span className="muted">{m.account_number_masked}</span>
                      <div className="muted" style={{ fontSize: 12 }}>{m.account_name} {m.is_default && '· Default'}</div>
                    </div>
                    <div className="adm-rowact">
                      {!m.is_default && <button className="adm-btn ghost sm" onClick={() => setDefault(m.id)}>Set default</button>}
                      <button className="adm-btn ghost sm danger" onClick={() => removeMethod(m.id)} title="Remove"><FIcon name="trash" size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h4 style={{ marginBottom: 10, fontSize: 14 }}>Add Bank Account</h4>
            <div className="adm-field"><span>Bank</span><FSelect value={bank} options={BANKS} onChange={setBank} /></div>
            <div className="adm-field-row">
              <label className="adm-field"><span>Account number</span><input value={acctNum} onChange={(e) => setAcctNum(e.target.value)} placeholder="0123456789" /></label>
              <label className="adm-field"><span>Bank code (optional)</span><input value={bankCode} onChange={(e) => setBankCode(e.target.value)} placeholder="e.g. 058" /></label>
            </div>
            <div className="adm-field-row" style={{ alignItems: 'flex-end' }}>
              <label className="adm-field" style={{ flex: 1 }}><span>Account name</span><input value={acctName} onChange={(e) => setAcctName(e.target.value)} placeholder="Account holder name" /></label>
              {bankCode.trim() && (
                <button type="button" className="adm-btn ghost" disabled={verifying} onClick={verifyBank} style={{ marginBottom: 12 }}>
                  {verifying ? 'Verifying…' : 'Verify'}
                </button>
              )}
            </div>
            <button className="adm-btn primary" disabled={savingMethod} onClick={addMethod}>
              {savingMethod ? 'Adding…' : 'Add payout method'}
            </button>
          </div>

          <div className="panel">
            <h3 style={{ marginBottom: 14 }}>Notifications</h3>
            {[
              ['referral_signup', 'New referral signup'],
              ['referral_purchase', 'Referral purchase'],
              ['commission_earned', 'Commission earned'],
              ['withdrawal_updates', 'Withdrawal updates'],
              ['weekly_summary', 'Weekly summary email'],
            ].map(([key, label]) => (
              <label className="aff-notif-opt" key={key}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={!!notifs[key]}
                  onChange={(e) => saveNotifs({ ...notifs, [key]: e.target.checked })}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export {
  FAFF_NAV, FSTATUS, initialsOf,
  Pill, CopyField, QR, ShareRow, FSelect, FPager, fn, affPath, useAffGo,
  GenLinkModal, LinkModal,
  AffOverview, AffPerformance, AffPromote, AffLinks, AffResources, AffEarnings,
  AffWithdraw, AffReferrals, AffPromoCodes, AffLeaderboard, AffSettings,
};
