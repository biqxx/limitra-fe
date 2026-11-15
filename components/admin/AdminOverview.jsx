'use client';
/* Overview & Analytics — wired to /admin/dashboard, /admin/orders, /admin/ai/metrics, and /analytics/*. */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { Thumb, REAL_IMG } from '@/components/ui/Shared';
import { useStore } from '@/components/store/StoreProvider';
import { naira, PRODUCTS } from '@/lib/data';
import { adminAiApi, adminAnalyticsApi, adminOrdersApi, adminSystemApi } from '@/lib/api/endpoints';
import { Kpi, BarChart, Donut, STATUS_CLS } from '@/components/charts/Charts';

function RevenueChart({ salesData }) {
  const [range, setRange] = useState('month');
  const series = Array.isArray(salesData?.series) ? salesData.series
    : Array.isArray(salesData?.chart) ? salesData.chart
    : Array.isArray(salesData?.timeline) ? salesData.timeline : [];

  const fallback = {
    week: { data: [0, 0, 0, 0, 0, 0, 0], labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    month: { data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] },
    year: { data: [0, 0, 0, 0, 0, 0], labels: ['2026', '2027', '2028', '2029', '2030', '2031'] }
  };
  const cur = series.length > 0
    ? {
        data: series.map((pt) => Number(pt.revenue ?? pt.total ?? pt.value ?? pt.amount ?? 0)),
        labels: series.map((pt, i) => String(pt.label ?? pt.date ?? pt.period ?? i + 1).slice(0, 8)),
      }
    : fallback[range];

  return (
    <div className="panel">
      <div className="panel-h"><h3>Revenue</h3>
        <div className="seg">
          {['week', 'month', 'year'].map((r) => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r[0].toUpperCase() + r.slice(1)}</button>)}
        </div>
      </div>
      <BarChart data={cur.data} labels={cur.labels} alt />
    </div>
  );
}

export function AdminOverview() {
  useStore();
  const router = useRouter();
  const [dash, setDash] = useState(null);
  const [orders, setOrders] = useState([]);
  const [aiMetrics, setAiMetrics] = useState(null);
  const [traffic, setTraffic] = useState([]);
  const [salesData, setSalesData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      adminSystemApi.dashboard(),
      adminOrdersApi.list({ per_page: 6 }),
      adminAiApi.metrics(),
      adminAnalyticsApi.traffic(),
      adminAnalyticsApi.sales({ group_by: 'month' }),
    ]).then(([dRes, oRes, aiRes, tRes, sRes]) => {
      if (cancelled) return;
      if (dRes.status === 'fulfilled') setDash(dRes.value?.data ?? dRes.value);
      if (oRes.status === 'fulfilled') {
        const list = oRes.value?.items ?? oRes.value?.data?.items ?? oRes.value?.data ?? [];
        if (Array.isArray(list)) setOrders(list);
      }
      if (aiRes.status === 'fulfilled') setAiMetrics(aiRes.value?.data ?? aiRes.value);
      if (tRes.status === 'fulfilled') {
        const tData = tRes.value?.data ?? tRes.value;
        const rawSegs = Array.isArray(tData?.sources) ? tData.sources : Array.isArray(tData?.channels) ? tData.channels : [];
        const colors = ['#0438B6', '#F67208', '#1F8A5B', '#7A5AE0', '#D6247C'];
        setTraffic(rawSegs.slice(0, 5).map((s, idx) => ({
          label: s.source || s.channel || s.name || `Source ${idx + 1}`,
          value: Number(s.count ?? s.visits ?? s.value ?? 0),
          color: colors[idx % colors.length],
        })));
      }
      if (sRes.status === 'fulfilled') setSalesData(sRes.value?.data ?? sRes.value);
    });
    return () => { cancelled = true; };
  }, []);

  const revenue = Number(dash?.total_revenue ?? dash?.revenue ?? orders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded').reduce((s, o) => s + Number(o.total ?? o.total_amount ?? 0), 0));
  const totalOrders = Number(dash?.total_orders ?? orders.length);
  const totalCustomers = Number(dash?.total_customers ?? dash?.customers_count ?? 0);
  const totalProducts = Number(dash?.total_products ?? PRODUCTS.length);
  const pending = Number(dash?.pending_orders ?? orders.filter((o) => o.status === 'pending' || o.status === 'processing').length);
  const completed = Number(dash?.completed_orders ?? orders.filter((o) => o.status === 'delivered' || o.status === 'completed').length);
  const affiliateSales = Number(dash?.affiliate_sales ?? dash?.affiliate_revenue ?? 0);
  const eloChats = Number(aiMetrics?.total_conversations ?? dash?.ai_conversations ?? 0);

  const kpis = [
    ['dollar', '#1F8A5B', 'Total Revenue', naira(revenue), '', true],
    ['truck', '#0438B6', 'Total Orders', totalOrders, '', true],
    ['user', '#7A5AE0', 'Total Customers', totalCustomers, '', true],
    ['bag', '#F67208', 'Total Products', totalProducts, '', true],
    ['clock', '#F5A623', 'Pending Orders', pending, '', false],
    ['check', '#1F8A5B', 'Completed Orders', completed, '', true],
    ['share', '#0E9BD6', 'Affiliate Sales', naira(affiliateSales), '', true],
    ['headset', '#D6247C', 'Elo AI Chats', eloChats, '', true],
  ];

  const topProducts = PRODUCTS.filter((p) => p.bestseller).length > 0
    ? PRODUCTS.filter((p) => p.bestseller).slice(0, 5)
    : PRODUCTS.slice(0, 5);

  return (
    <>
      <div className="adm-h"><div><h1>Dashboard</h1><p>Welcome back, here’s how Limitra is performing today.</p></div>
        <div className="adm-h-actions">
          <button className="adm-btn ghost" onClick={() => router.push('/admin/reports')}><Icon name="download" size={15} /> Export</button>
          <button className="adm-btn primary" onClick={() => router.push('/admin/products')}><Icon name="plus" size={15} /> Add product</button>
        </div>
      </div>
      <div className="kpi-grid">{kpis.map((k, i) => <Kpi key={i} ic={k[0]} tint={k[1]} label={k[2]} val={k[3]} delta={k[4]} up={k[5]} />)}</div>
      <div className="adm-row c2">
        <RevenueChart salesData={salesData} />
        <div className="panel">
          <div className="panel-h"><h3>Traffic sources</h3></div>
          <Donut segments={traffic} />
        </div>
      </div>
      <div className="adm-row c2">
        <div className="panel">
          <div className="panel-h"><h3>Recent orders</h3><button className="adm-btn ghost" onClick={() => router.push('/admin/orders')} style={{ cursor: 'pointer' }}>View all</button></div>
          <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>{orders.slice(0, 6).map((o) => {
              const st = String(o.status || 'pending');
              const stLabel = st.charAt(0).toUpperCase() + st.slice(1).replace(/_/g, ' ');
              const cust = o.customer_name || o.customer?.name || o.user?.username || o.user?.email || 'Customer';
              return (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => router.push('/admin/orders')}>
                  <td data-label="Order"><b style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5 }}>{o.order_number || `#${o.id}`}</b></td>
                  <td data-label="Customer">{cust}</td>
                  <td data-label="Status"><span className={'adm-pill ' + (STATUS_CLS[stLabel] || 'muted')}>{stLabel}</span></td>
                  <td data-label="Total"><b>{naira(Number(o.total ?? o.total_amount ?? 0))}</b></td>
                </tr>
              );
            })}</tbody>
          </table>{orders.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No orders yet.</div>}</div>
        </div>
        <div className="panel">
          <div className="panel-h"><h3>Top products</h3></div>
          <div className="adm-list">
            {topProducts.length === 0
              ? <div style={{ padding: '18px 4px', textAlign: 'center', color: 'var(--text-faint)' }}>No products yet.</div>
              : topProducts.map((p) => (
                <div className="adm-li" key={p.id}>
                  <span className="adm-prod-thumb"><Thumb product={p} src={REAL_IMG[p.id]} /></span>
                  <div className="adm-li-main"><b style={{ fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</b><small>{(p.reviews || 0).toLocaleString()} reviews · {p.rating}★</small></div>
                  <b style={{ fontFamily: 'var(--font-display)' }}>{naira(p.price)}</b>
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function AdminAnalytics() {
  const [range, setRange] = useState('30 days');
  const [gran, setGran] = useState('Weekly');
  const [overview, setOverview] = useState(null);
  const [sales, setSales] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [prodStats, setProdStats] = useState(null);
  const [conv, setConv] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const days = range === '90 days' ? 90 : 30;
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const group_by = gran === 'Daily' ? 'day' : gran === 'Monthly' ? 'month' : 'week';

    Promise.allSettled([
      adminAnalyticsApi.overview({ from, to, group_by }),
      adminAnalyticsApi.sales({ from, to, group_by }),
      adminAnalyticsApi.customers({ from, to }),
      adminAnalyticsApi.products({ from, to }),
      adminAnalyticsApi.conversion({ from, to }),
    ]).then(([oRes, sRes, cRes, pRes, cvRes]) => {
      if (cancelled) return;
      if (oRes.status === 'fulfilled') setOverview(oRes.value?.data ?? oRes.value);
      if (sRes.status === 'fulfilled') setSales(sRes.value?.data ?? sRes.value);
      if (cRes.status === 'fulfilled') setCustomers(cRes.value?.data ?? cRes.value);
      if (pRes.status === 'fulfilled') setProdStats(pRes.value?.data ?? pRes.value);
      if (cvRes.status === 'fulfilled') setConv(cvRes.value?.data ?? cvRes.value);
    });
    return () => { cancelled = true; };
  }, [gran, range]);

  const series = Array.isArray(sales?.series) ? sales.series : Array.isArray(sales?.chart) ? sales.chart : [];
  const CHART_FALLBACK = {
    Daily: { data: [0, 0, 0, 0, 0, 0, 0], labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    Weekly: { data: [0, 0, 0, 0, 0, 0, 0, 0], labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'] },
    Monthly: { data: [0, 0, 0, 0, 0, 0], labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
  };
  const ch = series.length > 0
    ? {
        data: series.map((pt) => Number(pt.revenue ?? pt.total ?? pt.value ?? pt.amount ?? 0)),
        labels: series.map((pt, i) => String(pt.label ?? pt.date ?? pt.period ?? i + 1).slice(0, 8)),
      }
    : CHART_FALLBACK[gran];

  const aov = Number(overview?.average_order_value ?? sales?.average_order_value ?? 0);
  const newCust = Number(customers?.new_customers ?? overview?.new_customers ?? 0);
  const retRate = Number(customers?.returning_rate ?? 0);
  const convRate = Number(conv?.conversion_rate ?? overview?.conversion_rate ?? 0);

  const custSegments = [];
  if (customers?.new_customers != null || customers?.returning_customers != null) {
    custSegments.push({ label: 'New', value: Number(customers.new_customers ?? 0), color: '#0438B6' });
    custSegments.push({ label: 'Returning', value: Number(customers.returning_customers ?? 0), color: '#1F8A5B' });
  }

  const bestSellers = Array.isArray(prodStats?.best_sellers) ? prodStats.best_sellers : [];
  const mostViewed = Array.isArray(prodStats?.most_viewed) ? prodStats.most_viewed : [];
  const lowPerf = Array.isArray(prodStats?.low_performing) ? prodStats.low_performing : [];

  const renderProdList = (list, emptyMsg) => list.length === 0
    ? <div style={{ padding: '18px 4px', textAlign: 'center', color: 'var(--text-faint)' }}>{emptyMsg}</div>
    : list.slice(0, 5).map((item, idx) => (
      <div className="adm-li" key={item.id || idx}>
        <div className="adm-li-main">
          <b style={{ fontSize: 13.5 }}>{item.name || item.title || `Product #${item.product_id || idx + 1}`}</b>
          <small className="muted">{item.units_sold != null ? `${item.units_sold} sold` : item.views != null ? `${item.views} views` : ''}</small>
        </div>
        {item.revenue != null && <b>{naira(Number(item.revenue))}</b>}
      </div>
    ));

  return (
    <>
      <div className="adm-h"><div><h1>Analytics</h1><p>Sales, customers, products and traffic insights.</p></div>
        <div className="adm-h-actions"><div className="seg" style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 'var(--r-pill)', padding: 3 }}>{['30 days', '90 days'].map(r => <button key={r} className={'adm-chip' + (range === r ? ' on' : '')} style={{ background: range === r ? '' : 'transparent', border: 'none' }} onClick={() => setRange(r)}>{r}</button>)}</div></div>
      </div>
      <div className="kpi-grid">
        <Kpi ic="dollar" tint="#1F8A5B" label="Avg order value" val={naira(aov)} delta="" up />
        <Kpi ic="user" tint="#0438B6" label="New customers" val={String(newCust)} delta="" up />
        <Kpi ic="refresh" tint="#7A5AE0" label="Returning rate" val={`${retRate}%`} delta="" up />
        <Kpi ic="eye" tint="#F67208" label="Conversion" val={`${convRate}%`} delta="" up={convRate > 0} />
      </div>
      <div className="adm-row c2">
        <div className="panel"><div className="panel-h"><h3>Sales over time</h3><div className="seg">{['Daily', 'Weekly', 'Monthly'].map(g => <button key={g} className={gran === g ? 'on' : ''} onClick={() => setGran(g)}>{g}</button>)}</div></div>
          <BarChart key={gran + range} data={ch.data} labels={ch.labels} alt /></div>
        <div className="panel"><div className="panel-h"><h3>Customers</h3></div>
          <Donut segments={custSegments} /></div>
      </div>
      <div className="adm-row c3">
        <div className="panel"><div className="panel-h"><h3>Best sellers</h3></div><div className="adm-list">{renderProdList(bestSellers, 'No sales data yet.')}</div></div>
        <div className="panel"><div className="panel-h"><h3>Most viewed</h3></div><div className="adm-list">{renderProdList(mostViewed, 'No view data yet.')}</div></div>
        <div className="panel"><div className="panel-h"><h3>Low performing</h3></div><div className="adm-list">{renderProdList(lowPerf, 'No sales data yet.')}</div></div>
      </div>
    </>
  );
}
