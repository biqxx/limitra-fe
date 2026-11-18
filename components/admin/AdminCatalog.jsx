'use client';
/* Catalog nav group (Products, Inventory, Orders, Coupons) — ported verbatim from
   legacy/admin-sections.jsx. `window.admToast` calls were replaced with `useAdminToast()`;
   `window.__admHL` cross-page highlight was replaced with `useHighlight()` reading
   `useSearchParams().get('highlight')` (see AdminOrders / AdminInventory below). */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { Thumb, REAL_IMG } from '@/components/ui/Shared';
import { useStore } from '@/components/store/StoreProvider';
import { naira, PRODUCTS, CATEGORIES } from '@/lib/data';
import { getVariants, setVariants, applyStoredVariants } from '@/lib/variantsStore';
import { cartesianCombos, defaultSku, groupsFromFlatVariants, stockMapFromFlatVariants } from '@/lib/variants';
import { productsApi, categoriesApi, adminProductsApi, sourcingApi, adminOrdersApi, adminPromotionsApi, adminInventoryApi } from '@/lib/api/endpoints';
import { hasPermission } from '@/lib/auth/permissions';
import { messageFrom } from '@/lib/api/errors';
import { Kpi } from '@/components/charts/Charts';
import { useAdminToast } from './AdminToastContext';
import { AdmHead, Pager, usePager, AdmSelect, AdmDate, useHighlight } from './AdminShared';
import { buildThermalReceiptHtml, printThermalReceipt, downloadThermalReceipt, buildShippingLabelHtml, printShippingLabel, downloadShippingLabel } from './ThermalReceipt';

// Confirmed by the spec's own enum (GET /admin/orders' `status` param) — unlike
// most of this API, these request/response shapes look real, though still
// unverified live (see adminOrdersApi in lib/api/endpoints.js).
const ORDER_STATUSES = ['pending_payment', 'confirmed', 'processing', 'shipped', 'in_transit', 'delivered', 'cancelled'];
const ORDER_STATUS_LABEL = {
  pending_payment: 'Pending payment', confirmed: 'Confirmed', processing: 'Processing',
  shipped: 'Shipped', in_transit: 'In transit', delivered: 'Delivered', cancelled: 'Cancelled',
};
const ORDER_STATUS_CLS = {
  pending_payment: 'warn', confirmed: 'info', processing: 'warn',
  shipped: 'info', in_transit: 'info', delivered: 'ok', cancelled: 'bad',
};

function normalizeAdminOrder(o) {
  const items = o.items ?? o.order_items ?? o.line_items;
  const itemCount = o.items_count ?? o.item_count
    ?? (Array.isArray(items) ? items.reduce((s, it) => s + Number(it.quantity ?? it.qty ?? 1), 0) : null) ?? 0;
  const customer = o.customer_name ?? o.customer?.name ?? o.user?.name
    ?? [o.user?.first_name, o.user?.last_name].filter(Boolean).join(' ')
    ?? o.contact_email ?? o.user?.email ?? 'Customer';
  return {
    id: o.id ?? o.order_id ?? o.order_number,
    status: String(o.status ?? 'pending_payment').toLowerCase(),
    paymentStatus: o.payment_status,
    customer,
    date: o.created_at ?? o.date,
    itemCount,
    total: Number(o.order_total ?? (Number(o.total ?? o.total_amount ?? o.grand_total ?? o.amount ?? 0) + Number(o.credit_total ?? 0))),
    raw: o,
  };
}

/* ---------- PRODUCTS ---------- */
/* module-scope, mirrors the legacy `window.ADMIN_EXTRA_CATS` mutable global */
let ADMIN_EXTRA_CATS = [];

// GET /admin/products (adminProductsApi, lib/api/endpoints.js) returns the full
// backend record — brand, sku, status (draft/active/archived), compare_at_price,
// is_featured, etc. — none of which the public OpenAPI spec documents. Mapped
// here into the flat shape this table/drawer already expect; `_raw` keeps the
// untouched record around for anything not mapped.
// `variants` on the real backend is a FLAT array of per-SKU records —
// confirmed live via a 422 on POST /admin/products: "variants.0.sku",
// "variants.0.attributes" and "variants.0.stock" are each required — NOT the
// {name,type,options:[...]} "attribute group" shape this admin's authoring UI
// uses (one group per dimension, e.g. Colour/Storage, each option optionally
// carrying its own price override). The two are reconciled below: `variants`
// stays the authoring-group shape (from lib/variantsStore.js, since the
// backend doesn't store colour swatches or per-option price overrides), while
// `variantStock` carries the real sku/stock per attribute-combination, keyed
// by comboKey() so it survives regardless of group ordering. saveAdminProduct
// cross-multiplies the groups with variantStock to build the flat payload the
// backend actually validates.
export const mapAdminProduct = (p) => {
  const flatVariants = Array.isArray(p.variants) ? p.variants.filter(v => v && typeof v === 'object') : [];
  const localGroups = getVariants(p.id);
  const firstImg = Array.isArray(p.images) ? p.images[0] : null;
  const imageUrl = typeof firstImg === 'string' ? firstImg : firstImg?.url || firstImg?.path;
  if (p.id && imageUrl && !REAL_IMG[p.id]) REAL_IMG[p.id] = imageUrl;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand || '',
    price: Number(p.price) || 0,
    was: Number(p.compare_at_price) || 0,
    discountActive: Boolean(p.discount_active),
    discountPercentage: Number(p.discount_percentage) || 0,
    discountStartsAt: p.discount_starts_at || null,
    discountEndsAt: p.discount_ends_at || null,
    stock: p.stock ?? 0,
    category: p.category?.slug || 'all',
    status: p.status || 'draft',
    desc: p.description || '',
    variants: localGroups.length ? localGroups : groupsFromFlatVariants(flatVariants),
    variantStock: stockMapFromFlatVariants(flatVariants),
    _raw: p,
  };
};

export const productToDraft = (p) => ({
  id: p.id,
  name: p.name,
  brand: p.brand,
  price: p.price,
  category: p.category,
  status: p.status,
  desc: p.desc,
  _stock: p.stock,
  variants: p.variants,
  variantStock: p.variantStock,
  _raw: p._raw,
});

const pricingIssueMessage = (source) => {
  const reasons = source?.current_price_quote?.blocked_reasons || [];
  const missing = source?.current_price_quote?.missing_inputs || [];
  const labels = {
    delivery_above_limit: 'supplier delivery exceeds the configured limit',
    weight_above_limit: 'supplier weight exceeds the configured limit',
    supplier_price: 'supplier price',
    supplier_currency: 'supplier currency',
    delivery_days_max: 'maximum delivery time',
  };

  if (reasons.length) {
    return `Cannot activate this product: ${reasons.map(reason => labels[reason] || reason.replaceAll('_', ' ')).join(', ')}.`;
  }
  if (missing.length) {
    return `Cannot activate this product until you add: ${missing.map(field => labels[field] || field.replaceAll('_', ' ')).join(', ')}.`;
  }
  return 'Recalculate and approve the supplier price before activating this product.';
};

// Shared by AdminProducts' own editor and AdminSourcing's "Review product"
// modal (reviewing a just-imported product without leaving the Sourcing
// page) — builds the request body, runs the sourced-pricing approval flow
// when publishing a sourced product, creates or updates the product, and
// persists variants (see mapAdminProduct's comment on why both the real
// field and the localStorage fallback are written). Returns the product id
// on success, or null if blocked (pricing issue) — caller decides what to
// do next (close a drawer, reload a list, etc.), this never does either.
function invalidateStorefrontCatalogCache() {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem('lim_catalog_cache_v1'); } catch (e) {}
  window.dispatchEvent(new Event('lim:catalog-dirty'));
}

export async function saveAdminProduct(d, toast) {
  const catObj = [...CATEGORIES, ...ADMIN_EXTRA_CATS].find(c => c.slug === d.category);
  const sources = d._raw?.sources || [];
  const sourced = Boolean(sources.length);
  const variantsPayload = cartesianCombos(d.variants).map(c => {
    const rec = d.variantStock?.[c.key] || {};
    return {
      sku: String(rec.sku || defaultSku(d.name, c.attributes)).trim(),
      attributes: c.attributes,
      stock: Math.max(0, Number(rec.stock) || 0),
    };
  });
  const body = { category_id: catObj?.id ?? d._raw?.category?.id, name: d.name.trim(), brand: d.brand.trim(), description: d.desc || '', stock: Number(d._stock) || 0, status: d.status || 'draft', variants: variantsPayload };
  if (!sourced) body.price = Number(d.price) || 0;

  let productId = d.id;
  if (d._new) {
    const created = await adminProductsApi.create(body);
    productId = created?.id ?? productId;
    toast(d.status === 'active' ? 'Product created and published' : 'Product created');
  } else {
    if (body.status === 'active' && sourced) {
      const unapprovable = sources.find(source => !['approved', 'pending_approval'].includes(source.pricing_status));
      if (unapprovable) {
        toast(pricingIssueMessage(unapprovable));
        return null;
      }
      for (const source of sources.filter(source => source.pricing_status === 'pending_approval')) {
        await sourcingApi.approvePrice(source.id, source.current_price_quote?.id);
      }
    }
    await adminProductsApi.update(d.id, body);
    toast(body.status === 'active' ? 'Price approved and product published' : 'Changes saved');
  }
  if (productId != null) setVariants(productId, d.variants || []);
  invalidateStorefrontCatalogCache();
  return productId;
}

// /admin/products/[id] renders this same list page with that product's edit
// drawer pre-opened (see app/admin/products/[id]/page.js) rather than being a
// separate detail page — matches every other admin section, which only ever
// has one flat list + an inline drawer, never a per-record route.
export function AdminProducts({ editId }) {
  const addToast = useAdminToast();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState('featured');
  const [stat, setStat] = useState('All status');
  const [stockStat, setStockStat] = useState('All stock');
  const [editing, setEditing] = useState(null); // product being edited
  const [bulk, setBulk] = useState(false);
  const t = (m) => addToast(m);

  // The admin's OWN catalog, not the storefront's — productsApi.list() (what
  // StoreProvider's catalog loader feeds PRODUCTS from) always filters to
  // status:"active" only, for every caller, with no override, even an admin
  // token. A freshly created product defaults to "draft" and would never show
  // up there — this is why a just-created product "disappeared" on refresh.
  const loadProducts = useCallback(async () => {
    try {
      const res = await adminProductsApi.list({ per_page: 100 });
      const raw = Array.isArray(res) ? res : res?.items || res?.data || [];
      setItems(raw.map(mapAdminProduct));
    } catch (e) {
      t(messageFrom(e));
    } finally {
      setLoaded(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Always fetch the detail record for an editor deep link. List records do not
  // include supplier sources, so using one here hides the pricing approval UI
  // even though the API still enforces supplier-price approval on activation.
  const deepLinkOpened = useRef(false);
  useEffect(() => {
    if (!editId || deepLinkOpened.current) return;

    let cancelled = false;
    deepLinkOpened.current = true;
    adminProductsApi.get(editId).then(raw => {
      if (cancelled) return;
      setEditing(productToDraft(mapAdminProduct(raw)));
    }).catch(e => {
      if (!cancelled) t(messageFrom(e));
    });
    return () => { cancelled = true; };
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeEditing = () => { setEditing(null); router.replace('/admin/products'); };
  const openEditor = async (product) => {
    // The route change also triggers the deep-link effect. Mark this interaction
    // as handled so it cannot briefly open a source-less list record first.
    deepLinkOpened.current = true;
    router.replace('/admin/products/' + product.id);
    try {
      const detail = await adminProductsApi.get(product.id);
      setEditing(productToDraft(mapAdminProduct(detail)));
    } catch (error) {
      t(messageFrom(error));
    }
  };

  const cats = ['all', ...new Set(items.map(p => p.category))];
  const stockStatusOf = (s) => s === 0 ? 'Out of stock' : s < 10 ? 'Low stock' : 'In stock';
  let list = items.filter(p =>
    (cat === 'all' || p.category === cat) &&
    (!q || p.name.toLowerCase().includes(q.toLowerCase())) &&
    (stat === 'All status' || p.status === stat.toLowerCase()) &&
    (stockStat === 'All stock' || stockStatusOf(p.stock) === stockStat)
  );
  list = [...list].sort((a, b) => {
    if (sort === 'price-low') return a.price - b.price;
    if (sort === 'price-high') return b.price - a.price;
    if (sort === 'name-az') return a.name.localeCompare(b.name);
    if (sort === 'stock-low') return a.stock - b.stock;
    if (sort === 'stock-high') return b.stock - a.stock;
    return 0;
  });
  const { shown: pShown, pagerProps: pPager } = usePager(list, q + cat + sort + stat + stockStat);
  return (
    <>
      <AdmHead title="Products" sub={`${items.length} products across ${cats.length - 1} categories`}>
        <button className="adm-btn ghost" onClick={() => setBulk(true)}><Icon name="download" size={15} /> Bulk upload</button>
        <button className="adm-btn primary" onClick={() => setEditing({ id: 'new', name: '', brand: '', price: 0, category: cats[1] || 'phones', status: 'draft', desc: '', _stock: 20, _new: true })}><Icon name="plus" size={15} /> Add product</button>
      </AdmHead>
      <div className="adm-filters">
        <div className="adm-mini-search"><Icon name="search" size={16} className="muted" /><input placeholder="Search products…" value={q} onChange={e => setQ(e.target.value)} /></div>
        {cats.slice(0, 6).map(c => <button key={c} className={'adm-chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c === 'all' ? 'All' : (CATEGORIES.find(x => x.slug === c)?.name || c)}</button>)}
        <div className="adm-filters-r">
          <AdmSelect compact icon="filter" title="Filter by catalog status" value={stat} options={['All status', 'Draft', 'Active', 'Archived']} onChange={setStat} />
          <AdmSelect compact icon="filter" title="Filter by stock" value={stockStat} options={['All stock', 'In stock', 'Low stock', 'Out of stock']} onChange={setStockStat} />
          <AdmSelect compact icon="sort" title="Sort by" value={sort} options={[{ value: 'featured', label: 'Featured' }, { value: 'price-low', label: 'Price: Low → High' }, { value: 'price-high', label: 'Price: High → Low' }, { value: 'name-az', label: 'Name: A → Z' }, { value: 'stock-low', label: 'Stock: Low → High' }, { value: 'stock-high', label: 'Stock: High → Low' }]} onChange={setSort} />
        </div>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Variations</th><th>Status</th><th></th></tr></thead>
          <tbody>{pShown.map(p => (
            <tr key={p.id}>
              <td><div className="adm-prod"><span className="adm-prod-thumb"><Thumb product={p} src={REAL_IMG[p.id]} /></span><div><b>{p.name.split(',')[0]}</b><small>{p.brand ? p.brand + ' · ' : ''}{p.slug}</small></div></div></td>
              <td>{CATEGORIES.find(x => x.slug === p.category)?.name || p.category}</td>
              <td>
                <b>{naira(p.price)}</b>
                {p.was > p.price && (
                  <div className="row" style={{ gap: 6, marginTop: 2 }}>
                    <small className="muted" style={{ textDecoration: 'line-through' }}>{naira(p.was)}</small>
                    <span className="adm-pill warn" style={{ fontSize: 10.5, padding: '1px 6px' }}>-{p.discountPercentage || Math.round(((p.was - p.price) / p.was) * 100)}%</span>
                  </div>
                )}
              </td>
              <td>{p.stock}</td>
              <td>{p.variants?.length
                ? <span className="adm-pill ok">{p.variants.map(g => g.name).filter(Boolean).join(', ') || `${p.variants.length} set`}</span>
                : <span className="adm-pill muted">None</span>}</td>
              <td className="row" style={{ gap: 6 }}>
                <span className={'adm-pill ' + (p.stock === 0 ? 'bad' : p.stock < 10 ? 'warn' : 'ok')}>{stockStatusOf(p.stock)}</span>
                <span className={'adm-pill ' + (p.status === 'active' ? 'ok' : p.status === 'draft' ? 'warn' : 'muted')}>{p.status === 'active' ? 'Active' : p.status === 'archived' ? 'Archived' : 'Draft'}</span>
              </td>
              <td><div className="adm-rowact"><button title="Edit" onClick={() => openEditor(p)}><Icon name="edit" size={15} /></button><button className="del" title="Delete" onClick={async () => {
                try { await adminProductsApi.remove(p.id); } catch (e) { t(messageFrom(e)); return; }
                setItems(list => list.filter(x => x.id !== p.id));
                t('Product deleted');
              }}><Icon name="trash" size={15} /></button></div></td>
            </tr>
          ))}</tbody>
        </table>{loaded && list.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No products match your filters.</div>}<Pager {...pPager} /></div>
      </div>
      {editing && <ProductEditDrawer key={`${editing.id}:${(editing._raw?.sources || []).map(source => source.id).join(',')}`} draft={editing} onClose={closeEditing} onMutated={loadProducts} onSave={async (d) => {
        try {
          const productId = await saveAdminProduct(d, t);
          if (productId == null) return; // blocked (pricing issue) — leave the drawer open
          await loadProducts();
          closeEditing();
        } catch (e) {
          t(messageFrom(e));
        }
      }} />}
      {bulk && <BulkUploadModal onClose={() => setBulk(false)} onDone={() => { loadProducts(); setBulk(false); }} />}
    </>
  );
}

function BulkUploadModal({ onClose, onDone }) {
  const addToast = useAdminToast();
  const [file, setFile] = useState(null);
  const [job, setJob] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!job?.id || !['pending', 'queued', 'processing'].includes(String(job.status || '').toLowerCase())) return undefined;
    const t = setInterval(async () => {
      try {
        const next = await adminProductsApi.getImport(job.id);
        setJob(next);
        if (['completed', 'failed', 'cancelled'].includes(String(next?.status || '').toLowerCase())) {
          const errRes = await adminProductsApi.importErrors(job.id).catch(() => null);
          setErrors(Array.isArray(errRes?.items) ? errRes.items : Array.isArray(errRes) ? errRes : []);
          if (String(next?.status).toLowerCase() === 'completed') onDone();
        }
      } catch {}
    }, 2500);
    return () => clearInterval(t);
  }, [job, onDone]);

  const startUpload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await adminProductsApi.startImport(fd);
      setJob(res);
      addToast('Product import queued');
    } catch (e) {
      addToast(messageFrom(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <div className="adm-modal" role="dialog" aria-label="Bulk upload">
        <div className="adm-drawer-h"><h3>Bulk product upload</h3><button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button></div>
        <div className="adm-drawer-body">
          <label className="adm-img-drop" style={{ height: 150 }}>
            {file
              ? <span className="adm-img-empty"><Icon name="check" size={26} stroke={3} /><b>{file.name}</b><small>Ready to import</small></span>
              : <span className="adm-img-empty"><Icon name="download" size={26} /><b>Drop CSV / Excel file</b><small>or click to browse · .csv, .xlsx</small></span>}
            <input type="file" accept=".csv,.xlsx,.xls" hidden onChange={e => { const fl = e.target.files && e.target.files[0]; if (fl) setFile(fl); }} />
          </label>
          <div className="adm-note">
            <Icon name="info" size={15} /> Columns: name, brand, category, price, stock, description, image URL.{' '}
            <a href={adminProductsApi.importTemplateUrl()} target="_blank" rel="noopener noreferrer">Download template</a>
          </div>
          {job && (
            <div className="panel" style={{ marginTop: 12, padding: 12 }}>
              <div className="row between">
                <b>Import #{job.id}</b>
                <span className="adm-pill info">{job.status || 'queued'}</span>
              </div>
              {errors.length > 0 && (
                <ul style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', paddingLeft: 18 }}>
                  {errors.slice(0, 5).map((err, i) => <li key={i}>{err.message || err.error || JSON.stringify(err)}</li>)}
                </ul>
              )}
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                {['pending', 'queued', 'processing'].includes(String(job.status || '').toLowerCase()) && (
                  <button className="adm-btn ghost" onClick={async () => { await adminProductsApi.cancelImport(job.id).catch(() => {}); setJob(await adminProductsApi.getImport(job.id).catch(() => job)); }}>Cancel job</button>
                )}
                {String(job.status || '').toLowerCase() === 'failed' && (
                  <button className="adm-btn ghost" onClick={async () => { await adminProductsApi.retryImport(job.id).catch(() => {}); setJob(await adminProductsApi.getImport(job.id).catch(() => job)); }}>Retry job</button>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="adm-drawer-f">
          <button className="adm-btn ghost" onClick={onClose}>Close</button>
          <button className="adm-btn primary" disabled={!file || busy} onClick={startUpload}>{busy ? 'Uploading…' : 'Import products'}</button>
        </div>
      </div>
    </>
  );
}

/* Per-product variations (colour, storage, size, …) — the uploader defines
   whichever groups actually apply to this product; ProductPage only renders
   the ones present, so nothing shows for products with none. */
function VariantGroupRow({ group, onChange, onRemove }) {
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#0438B6');
  const label = (o) => group.type === 'color' ? o.name : o.label;
  const addOption = () => {
    const v = name.trim();
    if (!v) return;
    const exists = group.options.some(o => label(o) === v);
    if (exists) return;
    const next = group.type === 'color' ? { name: v, hex, price: null } : { label: v, price: null };
    onChange({ options: [...group.options, next] });
    setName('');
  };
  const removeOption = (oi) => onChange({ options: group.options.filter((_, i) => i !== oi) });
  const updateOptionPrice = (oi, raw) => {
    const price = raw === '' ? null : Math.max(0, Number(raw) || 0);
    onChange({ options: group.options.map((o, i) => i === oi ? { ...o, price } : o) });
  };
  return (
    <div className="adm-variant-group" style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: 14, marginBottom: 12 }}>
      <div className="adm-field-row" style={{ marginBottom: 10 }}>
        <label className="adm-field"><span>Variation name</span><input value={group.name} onChange={e => onChange({ name: e.target.value })} placeholder="e.g. Colour, Size" /></label>
        <label className="adm-field"><span>Type</span>
          <AdmSelect value={group.type} options={[{ value: 'text', label: 'Text options' }, { value: 'color', label: 'Colour swatches' }]} onChange={v => onChange({ type: v, options: [] })} />
        </label>
      </div>
      <div className="adm-variant-opts" style={{ marginBottom: 10 }}>
        {group.options.map((o, oi) => (
          <div key={oi} className="adm-variant-opt-row">
            {group.type === 'color' && <i className="adm-variant-swatch" style={{ background: o.hex }} />}
            <span className="adm-variant-opt-label">{label(o)}</span>
            <div className="adm-variant-opt-price">
              <span className="muted">₦</span>
              <input type="number" min="0" step="100" placeholder="Base price" value={o.price ?? ''} onChange={e => updateOptionPrice(oi, e.target.value)} />
            </div>
            <button type="button" onClick={() => removeOption(oi)} aria-label="Remove option"><Icon name="close" size={13} /></button>
          </div>
        ))}
        {group.options.length === 0 && <span className="muted" style={{ fontSize: 12.5 }}>No options yet</span>}
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginBottom: 10, marginTop: -4 }}>Leave an option&apos;s price blank to use the product&apos;s base price when it&apos;s selected.</p>
      <div className="adm-field-row" style={{ alignItems: 'flex-end' }}>
        <label className="adm-field" style={{ flex: 1 }}>
          <span>{group.type === 'color' ? 'Add colour' : 'Add option'}</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={group.type === 'color' ? 'e.g. Cosmic Orange' : 'e.g. 256GB'} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }} />
        </label>
        {group.type === 'color' && (
          <label className="adm-field" style={{ width: 56 }}>
            <span>Swatch</span>
            <input type="color" value={hex} onChange={e => setHex(e.target.value)} style={{ padding: 2, height: 42 }} />
          </label>
        )}
        <button type="button" className="adm-btn ghost" onClick={addOption}>Add</button>
      </div>
      <button type="button" className="adm-btn ghost del" style={{ marginTop: 10 }} onClick={onRemove}><Icon name="trash" size={13} /> Remove variation</button>
    </div>
  );
}

function VariantsEditor({ variants, onChange }) {
  const groups = variants || [];
  const updateGroup = (i, patch) => onChange(groups.map((g, gi) => gi === i ? { ...g, ...patch } : g));
  return (
    <div className="adm-field">
      <span>Variations</span>
      {groups.map((g, i) => (
        <VariantGroupRow key={i} group={g} onChange={patch => updateGroup(i, patch)} onRemove={() => onChange(groups.filter((_, gi) => gi !== i))} />
      ))}
      <button type="button" className="adm-btn ghost" style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...groups, { name: '', type: 'text', options: [] }])}>
        <Icon name="plus" size={14} /> Add variation
      </button>
    </div>
  );
}

export function ProductEditDrawer({ draft, onClose, onSave, onMutated }) {
  const addToast = useAdminToast();
  const [f, setF] = useState({ ...draft, variants: draft.variants || [], variantStock: draft.variantStock || {} });
  const [pricingBusy, setPricingBusy] = useState(false);
  const toLocalDt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [discMode, setDiscMode] = useState('pct');
  const [discValue, setDiscValue] = useState(() => (draft._raw?.discount_percentage > 0 ? String(draft._raw.discount_percentage) : ''));
  const [discStartsAt, setDiscStartsAt] = useState(() => toLocalDt(draft._raw?.discount_starts_at));
  const [discEndsAt, setDiscEndsAt] = useState(() => toLocalDt(draft._raw?.discount_ends_at));
  const [discBusy, setDiscBusy] = useState(false);
  const initialSource = draft._raw?.sources?.[0] || null;
  const [pricingInputs, setPricingInputs] = useState({
    supplier_price: initialSource?.supplier_price || '',
    supplier_currency: initialSource?.supplier_currency || 'USD',
    weight_lb: initialSource?.weight_lb || '',
    delivery_days_min: initialSource?.delivery_days_min || '',
    delivery_days_max: initialSource?.delivery_days_max || '',
  });
  const [, force] = useState(0);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const setComboField = (key, field, value) => setF(s => ({ ...s, variantStock: { ...s.variantStock, [key]: { ...(s.variantStock?.[key] || {}), [field]: value } } }));
  const combos = cartesianCombos(f.variants);
  const source = f._raw?.sources?.[0] || null;
  const quote = source?.current_price_quote;
  const sourced = Boolean(source);
  const pricingApproved = source?.pricing_status === 'approved';
  const cats = [...CATEGORIES, ...ADMIN_EXTRA_CATS];
  const addCat = async (name) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (cats.some(c => c.slug === slug)) { set('category', slug); return; }
    try {
      const created = await categoriesApi.create({ name });
      ADMIN_EXTRA_CATS.push({ slug, name, id: created?.id });
      set('category', slug); force(n => n + 1);
      addToast('Category “' + name + '” added');
    } catch (e) {
      addToast(messageFrom(e));
    }
  };
  const applySource = updated => {
    setF(current => ({
      ...current,
      price: Number(updated.final_price_ngn || updated.current_price_quote?.proposed_price_ngn || current.price) || 0,
      _raw: {
        ...current._raw,
        price: updated.product?.price || current._raw?.price,
        sources: [updated, ...(current._raw?.sources || []).filter(item => item.id !== updated.id)],
      },
    }));
  };
  const recalculate = async () => {
    setPricingBusy(true);
    try {
      const payload = Object.fromEntries(Object.entries(pricingInputs).filter(([, value]) => value !== '').map(([key, value]) => [key, key === 'supplier_currency' ? String(value).toUpperCase() : Number(value)]));
      const updated = await sourcingApi.recalculatePrice(source.id, payload);
      applySource(updated);
      addToast(updated.pricing_status === 'pending_approval' ? 'Price calculated. Review and approve it below.' : 'Pricing details saved. Complete the missing information.');
    } catch (error) {
      addToast(messageFrom(error));
    } finally {
      setPricingBusy(false);
    }
  };
  const approve = async () => {
    setPricingBusy(true);
    try {
      const updated = await sourcingApi.approvePrice(source.id, quote?.id);
      applySource(updated);
      addToast('Selling price approved. This product can now be published.');
    } catch (error) {
      addToast(messageFrom(error));
    } finally {
      setPricingBusy(false);
    }
  };
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <div className="adm-modal adm-modal-lg" role="dialog" aria-modal="true" aria-label={f._new ? 'Add product' : 'Edit product'}>
        <div className="adm-drawer-h">
          <div>
            <h3>{f._new ? 'Add product' : 'Edit product'}</h3>
            {!f._new && f.id && <small className="muted">Product #{f.id}{source ? ` · ${source.supplier}` : ''}</small>}
          </div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">
          <div className="adm-prod-modal-grid">
            <div className="adm-prod-modal-side">
              <label className="adm-img-drop" style={{ height: 220 }}>
                {f._img
                  ? <img src={f._img} alt="preview" className="adm-img-preview" />
                  : (!f._new && f._raw)
                    ? <div className="adm-drawer-thumb" style={{ height: '100%' }}><Thumb product={f._raw} src={REAL_IMG[f._raw.id]} /></div>
                    : <span className="adm-img-empty"><Icon name="download" size={26} /><b>Add product photo</b><small>Click to upload, JPG, PNG or WEBP</small></span>}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => {
                  const file = e.target.files && e.target.files[0]; if (!file) return;
                  const r = new FileReader(); r.onload = () => set('_img', r.result); r.readAsDataURL(file);
                }} />
                {f._img && <span className="adm-img-replace"><Icon name="edit" size={13} /> Change photo</span>}
              </label>

              <label className="adm-field"><span>Category</span>
                <AdmSelect value={f.category} options={cats.map(c => ({ value: c.slug, label: c.name }))} onChange={v => set('category', v)} creatable onCreate={addCat} />
              </label>

              <label className="adm-field"><span>Catalog status</span>
                <AdmSelect value={f.status || 'draft'} options={[{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]} onChange={v => set('status', v)} />
                {sourced && source.pricing_status === 'pending_approval' && <small className="muted">Saving as Active will approve the displayed price and publish the product.</small>}
                {sourced && !pricingApproved && source.pricing_status !== 'pending_approval' && <small className="muted">{pricingIssueMessage(source)} Update the pricing inputs or pricing settings, then recalculate.</small>}
              </label>
            </div>

            <div className="adm-prod-modal-main">
              <div className="adm-field-row">
                <label className="adm-field"><span>Product name</span><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Product name" /></label>
                <label className="adm-field"><span>Brand</span><input value={f.brand} onChange={e => set('brand', e.target.value)} placeholder="Brand" /></label>
              </div>

              <div className="adm-field-row">
                <label className="adm-field"><span>{sourced ? 'Approved / proposed price (₦)' : 'Price (₦)'}</span><input type="number" value={f.price} onChange={e => set('price', e.target.value)} disabled={sourced} />{sourced && <small className="muted">Managed by supplier pricing below.</small>}</label>
                <label className="adm-field"><span>Stock</span><input type="number" value={f._stock} onChange={e => set('_stock', e.target.value)} /></label>
              </div>

              {f.id && f.id !== 'new' && (
                <section className="adm-supplier-card">
                  <div className="adm-supplier-head">
                    <div>
                      <b>Price discount &amp; timer</b>
                      <small className="muted" style={{ display: 'block', marginTop: 2 }}>
                        {f._raw?.discount_active
                          ? `Active: ${naira(Number(f.price))} (slashed from ${naira(Number(f._raw?.compare_at_price || f.price))}) · ${f._raw?.discount_ends_at ? 'Ends ' + new Date(f._raw.discount_ends_at).toLocaleString() : 'No expiry (infinite)'}`
                          : 'Slash the selling price by percentage or fixed amount, with optional start & end timer.'}
                      </small>
                    </div>
                    {f._raw?.discount_active && <span className="adm-pill ok">-{f._raw?.discount_percentage || 0}% OFF</span>}
                  </div>
                  <div className="adm-field-row">
                    <label className="adm-field">
                      <span>Discount type</span>
                      <select value={discMode} onChange={e => setDiscMode(e.target.value)}>
                        <option value="pct">Percentage (%)</option>
                        <option value="price">Slashed price (₦)</option>
                      </select>
                    </label>
                    <label className="adm-field">
                      <span>{discMode === 'pct' ? 'Discount (%)' : 'New buying price (₦)'}</span>
                      <input type="number" min="1" step="0.01" value={discValue} onChange={e => setDiscValue(e.target.value)} placeholder={discMode === 'pct' ? 'e.g. 20' : 'e.g. 40000'} />
                    </label>
                  </div>
                  <div className="adm-field-row">
                    <label className="adm-field">
                      <span>Starts at (optional)</span>
                      <input type="datetime-local" value={discStartsAt} onChange={e => setDiscStartsAt(e.target.value)} />
                    </label>
                    <label className="adm-field">
                      <span>Ends at (blank = infinite)</span>
                      <input type="datetime-local" value={discEndsAt} onChange={e => setDiscEndsAt(e.target.value)} />
                    </label>
                  </div>
                  <div className="adm-supplier-actions">
                    <button
                      type="button"
                      className="adm-btn ghost"
                      disabled={discBusy || !discValue}
                      onClick={async () => {
                        const num = Number(discValue);
                        if (!num || num <= 0) { addToast('Enter a valid discount value'); return; }
                        setDiscBusy(true);
                        try {
                          const payload = discMode === 'pct' ? { discount_percentage: num } : { discounted_price: num };
                          if (discStartsAt) payload.discount_starts_at = new Date(discStartsAt).toISOString();
                          if (discEndsAt) payload.discount_ends_at = new Date(discEndsAt).toISOString();
                          const res = await adminProductsApi.applyDiscount(f.id, payload);
                          const updated = res?.data ?? res;
                          setF(curr => ({
                            ...curr,
                            price: Number(updated?.price ?? curr.price),
                            _raw: updated ? { ...curr._raw, ...updated, sources: updated.sources ?? curr._raw?.sources } : curr._raw,
                          }));
                          invalidateStorefrontCatalogCache();
                          onMutated?.();
                          addToast('Discount applied');
                        } catch (err) {
                          addToast(messageFrom(err));
                        } finally {
                          setDiscBusy(false);
                        }
                      }}
                    >
                      {discBusy ? 'Applying…' : 'Apply discount'}
                    </button>
                    {f._raw?.discount_active && (
                      <button
                        type="button"
                        className="adm-btn ghost"
                        style={{ color: 'var(--red)' }}
                        disabled={discBusy}
                        onClick={async () => {
                          setDiscBusy(true);
                          try {
                            const res = await adminProductsApi.removeDiscount(f.id);
                            const updated = res?.data ?? res;
                            setDiscValue('');
                            setDiscStartsAt('');
                            setDiscEndsAt('');
                            setF(curr => ({
                              ...curr,
                              price: Number(updated?.price ?? curr.price),
                              _raw: updated ? { ...curr._raw, ...updated, sources: updated.sources ?? curr._raw?.sources } : curr._raw,
                            }));
                            invalidateStorefrontCatalogCache();
                            onMutated?.();
                            addToast('Discount removed');
                          } catch (err) {
                            addToast(messageFrom(err));
                          } finally {
                            setDiscBusy(false);
                          }
                        }}
                      >
                        Remove discount
                      </button>
                    )}
                  </div>
                </section>
              )}

              {sourced && (
                <section className="adm-supplier-card">
                  <div className="adm-supplier-head">
                    <div>
                      <b>Supplier pricing</b>
                      <small className="muted" style={{ display: 'block', marginTop: 2 }}>{source.supplier} · {source.external_product_id}</small>
                    </div>
                    <span className={'adm-pill ' + (pricingApproved ? 'ok' : source.pricing_status === 'blocked' ? 'bad' : 'warn')}>{String(source.pricing_status || 'pending').replaceAll('_', ' ')}</span>
                  </div>

                  <div className="adm-field-row">
                    <label className="adm-field"><span>Supplier price</span><input type="number" min="0" step="0.01" value={pricingInputs.supplier_price} onChange={e => setPricingInputs(current => ({ ...current, supplier_price: e.target.value }))} /></label>
                    <label className="adm-field"><span>Currency</span><input maxLength="3" value={pricingInputs.supplier_currency} onChange={e => setPricingInputs(current => ({ ...current, supplier_currency: e.target.value.toUpperCase() }))} /></label>
                  </div>

                  <div className="adm-field-row-3">
                    <label className="adm-field"><span>Weight (lb)</span><input type="number" min="0" step="0.01" value={pricingInputs.weight_lb} onChange={e => setPricingInputs(current => ({ ...current, weight_lb: e.target.value }))} /></label>
                    <label className="adm-field"><span>Delivery min (days)</span><input type="number" min="1" value={pricingInputs.delivery_days_min} onChange={e => setPricingInputs(current => ({ ...current, delivery_days_min: e.target.value }))} /></label>
                    <label className="adm-field"><span>Delivery max (days)</span><input type="number" min="1" value={pricingInputs.delivery_days_max} onChange={e => setPricingInputs(current => ({ ...current, delivery_days_max: e.target.value }))} /></label>
                  </div>

                  {quote?.missing_inputs?.length > 0 && <div className="adm-note"><Icon name="info" size={14} /> Missing: {quote.missing_inputs.join(', ').replaceAll('_', ' ')}</div>}
                  {quote?.blocked_reasons?.length > 0 && <div className="adm-note" style={{ color: 'var(--red)' }}><Icon name="info" size={14} /> Blocked: {quote.blocked_reasons.join(', ').replaceAll('_', ' ')}</div>}

                  {quote?.proposed_price_ngn && (
                    <div className="adm-supplier-quote">
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="muted" style={{ fontSize: 13 }}>Proposed selling price</span>
                        <b style={{ fontSize: 17, fontFamily: 'var(--font-display)' }}>{naira(Number(quote.proposed_price_ngn))}</b>
                      </div>
                      {quote.cost_breakdown && (
                        <div className="adm-supplier-metrics">
                          <div><span>Landed cost</span><b>{naira(Number(quote.cost_breakdown.total_cost_ngn || 0))}</b></div>
                          <div><span>Profit</span><b>{naira(Number(quote.cost_breakdown.profit_ngn || 0))}</b></div>
                          <div><span>FX rate</span><b>{Number(quote.cost_breakdown.supplier_effective_rate_ngn || 0).toLocaleString('en-NG')} ₦/{source.supplier_currency}</b></div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="adm-btn ghost" onClick={recalculate} disabled={pricingBusy}>{pricingBusy ? 'Working…' : 'Recalculate'}</button>
                    {source.pricing_status === 'pending_approval' && <button type="button" className="adm-btn primary" onClick={approve} disabled={pricingBusy}>Approve price</button>}
                  </div>
                </section>
              )}

              <label className="adm-field"><span>Description</span><textarea rows={3} value={f.desc || (f._raw && f._raw.desc) || ''} onChange={e => set('desc', e.target.value)} placeholder="Short product description" /></label>
              <VariantsEditor variants={f.variants} onChange={v => set('variants', v)} />
              {combos.length > 0 && (
                <div className="adm-field">
                  <span>Variant stock &amp; SKU</span>
                  {combos.map(c => {
                    const rec = f.variantStock?.[c.key] || {};
                    return (
                      <div key={c.key} className="adm-field-row-3" style={{ alignItems: 'flex-end' }}>
                        <div style={{ paddingBottom: 10, minWidth: 0 }}><small className="muted">{Object.entries(c.attributes).map(([k, v]) => `${k}: ${v}`).join(' · ')}</small></div>
                        <label className="adm-field"><span>SKU</span><input value={rec.sku ?? ''} placeholder={defaultSku(f.name, c.attributes)} onChange={e => setComboField(c.key, 'sku', e.target.value)} /></label>
                        <label className="adm-field"><span>Stock</span><input type="number" min="0" value={rec.stock ?? ''} onChange={e => setComboField(c.key, 'stock', e.target.value)} /></label>
                      </div>
                    );
                  })}
                  <p className="muted" style={{ fontSize: 11.5, marginTop: -4 }}>Each variation combination needs its own stock count. Leave SKU blank to use the auto-generated placeholder shown.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="adm-drawer-f">
          <button className="adm-btn ghost" onClick={onClose}>Cancel</button>
          <button className="adm-btn primary" disabled={!f.name.trim() || !f.brand.trim()} onClick={() => onSave(f)}>{f._new ? 'Create product' : 'Save changes'}</button>
        </div>
      </div>
    </>
  );
}

/* ---------- ORDERS ---------- */
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Deliberately not toLocaleDateString — its output depends on the runtime's
// ICU data, which can differ between the Node server (SSR) and the browser
// (hydration), producing a React hydration mismatch (confirmed live, see
// the same fix in components/pages/Account.jsx).
function fmtOrderDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}

function useOrderDetail(order) {
  const [detail, setDetail] = useState(order?.raw || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminOrdersApi.get(order.id)
      .then((res) => {
        if (!cancelled) setDetail(res?.data || res || order.raw);
      })
      .catch(() => {
        if (!cancelled) setDetail(order.raw);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [order]);

  return { detail: detail || order?.raw || {}, loading };
}

function InvoiceModal({ order, onClose }) {
  const addToast = useAdminToast();
  const [paperWidth, setPaperWidth] = useState('80mm');
  const { detail: receiptOrder, loading } = useOrderDetail(order);
  const previewHtml = buildThermalReceiptHtml(receiptOrder, paperWidth);

  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <div className="adm-modal inv-modal" role="dialog" aria-label="Thermal Receipt">
        <div className="adm-drawer-h">
          <h3>Thermal Receipt · #{order.id}</h3>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">
          <div className="row between" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 12.5 }}>POS thermal roll format (monospace, monochrome, 0mm margin)</span>
            <div className="row" style={{ gap: 6 }}>
              {['80mm', '58mm'].map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`adm-chip${paperWidth === w ? ' on' : ''}`}
                  onClick={() => setPaperWidth(w)}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>Loading order items &amp; delivery details…</p>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--surface-2)', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
              <iframe
                title={`receipt-${order.id}`}
                srcDoc={previewHtml}
                style={{
                  width: paperWidth === '58mm' ? 230 : 320,
                  height: 440,
                  border: '1px solid #d4d4d8',
                  background: '#ffffff',
                }}
              />
            </div>
          )}

          <div className="adm-drawer-foot">
            <button className="adm-btn ghost" onClick={onClose}>Close</button>
            <button
              className="adm-btn ghost"
              disabled={loading}
              onClick={() => {
                downloadThermalReceipt(receiptOrder, paperWidth);
                addToast(`Receipt #${order.id} (${paperWidth}) downloaded`);
              }}
            >
              <Icon name="download" size={15} /> Download ({paperWidth})
            </button>
            <button
              className="adm-btn primary"
              disabled={loading}
              onClick={() => printThermalReceipt(receiptOrder, paperWidth)}
            >
              Print Thermal Receipt
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ShippingLabelModal({ order, onClose }) {
  const addToast = useAdminToast();
  const { detail: labelOrder, loading } = useOrderDetail(order);
  const labelHtml = buildShippingLabelHtml(labelOrder);

  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <div className="adm-modal inv-modal" role="dialog" aria-label="Shipping Label">
        <div className="adm-drawer-h">
          <h3>Shipping Label · #{order.id}</h3>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">
          <div className="row between" style={{ marginBottom: 12, gap: 8 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>4×6″ (100×150mm) thermal shipping label</span>
          </div>

          {loading ? (
            <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>Loading shipping address &amp; tracking…</p>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', background: 'var(--surface-2)', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
              <iframe
                title={`shipping-label-${order.id}`}
                srcDoc={labelHtml}
                style={{
                  width: 380,
                  height: 520,
                  border: '1px solid #d4d4d8',
                  background: '#ffffff',
                }}
              />
            </div>
          )}

          <div className="adm-drawer-foot">
            <button className="adm-btn ghost" onClick={onClose}>Close</button>
            <button
              className="adm-btn ghost"
              disabled={loading}
              onClick={() => {
                downloadShippingLabel(labelOrder);
                addToast(`Shipping label #${order.id} downloaded`);
              }}
            >
              <Icon name="download" size={15} /> Download Label
            </button>
            <button
              className="adm-btn primary"
              disabled={loading}
              onClick={() => printShippingLabel(labelOrder)}
            >
              Print Shipping Label
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function OrderDrawer({ title, sub, saving, canSave, onClose, onSave, saveLabel, children }) {
  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="adm-drawer-h">
          <div><h3>{title}</h3>{sub && <small className="muted">{sub}</small>}</div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">{children}</div>
        <div className="adm-drawer-f">
          <button className="adm-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="adm-btn primary" onClick={onSave} disabled={saving || !canSave}>{saving ? 'Saving…' : saveLabel}</button>
        </div>
      </aside>
    </>
  );
}

// The generic status-update endpoint's own enum only covers
// processing/in_transit/delivered — "shipped" is set via the dedicated
// /ship action below instead (it needs courier/tracking_number, not just
// a status string).
const STATUS_UPDATE_OPTIONS = ['processing', 'in_transit', 'delivered'];

export function AdminOrders() {
  const highlight = useSearchParams().get('highlight');
  useHighlight(highlight);
  const toast = useAdminToast();
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('All');
  const [shippingLabel, setShippingLabel] = useState(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [invoice, setInvoice] = useState(null);
  const [shipDraft, setShipDraft] = useState(null);
  const [statusDraft, setStatusDraft] = useState(null);
  const [refundDraft, setRefundDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const res = await adminOrdersApi.list({ per_page: 100 });
      const list = Array.isArray(res) ? res : (res?.data ?? res?.items ?? res?.orders ?? []);
      setOrders((Array.isArray(list) ? list : []).map(normalizeAdminOrder));
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  // Initial network hydration is intentionally triggered when the page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadOrders(); }, [loadOrders]);

  const tabs = ['All', ...ORDER_STATUSES];
  const O = orders;
  let list = O.filter(o => (status === 'All' || o.status === status) && (!q || String(o.id).toLowerCase().includes(q.toLowerCase()) || (o.customer || '').toLowerCase().includes(q.toLowerCase())));
  list = [...list].sort((a, b) => {
    if (sort === 'total-high') return b.total - a.total;
    if (sort === 'total-low') return a.total - b.total;
    if (sort === 'items') return b.itemCount - a.itemCount;
    if (sort === 'oldest') return new Date(a.date) - new Date(b.date);
    return new Date(b.date) - new Date(a.date);
  });
  const { shown: oShown, pagerProps: oPager } = usePager(list, q + status + sort);

  const submitStatus = async () => {
    if (!statusDraft?.status || !statusDraft.note.trim()) return;
    setSaving(true);
    try {
      await adminOrdersApi.updateStatus(statusDraft.order.id, { status: statusDraft.status, note: statusDraft.note.trim() });
      toast('Order status updated');
      setStatusDraft(null);
      await loadOrders();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  const submitShip = async () => {
    if (!shipDraft?.courier.trim() || !shipDraft.tracking_number.trim()) return;
    setSaving(true);
    try {
      await adminOrdersApi.ship(shipDraft.order.id, { courier: shipDraft.courier.trim(), tracking_number: shipDraft.tracking_number.trim() });
      toast('Order marked as shipped');
      setShipDraft(null);
      await loadOrders();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  const submitRefund = async () => {
    if (!refundDraft?.amount || !refundDraft.reason.trim()) return;
    setSaving(true);
    try {
      await adminOrdersApi.refund(refundDraft.order.id, { amount: Number(refundDraft.amount), method: refundDraft.method, reason: refundDraft.reason.trim() });
      toast('Refund submitted');
      setRefundDraft(null);
      await loadOrders();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  return (
    <>
      <AdmHead title="Orders" sub={`${O.length} total orders`}>
        <button className="adm-btn ghost"><Icon name="download" size={15} /> Export CSV</button>
      </AdmHead>
      <div className="adm-filters">
        <div className="adm-mini-search"><Icon name="search" size={16} className="muted" /><input placeholder="Search order # or customer…" value={q} onChange={e => setQ(e.target.value)} /></div>
        {tabs.map(t => <button key={t} className={'adm-chip' + (status === t ? ' on' : '')} onClick={() => setStatus(t)}>{t === 'All' ? 'All' : (ORDER_STATUS_LABEL[t] || t)}</button>)}
        <div className="adm-filters-r">
          <AdmSelect compact icon="sort" title="Sort by" value={sort} options={[{ value: 'recent', label: 'Most recent' }, { value: 'oldest', label: 'Oldest first' }, { value: 'total-high', label: 'Total: High → Low' }, { value: 'total-low', label: 'Total: Low → High' }, { value: 'items', label: 'Most items' }]} onChange={setSort} />
        </div>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        {!loaded ? <div className="adm-soon"><p>Loading orders…</p></div> : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
              <tbody>{oShown.map(o => (
                <tr key={o.id} data-hlkey={o.id + ' ' + (o.customer || '')}>
                  <td><b style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5 }}>#{o.id}</b></td>
                  <td>{o.customer}</td><td className="muted">{fmtOrderDate(o.date)}</td><td>{o.itemCount}</td><td><b>{naira(o.total)}</b></td>
                  <td><span className={'adm-pill ' + (ORDER_STATUS_CLS[o.status] || 'muted')}>{ORDER_STATUS_LABEL[o.status] || o.status}</span></td>
                  <td><div className="adm-rowact">
                    <button title="Thermal receipt / invoice" onClick={() => setInvoice(o)}><Icon name="eye" size={15} /></button>
                    <button title="Shipping label" onClick={() => setShippingLabel(o)}><Icon name="tag" size={15} /></button>
                    <button title="Update status" onClick={() => setStatusDraft({ order: o, status: STATUS_UPDATE_OPTIONS[0], note: '' })}><Icon name="edit" size={15} /></button>
                    <button title="Mark as shipped" onClick={() => setShipDraft({ order: o, courier: '', tracking_number: '' })}><Icon name="truck" size={15} /></button>
                    <button title="Refund" onClick={() => setRefundDraft({ order: o, amount: o.total, method: 'original_payment', reason: '' })}><Icon name="dollar" size={15} /></button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
            {list.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No orders match your filters.</div>}
            <Pager {...oPager} />
          </div>
        )}
      </div>
      {invoice && <InvoiceModal order={invoice} onClose={() => setInvoice(null)} />}
      {shippingLabel && <ShippingLabelModal order={shippingLabel} onClose={() => setShippingLabel(null)} />}

      {statusDraft && (
        <OrderDrawer title={`Update status · #${statusDraft.order.id}`} saving={saving} canSave={!!statusDraft.note.trim()} onClose={() => setStatusDraft(null)} onSave={submitStatus} saveLabel="Update status">
          <label className="adm-field"><span>New status</span>
            <select value={statusDraft.status} onChange={e => setStatusDraft(c => ({ ...c, status: e.target.value }))}>
              {STATUS_UPDATE_OPTIONS.map(s => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="adm-field"><span>Note</span><textarea rows="3" value={statusDraft.note} onChange={e => setStatusDraft(c => ({ ...c, note: e.target.value }))} placeholder="Why this status changed (required)" autoFocus /></label>
        </OrderDrawer>
      )}

      {shipDraft && (
        <OrderDrawer title={`Mark as shipped · #${shipDraft.order.id}`} saving={saving} canSave={!!(shipDraft.courier.trim() && shipDraft.tracking_number.trim())} onClose={() => setShipDraft(null)} onSave={submitShip} saveLabel="Mark as shipped">
          <label className="adm-field"><span>Courier</span><input value={shipDraft.courier} onChange={e => setShipDraft(c => ({ ...c, courier: e.target.value }))} placeholder="e.g. GIG Logistics" autoFocus /></label>
          <label className="adm-field"><span>Tracking number</span><input value={shipDraft.tracking_number} onChange={e => setShipDraft(c => ({ ...c, tracking_number: e.target.value }))} /></label>
        </OrderDrawer>
      )}

      {refundDraft && (
        <OrderDrawer title={`Refund · #${refundDraft.order.id}`} saving={saving} canSave={!!(Number(refundDraft.amount) > 0 && refundDraft.reason.trim())} onClose={() => setRefundDraft(null)} onSave={submitRefund} saveLabel="Submit refund">
          <div className="adm-field-row">
            <label className="adm-field"><span>Amount (₦)</span><input type="number" min="0" value={refundDraft.amount} onChange={e => setRefundDraft(c => ({ ...c, amount: e.target.value }))} autoFocus /></label>
            <label className="adm-field"><span>Refund to</span>
              <select value={refundDraft.method} onChange={e => setRefundDraft(c => ({ ...c, method: e.target.value }))}>
                <option value="original_payment">Original payment method</option>
                <option value="wallet">Wallet credit</option>
              </select>
            </label>
          </div>
          <label className="adm-field"><span>Reason</span><textarea rows="3" value={refundDraft.reason} onChange={e => setRefundDraft(c => ({ ...c, reason: e.target.value }))} placeholder="Why this order is being refunded (required)" /></label>
        </OrderDrawer>
      )}
    </>
  );
}

/* ---------- COUPONS (connected to /admin/promotions) ---------- */
function promoTypeLabel(t) {
  if (t === 'fixed') return 'Fixed amount';
  if (t === 'free_shipping') return 'Free shipping';
  return 'Percentage';
}
function promoTypeSlug(label) {
  if (label === 'Fixed amount' || label === 'fixed') return 'fixed';
  if (label === 'Free shipping' || label === 'free_shipping') return 'free_shipping';
  return 'percentage';
}

export function AdminCoupons() {
  const { user } = useStore();
  const canManage = hasPermission(user, 'promotions.manage');
  const addToast = useAdminToast();
  const [coupons, setCoupons] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await adminPromotionsApi.list({ per_page: 100 });
      const list = Array.isArray(res) ? res : (res?.items || res?.data || []);
      setCoupons(list);
    } catch (err) {
      addToast(messageFrom(err));
    } finally {
      setLoaded(true);
    }
  }, [addToast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtered = coupons.filter(c =>
    !q.trim() || `${c.code || ''} ${c.name || ''}`.toLowerCase().includes(q.trim().toLowerCase())
  );
  const { shown: cpShown, pagerProps: cpPager } = usePager(filtered, q + coupons.length);

  const save = async (d) => {
    try {
      const type = promoTypeSlug(d.type);
      const payload = {
        code: d.code.trim().toUpperCase(),
        name: d.name.trim() || d.code.trim().toUpperCase(),
        type,
        value: type === 'free_shipping' ? 0 : Number(d.value || 0),
        minimum_spend: d.minimum_spend ? Number(d.minimum_spend) : 0,
        active: d.active !== false,
        ends_at: d.expires || null,
      };
      if (d.id) await adminPromotionsApi.update(d.id, payload);
      else await adminPromotionsApi.create(payload);
      addToast(d.id ? 'Promotion updated' : 'Promotion created');
      setEdit(null);
      await load();
    } catch (err) {
      addToast(messageFrom(err));
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Deactivate promotion "${c.code}"?`)) return;
    try {
      await adminPromotionsApi.remove(c.id);
      addToast('Promotion ' + c.code + ' deactivated');
      await load();
    } catch (err) {
      addToast(messageFrom(err));
    }
  };

  return (
    <>
      <AdmHead title="Coupons & Promotions" sub="Discounts, flash sales & campaigns">
        <button className="adm-btn ghost" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
        {canManage && (
          <button className="adm-btn primary" onClick={() => setEdit({ _new: true, code: '', name: '', type: 'Percentage', value: '', minimum_spend: '', active: true, expires: '' })}><Icon name="plus" size={15} /> Create coupon</button>
        )}
      </AdmHead>
      <div className="adm-filters">
        <div className="adm-mini-search"><Icon name="search" size={16} className="muted" /><input placeholder="Search promo code or name…" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Value</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {!loaded ? (
              <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>Loading promotions…</td></tr>
            ) : cpShown.length === 0 ? (
              <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>No promotions found.</td></tr>
            ) : cpShown.map((c) => (
              <tr key={c.id || c.code}>
                <td><b style={{ fontFamily: 'var(--font-display)', letterSpacing: '.03em' }}>{c.code}</b></td>
                <td className="muted">{c.name || '—'}</td>
                <td>{promoTypeLabel(c.type)}</td>
                <td>{c.type === 'free_shipping' ? 'Free shipping' : c.type === 'fixed' ? naira(Number(c.value || 0)) : `${Number(c.value || 0)}%`}</td>
                <td><span className={'adm-pill ' + (c.active ? 'ok' : 'muted')}>{c.active ? 'Active' : 'Inactive'}</span></td>
                <td>{canManage && (
                  <div className="adm-rowact">
                    <button title="Redemptions" onClick={async () => {
                      try {
                        const res = await adminPromotionsApi.redemptions(c.id);
                        const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
                        addToast(`${c.code}: ${list.length} redemption(s) recorded`);
                      } catch (err) {
                        addToast(messageFrom(err));
                      }
                    }}><Icon name="eye" size={15} /></button>
                    <button title="Edit" onClick={() => setEdit({ id: c.id, code: c.code, name: c.name || '', type: promoTypeLabel(c.type), value: c.value ?? '', minimum_spend: c.minimum_spend ?? '', active: c.active !== false, expires: c.ends_at ? String(c.ends_at).slice(0, 10) : '' })}><Icon name="edit" size={15} /></button>
                    <button className="del" title="Deactivate" onClick={() => remove(c)}><Icon name="trash" size={15} /></button>
                  </div>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table><Pager {...cpPager} /></div>
      </div>
      {edit && <CouponModal draft={edit} onClose={() => setEdit(null)} onSave={save} />}
    </>
  );
}

function CouponModal({ draft, onClose, onSave }) {
  const [f, setF] = useState(draft);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <div className="adm-modal" role="dialog" aria-label="Coupon">
        <div className="adm-drawer-h"><h3>{f._new ? 'Create coupon' : 'Edit coupon'}</h3><button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button></div>
        <div className="adm-drawer-body">
          <label className="adm-field"><span>Coupon code</span><input value={f.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="e.g. WELCOME15" /></label>
          <label className="adm-field"><span>Name / Description</span><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="15% off first order" /></label>
          <div className="adm-field-row">
            <label className="adm-field"><span>Type</span><AdmSelect value={f.type} options={['Percentage', 'Fixed amount', 'Free shipping']} onChange={v => set('type', v)} /></label>
            <label className="adm-field"><span>{f.type === 'Percentage' ? 'Percent off' : f.type === 'Fixed amount' ? 'Amount (₦)' : 'Value'}</span><input type="number" min="0" value={f.value} onChange={e => set('value', e.target.value)} placeholder={f.type === 'Percentage' ? '15' : '5000'} disabled={f.type === 'Free shipping'} /></label>
          </div>
          <div className="adm-field-row">
            <label className="adm-field"><span>Minimum spend (₦)</span><input type="number" min="0" value={f.minimum_spend} onChange={e => set('minimum_spend', e.target.value)} placeholder="0" /></label>
            <label className="adm-field"><span>Status</span><AdmSelect value={f.active ? 'Active' : 'Inactive'} options={['Active', 'Inactive']} onChange={v => set('active', v === 'Active')} /></label>
          </div>
          <label className="adm-field"><span>Expires</span><AdmDate value={f.expires} onChange={v => set('expires', v)} placeholder="Pick a date" /></label>
        </div>
        <div className="adm-drawer-f"><button className="adm-btn ghost" onClick={onClose}>Cancel</button><button className="adm-btn primary" disabled={!f.code.trim()} onClick={() => onSave(f)}>{f._new ? 'Create coupon' : 'Save changes'}</button></div>
      </div>
    </>
  );
}

/* ---------- INVENTORY ---------- */
export function AdminInventory() {
  const addToast = useAdminToast();
  useStore();
  const highlight = useSearchParams().get('highlight');
  useHighlight(highlight);
  const [q, setQ] = useState('');
  const [stat, setStat] = useState('All');
  const [sort, setSort] = useState('stock-low');
  const [invItems, setInvItems] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [adjustments, setAdjustments] = useState([]);

  const loadAdjustments = async () => {
    try {
      const res = await adminInventoryApi.adjustments({ per_page: 50 });
      setAdjustments(Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []);
      setHistoryOpen(true);
    } catch (err) {
      addToast(messageFrom(err));
    }
  };

  const setThreshold = async (p) => {
    const raw = window.prompt(`Low-stock threshold for ${p.name}:`, String(p.threshold ?? 6));
    if (raw == null) return;
    const threshold = parseInt(raw, 10);
    if (Number.isNaN(threshold) || threshold < 0) { addToast('Enter a valid non-negative integer'); return; }
    try {
      await adminInventoryApi.updateThreshold(p.id, { low_stock_threshold: threshold });
      addToast(`Low-stock threshold updated to ${threshold}`);
      await loadInventory();
    } catch (err) {
      addToast(messageFrom(err));
    }
  };

  const loadInventory = useCallback(async () => {
    try {
      const res = await adminInventoryApi.list({ per_page: 200 });
      const list = res?.items ?? res?.data?.items ?? res?.data ?? [];
      if (Array.isArray(list) && list.length > 0) {
        setInvItems(list.map((it) => ({
          id: it.product_id ?? it.id,
          name: it.name || it.product_name || `Product #${it.product_id ?? it.id}`,
          slug: it.sku || it.slug || String(it.product_id ?? it.id),
          stock: Number(it.stock ?? it.quantity ?? it.available_stock ?? 0),
          threshold: Number(it.low_stock_threshold ?? 6),
        })));
      }
    } catch {
      // Fallback to store PRODUCTS if /admin/inventory fails
    }
  }, []);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  const sourceList = invItems || PRODUCTS;
  const stk = (p) => p.stock ?? 0;
  const statusOf = (p) => {
    const s = stk(p);
    const th = p.threshold ?? 6;
    return s === 0 ? 'Out of stock' : s < th ? 'Low stock' : 'In stock';
  };
  let low = sourceList.filter(p => (!q || p.name.toLowerCase().includes(q.toLowerCase()) || String(p.slug || '').toLowerCase().includes(q.toLowerCase())) && (stat === 'All' || statusOf(p) === stat));
  low = [...low].sort((a, b) => {
    if (sort === 'stock-high') return stk(b) - stk(a);
    if (sort === 'name-az') return a.name.localeCompare(b.name);
    return stk(a) - stk(b);
  });
  const { shown: invShown, pagerProps: invPager } = usePager(low, q + stat + sort);

  const adjustStock = async (p) => {
    const raw = window.prompt(`Adjust stock for ${p.name} (enter positive or negative integer):`, '10');
    if (raw == null) return;
    const delta = parseInt(raw, 10);
    if (!delta || Number.isNaN(delta)) { addToast('Enter a valid non-zero number'); return; }
    try {
      await adminInventoryApi.adjustProduct(p.id, { quantity_delta: delta, reason: 'Admin inventory adjustment' });
      addToast(`Stock adjusted by ${delta > 0 ? '+' : ''}${delta}`);
      await loadInventory();
    } catch (err) {
      addToast(messageFrom(err));
    }
  };

  return (
    <>
      <AdmHead title="Inventory" sub="Stock levels & alerts">
        <button className="adm-btn ghost" onClick={loadAdjustments}><Icon name="clock" size={14} /> Adjustment history</button>
        <button className="adm-btn ghost" onClick={loadInventory}><Icon name="refresh" size={14} /> Refresh</button>
      </AdmHead>
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <Kpi ic="package" tint="#0438B6" label="SKUs tracked" val={sourceList.length} delta="" up />
        <Kpi ic="info" tint="#F5A623" label="Low stock" val={sourceList.filter(p => statusOf(p) === 'Low stock').length} delta="" up />
        <Kpi ic="close" tint="#E5484D" label="Out of stock" val={sourceList.filter(p => statusOf(p) === 'Out of stock').length} delta="" up />
      </div>
      <div className="adm-filters">
        <div className="adm-mini-search"><Icon name="search" size={16} className="muted" /><input placeholder="Search products or SKU…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="adm-filters-r">
          <AdmSelect compact icon="filter" title="Filter by status" value={stat} options={['All', 'In stock', 'Low stock', 'Out of stock']} onChange={setStat} />
          <AdmSelect compact icon="sort" title="Sort by" value={sort} options={[{ value: 'stock-low', label: 'Stock: Low → High' }, { value: 'stock-high', label: 'Stock: High → Low' }, { value: 'name-az', label: 'Name: A → Z' }]} onChange={setSort} />
        </div>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="panel-h" style={{ padding: '18px 20px 0' }}><h3>Stock levels</h3></div>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Product</th><th>SKU</th><th>In stock</th><th>Status</th><th></th></tr></thead>
          <tbody>{invShown.map((p) => { const s = stk(p); const st = statusOf(p); return (
            <tr key={p.id} data-hlkey={p.name}><td><div className="adm-prod"><span className="adm-prod-thumb"><Thumb product={p} src={REAL_IMG[p.id]} /></span><div><b>{p.name.split(',')[0]}</b></div></div></td>
              <td className="muted">{String(p.slug || '').slice(0, 12).toUpperCase()}</td><td>{s}</td>
              <td><span className={'adm-pill ' + (s === 0 ? 'bad' : st === 'Low stock' ? 'warn' : 'ok')}>{st}</span></td>
              <td><div className="adm-rowact">
                <button title="Set low-stock threshold" onClick={() => setThreshold(p)}><Icon name="edit" size={15} /></button>
                <button title="Adjust stock" onClick={() => adjustStock(p)}><Icon name="plus" size={15} /></button>
              </div></td></tr>
          ); })}</tbody>
        </table>{low.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No products match your filters.</div>}<Pager {...invPager} /></div>
      </div>
      {historyOpen && (
        <>
          <div className="adm-drawer-scrim" onClick={() => setHistoryOpen(false)} />
          <div className="adm-modal" role="dialog" aria-label="Inventory adjustment history">
            <div className="adm-drawer-h"><h3>Inventory adjustment history</h3><button className="adm-icon-btn" onClick={() => setHistoryOpen(false)} aria-label="Close"><Icon name="close" size={20} /></button></div>
            <div className="adm-drawer-body" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {adjustments.length === 0 ? <p className="muted">No adjustments recorded yet.</p> : (
                <div className="adm-list">
                  {adjustments.map((a, idx) => (
                    <div className="adm-li" key={a.id || idx}>
                      <div className="adm-li-main">
                        <b>{a.product?.name || `Product #${a.product_id}`}</b>
                        <small className="muted">{a.reason || 'Adjustment'} · {a.created_at ? String(a.created_at).slice(0, 10) : ''}</small>
                      </div>
                      <span className={'adm-pill ' + (Number(a.quantity_delta) >= 0 ? 'ok' : 'bad')}>{Number(a.quantity_delta) >= 0 ? `+${a.quantity_delta}` : a.quantity_delta}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="adm-drawer-f"><button className="adm-btn ghost" onClick={() => setHistoryOpen(false)}>Close</button></div>
          </div>
        </>
      )}
    </>
  );
}
