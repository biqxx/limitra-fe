'use client';
/* LIMITRA store — global cart/wishlist/theme/etc state, ported from legacy/store.jsx.
   Routing changes from a hash router to next/navigation; everything else is unchanged. */
import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { naira, byId, REAL_IMG, slugify, setCategories, setSubcats, setProducts, unitPriceOf } from '@/lib/data';
import { applyStoredVariants } from '@/lib/variantsStore';
import { routeFor, parseRoute } from '@/lib/routes';
import { getToken, clearTokens } from '@/lib/auth';
import { authApi, profileApi, cartApi, cartItemsApi, favoritesApi, categoriesApi, productsApi, addressesApi, walletApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';

// cosmetic placeholder tints, cycled per category — the backend has no color/theme
// field for a category, this just keeps empty-image product cards visually varied.
const CAT_TINTS = [
  ['rgba(4,56,182,.12)', 'rgba(4,56,182,.04)'],
  ['rgba(246,114,8,.14)', 'rgba(246,114,8,.05)'],
  ['rgba(16,122,69,.12)', 'rgba(16,122,69,.04)'],
  ['rgba(142,85,230,.12)', 'rgba(142,85,230,.04)'],
  ['rgba(229,72,77,.12)', 'rgba(229,72,77,.04)'],
  ['rgba(201,137,10,.12)', 'rgba(201,137,10,.04)'],
];

const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);

const CATALOG_TTL_MS = 60 * 1000;
const CATALOG_CACHE_KEY = 'lim_catalog_cache_v1';
let _catalogFetchedAt = 0;
let _catalogPromise = null;

function needsCatalogOnRoute(pathname) {
  if (!pathname || pathname.startsWith('/admin')) return false;
  if (pathname === '/') return true;
  return ['/shop', '/deals', '/category', '/product', '/cart', '/wishlist', '/channels', '/microstores', '/store'].some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function defaultVariantFor(product) {
  const list = Array.isArray(product?.variants) ? product.variants : [];
  if (!list.length) return null;
  return list.find(v => (v.status ?? 'active') === 'active' && (v.stock ?? 1) > 0) || list[0];
}

export function StoreProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = useMemo(() => parseRoute(pathname, searchParams), [pathname, searchParams]);

  const [theme, setTheme] = useState('light');
  /* guest cart/wishlist — localStorage-backed. Once signed in, the backend cart
     (remoteCart/favorites below) takes over as the source of truth instead;
     the backend has no guest/anonymous cart support (its routes require auth). */
  const [localCart, setLocalCart] = useState([]);
  const localCartRef = useRef(localCart); localCartRef.current = localCart;
  const [localWish, setLocalWish] = useState([]);
  const localWishRef = useRef(localWish); localWishRef.current = localWish;
  const [remoteCart, setRemoteCart] = useState(null); // raw cartApi cart object, signed-in users only
  const remoteCartRef = useRef(remoteCart); remoteCartRef.current = remoteCart;
  const [favorites, setFavorites] = useState([]); // [{id, product_id, ...}], signed-in users only
  const favoritesRef = useRef(favorites); favoritesRef.current = favorites;
  const [addresses, setAddresses] = useState([]);
  const [cards, setCards] = useState([]);
  const cardsRef = useRef(cards); cardsRef.current = cards;
  const [toasts, setToasts] = useState([]);
  const [query, setQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [referral, setReferral] = useState({ code: null, credit: 0, referrals: [] });
  const [rewards, setRewards] = useState([]);
  const [promo, setPromo] = useState(null); // applied promo code (in-memory: never auto-applies on reload)
  const [spinUsed, setSpinUsed] = useState(false);
  const [user, setUser] = useState(null);
  const isAuthenticated = !!user;
  const [authLoading, setAuthLoading] = useState(true);
  const tid = useRef(0);

  /* hydrate from localStorage once on mount (avoids SSR/client markup mismatch).
     cards/referral have no fake seed anymore — they start empty until a real
     backend (or, for cards, the user's own local entries) fills them in.
     Addresses are no longer part of this — see loadAddresses() below, which
     reads from the real addressesApi instead of localStorage.
     `hydrated` gates every persist-effect below: without it, a persist effect's
     first run (same commit as this one, before these setState calls have landed)
     would still see the pre-hydration default and write it straight back over
     whatever was just read — invisible in prod where it self-corrects next tick,
     but permanent under StrictMode's double-invoked mount, which re-hydrates from
     that already-clobbered value. */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try { setTheme(localStorage.getItem('lim_theme') || 'light'); } catch (e) {}
    try { setLocalCart(JSON.parse(localStorage.getItem('lim_cart') || '[]')); } catch (e) {}
    try { setLocalWish(JSON.parse(localStorage.getItem('lim_wish') || '[]')); } catch (e) {}
    try { setCards(JSON.parse(localStorage.getItem('lim_cards') || '[]')); } catch (e) {}
    try { setSearchHistory(JSON.parse(localStorage.getItem('lim_search') || '[]')); } catch (e) {}
    try {
      const saved = JSON.parse(localStorage.getItem('lim_referral') || 'null');
      if (saved) setReferral(saved);
    } catch (e) {}
    try { setRewards(JSON.parse(localStorage.getItem('lim_rewards') || '[]')); } catch (e) {}
    try { setSpinUsed(localStorage.getItem('lim_spin_used') === '1'); } catch (e) {}
    setHydrated(true);
  }, []);

  /* backend cart/favorites — only exist for signed-in users (both routes 401 without
     a token; there's no guest/anonymous cart on this backend). Loaded once right
     after a session resolves; refreshRemoteCart() re-fetches after any mutation
     since the API doesn't document what addToActive/updateQty/etc. return. */
  const refreshRemoteCart = useCallback(async () => {
    try { setRemoteCart(await cartApi.getActive()); } catch (e) { /* leave stale cart on a transient failure */ }
  }, []);
  const loadCartAndFavorites = useCallback(async () => {
    try {
      let pendingLocal = localCartRef.current || [];
      if (pendingLocal.length === 0 && typeof window !== 'undefined') {
        try { pendingLocal = JSON.parse(localStorage.getItem('lim_cart') || '[]'); } catch (e) {}
      }
      if (pendingLocal.length > 0) {
        const failed = [];
        for (const item of pendingLocal) {
          try {
            const payload = { product_id: item.id, quantity: item.qty || 1 };
            if (item.variantId != null) payload.variant_id = item.variantId;
            if (item.selectedOptions && Object.keys(item.selectedOptions).length > 0) payload.selected_options = item.selectedOptions;
            await cartApi.addToActive(payload);
          } catch (e) {
            failed.push(item);
          }
        }
        setLocalCart(failed);
        try { localStorage.setItem('lim_cart', JSON.stringify(failed)); } catch (e) {}
      }
      let c;
      try { c = await cartApi.getActive(); } catch (e) { c = await cartApi.getOrCreateActive(); }
      setRemoteCart(c);
    } catch (e) { setRemoteCart(null); }
    try {
      let pendingWish = localWishRef.current || [];
      if (pendingWish.length === 0 && typeof window !== 'undefined') {
        try { pendingWish = JSON.parse(localStorage.getItem('lim_wish') || '[]'); } catch (e) {}
      }
      if (pendingWish.length > 0) {
        for (const pid of pendingWish) {
          try {
            const v = defaultVariantFor(byId(pid));
            await favoritesApi.add(pid, v?.id ?? null);
          } catch (e) { /* skip unavailable guest favorite */ }
        }
        setLocalWish([]);
        try { localStorage.setItem('lim_wish', '[]'); } catch (e) {}
      }
      const favs = await favoritesApi.list();
      // Confirmed live: GET /favorites' data is { items: [...], pagination }
      // — not a bare array and not nested under `.data` again, which is why
      // this silently fell back to [] every time despite favorites existing.
      setFavorites(Array.isArray(favs) ? favs : (favs?.items ?? favs?.data ?? []));
    } catch (e) { setFavorites([]); }
  }, []);

  /* real addresses — also signed-in only (401 without a token, confirmed live).
     Loaded alongside cart/favorites once a session resolves. */
  const [addressesLoading, setAddressesLoading] = useState(false);
  const loadAddresses = useCallback(async () => {
    setAddressesLoading(true);
    try {
      const list = await addressesApi.list();
      setAddresses(Array.isArray(list) ? list : list?.data || list?.items || []);
    } catch (e) {
      setAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  }, []);

  /* real wallet balance ("Lim Cash" in the UI) — signed-in only. Loaded
     alongside cart/addresses once a session resolves. Response shape isn't in
     the OpenAPI schema (generic SuccessResponse) — balance is read
     defensively at the call site below. */
  const [wallet, setWallet] = useState(null);
  const loadWallet = useCallback(async () => {
    try { setWallet(await walletApi.get()); } catch (e) { setWallet(null); }
  }, []);
  const walletBalance = Number(wallet?.balance ?? wallet?.data?.balance ?? 0);

  /* real session — resolves who's signed in from a stored JWT.
     lib/api/endpoints.js: authApi.me() (id/username/email/role) + profileApi.get()
     (first_name/last_name/phone/etc.) together make up the real profile.
     Exposed as refreshUser() so a fresh login can populate `user` immediately
     instead of waiting for the next full page load. Returns the resolved user
     (or null) directly so a caller like AuthPage can route on `role` right away
     instead of reading back a `user` that may not have re-rendered into its
     closure yet. */
  const refreshUser = useCallback(async () => {
    if (!getToken()) { setUser(null); setRemoteCart(null); setFavorites([]); setAddresses([]); setWallet(null); setAuthLoading(false); return null; }
    try {
      const me = await authApi.me();
      // profileApi.get() 404s/500s for accounts with no profile row yet (seen
      // live on at least one admin account) — that's not a reason to drop a
      // session authApi.me() already proved valid, so it's non-fatal here.
      let profile = null;
      try { profile = await profileApi.get(); } catch (e) { /* no profile yet, proceed with `me` alone */ }
      const resolved = { ...me, ...profile };
      setUser(resolved);
      await Promise.all([
        loadCartAndFavorites(),
        loadAddresses(),
        loadWallet(),
      ]);
      return resolved;
    } catch (e) {
      setUser(null); clearTokens();
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, [loadCartAndFavorites, loadAddresses, loadWallet]);
  useEffect(() => { refreshUser(); }, [refreshUser]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch (e) {}
    clearTokens();
    setUser(null);
    setRemoteCart(null);
    setFavorites([]);
    setAddresses([]);
    setWallet(null);
  }, []);

  /* catalog — categories + products, both public (no auth) endpoints. Mutates
     the shared CATEGORIES/SUBCATS/PRODUCTS arrays/objects from lib/data.js in
     place (see their definitions for why) and bumps `catalogVersion` so every
     useStore() consumer re-renders and picks up the now-populated data on its
     next render. Response shapes aren't in the OpenAPI schema (no Product/
     Category component defined) so fields are read defensively; anything the
     real UI needs but the backend doesn't model yet (discounts, badges,
     ratings, brand) is left at a neutral default rather than invented. Fails
     open: an error here just leaves the catalog empty, same as today. */
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const applyCatalogPayload = useCallback((catList, rawProducts) => {
    const catsById = {};
    const mappedCats = catList.map((c, i) => {
      const slug = c.slug || slugify(c.name) || `category-${c.id}`;
      const mapped = {
        id: c.id,
        slug,
        name: c.name,
        count: c.products_count ?? c.product_count ?? c.count ?? 0,
        tint: CAT_TINTS[i % CAT_TINTS.length],
      };
      catsById[c.id] = mapped;
      return mapped;
    });
    const subcats = {};
    catList.forEach(c => {
      const slug = catsById[c.id]?.slug;
      const subs = c.subcategories || c.subCategories || [];
      if (slug && Array.isArray(subs) && subs.length) subcats[slug] = subs.map(s => s.name).filter(Boolean);
    });

    const mappedProducts = rawProducts.map(p => {
      const cat = catsById[p.category_id ?? p.category?.id];
      const imageUrls = Array.isArray(p.images)
        ? p.images.map(img => (typeof img === 'string' ? img : img?.url || img?.path)).filter(Boolean)
        : [];
      const imageUrl = imageUrls[0];
      const stock = Number(p.stock) || 0;
      if (imageUrl) REAL_IMG[p.id] = imageUrl;
      const createdAt = p.created_at ? new Date(p.created_at) : null;
      const isNew = createdAt ? (Date.now() - createdAt.getTime()) < 14 * 24 * 60 * 60 * 1000 : false;
      return {
        id: p.id,
        slug: p.slug || slugify(p.name) || `product-${p.id}`,
        name: p.name,
        brand: p.brand || '',
        price: Number(p.price) || 0,
        was: Number(p.compare_at_price) || 0,
        off: Number(p.discount_percentage) || 0,
        stock,
        category: cat?.slug || p.category?.slug || 'all',
        subcategoryName: p.subcategory?.name || null,
        desc: p.description || '',
        description: p.description || '',
        store: p.creator?.name || p.creator?.username || 'Limitra',
        rating: Number(p.average_rating ?? p.rating) || 0,
        reviews: Number(p.review_count ?? p.reviews_count ?? p.reviews) || 0,
        specs: Array.isArray(p.specifications)
          ? p.specifications.filter(s => s?.name).map(s => [s.name, s.value ?? ''])
          : [],
        images: imageUrls,
        variants: Array.isArray(p.variants) ? p.variants : [],
        badges: [...(stock === 0 ? ['out-of-stock'] : []), ...(isNew ? ['new'] : []), ...(p.is_featured ? ['hot'] : [])],
        bestseller: !!p.is_bestseller,
        tint: cat?.tint || CAT_TINTS[0],
      };
    });

    setCategories(mappedCats);
    setSubcats(subcats);
    setProducts(applyStoredVariants(mappedProducts));
    setCatalogVersion(v => v + 1);
  }, []);

  const loadCatalog = useCallback(async (force = false) => {
    try {
      if (!force && typeof window !== 'undefined') {
        if (Date.now() - _catalogFetchedAt < CATALOG_TTL_MS) {
          setCatalogLoading(false);
          return;
        }
        try {
          const cached = JSON.parse(sessionStorage.getItem(CATALOG_CACHE_KEY) || 'null');
          if (cached && (Date.now() - cached.ts) < CATALOG_TTL_MS && Array.isArray(cached.products)) {
            _catalogFetchedAt = cached.ts;
            applyCatalogPayload(cached.cats || [], cached.products);
            setCatalogLoading(false);
            return;
          }
        } catch (e) {}
      }

      if (!_catalogPromise || force) {
        _catalogPromise = Promise.all([
          categoriesApi.list().catch(() => []),
          productsApi.list({ per_page: 100 }).catch(() => null),
        ]).finally(() => { _catalogPromise = null; });
      }
      const [rawCats, rawProductsRes] = await _catalogPromise;
      const catList = Array.isArray(rawCats) ? rawCats : rawCats?.items || rawCats?.data || [];
      const rawProducts = Array.isArray(rawProductsRes) ? rawProductsRes : rawProductsRes?.items || rawProductsRes?.data || [];
      _catalogFetchedAt = Date.now();
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ ts: _catalogFetchedAt, cats: catList, products: rawProducts }));
        } catch (e) {}
      }
      applyCatalogPayload(catList, rawProducts);
    } catch (e) {
      console.error('[catalog] load failed:', e);
    } finally {
      setCatalogLoading(false);
    }
  }, [applyCatalogPayload]);

  useEffect(() => {
    if (!needsCatalogOnRoute(pathname)) {
      setCatalogLoading(false);
      return;
    }
    loadCatalog();
  }, [loadCatalog, pathname]);

  useEffect(() => {
    const onSignup = () => setSpinUsed(false);
    window.addEventListener('lim:signup', onSignup);
    return () => window.removeEventListener('lim:signup', onSignup);
  }, []);

  /* theme */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (!hydrated) return;
    try { localStorage.setItem('lim_theme', theme); } catch (e) {}
  }, [theme, hydrated]);
  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  /* routing */
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  const go = useCallback((name, ...params) => {
    const target = routeFor(name, params);
    if (typeof window !== 'undefined') {
      const current = `${window.location.pathname}${window.location.search}`;
      if (target !== current) {
        window.dispatchEvent(new Event('lim:nav-start'));
      }
    }
    router.push(target);
  }, [router]);

  /* persistence — gated on `hydrated` (see the hydrate effect above) so a
     pre-hydration default never gets written back over real stored data. */
  useEffect(() => { if (!hydrated) return; try { localStorage.setItem('lim_cart', JSON.stringify(localCart)); } catch (e) {} }, [localCart, hydrated]);
  useEffect(() => { if (!hydrated) return; try { localStorage.setItem('lim_wish', JSON.stringify(localWish)); } catch (e) {} }, [localWish, hydrated]);
  useEffect(() => { if (!hydrated) return; try { localStorage.setItem('lim_cards', JSON.stringify(cards)); } catch (e) {} }, [cards, hydrated]);
  useEffect(() => { if (!hydrated) return; try { localStorage.setItem('lim_search', JSON.stringify(searchHistory)); } catch (e) {} }, [searchHistory, hydrated]);
  useEffect(() => { if (!hydrated) return; try { localStorage.setItem('lim_referral', JSON.stringify(referral)); } catch (e) {} }, [referral, hydrated]);
  useEffect(() => { if (!hydrated) return; try { localStorage.setItem('lim_rewards', JSON.stringify(rewards)); } catch (e) {} }, [rewards, hydrated]);
  useEffect(() => { if (!hydrated) return; try { localStorage.setItem('lim_spin_used', spinUsed ? '1' : '0'); } catch (e) {} }, [spinUsed, hydrated]);

  /* search history */
  const addSearch = useCallback((q) => {
    q = (q || '').trim(); if (!q) return;
    setSearchHistory(h => [q, ...h.filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 8));
  }, []);
  const clearSearch = useCallback(() => setSearchHistory([]), []);

  /* addresses — real backend calls (addressesApi, lib/api/endpoints.js), confirmed
     live (401 without a token, not 404 — a stale earlier check here had wrongly
     assumed the route wasn't deployed). Errors are toasted AND rethrown so the
     calling form (AddressForm) can turn field-level errors into inline messages
     and keep its modal open instead of silently closing on failure. */
  const saveAddress = useCallback(async (data) => {
    const { id, ...rest } = data;
    const payload = { ...rest, is_default: !!rest.is_default };
    try {
      if (id) {
        const updated = await addressesApi.update(id, payload);
        const merged = { id, ...payload, ...updated };
        setAddresses(list => list.map(a => a.id === id ? merged : (payload.is_default ? { ...a, is_default: false } : a)));
        toast('Address updated');
        return merged;
      }
      const created = await addressesApi.create(payload);
      setAddresses(list => payload.is_default ? [...list.map(a => ({ ...a, is_default: false })), created] : [...list, created]);
      toast('Address added');
      return created;
    } catch (e) {
      toast(messageFrom(e), 'error');
      throw e;
    }
  }, []);
  const removeAddress = useCallback(async (id) => {
    try {
      await addressesApi.remove(id);
      setAddresses(list => list.filter(a => a.id !== id));
      toast('Address removed');
    } catch (e) {
      toast(messageFrom(e), 'error');
    }
  }, []);
  const setPrimaryAddress = useCallback(async (id) => {
    try {
      await addressesApi.setDefault(id);
      setAddresses(list => list.map(a => ({ ...a, is_default: a.id === id })));
      toast('Default address updated');
    } catch (e) {
      toast(messageFrom(e), 'error');
    }
  }, []);

  /* saved cards — also client-local. savedCardsApi is live, but creating a real
     card needs a payment-gateway tokenization step (card_token) that doesn't
     exist in this app yet — HANDOFF.md is explicit a raw PAN must never reach
     the backend, so this stays local until that gateway is wired in. */
  const saveCard = useCallback((data) => {
    setCards(list => {
      const exists = data.id && list.some(c => c.id === data.id);
      const makeP = !!data.primary;
      if (exists) {
        return list.map(c => c.id === data.id ? { ...c, ...data, primary: makeP ? true : c.primary } : (makeP ? { ...c, primary: false } : c));
      }
      const next = { ...data, id: data.id || Date.now() };
      const base = makeP ? list.map(c => ({ ...c, primary: false })) : list;
      return [...base, next];
    });
    toast(data.id && cardsRef.current.some(c => c.id === data.id) ? 'Card updated' : 'Card saved');
  }, []);
  const removeCard = useCallback((id) => { setCards(list => list.filter(c => c.id !== id)); toast('Card removed'); }, []);
  const setPrimaryCard = useCallback((id) => { setCards(list => list.map(c => ({ ...c, primary: c.id === id }))); toast('Default card updated'); }, []);

  /* toasts */
  const toast = useCallback((msg, kind = 'ok') => {
    const id = ++tid.current;
    setToasts(t => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600);
  }, []);

  /* cart ops — guests stay fully local; signed-in users hit the real backend and
     re-fetch the active cart afterward rather than trust each endpoint's response
     shape (undocumented in the API spec). `opts.variants` (a per-product-defined
     map of group name -> {label, hex?}, from ProductPage) is UI-only: the backend
     cart has no variant fields, so it's never sent and won't survive a reload
     once signed in. `opts.unitPrice` (ProductPage's effectivePrice() result, which
     already accounts for any per-variant price override) is snapshotted onto the
     guest-cart line so a later price change doesn't retroactively reprice
     something already sitting in someone's cart — see unitPriceOf() in lib/data.js. */
  const addToCart = useCallback(async (product, opts = {}, qty = 1) => {
    const fallbackVariant = opts.variantId == null ? defaultVariantFor(product) : null;
    const variants = opts.variants || {};
    const variantId = opts.variantId ?? fallbackVariant?.id ?? null;
    const selectedOptions = (opts.selectedOptions && Object.keys(opts.selectedOptions).length > 0)
      ? opts.selectedOptions
      : (fallbackVariant?.attributes || {});
    const unitPrice = opts.unitPrice ?? fallbackVariant?.price ?? product.price;

    if (!isAuthenticated) {
      const variantKey = Object.keys(variants).sort().map(k => `${k}:${variants[k].label}`).join('|');
      const key = [product.id, variantId ?? variantKey].join('|');
      setLocalCart(c => {
        const ex = c.find(i => i.key === key);
        if (ex) return c.map(i => i.key === key ? { ...i, qty: i.qty + qty } : i);
        return [...c, { key, id: product.id, qty, variants, unitPrice, variantId, selectedOptions }];
      });
      toast(`Added to cart · ${product.name.split(',')[0]}`);
      return;
    }

    const prevCart = remoteCartRef.current;
    const prevItems = prevCart?.items || prevCart?.cart_items || [];
    const matchIdx = prevItems.findIndex(it =>
      (it.product_id ?? it.product?.id) === product.id
      && (it.variant_id ?? it.variant?.id ?? null) === variantId
    );
    const nextItems = matchIdx >= 0
      ? prevItems.map((it, idx) => idx === matchIdx ? { ...it, quantity: (it.quantity || 0) + qty } : it)
      : [
          ...prevItems,
          {
            id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            product_id: product.id,
            variant_id: variantId,
            selected_options: selectedOptions,
            quantity: qty,
            unit_price: unitPrice,
            price: unitPrice,
            product,
          },
        ];
    setRemoteCart({ ...(prevCart || {}), items: nextItems });
    toast(`Added to cart · ${product.name.split(',')[0]}`);

    try {
      const payload = { product_id: product.id, quantity: qty };
      if (variantId != null) payload.variant_id = variantId;
      if (Object.keys(selectedOptions).length > 0) payload.selected_options = selectedOptions;
      const updated = await cartApi.addToActive(payload);
      if (updated && (Array.isArray(updated.items) || Array.isArray(updated.cart_items))) {
        setRemoteCart(updated);
      } else {
        await refreshRemoteCart();
      }
    } catch (e) {
      setRemoteCart(prevCart);
      toast(messageFrom(e), 'error');
    }
  }, [isAuthenticated, toast, refreshRemoteCart]);

  const setQty = useCallback(async (key, qty) => {
    if (!isAuthenticated) {
      setLocalCart(c => qty <= 0 ? c.filter(i => i.key !== key) : c.map(i => i.key === key ? { ...i, qty } : i));
      return;
    }
    try {
      if (qty <= 0) await cartItemsApi.remove(key);
      else await cartItemsApi.updateQty(key, qty);
      await refreshRemoteCart();
    } catch (e) {
      toast(messageFrom(e), 'error');
    }
  }, [isAuthenticated, refreshRemoteCart, toast]);

  const removeItem = useCallback(async (key) => {
    if (!isAuthenticated) { setLocalCart(c => c.filter(i => i.key !== key)); return; }
    try {
      await cartItemsApi.remove(key);
      await refreshRemoteCart();
    } catch (e) {
      toast(messageFrom(e), 'error');
    }
  }, [isAuthenticated, refreshRemoteCart, toast]);

  const clearCart = useCallback(async () => {
    if (!isAuthenticated) { setLocalCart([]); return; }
    try { if (remoteCart?.id) await cartApi.clear(remoteCart.id); } catch (e) { /* order creation may already have closed this cart */ }
    await refreshRemoteCart();
  }, [isAuthenticated, remoteCart, refreshRemoteCart]);

  /* wishlist — same guest-local / signed-in-real split as cart above.
     favoritesApi.remove takes the favorite record's own id, not the product id,
     so signed-in state has to track that pairing (unlike the plain id array below). */
  const toggleWish = useCallback(async (id) => {
    if (!isAuthenticated) {
      setLocalWish(w => {
        const has = w.includes(id);
        toast(has ? 'Removed from wishlist' : 'Saved to wishlist');
        return has ? w.filter(x => x !== id) : [...w, id];
      });
      return;
    }
    const prevFavorites = favoritesRef.current;
    const existing = prevFavorites.find(f => (f.product_id ?? f.product?.id) === id);
    const optimisticId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    if (existing) {
      setFavorites(fs => fs.filter(f => f.id !== existing.id));
      toast('Removed from wishlist');
      try {
        await favoritesApi.remove(existing.id);
      } catch (e) {
        setFavorites(prevFavorites);
        toast(messageFrom(e), 'error');
      }
      return;
    }

    const defaultVariant = defaultVariantFor(byId(id));
    setFavorites(fs => [...fs, { id: optimisticId, product_id: id, variant_id: defaultVariant?.id ?? null }]);
    toast('Saved to wishlist');
    try {
      const created = await favoritesApi.add(id, defaultVariant?.id ?? null);
      if (created && created.id) {
        setFavorites(fs => fs.map(f => f.id === optimisticId ? created : f));
      }
    } catch (e) {
      setFavorites(prevFavorites);
      toast(messageFrom(e), 'error');
    }
  }, [isAuthenticated, toast]);

  /* referrals, referrer earns ₦5,000 store credit per completed referral; credit only offsets order totals */
  const REFERRAL_REWARD = 5000;
  // spend up to `amount` (or full balance) of credit; returns the amount actually applied
  const redeemCredit = useCallback((amount) => {
    let applied = 0;
    setReferral(r => { applied = Math.min(r.credit, amount); return { ...r, credit: r.credit - applied }; });
    return applied;
  }, []);

  // spin-to-win rewards (single spin per account); a reward becomes a coupon usable at checkout
  const claimSpin = useCallback((reward) => {
    // cash prizes go straight to referral credit (points), not a coupon
    if (reward.kind === 'fixed') {
      setReferral(r => ({ ...r, credit: r.credit + reward.value }));
      setSpinUsed(true);
      return null;
    }
    const code = (reward.codePrefix || 'WELCOME') + Math.floor(10 + Math.random() * 89);
    const expires = new Date(Date.now() + 7 * 864e5).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
    setRewards(r => [{ ...reward, code, expires, status: 'Active', won: 'Just now' }, ...r]);
    setSpinUsed(true);
    return code;
  }, []);
  const redeemReward = useCallback((code) => setRewards(r => r.map(x => x.code === code ? { ...x, status: 'Used' } : x)), []);

  /* remote cart item shape is undocumented in the API spec — checked defensively
     against a couple of plausible field names, and needs live verification once
     /products (and therefore real cart items) actually exist. */
  const remoteCartItems = remoteCart?.items || remoteCart?.cart_items || [];
  const cart = isAuthenticated
    ? remoteCartItems.map(it => {
        const pid = it.product_id ?? it.product?.id;
        const p = it.product;
        const firstImg = Array.isArray(p?.images) ? p.images[0] : null;
        const imageUrl = typeof firstImg === 'string' ? firstImg : firstImg?.url || firstImg?.path;
        if (pid && imageUrl && !REAL_IMG[pid]) REAL_IMG[pid] = imageUrl;
        const opts = it.selected_options && typeof it.selected_options === 'object' ? it.selected_options : {};
        const variants = Object.fromEntries(
          Object.entries(opts).map(([k, v]) => [k, typeof v === 'object' && v !== null ? v : { label: String(v) }])
        );
        return {
          key: it.id,
          id: pid,
          qty: it.quantity,
          variants,
          unitPrice: Number(it.unit_price ?? it.price ?? p?.price ?? 0),
          product: p ? {
            id: p.id,
            slug: p.slug || `product-${p.id}`,
            name: p.name,
            brand: p.brand || '',
            price: Number(p.price) || 0,
            was: Number(p.compare_at_price) || 0,
            stock: Number(p.stock) || 0,
            tint: CAT_TINTS[0],
          } : null,
        };
      })
    : localCart;
  // Needed by checkoutApi.quote({cart_id}) — only meaningful for signed-in users
  // (the real backend has no guest cart, so there's nothing to quote against
  // until checkout itself requires sign-in).
  const cartId = remoteCart?.id ?? null;
  const wish = isAuthenticated ? favorites.map(f => f.product_id ?? f.product?.id) : localWish;

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = isAuthenticated
    ? remoteCartItems.reduce((s, it) => s + Number(it.unit_price ?? it.price ?? it.product?.price ?? 0) * (it.quantity || 0), 0)
    : localCart.reduce((s, i) => s + unitPriceOf(i, byId(i.id)) * i.qty, 0);

  const value = {
    theme, toggleTheme, route, go,
    user, isAuthenticated, authLoading, logout, refreshUser,
    catalogLoading, catalogVersion, loadCatalog,
    cart, addToCart, setQty, removeItem, clearCart, cartCount, cartTotal, cartId,
    wish, toggleWish,
    addresses, addressesLoading, loadAddresses, saveAddress, removeAddress, setPrimaryAddress,
    cards, saveCard, removeCard, setPrimaryCard,
    wallet, walletBalance, loadWallet,
    toasts, toast,
    query, setQuery,
    searchHistory, addSearch, clearSearch,
    referral, REFERRAL_REWARD, redeemCredit,
    rewards, spinUsed, claimSpin, redeemReward,
    promo, setPromo,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export const fmt = n => naira(n);
