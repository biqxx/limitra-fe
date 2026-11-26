import { comboKey } from '@/lib/variants';

/* LIMITRA shared data helpers.
   CATEGORIES/SUBCATS/PRODUCTS are populated at runtime from the real backend
   (categoriesApi/productsApi, see lib/api/endpoints.js) by the catalog loader
   in components/store/StoreProvider.jsx. They start empty so every call site
   across the app already renders a correct "no data yet" state for the moment
   between first paint and that fetch resolving (and if it fails — the loader
   fails open, not closed).
   setCategories/setSubcats/setProducts REASSIGN these bindings (not mutate in
   place) — every module that does `import { PRODUCTS } from '@/lib/data'` still
   sees the update with no re-import needed, because ES module imports are live
   bindings that track reassignment of the exporting module's `let`. This used
   to mutate in place instead (`.length = 0; .push(...)`), which seemed
   equivalent but silently broke any `useMemo`/`useCallback` that listed the
   array itself as a dependency (e.g. ShopPage's `filtered` list): React compares
   dependencies by reference, and an in-place-mutated array never changes
   reference, so those memos stayed stuck on their first (empty) render forever
   — products existed in the array but no page would ever show them. */
const naira = n => '₦ ' + n.toLocaleString('en-NG');

let CATEGORIES = [];
let SUBCATS = {};
let PRODUCTS = [];

// a few products carry hand-picked real photos (see components/ui/Shared.jsx,
// which re-exports this); the catalog loader also fills in product.id -> first
// uploaded image for anything the real backend returns with `images`.
const REAL_IMG = {
  p1: '/assets/img/cat-03.jpg',
  p2: '/assets/img/cat-02.jpg',
  iphone17promax: '/assets/img/ip17-orange-front.webp',
};

const slugify = (s) => String(s ?? '').toLowerCase().replace(/[’'`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function setCategories(list) { CATEGORIES = list; }
function setSubcats(map) { SUBCATS = map; }
function setProducts(list) { PRODUCTS = list; }

// Products created in the admin panel get added to this shared array for
// instant feedback in the current tab, ahead of (or alongside) the real
// productsApi.create() call — see AdminCatalog.jsx. A new array, not a push,
// for the same reference-identity reason as setProducts above.
const addAdminProduct = (p) => { PRODUCTS = [...PRODUCTS, p]; };

// Loose equality: callers pass ids sourced from several undocumented API
// response shapes (cart items, favorites, etc.) that aren't guaranteed to
// match the catalog's own id type (e.g. "42" vs 42) — a strict === here
// would silently show real items as "unavailable" on a type mismatch alone.
const byId   = id => PRODUCTS.find(p => p.id == id);
const bySlug = s => PRODUCTS.find(p => p.slug === s || p.id == s);
const byCat  = c  => PRODUCTS.filter(p => p.category === c);

// A variant option can carry its own `price` (set in the admin, see
// AdminCatalog.jsx's VariantGroupRow) that overrides the product's base price
// when that option is selected — e.g. 256GB costs more than 128GB. `selected`
// is ProductPage's {groupName: chosenOption} map. Groups are walked in their
// stored order, so if more than one group has a priced option selected (rare —
// normally only one dimension, like storage, drives price) the later group in
// `product.variants` wins; most products will only ever set this on one group.
const effectivePrice = (product, selected) => {
  if (product?.variantStock && selected && Array.isArray(product?.variants) && product.variants.length) {
    const selectedAttrs = {};
    product.variants.forEach(g => {
      const sel = selected?.[g.name];
      if (sel != null) selectedAttrs[g.name] = g.type === 'color' ? sel.name : sel.label;
    });
    if (Object.keys(selectedAttrs).length === product.variants.length) {
      const rec = product.variantStock[comboKey(selectedAttrs)];
      if (rec?.price != null && Number(rec.price) > 0) return Number(rec.price);
    }
  }
  let price = product?.price ?? 0;
  (product?.variants || []).forEach(g => {
    const sel = selected?.[g.name];
    if (sel?.price != null && sel.price > 0) price = sel.price;
  });
  return price;
};

// Cart lines snapshot the resolved price at add-to-cart time (`unitPrice`,
// set in StoreProvider.addToCart) so a later price/variant-price change
// doesn't retroactively change what's already in someone's cart. Falls back
// to the product's current base price for any cart line saved before this
// existed, or if it was added without going through ProductPage.
const unitPriceOf = (cartItem, product) => cartItem?.unitPrice ?? product?.price ?? 0;

// generic product-variant option lists (storage sizes, fallback swatch colours)
const VARIANTS = {
  color: [
    { name:'Titanium', hex:'#8E8E93' },
    { name:'Phantom Black', hex:'#1C1C1E' },
    { name:'Sky Blue', hex:'#5AA9E6' },
    { name:'Sunset Orange', hex:'#F67208' },
  ],
  storage: ['128GB','256GB','512GB','1TB'],
};

// detect card brand from the first digit(s) of a PAN
const cardBrand = (num) => {
  const n = (num || '').replace(/\D/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'Mastercard';
  if (/^(50|65|6)/.test(n)) return 'Verve';
  if (/^3[47]/.test(n)) return 'Amex';
  return 'Card';
};

export {
  naira, CATEGORIES, SUBCATS, PRODUCTS, REAL_IMG,
  VARIANTS, byId, bySlug, byCat, cardBrand, addAdminProduct,
  slugify, setCategories, setSubcats, setProducts,
  effectivePrice, unitPriceOf,
};
