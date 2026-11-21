'use client';
/* LIMITRA MicroStore owner dashboard — sits inside the normal site chrome
   (header/footer), unlike the isolated full-viewport Admin/Affiliate dashboard
   shells, because that's how the target design presents it. Reuses the same
   Kpi/BarChart/Donut/.panel/.adm-table primitives as those dashboards (see
   components/charts/Charts.jsx, styles/admin.css) for visual consistency,
   just laid out inside the page flow instead of owning the viewport.

   Most of the target design's sections (Orders, Inventory, Customers,
   Promotion, Reviews, Earnings, Withdrawals, Transactions, Order Status,
   Top Performing Products) have no backing API for MicroStores at all —
   myMicrostoreApi only exposes get/create/update/addProduct/updateProduct/
   removeProduct/analytics. Those sections render ComingSoon panels instead
   of fabricated numbers. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, Fragment } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { Kpi, BarChart } from '@/components/charts/Charts';
import { useStore } from '@/components/store/StoreProvider';
import { Breadcrumbs, Thumb } from '@/components/ui/Shared';
import { naira, PRODUCTS, REAL_IMG } from '@/lib/data';
import { myMicrostoreApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';

const fn = naira;

export const MS_NAV = [
  ['Overview', [['dashboard', 'Dashboard', 'grid']]],
  ['Sales', [['orders', 'Orders', 'cart'], ['products', 'Products', 'bag'], ['inventory', 'Inventory', 'package'], ['customers', 'Customers', 'user']]],
  ['Growth', [['analytics', 'Analytics', 'spark'], ['promotion', 'Promotion', 'gift'], ['reviews', 'Reviews', 'star']]],
  ['Finance', [['earnings', 'Earnings', 'dollar'], ['withdrawals', 'Withdrawals', 'wallet'], ['transactions', 'Transactions', 'list']]],
  ['Store', [['storefront', 'Storefront', 'store'], ['settings', 'Store Settings', 'lock']]],
];

export const msPath = (key) => '/microstore/dashboard' + (key === 'dashboard' ? '' : '/' + key);

/* ---- Per-page header slot: a page can override the topbar's subtitle and
   swap the default "Add Products" action for its own (e.g. Settings' "Save
   Changes"), without the Frame needing to know about every page's actions. */
const MsHeaderCtx = createContext(null);
export function useMsPageHeader({ subtitle, actionLabel, onAction, actionBusy } = {}) {
  const setHeader = useContext(MsHeaderCtx);
  useEffect(() => {
    setHeader?.({ subtitle, actionLabel, onAction, actionBusy });
    return () => setHeader?.(null);
  }, [setHeader, subtitle, actionLabel, onAction, actionBusy]);
}

function initialsOf(name) {
  return String(name || 'MS').trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || 'MS';
}

/* ---- Shared context: loads the store + best-effort analytics once ---- */
const MicrostoreCtx = createContext(null);
export function useMicrostore() {
  return useContext(MicrostoreCtx);
}

// GET /my-microstore's shape for the curated-products relation is
// undocumented — try every plausible key a Laravel resource might use for it
// instead of assuming `.products` is the only one.
function extractProducts(s, raw) {
  for (const obj of [s, raw]) {
    for (const key of ['products', 'curated_products', 'store_products', 'microstore_products', 'items']) {
      if (Array.isArray(obj?.[key])) return obj[key];
    }
  }
  return [];
}

const productKeyOf = (p) => p.product_id ?? p.id;

export function MicrostoreProvider({ children }) {
  const { isAuthenticated, authLoading } = useStore();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [storeRes, analyticsRes] = await Promise.all([
        myMicrostoreApi.get(),
        myMicrostoreApi.analytics().catch(() => null),
      ]);
      const s = storeRes?.microstore || storeRes;
      if (!s) {
        setNotFound(true);
        setStore(null);
      } else {
        setNotFound(false);
        setStore(s);
        // Merge rather than replace: if the server's GET omits the relation
        // (missing ?include, stale read replica, etc.) this must not wipe out
        // products that were just optimistically added this session.
        const fetched = extractProducts(s, storeRes);
        setProducts((prev) => {
          const byKey = new Map(prev.map((p) => [productKeyOf(p), p]));
          fetched.forEach((p) => byKey.set(productKeyOf(p), p));
          return Array.from(byKey.values());
        });
      }
      setAnalytics(analyticsRes?.analytics || analyticsRes || null);
    } catch (e) {
      setNotFound(true);
      setStore(null);
      setError(messageFrom(e, 'Could not load your MicroStore'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { setLoading(false); return; } // eslint-disable-line react-hooks/set-state-in-effect
    refresh();
  }, [authLoading, isAuthenticated, refresh]);

  // Optimistic local mutators — update the UI immediately from what the
  // add/update/remove endpoints themselves return or imply, instead of
  // depending on a follow-up GET /my-microstore to echo the relation back
  // correctly (see extractProducts above for why that can't be trusted alone).
  const addProductLocal = useCallback((item) => {
    setProducts((prev) => {
      const key = productKeyOf(item);
      if (prev.some((p) => productKeyOf(p) === key)) return prev;
      return [...prev, item];
    });
  }, []);
  const updateProductLocal = useCallback((productId, patch) => {
    setProducts((prev) => prev.map((p) => (productKeyOf(p) === productId ? { ...p, ...patch } : p)));
  }, []);
  const removeProductLocal = useCallback((productId) => {
    setProducts((prev) => prev.filter((p) => productKeyOf(p) !== productId));
  }, []);

  const value = useMemo(
    () => ({ store, products, analytics, loading, notFound, error, refresh, addProductLocal, updateProductLocal, removeProductLocal }),
    [store, products, analytics, loading, notFound, error, refresh, addProductLocal, updateProductLocal, removeProductLocal],
  );

  return <MicrostoreCtx.Provider value={value}>{children}</MicrostoreCtx.Provider>;
}

/* ---- Dashboard frame: sidebar + topbar, wraps every page under
   app/(site)/microstore/dashboard ---- */
export function MicrostoreDashboardFrame({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, authLoading } = useStore();
  const { store, loading, notFound } = useMicrostore();
  const [headerConfig, setHeaderConfig] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.replace('/auth/signin'); return; }
    if (!loading && notFound) router.replace('/start-microstore');
  }, [authLoading, isAuthenticated, loading, notFound, router]);

  // `loading` flips true on every refresh() call, not just the first one —
  // once a store is already loaded, a background refresh (after adding a
  // product, saving settings, etc.) must not unmount {children}, or it wipes
  // out whatever local UI state that subtree was holding (an open modal, an
  // in-progress edit) every single time.
  if (authLoading || !isAuthenticated || (loading && !store) || notFound) {
    return <div className="page page-fade"><div className="wrap" style={{ padding: '60px 0' }}><p className="muted">Loading your MicroStore…</p></div></div>;
  }

  const isActive = (key) => pathname === msPath(key);
  const current = MS_NAV.flatMap(([, items]) => items).find(([key]) => isActive(key));
  const currentLabel = current?.[1] || 'Dashboard';
  const firstName = (user?.name || user?.username || 'there').split(' ')[0];
  const storeHref = store?.slug ? `/microstores/${store.slug}` : null;

  return (
    <div className="page page-fade">
      <div className="wrap">
        <Breadcrumbs items={currentLabel === 'Dashboard' ? [{ label: 'Microstore' }] : [{ label: 'Microstore', to: ['microstoreDashboard'] }, { label: currentLabel }]} />
      </div>

      <section className="sec" style={{ paddingTop: 10 }}>
        <div className="wrap ms-dash">
          <aside className="ms-dash-side">
            <div className="ms-dash-store">
              <span className="ms-dash-avatar">{initialsOf(store?.name)}</span>
              <div>
                <b>{store?.name}</b>
                {store?.verified && <span className="adm-pill ok" style={{ marginLeft: 6 }}>Verified</span>}
                {store?.tagline && <p className="muted" style={{ marginTop: 2, fontSize: 12.5 }}>{store.tagline}</p>}
              </div>
            </div>
            <nav className="ms-dash-nav">
              {MS_NAV.map(([grp, items]) => (
                <Fragment key={grp}>
                  <div className="ms-dash-grp">{grp}</div>
                  {items.map(([key, label, ic]) => (
                    <button key={key} className={'ms-dash-link' + (isActive(key) ? ' on' : '')} onClick={() => router.push(msPath(key))}>
                      <Icon name={ic} size={17} /> {label}
                    </button>
                  ))}
                </Fragment>
              ))}
            </nav>
            {storeHref && (
              <a className="btn btn-primary btn-block" href={storeHref} target="_blank" rel="noreferrer">View Store</a>
            )}
          </aside>

          <div className="ms-dash-main">
            <div className="ms-dash-top">
              <div>
                <span className="muted">{currentLabel === 'Dashboard' ? `Good day, ${firstName}` : currentLabel}</span>
                <h1 style={{ marginTop: 2 }}>{currentLabel === 'Dashboard' ? 'Welcome back to your MicroStore!' : currentLabel}</h1>
                {headerConfig?.subtitle && <p className="muted" style={{ marginTop: 6 }}>{headerConfig.subtitle}</p>}
              </div>
              <div className="row" style={{ gap: 10 }}>
                {storeHref && (
                  <a className="btn btn-ghost" href={storeHref} target="_blank" rel="noreferrer"><Icon name="eye" size={15} /> Preview Store</a>
                )}
                {headerConfig?.onAction ? (
                  <button className="btn btn-primary" onClick={headerConfig.onAction} disabled={headerConfig.actionBusy}>
                    <Icon name="check" size={15} /> {headerConfig.actionBusy ? 'Saving…' : (headerConfig.actionLabel || 'Save Changes')}
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={() => router.push(msPath('products'))}><Icon name="plus" size={15} /> Add Products</button>
                )}
              </div>
            </div>
            <MsHeaderCtx.Provider value={setHeaderConfig}>
              {children}
            </MsHeaderCtx.Provider>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---- Shared "no backend for this yet" panel ---- */
export function ComingSoon({ title, desc, icon, bullets }) {
  return (
    <div className="panel" style={{ textAlign: 'center', padding: icon ? '48px 24px' : '36px 20px' }}>
      {icon && (
        <span style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', marginInline: 'auto', marginBottom: 16 }}>
          <Icon name={icon} size={24} className="muted" />
        </span>
      )}
      {!icon && <div className="panel-h" style={{ justifyContent: 'center', marginBottom: 8 }}><h3>{title}</h3></div>}
      {icon && <h3 style={{ marginBottom: 8 }}>{title}</h3>}
      <p className="muted" style={{ maxWidth: 380, marginInline: 'auto' }}>{desc || `${title} isn't available for MicroStores yet — this will populate once that's supported.`}</p>
      {bullets?.length > 0 && (
        <ul style={{ listStyle: 'none', maxWidth: 320, marginInline: 'auto', marginTop: 18, textAlign: 'left', display: 'grid', gap: 8 }}>
          {bullets.map((b) => (
            <li key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, color: 'var(--text-muted)' }}>
              <Icon name="clock" size={14} style={{ marginTop: 2, flex: 'none', color: 'var(--text-faint)' }} /> {b}
            </li>
          ))}
        </ul>
      )}
      <span className="adm-pill muted" style={{ marginTop: 18, display: 'inline-flex' }}>Coming soon</span>
    </div>
  );
}

/* ---- Overview ---- */
export function MSOverview() {
  const { products, analytics } = useMicrostore();
  const totalSales = analytics?.total_sales ?? analytics?.total_revenue ?? null;
  const ordersCount = analytics?.orders_count ?? analytics?.total_orders ?? null;
  const availableBalance = analytics?.available_balance ?? analytics?.balance ?? null;
  const series = Array.isArray(analytics?.series) ? analytics.series : [];
  const chartSlice = series.slice(-10);
  const chartData = chartSlice.map((d) => Number(d.sales ?? d.revenue ?? d.total ?? 0));
  const chartLabels = chartSlice.map((d) => String(d.date || '').slice(5));

  return (
    <>
      <div className="kpi-grid">
        <Kpi ic="bag" tint="#0438B6" label="Products" val={String(products.length)} />
        <Kpi ic="dollar" tint="#1F8A5B" label="Total sales" val={totalSales != null ? fn(Number(totalSales)) : 'Coming soon'} />
        <Kpi ic="cart" tint="#F5A623" label="Orders" val={ordersCount != null ? String(ordersCount) : 'Coming soon'} />
        <Kpi ic="wallet" tint="#7A5AE0" label="Available balance" val={availableBalance != null ? fn(Number(availableBalance)) : 'Coming soon'} />
      </div>

      <div className="panel">
        <div className="panel-h"><h3>Sales overview</h3></div>
        {chartData.some((v) => v > 0)
          ? <BarChart data={chartData} labels={chartLabels} alt />
          : <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>No sales data available yet — this will populate once your store has orders.</p>}
      </div>

      <div className="adm-row c2">
        <ComingSoon title="Order status" />
        <ComingSoon title="Top performing products" desc="Per-product sales ranking isn't available for MicroStores yet." />
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>My products ({products.length})</h3></div>
        {products.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 28 }}>No products curated yet.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Product</th><th>Status</th></tr></thead>
              <tbody>
                {products.slice(0, 5).map((p) => (
                  <tr key={p.id || p.product_id}>
                    <td><b>{p.custom_title || p.product?.name || p.name || `Product #${p.product_id || p.id}`}</b></td>
                    <td><span className={'adm-pill ' + (p.is_pinned ? 'ok' : 'muted')}>{p.is_pinned ? 'Pinned' : 'Standard'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ---- Products ---- */
/* Mirrors Admin's "Add product" modal chrome (.adm-drawer-scrim/.adm-modal/
   .adm-drawer-h/-body/-f) for visual consistency — but a MicroStore owner
   curates from the existing live catalog rather than creating a new product
   (myMicrostoreApi.addProduct only takes a product_id + note), so this is a
   searchable picker over the real PRODUCTS catalog, not a creation form. */
function AddProductModal({ excludeIds, onClose, onAdded }) {
  // Subscribes this component to StoreProvider so it re-renders once the
  // async catalog load (StoreProvider.loadCatalog) populates PRODUCTS — see
  // lib/data.js's note on why this is a plain computation below, not a
  // useMemo: PRODUCTS is a reassigned module-level binding, not state, so a
  // memo keyed on search/excludeIds alone would stay stuck on whatever
  // PRODUCTS looked like on this component's first render.
  const { toast } = useStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const term = search.trim().toLowerCase();
  const results = PRODUCTS
    .filter((p) => !excludeIds.has(p.id))
    .filter((p) => !term || p.name.toLowerCase().includes(term) || (p.brand || '').toLowerCase().includes(term))
    .slice(0, 40);

  const selectProduct = (p) => {
    setSelected(p);
    setTitle(p.name);
    setDesc(p.desc || '');
  };

  const resetSelection = () => {
    setSelected(null);
    setTitle('');
    setDesc('');
    setPinned(false);
    setSearch('');
  };

  // Adds one product and keeps the modal open so the owner can pick the next
  // one straight away — excludeIds (from MSProducts) is recomputed from the
  // live curated list on every refresh, so an already-added product drops out
  // of this picker's results automatically without any local bookkeeping here.
  const confirm = async () => {
    if (!selected) return;
    setSaving(true);
    const body = {
      product_id: selected.id,
      custom_title: title.trim() && title.trim() !== selected.name ? title.trim() : undefined,
      custom_description: desc.trim() || undefined,
      is_pinned: pinned || undefined,
    };
    try {
      const res = await myMicrostoreApi.addProduct(body);
      // Use whatever the server actually returns for the new curated record
      // if it looks like one; otherwise fall back to a client-built item so
      // it shows up immediately regardless of what the response shape is.
      const created = res?.microstore_product || res?.product || res;
      const item = (created && typeof created === 'object' && (created.product_id || created.id))
        ? created
        : { ...body, product: { id: selected.id, name: selected.name, price: selected.price } };
      toast(`Added "${selected.name}" to your store`);
      setAddedCount((n) => n + 1);
      onAdded(item);
      resetSelection();
    } catch (e) {
      toast(messageFrom(e, 'Could not add this product'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <div className="adm-modal adm-modal-lg" role="dialog" aria-modal="true" aria-label="Add product">
        <div className="adm-drawer-h">
          <div><h3>Add product to your MicroStore</h3><small className="muted">Base product, photo & variations come from Limitra&rsquo;s live catalog.</small></div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">
          <div className="adm-prod-modal-grid">
            <div className="adm-prod-modal-side">
              <div className="adm-img-drop" style={{ cursor: 'default', height: 160 }}>
                {selected
                  ? <div className="ms-thumb-fit" style={{ height: '100%' }}><Thumb product={selected} src={REAL_IMG[selected.id]} /></div>
                  : <span className="adm-img-empty"><Icon name="package" size={24} /><b>No product selected</b><small>Pick a base product below</small></span>}
              </div>
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.4, display: 'flex', gap: 5, alignItems: 'flex-start' }}><Icon name="lock" size={12} style={{ marginTop: 2, flex: 'none' }} /> <span>Photo is managed by Limitra&rsquo;s catalog &mdash; there&rsquo;s no per-store photo upload.</span></p>

              <label className="adm-field">
                <span>Base product</span>
                <input placeholder="Search by name or brand…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <div style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gap: 6, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 6 }}>
                {results.length === 0 ? (
                  <p className="muted" style={{ textAlign: 'center', padding: 16, fontSize: 13 }}>No matching products.</p>
                ) : results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProduct(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 'var(--r-sm)', textAlign: 'left',
                      background: selected?.id === p.id ? 'var(--primary-soft)' : 'var(--surface-2)',
                      border: selected?.id === p.id ? '1.5px solid var(--primary)' : '1.5px solid transparent',
                    }}
                  >
                    <div className="ms-thumb-fit" style={{ width: 36, height: 36, flex: 'none', borderRadius: 'var(--r-sm)' }}><Thumb product={p} src={REAL_IMG[p.id]} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ display: 'block', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</b>
                      <span className="muted" style={{ fontSize: 12 }}>{p.brand} · {fn(Number(p.price || 0))}</span>
                    </div>
                    {selected?.id === p.id && <Icon name="check" size={16} stroke={3} style={{ color: 'var(--primary)', flex: 'none' }} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="adm-prod-modal-main">
              <label className="adm-field">
                <span>Product name</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!selected} placeholder={selected ? '' : 'Select a base product first'} />
                <small className="muted">Shown on your storefront in place of the catalog name.</small>
              </label>
              <label className="adm-field">
                <span>Description</span>
                <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!selected} placeholder={selected ? 'Why you recommend it' : 'Select a base product first'} />
              </label>
              <div className="row between" style={{ padding: '2px 0' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Pin to the top of my storefront</span>
                <button
                  type="button"
                  className={'toggle' + (pinned ? ' on' : '')}
                  onClick={() => setPinned((p) => !p)}
                  disabled={!selected}
                  style={{ opacity: selected ? 1 : .5 }}
                  role="switch"
                  aria-checked={pinned}
                  aria-label="Pin to top of storefront"
                />
              </div>

              <div className="adm-field" style={{ opacity: .65 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  Variations <Icon name="lock" size={11} /> <small className="muted" style={{ textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>not editable per MicroStore</small>
                </span>
                {selected ? (
                  selected.variants?.length > 0 ? (
                    <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
                      {selected.variants.map((v) => (
                        <p key={v.name} className="muted" style={{ fontSize: 12.5, margin: 0, wordBreak: 'break-word' }}>
                          <b style={{ color: 'var(--text)' }}>{v.name}:</b> {(v.options || []).map((o) => o.name || o).join(', ')}
                        </p>
                      ))}
                    </div>
                  ) : <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>This product has no variations.</p>
                ) : <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Select a base product to see its variations.</p>}
              </div>
            </div>
          </div>
        </div>
        <div className="adm-drawer-f">
          {addedCount > 0 && <span className="muted" style={{ fontSize: 12.5, marginRight: 'auto', alignSelf: 'center' }}>{addedCount} product{addedCount === 1 ? '' : 's'} added</span>}
          <button className="adm-btn ghost" onClick={onClose}>{addedCount > 0 ? 'Done' : 'Cancel'}</button>
          <button className="adm-btn primary" disabled={!selected || saving} onClick={confirm}>{saving ? 'Adding…' : 'Add product'}</button>
        </div>
      </div>
    </>
  );
}

export function MSProducts() {
  const { products, refresh, addProductLocal, updateProductLocal, removeProductLocal } = useMicrostore();
  const [picker, setPicker] = useState(false);

  const excludeIds = useMemo(() => new Set(products.map((p) => p.product_id || p.id)), [products]);

  const togglePinned = async (p) => {
    const key = p.product_id || p.id;
    updateProductLocal(key, { is_pinned: !p.is_pinned });
    await myMicrostoreApi.updateProduct(key, { is_pinned: !p.is_pinned }).catch(() => {});
    refresh();
  };

  const removeProd = async (p) => {
    const key = p.product_id || p.id;
    removeProductLocal(key);
    await myMicrostoreApi.removeProduct(key).catch(() => {});
    refresh();
  };

  return (
    <>
      {picker && (
        <AddProductModal
          excludeIds={excludeIds}
          onClose={() => setPicker(false)}
          onAdded={(item) => { addProductLocal(item); refresh(); }}
        />
      )}

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="panel-h" style={{ padding: '18px 20px 0' }}>
          <h3>Curated products ({products.length})</h3>
          <button className="adm-btn primary" onClick={() => setPicker(true)}><Icon name="plus" size={15} /> Add product</button>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Product</th><th>Price</th><th>Pinned</th><th></th></tr></thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 24 }}>No curated products yet.</td></tr>
              ) : products.map((p) => (
                <tr key={p.id || p.product_id}>
                  <td><b>{p.custom_title || p.product?.name || p.name || `Product #${p.product_id || p.id}`}</b></td>
                  <td>{fn(Number(p.product?.price || p.price || 0))}</td>
                  <td><button className={'adm-pill ' + (p.is_pinned ? 'ok' : 'muted')} onClick={() => togglePinned(p)}>{p.is_pinned ? 'Pinned' : 'Standard'}</button></td>
                  <td><div className="adm-rowact"><button className="del" title="Remove" onClick={() => removeProd(p)}><Icon name="trash" size={15} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---- Storefront ---- */
export function MSStorefront() {
  const { store } = useMicrostore();
  const href = store?.slug ? `/microstores/${store.slug}` : null;
  return (
    <div className="panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
      <h3 style={{ marginBottom: 8 }}>{store?.name}</h3>
      <p className="muted" style={{ marginBottom: 20 }}>{store?.tagline || 'Your live MicroStore storefront.'}</p>
      {href ? (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <a className="btn btn-primary" href={href} target="_blank" rel="noreferrer"><Icon name="eye" size={15} /> Preview storefront</a>
          <button
            className="btn btn-ghost"
            onClick={async () => { try { await navigator.clipboard.writeText(window.location.origin + href); } catch (e) {} }}
          ><Icon name="copy" size={15} /> Copy link</button>
        </div>
      ) : (
        <p className="muted">Your storefront link isn&rsquo;t ready yet.</p>
      )}
    </div>
  );
}

/* ---- Store settings ---- */
function ImageSlot({ label, value, onChange, round, recommended }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const size = round ? 90 : undefined;
  return (
    <div className="panel" style={{ flex: round ? '0 0 220px' : '1 1 320px' }}>
      <b style={{ display: 'block', marginBottom: 12 }}>{label}</b>
      {value ? (
        <img src={value} alt="" style={{ width: round ? size : '100%', height: round ? size : 90, borderRadius: round ? '50%' : 'var(--r-sm)', objectFit: 'cover', background: 'var(--surface-2)', display: 'block' }} />
      ) : (
        <div style={{ width: round ? size : '100%', height: round ? size : 90, borderRadius: round ? '50%' : 'var(--r-sm)', background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
          <Icon name="store" size={22} className="muted" />
        </div>
      )}
      {editing ? (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Paste image URL" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ flex: 1 }} />
          <button className="adm-btn primary sm" onClick={() => { onChange(draft.trim()); setEditing(false); }}>Save</button>
        </div>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="adm-btn ghost sm" onClick={() => { setDraft(value || ''); setEditing(true); }}>Change image</button>
          {value && <button className="adm-btn danger sm" onClick={() => onChange('')}>Remove image</button>}
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{recommended} No file upload yet — paste a direct image URL.</p>
    </div>
  );
}

function LockedField({ label, placeholder }) {
  return (
    <label className="adm-field">
      <span>{label} <small className="muted">(coming soon)</small></span>
      <input disabled placeholder={placeholder} style={{ opacity: .55, cursor: 'not-allowed' }} />
    </label>
  );
}

export function MSSettings() {
  const { store, refresh } = useMicrostore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(store?.name || ''); // eslint-disable-line react-hooks/set-state-in-effect
    setDescription(store?.tagline || '');
    setLogoUrl(store?.logo_url || '');
    setBannerUrl(store?.banner_url || '');
  }, [store]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await myMicrostoreApi.update({
        name: name.trim(),
        tagline: description.trim() || undefined,
        logo_url: logoUrl.trim() || undefined,
        banner_url: bannerUrl.trim() || undefined,
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [name, description, logoUrl, bannerUrl, refresh]);

  useMsPageHeader({
    subtitle: 'Manage your store information, brand assets and policies',
    actionLabel: 'Save Changes',
    onAction: save,
    actionBusy: saving,
  });

  return (
    <>
      <div className="panel">
        <h3>Store Appearance</h3>
        <p className="muted" style={{ marginTop: 4, marginBottom: 16 }}>Update your store logo and cover image. These will be visible on your MicroStore.</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <ImageSlot label="Logo" value={logoUrl} onChange={setLogoUrl} round recommended="Recommended: 500x500px." />
          <ImageSlot label="Cover image" value={bannerUrl} onChange={setBannerUrl} recommended="Recommended: 1200x400px." />
        </div>
      </div>

      <div className="panel">
        <h3>Store Information</h3>
        <p className="muted" style={{ marginTop: 4, marginBottom: 16 }}>Tell customers about your store and where you&rsquo;re located.</p>
        <div className="adm-field-row">
          <label className="adm-field"><span>Store name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="adm-field"><span>Store description</span><input value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        </div>
        <div className="adm-field-row" style={{ marginTop: 10 }}>
          <LockedField label="Store category" placeholder="e.g. Gaming and Tech" />
          <LockedField label="Contact email" placeholder="you@email.com" />
        </div>
        <div className="adm-field-row" style={{ marginTop: 10 }}>
          <LockedField label="Store location" placeholder="e.g. Lagos, Nigeria" />
          <LockedField label="Phone number" placeholder="+234…" />
        </div>
      </div>

      <div className="panel">
        <h3>Store Links</h3>
        <p className="muted" style={{ marginTop: 4, marginBottom: 16 }}>Add your social media and website links.</p>
        <div className="adm-field-row">
          <LockedField label="Instagram" placeholder="yourhandle" />
          <LockedField label="Facebook" placeholder="yourhandle" />
        </div>
        <div className="adm-field-row" style={{ marginTop: 10 }}>
          <LockedField label="TikTok" placeholder="yourhandle" />
          <LockedField label="Website" placeholder="https://" />
        </div>
      </div>

      <div className="panel">
        <h3>Store Policies</h3>
        <p className="muted" style={{ marginTop: 4, marginBottom: 16 }}>Add your store policies to build trust with your customers.</p>
        <div className="adm-field-row">
          <LockedField label="Shipping policy" placeholder="" />
          <LockedField label="Return & refund policy" placeholder="" />
        </div>
        <div className="adm-field-row" style={{ marginTop: 10 }}>
          <LockedField label="Consolidation policy" placeholder="" />
        </div>
      </div>
    </>
  );
}

/* ---- Analytics (real endpoint, undocumented shape) ---- */
export function MSAnalytics() {
  const { analytics } = useMicrostore();
  const entries = analytics && typeof analytics === 'object'
    ? Object.entries(analytics).filter(([k, v]) => typeof v === 'number' || typeof v === 'string')
    : [];

  if (entries.length === 0) {
    return <ComingSoon title="Analytics" desc="No analytics data is available for your MicroStore yet." />;
  }

  return (
    <div className="kpi-grid">
      {entries.map(([k, v]) => (
        <Kpi key={k} ic="spark" tint="#0438B6" label={k.replace(/_/g, ' ')} val={String(v)} />
      ))}
    </div>
  );
}
