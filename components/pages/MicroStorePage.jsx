'use client';
/* LIMITRA, MicroStore storefront — a single MicroStore Partner's shop page.
   Wired to the real backend: microstoresApi.get(slug) for the store profile,
   microstoresApi.products(slug) for its curated catalog. Curated items only
   carry a product_id (+ curator note/featured flag) — each is resolved
   against the already-loaded global PRODUCTS catalog (byId) to get the full
   normalized shape ProductCard/ListCard expect (price, rating, badges, etc.),
   same as every other product grid in the app, instead of a cut-down demo
   shape. Follow has no backend yet (no follow endpoint for MicroStores) so
   it stays an honest placeholder. There's no in-app messaging endpoint
   either, so "Chat with Store" opens the owner's WhatsApp/email instead —
   whichever contact field the store happens to expose (undocumented,
   field name unconfirmed); falls back to the old placeholder if neither
   is present. */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { useStore } from '@/components/store/StoreProvider';
import { Breadcrumbs, EmptyState, ProductCard } from '@/components/ui/Shared';
import { Dropdown } from '@/components/forms/Shared';
import { FilterPanel, ListCard, pagerList, priceSort } from '@/components/pages/ShopPage';
import { microstoresApi } from '@/lib/api/endpoints';
import { byId } from '@/lib/data';

const SORTS = [['relevance', 'Most relevant'], ['low', 'Price: low to high'], ['high', 'Price: high to low'], ['rating', 'Top rated'], ['new', 'Newest']];
const PER_PAGE = 10;

const EMPTY_FILTERS = { maxPrice: null, brands: [], minRating: 0, onSale: false, inStock: false };

// Nigerian local numbers (leading 0) need the country code for a wa.me link;
// anything already starting with a country code is left alone.
const toWaNumber = (raw) => {
  const d = String(raw).replace(/[^\d]/g, '');
  return d.startsWith('0') ? '234' + d.slice(1) : d;
};

export function MicroStorePage({ slug }) {
  const { go, toast } = useStore();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    setNotFound(false);
    Promise.all([
      microstoresApi.get(slug),
      microstoresApi.products(slug, { per_page: 100 }).catch(() => null),
    ]).then(([storeRes, productsRes]) => {
      if (!active) return;
      const s = storeRes?.microstore || storeRes;
      if (!s) { setNotFound(true); setLoading(false); return; }
      const curated = Array.isArray(productsRes) ? productsRes
        : Array.isArray(productsRes?.items) ? productsRes.items
        : Array.isArray(productsRes?.data) ? productsRes.data
        : [];
      setStore({ ...s, _curated: curated });
      setLoading(false);
    }).catch(() => {
      if (active) { setNotFound(true); setLoading(false); }
    });
    microstoresApi.trackClick(slug, { source: 'storefront' }).catch(() => {});
    return () => { active = false; };
  }, [slug]);

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [f, setF] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState('relevance');
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(false);

  // Resolve each curated item (product_id + curator_note/is_featured) against
  // the already-loaded global catalog to get a full, normalized product —
  // falls back to the API's own embedded `.product` object if a curated id
  // isn't in the currently-loaded catalog page.
  const products = useMemo(() => {
    const curated = store?._curated || [];
    return curated
      .map((item) => {
        const pid = item.product_id ?? item.id ?? item.product?.id;
        const full = byId(pid);
        if (full) return full;
        const p = item.product;
        if (!p) return null;
        return {
          id: p.id ?? pid, name: p.name || `Product #${pid}`, brand: p.brand || '',
          price: Number(p.price || 0), was: p.was ? Number(p.was) : undefined,
          off: Number(p.off || 0), rating: Number(p.rating || 0), reviews: Number(p.reviews || 0),
          badges: p.badges || [], category: p.category, slug: p.slug, stock: p.stock ?? 1,
        };
      })
      .filter(Boolean);
  }, [store]);

  const cats = useMemo(() => ['all', ...new Set(products.map((p) => p.category).filter(Boolean))], [products]);
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(), [products]);
  const priceCap = useMemo(() => Math.max(100000, Math.ceil(Math.max(...products.map((p) => p.price), 0) / 100000) * 100000), [products]);

  const filtered = useMemo(() => {
    let r = products.filter((p) =>
      (cat === 'all' || p.category === cat) &&
      (!q || p.name.toLowerCase().includes(q.toLowerCase())) &&
      p.price <= (f.maxPrice ?? Infinity) &&
      (f.brands.length === 0 || f.brands.includes(p.brand)) &&
      p.rating >= f.minRating &&
      (!f.onSale || p.off > 0) &&
      (!f.inStock || p.stock > 0)
    );
    r = [...r].sort((a, b) => priceSort(a, b, sort));
    return r;
  }, [products, cat, q, f, sort]);

  useEffect(() => setPage(1), [cat, q, f, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const activeCount = f.brands.length + (f.onSale ? 1 : 0) + (f.inStock ? 1 : 0) + (f.minRating ? 1 : 0) + (f.maxPrice != null ? 1 : 0);
  const clearAll = () => setF(EMPTY_FILTERS);

  if (loading) {
    return <div className="page page-fade"><div className="wrap" style={{ padding: '60px 0' }}><p className="muted">Loading store…</p></div></div>;
  }

  if (notFound || !store) {
    return (
      <div className="page page-fade"><div className="wrap">
        <EmptyState icon="store" title="Store not found" body="This MicroStore doesn’t exist or may have been removed." action="Explore MicroStores" onAction={() => go('microstoresExplore')} />
      </div></div>
    );
  }

  const name = store.name || 'MicroStore';
  const tagline = store.tagline || '';
  const description = store.bio || store.description || '';
  const rating = store.rating ?? store.average_rating;
  const reviewsCount = store.reviews_count ?? store.reviews;
  const location = store.city || store.location || store.address;
  const waNumber = store.whatsapp || store.whatsapp_number || store.phone || store.phone_number || store.contact_phone || store.owner?.whatsapp || store.owner?.phone;
  const contactEmail = store.contact_email || store.email || store.owner?.email;
  const chatHref = waNumber ? `https://wa.me/${toWaNumber(waNumber)}` : contactEmail ? `mailto:${contactEmail}` : null;

  return (
    <div className="page page-fade">
      <section className="sec" style={{ paddingTop: 8, paddingBottom: 0 }}>
        <div className="wrap">
          <div className="ms-store-banner">
            {store.banner_url && <div className="ms-store-banner-bgimg" style={{ backgroundImage: `url(${store.banner_url})` }} />}
            <div className="ms-store-banner-fade" />
            <span className="ms-store-banner-avatar">
              {store.logo_url ? <img src={store.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="store" size={28} />}
            </span>
            <div className="ms-store-banner-info">
              <b>{name}</b>
              {tagline && <span>{tagline}</span>}
              {description && <p>{description}</p>}
              <div className="ms-store-banner-meta">
                {rating != null && <span><Icon name="star" size={14} fill="#FFD166" /> {Number(rating).toFixed(1)}{reviewsCount != null ? ` (${reviewsCount} reviews)` : ''}</span>}
                {store.verified && <span><Icon name="shield" size={14} /> Verified Store</span>}
                {location && <span><Icon name="truck" size={14} /> Ships from {location}</span>}
              </div>
              <div className="ms-store-banner-cta">
                <button className="btn btn-primary" onClick={() => toast('Following stores isn’t available yet')}><Icon name="heart" size={16} /> Follow Store</button>
                {chatHref ? (
                  <a className="btn btn-ghost" href={chatHref} target="_blank" rel="noreferrer"><Icon name="chat" size={16} /> Chat with Store</a>
                ) : (
                  <button className="btn btn-ghost" onClick={() => toast('This store hasn’t added a contact method yet')}><Icon name="chat" size={16} /> Chat with Store</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap">
        <Breadcrumbs items={[{ label: 'Home', to: ['home'] }, { label: 'MicroStores', to: ['microstoresExplore'] }, { label: name }]} />
      </div>

      <section className="sec" style={{ paddingTop: 10 }}>
        <div className="wrap">
          <div className="shop-head">
            <div>
              <span className="eyebrow">Catalog</span>
              <h1 style={{ fontSize: 28 }}>Shop</h1>
              <p className="muted" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginTop: 4 }}>{filtered.length} products</p>
            </div>
            <div className="shop-tools">
              <button className="btn btn-outline mobile-filter" onClick={() => setDrawer(true)}>
                <Icon name="filter" size={17} /> Filters {activeCount > 0 && <span className="fcount">{activeCount}</span>}
              </button>
              <Dropdown value={sort} onChange={setSort} icon="sort" width={196} options={SORTS.map(([v, l]) => ({ value: v, label: l }))} />
              <div className="view-toggle">
                <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}><Icon name="grid" size={17} /></button>
                <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><Icon name="list" size={17} /></button>
              </div>
            </div>
          </div>

          <div className="shop-layout">
            <aside className="shop-side">
              <div className="ms-search">
                <Icon name="search" size={16} className="muted" />
                <input className="input" placeholder={'Search ' + name + '…'} value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="filter-block">
                <h5>Shop categories</h5>
                {cats.map((c) => (
                  <label key={c} className="check">
                    <input type="radio" name="storecat" checked={cat === c} onChange={() => setCat(c)} />
                    <span className="cbox round"><Icon name="check" size={12} stroke={3} /></span>{c === 'all' ? 'All products' : <span style={{ textTransform: 'capitalize' }}>{c}</span>}
                  </label>
                ))}
              </div>
              <div className="row between" style={{ margin: '18px 0 4px' }}>
                <h4 style={{ fontSize: 17 }}>Filters</h4>
                {activeCount > 0 && <button className="link-btn" onClick={clearAll}>Clear all</button>}
              </div>
              <FilterPanel f={f} setF={setF} brands={brands} priceCap={priceCap} />
            </aside>

            <div>
              {shown.length === 0 ? (
                <EmptyState icon="search" title={products.length === 0 ? 'No products curated yet' : 'No products match your filters'} body={products.length === 0 ? 'This MicroStore hasn’t added any products yet.' : 'Try a different search or widen your filters.'} action={(q || cat !== 'all' || activeCount > 0) ? 'Clear filters' : undefined} onAction={() => { setQ(''); setCat('all'); clearAll(); }} />
              ) : view === 'grid' ? (
                <div className="shop-grid">{shown.map((p) => <ProductCard key={p.id} product={p} />)}</div>
              ) : (
                <div className="list-grid">{shown.map((p) => <ListCard key={p.id} product={p} />)}</div>
              )}

              {pages > 1 && (
                <div className="pager">
                  <button className="pg" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><Icon name="chevleft" size={16} /></button>
                  {pagerList(page, pages).map((n, i) => (
                    n === '…'
                      ? <span key={'e' + i} className="pg-gap">…</span>
                      : <button key={n} className={'pg' + (page === n ? ' on' : '')} onClick={() => setPage(n)}>{n}</button>
                  ))}
                  <button className="pg" disabled={page === pages} onClick={() => setPage((p) => p + 1)}><Icon name="chevright" size={16} /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="ms-sell-banner">
            <span className="ms-sell-ic"><Icon name="store" size={22} /></span>
            <div><b>Want to sell on Limitra?</b><p>Start your own MicroStore, earn commissions and reach thousands of customers.</p></div>
            <button className="btn btn-accent" onClick={() => go('startMicrostore')}>Create your own MicroStore</button>
          </div>
        </div>
      </section>
    </div>
  );
}
