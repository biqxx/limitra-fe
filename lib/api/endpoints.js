// Typed wrappers around the real Limitra backend, grouped by resource.
// Source of truth: the live OpenAPI spec at https://api.limitra.com.ng/docs?api-docs.json
// (L5 Swagger). Re-fetch and diff that against this file if the backend changes —
// it's the "Limitra User Service API", so more groups (affiliate, admin, etc.)
// likely live in other services and aren't in this spec yet.
import { apiFetch } from './client';
import { storeSession, clearTokens } from '@/lib/auth';

async function withSession(promise) {
  const payload = await promise;
  storeSession(payload);
  return payload;
}

// User.role is one of [user, admin, staff, affiliate].
export const authApi = {
  // 201 -> SuccessResponse only (no token yet — account is inactive until verify-email).
  // `ref` is an optional affiliate referral code query param.
  signup: (data, ref) => apiFetch('/signup', { method: 'POST', body: data, params: { ref }, auth: false }),
  // Resolves a TokenPayload — activates the account and logs it in.
  verifyEmail: (data) => withSession(apiFetch('/verify-email', { method: 'POST', body: data, auth: false })),
  login: (data) => withSession(apiFetch('/login', { method: 'POST', body: data, auth: false })),
  logout: async () => { await apiFetch('/logout', { method: 'POST' }); clearTokens(); },
  // Needs the CURRENT (soon-to-expire) access token as Bearer — not a separate refresh token.
  refresh: () => withSession(apiFetch('/refresh', { method: 'POST' })),
  me: () => apiFetch('/me'),
  forgotPassword: (data) => apiFetch('/forgot-password', { method: 'POST', body: data, auth: false }),
  resetPassword: (data) => apiFetch('/reset-password', { method: 'POST', body: data, auth: false }),
};

// Wallet/ledger accounts (deposit & withdraw) — distinct from user profile.
// create: { user_id*, balance, bonus_balance, currency }. update: { currency, bonus_balance }.
export const accountsApi = {
  list: (params) => apiFetch('/accounts', { params }), // staff/admin; params: { user_id }
  create: (data) => apiFetch('/accounts', { method: 'POST', body: data }), // admin
  get: (accountId) => apiFetch(`/accounts/${accountId}`),
  update: (accountId, data) => apiFetch(`/accounts/${accountId}`, { method: 'PUT', body: data }), // admin
  remove: (accountId) => apiFetch(`/accounts/${accountId}`, { method: 'DELETE' }),
  deposit: (accountId, amount) => apiFetch(`/accounts/${accountId}/deposit`, { method: 'POST', body: { amount } }),
  withdraw: (accountId, amount) => apiFetch(`/accounts/${accountId}/withdraw`, { method: 'POST', body: { amount } }),
};

// create/update: { type*, recipient_name*, phone*, line1*, line2, city*, landmark, state*, country*, postal_code*, is_default }.
// POST/PUT /addresses document a different, stale shape (address_line_1, no
// recipient_name/phone, country as a free-text name) that the live backend
// actually rejects — confirmed against a real 422 response. The above is
// what it actually validates against (matches what PATCH documents); country
// must be a 2-letter ISO code (e.g. "NG"), also undocumented but confirmed
// live. GET's response shape isn't documented either, so addresses are read
// back defensively under both naming conventions (see Account.jsx/Cart.jsx).
export const addressesApi = {
  list: (params) => apiFetch('/addresses', { params }), // params: { type }
  create: (data) => apiFetch('/addresses', { method: 'POST', body: data }),
  get: (addressId) => apiFetch(`/addresses/${addressId}`),
  update: (addressId, data) => apiFetch(`/addresses/${addressId}`, { method: 'PUT', body: data }),
  remove: (addressId) => apiFetch(`/addresses/${addressId}`, { method: 'DELETE' }),
  setDefault: (addressId) => apiFetch(`/addresses/${addressId}/set-default`, { method: 'PATCH' }),
};

// Standalone cart-item resource. add: { cart_id*, product_id*, quantity* }. updateQty: { quantity* }.
export const cartItemsApi = {
  list: (params) => apiFetch('/cart-items', { params }), // params: { cart_id }
  add: (data) => apiFetch('/cart-items', { method: 'POST', body: data }),
  get: (cartItemId) => apiFetch(`/cart-items/${cartItemId}`),
  updateQty: (cartItemId, quantity) => apiFetch(`/cart-items/${cartItemId}`, { method: 'PUT', body: { quantity } }),
  remove: (cartItemId) => apiFetch(`/cart-items/${cartItemId}`, { method: 'DELETE' }),
};

// Cart resource — carts have their own id/status, plus cart-scoped item ops.
// addToActive: { product_id*, quantity* }. updateStatus: { status* }.
export const cartApi = {
  list: (params) => apiFetch('/cart', { params }), // params: { status }
  getOrCreateActive: () => apiFetch('/cart', { method: 'POST' }),
  get: (cartId) => apiFetch(`/cart/${cartId}`),
  updateStatus: (cartId, status) => apiFetch(`/cart/${cartId}`, { method: 'PUT', body: { status } }),
  remove: (cartId) => apiFetch(`/cart/${cartId}`, { method: 'DELETE' }),
  getActive: () => apiFetch('/cart/active'),
  addToActive: (data) => apiFetch('/cart/add', { method: 'POST', body: data }),
  removeItem: (cartId, cartItemId) => apiFetch(`/cart/${cartId}/items/${cartItemId}`, { method: 'DELETE' }),
  clear: (cartId) => apiFetch(`/cart/${cartId}/clear`, { method: 'DELETE' }),
};

// create/update: { name*, description }.
export const categoriesApi = {
  list: () => apiFetch('/categories', { auth: false }), // top-level + subcategories
  create: (data) => apiFetch('/categories', { method: 'POST', body: data }), // admin
  get: (categoryId) => apiFetch(`/categories/${categoryId}`, { auth: false }),
  listSubcategories: (categoryId) => apiFetch(`/categories/${categoryId}/subcategories`, { auth: false }),
  update: (categoryId, data) => apiFetch(`/categories/${categoryId}`, { method: 'PATCH', body: data }), // admin
  remove: (categoryId) => apiFetch(`/categories/${categoryId}`, { method: 'DELETE' }), // admin
};

// Includes inactive top-level categories and subcategories for catalog administration.
// Mutations use the existing policy-protected category resource routes.
export const adminCategoriesApi = {
  list: () => apiFetch('/admin/categories'),
  create: categoriesApi.create,
  update: categoriesApi.update,
  remove: categoriesApi.remove,
};

export const favoritesApi = {
  list: () => apiFetch('/favorites'),
  add: (productId) => apiFetch('/favorites', { method: 'POST', body: { product_id: productId } }),
  get: (favoriteId) => apiFetch(`/favorites/${favoriteId}`),
  remove: (favoriteId) => apiFetch(`/favorites/${favoriteId}`, { method: 'DELETE' }),
};

export const ordersApi = {
  list: (params) => apiFetch('/orders', { params }), // params: { status, from_date, to_date, q, per_page }
  get: (orderId) => apiFetch(`/orders/${orderId}`),
  // No request body in the spec — order is derived server-side from the caller's
  // active cart/quote (call checkoutApi.quote() first). Idempotency-Key (8-100
  // chars) is REQUIRED to avoid duplicate orders on retry; generate one per
  // checkout attempt (e.g. crypto.randomUUID()).
  create: (idempotencyKey) => apiFetch('/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
  }),
  cancel: (orderId, reason) => apiFetch(`/orders/${orderId}/cancel`, { method: 'POST', body: { reason } }),
  tracking: (orderId) => apiFetch(`/orders/${orderId}/tracking`),
  invoice: (orderId) => apiFetch(`/orders/${orderId}/invoice`),
  buyAgain: (orderId, itemIds) => apiFetch(`/orders/${orderId}/buy-again`, { method: 'POST', body: itemIds ? { item_ids: itemIds } : {} }),
  updateDeliveryAddress: (orderId, addressId) => apiFetch(`/orders/${orderId}/delivery-address`, { method: 'PATCH', body: { address_id: addressId } }),
  requestReturn: (orderId, data) => apiFetch(`/orders/${orderId}/returns`, { method: 'POST', body: data }),
};

// Real delivery methods for a cart/address — the actual identifiers to send
// as checkoutApi.quote()'s delivery_method differ by backend config, so they
// must come from here rather than being guessed. Response shape isn't in the
// spec either (generic SuccessResponse) — read it defensively at the call site.
export const deliveryApi = {
  options: (params) => apiFetch('/delivery/options', { params }),
};

// Real pickup/collection points for a pickup-type delivery method — like
// deliveryApi.options, response shape isn't documented (generic
// SuccessResponse), so read it defensively at the call site.
export const pickupLocationsApi = {
  list: (params) => apiFetch('/pickup-locations', { params }),
};

// Admin configuration behind deliveryApi.options()/pickupLocationsApi.list():
// zones, the methods attached to them, and pickup points. None of these
// request/response bodies are documented (empty `{}` request schemas, generic
// SuccessResponse replies) — there is no DELETE route for any of the three,
// only create/list/update, so deactivating is the only teardown available.
export const adminDeliveryZonesApi = {
  list: (params) => apiFetch('/admin/delivery-zones', { params }),
  create: (data) => apiFetch('/admin/delivery-zones', { method: 'POST', body: data }),
  update: (zoneId, data) => apiFetch(`/admin/delivery-zones/${zoneId}`, { method: 'PATCH', body: data }),
  setMethod: (zoneId, methodId, data) => apiFetch(`/admin/delivery-zones/${zoneId}/methods/${methodId}`, { method: 'PUT', body: data }),
};

export const adminDeliveryMethodsApi = {
  list: (params) => apiFetch('/admin/delivery-methods', { params }),
  create: (data) => apiFetch('/admin/delivery-methods', { method: 'POST', body: data }),
  update: (methodId, data) => apiFetch(`/admin/delivery-methods/${methodId}`, { method: 'PATCH', body: data }),
};

export const adminPickupLocationsApi = {
  list: (params) => apiFetch('/admin/pickup-locations', { params }),
  create: (data) => apiFetch('/admin/pickup-locations', { method: 'POST', body: data }),
  update: (pickupId, data) => apiFetch(`/admin/pickup-locations/${pickupId}`, { method: 'PATCH', body: data }),
};

// Quote is the first step of checkout — it prices a cart against a delivery
// address/method/payment method (and optional promo/wallet credit) without
// creating anything yet. ordersApi.create() then converts the most recent
// quote for the caller's active cart into a real order (no body of its own).
// Response shape isn't in the spec (just the generic SuccessResponse envelope)
// — read whatever it returns defensively at the call site.
export const checkoutApi = {
  quote: (data) => apiFetch('/checkout/quote', { method: 'POST', body: data }),
};

// initialize: { order_id*, method* ('card'|'bank_transfer'), callback_url*, saved_card_id }.
// Response shape is undocumented (generic SuccessResponse) — in line with how
// every other Nigerian payment gateway integration works, it's expected to
// include a hosted-page redirect URL and a reference to poll/confirm; read
// both defensively (see the call site in Cart.jsx) rather than assuming exact
// field names until a real transaction confirms them.
export const paymentsApi = {
  initialize: (data, idempotencyKey) => apiFetch('/payments/initialize', {
    method: 'POST',
    body: data,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  }),
  get: (paymentId) => apiFetch(`/payments/${paymentId}`),
  statusByReference: (reference) => apiFetch(`/payments/reference/${reference}/status`),
  retry: (paymentId, data) => apiFetch(`/payments/${paymentId}/retry`, { method: 'POST', body: data }),
};

export const walletApi = {
  get: () => apiFetch('/wallet'),
  transactions: (params) => apiFetch('/wallet/transactions', { params }),
  initializeDeposit: (data) => apiFetch('/wallet/deposits/initialize', { method: 'POST', body: data }), // { amount*, amount_minor*, callback_url*, method }
  verifyDeposit: (reference) => apiFetch(`/wallet/deposits/${reference}/verify`),
};

export const promotionsApi = {
  validate: (code, cartId) => apiFetch('/promotions/validate', { method: 'POST', body: { code, cart_id: cartId } }),
};

// create: { category_id*, subcategory_id, name*, description, price*, stock*, images }.
// GET /products (list) always filters to status:"active" only, for every
// caller — there is no query param that overrides it, even for an admin token
// (confirmed live). GET /products/{id} (singular) is NOT filtered the same way:
// a signed-in admin/staff token sees a draft product by id, a guest/customer
// gets 404 for it — so `get` below sends the token when one exists instead of
// forcing `auth: false`, letting an admin preview their own drafts here too.
export const productsApi = {
  // params: { category_id, subcategory_id, search, price_min, price_max, in_stock, sort_by, sort_dir, per_page }
  list: (params) => apiFetch('/products', { params, auth: false }),
  create: (data) => apiFetch('/products', { method: 'POST', body: data }), // admin
  get: (productId) => apiFetch(`/products/${productId}`),
  update: (productId, data) => apiFetch(`/products/${productId}`, { method: 'PATCH', body: data }), // admin
  remove: (productId) => apiFetch(`/products/${productId}`, { method: 'DELETE' }), // admin
};

// NOT in the public OpenAPI spec, but live and real (confirmed: GET /admin/products
// returns 401 unauthenticated rather than 404, and 200s with full data for an admin
// token). Unlike productsApi.list(), this returns every product regardless of
// status (draft/active/archived) plus admin-only fields (brand, sku, status, creator,
// etc.) the public endpoints never expose. The admin product list should read
// from here, not from the storefront's active-only catalog.
export const adminProductsApi = {
  list: (params) => apiFetch('/admin/products', { params }),
  get: (productId) => apiFetch(`/admin/products/${productId}`),
  create: (data) => apiFetch('/admin/products', { method: 'POST', body: data }),
  update: (productId, data) => apiFetch(`/admin/products/${productId}`, { method: 'PATCH', body: data }),
  remove: (productId) => apiFetch(`/admin/products/${productId}`, { method: 'DELETE' }),
  restore: (productId) => apiFetch(`/admin/products/${productId}/restore`, { method: 'POST' }),
};

export const sourcingApi = {
  sources: () => apiFetch('/admin/sourcing/sources'),
  search: (params) => apiFetch('/admin/sourcing/search', { params }),
  enhance: (data) => apiFetch('/admin/sourcing/enhance', { method: 'POST', body: data }),
  jobs: (params) => apiFetch('/admin/sourcing/jobs', { params }),
  queue: (data) => apiFetch('/admin/sourcing/jobs', { method: 'POST', body: data }),
  imports: (params) => apiFetch('/admin/sourcing/imports', { params }),
  import: (data) => apiFetch('/admin/sourcing/imports', { method: 'POST', body: data }),
  pricing: (productSourceId) => apiFetch(`/admin/sourcing/imports/${productSourceId}/pricing`),
  recalculatePrice: (productSourceId, data) => apiFetch(`/admin/sourcing/imports/${productSourceId}/pricing/recalculate`, { method: 'POST', body: data }),
  approvePrice: (productSourceId, quoteId) => apiFetch(`/admin/sourcing/imports/${productSourceId}/pricing/approve`, { method: 'POST', body: quoteId ? { quote_id: quoteId } : {} }),
};

export const businessSettingsApi = {
  list: (params) => apiFetch('/admin/settings', { params }),
  update: (settings) => apiFetch('/admin/settings', { method: 'PATCH', body: { settings } }),
};

// Separate from the auth User record. update: { first_name, middle_name, last_name,
// avatar, phone, birthday, subscribe_to_newsletter }.
export const profileApi = {
  get: () => apiFetch('/profile'),
  update: (data) => apiFetch('/profile', { method: 'PATCH', body: data }),
};

// save/update: { brand*, last4*, exp_month*, exp_year*, card_token*, is_default }.
// card_token comes from the payment gateway's client-side tokenization — never send a raw PAN.
export const savedCardsApi = {
  list: () => apiFetch('/saved-cards'),
  save: (data) => apiFetch('/saved-cards', { method: 'POST', body: data }),
  get: (savedCardId) => apiFetch(`/saved-cards/${savedCardId}`),
  update: (savedCardId, data) => apiFetch(`/saved-cards/${savedCardId}`, { method: 'PUT', body: data }),
  remove: (savedCardId) => apiFetch(`/saved-cards/${savedCardId}`, { method: 'DELETE' }),
  setDefault: (savedCardId) => apiFetch(`/saved-cards/${savedCardId}/set-default`, { method: 'PATCH' }),
};
