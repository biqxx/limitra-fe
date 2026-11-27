// Typed wrappers around the real Limitra backend, grouped by resource.
// Source of truth: the live OpenAPI spec at https://api.limitra.com.ng/docs?api-docs.json
// (L5 Swagger). Re-fetch and diff that against this file if the backend changes —
// it's the "Limitra User Service API", so more groups (affiliate, admin, etc.)
// likely live in other services and aren't in this spec yet.
import { apiFetch } from './client';
import { API_BASE_URL } from './config';
import { storeSession, clearTokens, getToken } from '@/lib/auth';

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
  resendVerification: (data) => apiFetch('/resend-verification', { method: 'POST', body: data, auth: false }),
  otpRequest: (data) => apiFetch('/auth/otp/request', { method: 'POST', body: data, auth: false }),
  otpVerify: (data) => withSession(apiFetch('/auth/otp/verify', { method: 'POST', body: data, auth: false })),
  socialRedirect: (provider, params) => apiFetch(`/auth/social/${provider}/redirect`, { params, auth: false }),
  socialCallback: (provider, data) => withSession(apiFetch(`/auth/social/${provider}/callback`, { method: 'POST', body: data, auth: false })),
  dashboard: () => apiFetch('/account/dashboard'),
  changePassword: (data) => apiFetch('/account/password/change', { method: 'POST', body: data }),
  sessions: () => apiFetch('/account/sessions'),
  revokeSession: (sessionId) => apiFetch(`/account/sessions/${sessionId}`, { method: 'DELETE' }),
  connectedAccounts: () => apiFetch('/account/connected-accounts'),
  disconnectAccount: (platform) => apiFetch(`/account/connected-accounts/${platform}`, { method: 'DELETE' }),
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
  updateQty: (cartItemId, quantity) => apiFetch(`/cart-items/${cartItemId}`, { method: 'PATCH', body: { quantity } }),
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
  merge: (anonymousCartToken) => apiFetch('/cart/merge', { method: 'POST', body: anonymousCartToken ? { anonymous_cart_token: anonymousCartToken } : {} }),
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
  create: (data) => apiFetch('/admin/categories', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/admin/categories/${id}`, { method: 'PATCH', body: data }),
  remove: (id) => apiFetch(`/admin/categories/${id}`, { method: 'DELETE' }),
};

export const favoritesApi = {
  list: () => apiFetch('/favorites'),
  add: (productId, variantId) => apiFetch('/favorites', {
    method: 'POST',
    body: variantId != null ? { product_id: productId, variant_id: variantId } : { product_id: productId },
  }),
  get: (favoriteId) => apiFetch(`/favorites/${favoriteId}`),
  remove: (favoriteId) => apiFetch(`/favorites/${favoriteId}`, { method: 'DELETE' }),
  // body: { expires_in_days? } — generates a public link viewable via
  // sharedWishlistsApi.get() below, by anyone, with no auth.
  share: (data) => apiFetch('/favorites/share', { method: 'POST', body: data || {} }),
};

// Public (no auth — unlike everything else here, this route has no security
// requirement in the spec) view of a wishlist shared via favoritesApi.share().
export const sharedWishlistsApi = {
  get: (token) => apiFetch(`/shared-wishlists/${token}`, { auth: false }),
};

export const ordersApi = {
  list: (params) => apiFetch('/orders', { params }), // params: { status, from_date, to_date, q, per_page }
  get: (orderId) => apiFetch(`/orders/${orderId}`),
  // Spec claims no request body (order derived server-side from the caller's
  // active cart/quote) — wrong, confirmed live: requires quote_id (from
  // checkoutApi.quote()'s response, call that first), payment_method and
  // contact_email in the body. Idempotency-Key (8-100 chars) is REQUIRED to
  // avoid duplicate orders on retry; generate one per checkout attempt
  // (e.g. crypto.randomUUID()).
  create: (data, idempotencyKey) => apiFetch('/orders', {
    method: 'POST',
    body: data,
    headers: { 'Idempotency-Key': idempotencyKey },
  }),
  cancel: (orderId, reason) => apiFetch(`/orders/${orderId}/cancel`, { method: 'POST', body: { reason } }),
  tracking: (orderId) => apiFetch(`/orders/${orderId}/tracking`),
  invoice: (orderId) => apiFetch(`/orders/${orderId}/invoice`),
  buyAgain: (orderId, itemIds) => apiFetch(`/orders/${orderId}/buy-again`, { method: 'POST', body: itemIds ? { item_ids: itemIds } : {} }),
  updateDeliveryAddress: (orderId, addressId) => apiFetch(`/orders/${orderId}/delivery-address`, { method: 'PATCH', body: { address_id: addressId } }),
  requestReturn: (orderId, data) => apiFetch(`/orders/${orderId}/returns`, { method: 'POST', body: data }),
};

// Admin view of every customer's orders (ordersApi above is scoped to the
// caller's own). Response shapes are undocumented (generic SuccessResponse)
// like the rest of this API, but the request schemas here ARE documented and
// look real (unlike Delivery's empty `{}` ones) — still unverified live, so
// treat a 422 as more authoritative than this if one ever comes back.
export const adminOrdersApi = {
  // params: { from_date, to_date, user_id, status, payment_status, cancellation_code, q, sort_by, per_page }
  list: (params) => apiFetch('/admin/orders', { params }),
  get: (orderId) => apiFetch(`/admin/orders/${orderId}`),
  update: (orderId, data) => apiFetch(`/admin/orders/${orderId}`, { method: 'PATCH', body: data }),
  remove: (orderId) => apiFetch(`/admin/orders/${orderId}`, { method: 'DELETE' }),
  // body: { status: 'processing'|'in_transit'|'delivered', note*, location?, occurred_at? }
  updateStatus: (orderId, data) => apiFetch(`/admin/orders/${orderId}/status`, { method: 'PATCH', body: data }),
  // body: { courier*, tracking_number*, estimated_delivery_at?, location?, note? } — sets status to shipped
  ship: (orderId, data) => apiFetch(`/admin/orders/${orderId}/ship`, { method: 'POST', body: data }),
  shipRedStar: (orderId, data = {}) => apiFetch(`/admin/orders/${orderId}/ship/redstar`, { method: 'POST', body: data }),
  waybill: (orderId, mini = false) => apiFetch(`/admin/orders/${orderId}/waybill`, { params: { mini: mini ? 1 : 0 } }),
  // body: { amount*, method: 'original_payment'|'wallet', reason* }
  refund: (orderId, data) => apiFetch(`/admin/orders/${orderId}/refund`, { method: 'POST', body: data }),
};

export const adminTransactionsApi = {
  // params: { type: 'all'|'deposit'|'payment'|'order'|'refund', status, q, page, per_page }
  list: (params) => apiFetch('/admin/transactions', { params }),
};

// Real delivery methods for a cart/address — the actual identifiers to send
// as checkoutApi.quote()'s delivery_method differ by backend config, so they
// must come from here rather than being guessed. Response shape isn't in the
// spec either (generic SuccessResponse) — read it defensively at the call site.
export const deliveryApi = {
  options: (params) => apiFetch('/delivery/options', { params }),
};

export const redstarApi = {
  cities: () => apiFetch('/logistics/redstar/cities'),
  towns: (cityCode) => apiFetch(`/logistics/redstar/cities/${encodeURIComponent(cityCode)}/towns`),
  dropOffLocations: (cityCode) => apiFetch(`/logistics/redstar/cities/${encodeURIComponent(cityCode)}/drop-off-locations`),
  pickupTypes: () => apiFetch('/logistics/redstar/pickup-types'),
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
  remove: (zoneId) => apiFetch(`/admin/delivery-zones/${zoneId}`, { method: 'DELETE' }),
  setMethod: (zoneId, methodId, data) => apiFetch(`/admin/delivery-zones/${zoneId}/methods/${methodId}`, { method: 'PUT', body: data }),
};

export const adminDeliveryMethodsApi = {
  list: (params) => apiFetch('/admin/delivery-methods', { params }),
  create: (data) => apiFetch('/admin/delivery-methods', { method: 'POST', body: data }),
  update: (methodId, data) => apiFetch(`/admin/delivery-methods/${methodId}`, { method: 'PATCH', body: data }),
  remove: (methodId) => apiFetch(`/admin/delivery-methods/${methodId}`, { method: 'DELETE' }),
};

export const adminPickupLocationsApi = {
  list: (params) => apiFetch('/admin/pickup-locations', { params }),
  create: (data) => apiFetch('/admin/pickup-locations', { method: 'POST', body: data }),
  update: (pickupId, data) => apiFetch(`/admin/pickup-locations/${pickupId}`, { method: 'PATCH', body: data }),
  remove: (pickupId) => apiFetch(`/admin/pickup-locations/${pickupId}`, { method: 'DELETE' }),
};

// Returns (a customer's request to send items back, created via
// ordersApi.requestReturn) and refunds (the actual money-movement record —
// can also originate from a late payment, not just a return) are two
// related but separate admin resources. Request/response shapes here ARE
// documented in the spec (unlike most of this API), still unverified live.
export const adminReturnsApi = {
  // params: { status, resolution, q, from, to, per_page }
  list: (params) => apiFetch('/admin/returns', { params }),
  // body: { status*, reason?, items?, notes? } — status: approved|rejected|received|completed
  update: (returnId, data) => apiFetch(`/admin/returns/${returnId}`, { method: 'PATCH', body: data }),
  // body: { amount*, method: 'original_payment'|'wallet', reason* }
  refund: (returnId, data) => apiFetch(`/admin/returns/${returnId}/refund`, { method: 'POST', body: data }),
};

export const adminRefundsApi = {
  // params: { status, source, provider, attention_only, q, from, to, sort, direction, per_page }
  list: (params) => apiFetch('/admin/refunds', { params }),
  get: (refundId) => apiFetch(`/admin/refunds/${refundId}`),
  // body: { status: 'processed'|'failed', note*, provider_reference?, provider_refund_id?, processed_at? }
  resolve: (refundId, data) => apiFetch(`/admin/refunds/${refundId}/resolve`, { method: 'POST', body: data }),
  retry: (refundId) => apiFetch(`/admin/refunds/${refundId}/retry`, { method: 'POST', body: {} }),
};

// Support ticket thread — create/list/get/message/close are all customer-
// facing; admin has no separate "post a message" endpoint, so staff replies
// go through the same ticketsApi.message() below (the backend presumably
// distinguishes the sender from the auth'd user, not the route). Request
// bodies for create/message/close are undocumented (empty `{}` schemas).
export const supportTicketsApi = {
  list: (params) => apiFetch('/support/tickets', { params }), // params: { status, per_page }
  create: (data) => apiFetch('/support/tickets', { method: 'POST', body: data }), // { subject*, message* } — guessed
  get: (ticketId) => apiFetch(`/support/tickets/${ticketId}`),
  message: (ticketId, data) => apiFetch(`/support/tickets/${ticketId}/messages`, { method: 'POST', body: data }), // { message* } — guessed
  close: (ticketId) => apiFetch(`/support/tickets/${ticketId}/close`, { method: 'POST', body: {} }),
};

export const supportAttachmentsApi = {
  get: (attachmentId) => apiFetch(`/support/attachments/${attachmentId}`),
};

export const adminSupportTicketsApi = {
  list: (params) => apiFetch('/admin/support/tickets', { params }), // params: { page, per_page }
  get: (ticketId) => apiFetch(`/admin/support/tickets/${ticketId}`),
  // body: { status?, priority?, assignee_id? } — no enums documented, guessed
  update: (ticketId, data) => apiFetch(`/admin/support/tickets/${ticketId}`, { method: 'PATCH', body: data }),
  reply: (ticketId, data) => apiFetch(`/admin/support/tickets/${ticketId}/messages`, { method: 'POST', body: data }),
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
  // Defaulted to GET (wrong — spec says POST with a required, if empty, body);
  // never wired up to any UI yet, so this was dead code rather than a live bug.
  verifyDeposit: (reference) => apiFetch(`/wallet/deposits/${reference}/verify`, { method: 'POST', body: {} }),
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
  suggestions: (params) => apiFetch('/products/suggestions', { params, auth: false }),
  related: (productId) => apiFetch(`/products/${productId}/related`, { auth: false }),
  alternatives: (productId) => apiFetch(`/products/${productId}/alternatives`, { auth: false }),
  create: (data) => apiFetch('/products', { method: 'POST', body: data }), // admin
  get: (productId) => apiFetch(`/products/${productId}`),
  update: (productId, data) => apiFetch(`/products/${productId}`, { method: 'PATCH', body: data }), // admin
  remove: (productId) => apiFetch(`/products/${productId}`, { method: 'DELETE' }), // admin
};

export const adminProductsApi = {
  list: (params) => apiFetch('/admin/products', { params }),
  get: (productId) => apiFetch(`/admin/products/${productId}`),
  create: (data) => apiFetch('/admin/products', { method: 'POST', body: data }),
  update: (productId, data) => apiFetch(`/admin/products/${productId}`, { method: 'PATCH', body: data }),
  applyDiscount: (productId, data) => apiFetch(`/admin/products/${productId}/discount`, { method: 'POST', body: data }),
  removeDiscount: (productId) => apiFetch(`/admin/products/${productId}/discount`, { method: 'DELETE' }),
  remove: (productId) => apiFetch(`/admin/products/${productId}`, { method: 'DELETE' }),
  restore: (productId) => apiFetch(`/admin/products/${productId}/restore`, { method: 'POST' }),
  importTemplateUrl: () => `${API_BASE_URL}/products/import-template`,
  startImport: (formData) => apiFetch('/products/imports', { method: 'POST', body: formData }),
  getImport: (jobId) => apiFetch(`/products/imports/${jobId}`),
  cancelImport: (jobId) => apiFetch(`/products/imports/${jobId}/cancel`, { method: 'POST', body: {} }),
  retryImport: (jobId) => apiFetch(`/products/imports/${jobId}/retry`, { method: 'POST', body: {} }),
  importErrors: (jobId) => apiFetch(`/products/imports/${jobId}/errors`),
};

export const sourcingApi = {
  sources: () => apiFetch('/admin/sourcing/sources'),
  search: (params) => apiFetch('/admin/sourcing/search', { params }),
  enhance: (data) => apiFetch('/admin/sourcing/enhance', { method: 'POST', body: data }),
  jobs: (params) => apiFetch('/admin/sourcing/jobs', { params }),
  queue: (data) => apiFetch('/admin/sourcing/jobs', { method: 'POST', body: data }),
  deleteJob: (id) => apiFetch(`/admin/sourcing/jobs/${id}`, { method: 'DELETE' }),
  imports: (params) => apiFetch('/admin/sourcing/imports', { params }),
  import: (data) => apiFetch('/admin/sourcing/imports', { method: 'POST', body: data }),
  pricing: (productSourceId) => apiFetch(`/admin/sourcing/imports/${productSourceId}/pricing`),
  recalculatePrice: (productSourceId, data) => apiFetch(`/admin/sourcing/imports/${productSourceId}/pricing/recalculate`, { method: 'POST', body: data }),
  approvePrice: (productSourceId, quoteId) => apiFetch(`/admin/sourcing/imports/${productSourceId}/pricing/approve`, { method: 'POST', body: quoteId ? { quote_id: quoteId } : {} }),
};

export const businessSettingsApi = {
  list: (params) => apiFetch('/admin/settings', { params }),
  update: (settings) => apiFetch('/admin/settings', { method: 'PATCH', body: { settings } }),
  history: (id) => apiFetch(`/admin/settings/${id}/history`),
};

// Separate from the auth User record. update: { first_name, middle_name, last_name,
// avatar, phone, birthday, subscribe_to_newsletter }.
export const profileApi = {
  get: () => apiFetch('/profile'),
  update: (data) => apiFetch('/profile', { method: 'PATCH', body: data }),
  uploadAvatar: (formData) => apiFetch('/profile/avatar', { method: 'POST', body: formData }),
  deleteAvatar: () => apiFetch('/profile/avatar', { method: 'DELETE' }),
  verifyEmail: (data) => apiFetch('/profile/email/verify', { method: 'POST', body: data }),
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

// Elo, the AI shopping assistant (components/lucy/EloAI.jsx) — all auth-
// required (confirmed in the spec), so the widget needs a signed-in-only
// real flow and a guest fallback. Request schemas here ARE documented
// (unlike most of this API) but still unverified live.
export const aiConversationsApi = {
  create: (data) => apiFetch('/ai/conversations', { method: 'POST', body: data }), // { channel: 'web', context? }
  messages: (conversationId) => apiFetch(`/ai/conversations/${conversationId}/messages`),
  // { text*, client_message_id*, async?, images?, attachments? }
  sendMessage: (conversationId, data) => apiFetch(`/ai/conversations/${conversationId}/messages`, { method: 'POST', body: data }),
  handoff: (conversationId, reason) => apiFetch(`/ai/conversations/${conversationId}/handoff`, { method: 'POST', body: { reason: reason || undefined } }),
  remove: (conversationId) => apiFetch(`/ai/conversations/${conversationId}`, { method: 'DELETE' }),
  attachment: (conversationId, attachmentId) => apiFetch(`/ai/conversations/${conversationId}/attachments/${attachmentId}`),
};

export const adminAiApi = {
  metrics: () => apiFetch('/admin/ai/metrics'),
  getSettings: () => apiFetch('/admin/ai/settings'),
  // { primary_model?, fallback_model?, high_reasoning_model? }
  updateSettings: (data) => apiFetch('/admin/ai/settings', { method: 'PATCH', body: data }),
  listConversations: (params) => apiFetch('/admin/ai/conversations', { params }),
  getConversation: (conversationId) => apiFetch(`/admin/ai/conversations/${conversationId}`),
  // { status*, notes? } — no status enum documented
  updateConversation: (conversationId, data) => apiFetch(`/admin/ai/conversations/${conversationId}`, { method: 'PATCH', body: data }),
  listKnowledge: (params) => apiFetch('/admin/ai/knowledge', { params }),
  // { title*, content*, slug?, category?, metadata? }
  createKnowledge: (data) => apiFetch('/admin/ai/knowledge', { method: 'POST', body: data }),
  getKnowledge: (docId) => apiFetch(`/admin/ai/knowledge/${docId}`),
  updateKnowledge: (docId, data) => apiFetch(`/admin/ai/knowledge/${docId}`, { method: 'PATCH', body: data }),
  removeKnowledge: (docId) => apiFetch(`/admin/ai/knowledge/${docId}`, { method: 'DELETE' }),
  indexKnowledge: (docId) => apiFetch(`/admin/ai/knowledge/${docId}/index`, { method: 'POST', body: {} }),
};

export const adminUsersApi = {
  list: (params) => apiFetch('/admin/users', { params }),
  get: (userId) => apiFetch(`/admin/users/${userId}`),
  create: (data) => apiFetch('/admin/users', { method: 'POST', body: data }),
  updateRole: (userId, data) => apiFetch(`/admin/users/${userId}/role`, { method: 'PATCH', body: data }),
  updateStatus: (userId, data) => apiFetch(`/admin/users/${userId}/status`, { method: 'PATCH', body: data }),
  suspend: (userId, data) => apiFetch(`/admin/users/${userId}/suspend`, { method: 'POST', body: data || {} }),
  restore: (userId) => apiFetch(`/admin/users/${userId}/restore`, { method: 'POST', body: {} }),
  passwordReset: (userId) => apiFetch(`/admin/users/${userId}/password-reset`, { method: 'POST', body: {} }),
  remove: (userId) => apiFetch(`/admin/users/${userId}`, { method: 'DELETE' }),
};

export const adminRolesApi = {
  list: () => apiFetch('/admin/roles'),
  get: (roleId) => apiFetch(`/admin/roles/${roleId}`),
  create: (data) => apiFetch('/admin/roles', { method: 'POST', body: data }),
  update: (roleId, data) => apiFetch(`/admin/roles/${roleId}`, { method: 'PATCH', body: data }),
  remove: (roleId) => apiFetch(`/admin/roles/${roleId}`, { method: 'DELETE' }),
  permissions: () => apiFetch('/admin/permissions'),
  members: (roleId) => apiFetch(`/admin/roles/${roleId}/members`),
  addMember: (roleId, data) => apiFetch(`/admin/roles/${roleId}/members`, { method: 'POST', body: data }),
  removeMember: (roleId, userId) => apiFetch(`/admin/roles/${roleId}/members/${userId}`, { method: 'DELETE' }),
  invitations: () => apiFetch('/admin/staff/invitations'),
  inviteStaff: (data) => apiFetch('/admin/staff/invitations', { method: 'POST', body: data }),
  resendInvite: (inviteId) => apiFetch(`/admin/staff/invitations/${inviteId}/resend`, { method: 'POST', body: {} }),
  revokeInvite: (inviteId) => apiFetch(`/admin/staff/invitations/${inviteId}`, { method: 'DELETE' }),
  assignStaffRole: (userId, data) => apiFetch(`/admin/staff/${userId}/role`, { method: 'PATCH', body: data }),
};

export const adminAffiliatesApi = {
  list: (params) => apiFetch('/admin/affiliates', { params }),
  get: (id) => apiFetch(`/admin/affiliates/${id}`),
  create: (data) => apiFetch('/admin/affiliates', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/admin/affiliates/${id}`, { method: 'PATCH', body: data }),
  affiliateCommissions: (affiliateId, params) => apiFetch(`/admin/affiliates/${affiliateId}/commissions`, { params }),
  commissions: (params) => apiFetch('/admin/commissions', { params }),
  getCommission: (id) => apiFetch(`/admin/commissions/${id}`),
  updateCommission: (id, data) => apiFetch(`/admin/commissions/${id}`, { method: 'PATCH', body: data }),
  bulkUpdateCommissions: (data) => apiFetch('/admin/commissions/bulk-update', { method: 'POST', body: data }),
  applications: (params) => apiFetch('/admin/affiliate-applications', { params }),
  getApplication: (id) => apiFetch(`/admin/affiliate-applications/${id}`),
  approveApplication: (id) => apiFetch(`/admin/affiliate-applications/${id}/approve`, { method: 'POST', body: {} }),
  rejectApplication: (id, data) => apiFetch(`/admin/affiliate-applications/${id}/reject`, { method: 'POST', body: data || {} }),
  withdrawals: (params) => apiFetch('/admin/withdrawals', { params }),
  approveWithdrawal: (id) => apiFetch(`/admin/withdrawals/${id}/approve`, { method: 'POST', body: {} }),
  startProcessingWithdrawal: (id, data) => apiFetch(`/admin/withdrawals/${id}/start-processing`, { method: 'POST', body: data || {} }),
  rejectWithdrawal: (id, data) => apiFetch(`/admin/withdrawals/${id}/reject`, { method: 'POST', body: data || {} }),
  markPaidWithdrawal: (id) => apiFetch(`/admin/withdrawals/${id}/mark-paid`, { method: 'POST', body: {} }),
  resources: (params) => apiFetch('/admin/affiliate-resources', { params }),
  createResource: (data) => apiFetch('/admin/affiliate-resources', { method: 'POST', body: data }),
  deleteResource: (id) => apiFetch(`/admin/affiliate-resources/${id}`, { method: 'DELETE' }),
  rules: () => apiFetch('/admin/affiliate-rules'),
  updateRules: (data) => apiFetch('/admin/affiliate-rules', { method: 'PATCH', body: data }),
};

export const adminRewardsApi = {
  list: (params) => apiFetch('/admin/reward-campaigns', { params }),
  get: (id) => apiFetch(`/admin/reward-campaigns/${id}`),
  wins: (id, params) => apiFetch(`/admin/reward-campaigns/${id}/wins`, { params }),
  create: (data) => apiFetch('/admin/reward-campaigns', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/admin/reward-campaigns/${id}`, { method: 'PATCH', body: data }),
  remove: (id) => apiFetch(`/admin/reward-campaigns/${id}`, { method: 'DELETE' }),
};

// Only get/moderate/feature are real, documented endpoints — there's no
// admin-side create or plain update for a microstore (only the owner's own
// /my-microstore POST/PATCH do that).
export const adminMicrostoresApi = {
  list: (params) => apiFetch('/admin/microstores', { params }),
  get: (id) => apiFetch(`/admin/microstores/${id}`),
  moderate: (id, data) => apiFetch(`/admin/microstores/${id}/moderate`, { method: 'POST', body: data }),
  toggleFeatured: (id, data) => apiFetch(`/admin/microstores/${id}/feature`, { method: 'PATCH', body: data || {} }),
};

export const adminProcurementApi = {
  list: (params) => apiFetch('/admin/procurement/orders', { params }),
  get: (id) => apiFetch(`/admin/procurement/orders/${id}`),
  create: (data) => apiFetch('/admin/procurement/orders', { method: 'POST', body: data }),
  updateStatus: (id, data) => apiFetch(`/admin/procurement/orders/${id}/status`, { method: 'PATCH', body: data }),
  sync: (id) => apiFetch(`/admin/procurement/orders/${id}/sync`, { method: 'POST', body: {} }),
};

export const adminReviewsApi = {
  list: (params) => apiFetch('/admin/reviews', { params }),
  get: (id) => apiFetch(`/admin/reviews/${id}`),
  moderate: (id, data) => apiFetch(`/admin/reviews/${id}/moderate`, { method: 'PATCH', body: data }),
  remove: (id) => apiFetch(`/admin/reviews/${id}`, { method: 'DELETE' }),
};

export const adminCareersApi = {
  jobs: (params) => apiFetch('/admin/jobs', { params }),
  getJob: (id) => apiFetch(`/admin/jobs/${id}`),
  createJob: (data) => apiFetch('/admin/jobs', { method: 'POST', body: data }),
  updateJob: (id, data) => apiFetch(`/admin/jobs/${id}`, { method: 'PATCH', body: data }),
  removeJob: (id) => apiFetch(`/admin/jobs/${id}`, { method: 'DELETE' }),
  applications: (params) => apiFetch('/admin/job-applications', { params }),
  updateApplicationStatus: (id, data) => apiFetch(`/admin/job-applications/${id}`, { method: 'PATCH', body: data }),
  applicationCvUrl: (id) => `${API_BASE_URL}/admin/job-applications/${id}/cv`,
};

export const adminQueuesApi = {
  status: () => apiFetch('/admin/queue/status'),
  metrics: () => apiFetch('/admin/queue/metrics'),
  failed: (params) => apiFetch('/admin/queue/failed-jobs', { params }),
  retry: (id) => apiFetch(`/admin/queue/failed-jobs/${id}/retry`, { method: 'POST', body: {} }),
};

export const adminNotificationsApi = {
  list: (params) => apiFetch('/admin/notifications', { params }),
  unreadCount: () => apiFetch('/admin/notifications/unread-count'),
  markRead: (id) => apiFetch(`/admin/notifications/${id}/read`, { method: 'PATCH', body: {} }),
  markAllRead: () => apiFetch('/admin/notifications/read-all', { method: 'POST', body: {} }),
  settings: () => apiFetch('/admin/notification-settings'),
  updateSetting: (event, data) => apiFetch(`/admin/notification-settings/${event}`, { method: 'PATCH', body: data }),
};

export const adminMailLogsApi = {
  list: (params) => apiFetch('/admin/mail-preview', { params }),
};

export const adminPromotionsApi = {
  list: (params) => apiFetch('/admin/promotions', { params }),
  get: (id) => apiFetch(`/admin/promotions/${id}`),
  redemptions: (id, params) => apiFetch(`/admin/promotions/${id}/redemptions`, { params }),
  create: (data) => apiFetch('/admin/promotions', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/admin/promotions/${id}`, { method: 'PATCH', body: data }),
  remove: (id) => apiFetch(`/admin/promotions/${id}`, { method: 'DELETE' }),
};

export const adminContentApi = {
  list: (params) => apiFetch('/admin/content', { params }),
  get: (id) => apiFetch(`/admin/content/${id}`),
  create: (data) => apiFetch('/admin/content', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/admin/content/${id}`, { method: 'PUT', body: data }),
  publish: (id) => apiFetch(`/admin/content/${id}/publish`, { method: 'POST', body: {} }),
  contentRevisions: (id) => apiFetch(`/admin/content/${id}/revisions`),
  restoreContentRevision: (id, revisionId) => apiFetch(`/admin/content/${id}/revisions/${revisionId}/restore`, { method: 'POST', body: {} }),
  blogPosts: (params) => apiFetch('/admin/blog/posts', { params }),
  createBlogPost: (data) => apiFetch('/admin/blog/posts', { method: 'POST', body: data }),
  updateBlogPost: (id, data) => apiFetch(`/admin/blog/posts/${id}`, { method: 'PATCH', body: data }),
  publishBlogPost: (id) => apiFetch(`/admin/blog/posts/${id}/publish`, { method: 'POST', body: {} }),
  removeBlogPost: (id) => apiFetch(`/admin/blog/posts/${id}`, { method: 'DELETE' }),
  blogRevisions: (id) => apiFetch(`/admin/blog/posts/${id}/revisions`),
  restoreBlogRevision: (id, revisionId) => apiFetch(`/admin/blog/posts/${id}/revisions/${revisionId}/restore`, { method: 'POST', body: {} }),
  media: (params) => apiFetch('/admin/media', { params }),
  removeMedia: (id) => apiFetch(`/admin/media/${id}`, { method: 'DELETE' }),
  newsletter: (params) => apiFetch('/admin/newsletter/subscribers', { params }),
  removeSubscriber: (id) => apiFetch(`/admin/newsletter/subscribers/${id}`, { method: 'DELETE' }),
};

export const adminSystemApi = {
  dashboard: () => apiFetch('/admin/dashboard'),
  health: () => apiFetch('/admin/health'),
};

export const affiliateApi = {
  apply: (data) => apiFetch('/affiliate/applications', { method: 'POST', body: data }),
  applicationStatus: () => apiFetch('/affiliate/application'),
  dashboard: (params) => apiFetch('/affiliate/dashboard', { params }),
  analytics: (params) => apiFetch('/affiliate/analytics', { params }),
  tierHistory: (params) => apiFetch('/affiliate/tier-history', { params }),
  referrals: (params) => apiFetch('/affiliate/referrals', { params }),
  sales: (params) => apiFetch('/affiliate/sales', { params }),
  commissions: (params) => apiFetch('/affiliate/commissions', { params }),
  links: (params) => apiFetch('/affiliate/links', { params }),
  createLink: (data) => apiFetch('/affiliate/links', { method: 'POST', body: data }),
  deleteLink: (id) => apiFetch(`/affiliate/links/${id}`, { method: 'DELETE' }),
  linkAnalytics: (id) => apiFetch(`/affiliate/links/${id}/analytics`),
  promoCodes: (params) => apiFetch('/affiliate/promo-codes', { params }),
  createPromoCode: (data) => apiFetch('/affiliate/promo-codes', { method: 'POST', body: data }),
  deletePromoCode: (id) => apiFetch(`/affiliate/promo-codes/${id}`, { method: 'DELETE' }),
  payoutMethods: () => apiFetch('/affiliate/payout-methods'),
  createPayoutMethod: (data) => apiFetch('/affiliate/payout-methods', { method: 'POST', body: data }),
  verifyPayoutMethod: (data) => apiFetch('/affiliate/payout-methods/verify', { method: 'POST', body: data }),
  setDefaultPayoutMethod: (id) => apiFetch(`/affiliate/payout-methods/${id}/default`, { method: 'PATCH', body: {} }),
  deletePayoutMethod: (id) => apiFetch(`/affiliate/payout-methods/${id}`, { method: 'DELETE' }),
  withdrawals: (params) => apiFetch('/affiliate/withdrawals', { params }),
  requestWithdrawal: (data, idempotencyKey) => apiFetch('/affiliate/withdrawals', {
    method: 'POST',
    body: data,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  }),
  ledger: (params) => apiFetch('/affiliate/ledger', { params }),
  promotableProducts: (params) => apiFetch('/affiliate/promotable-products', { params }),
  resources: (params) => apiFetch('/affiliate/resources', { params }),
  downloadResource: async (id, filename) => {
    const token = getToken();
    const res = await fetch(`${API_BASE_URL}/affiliate/resources/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `resource-${id}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  settings: () => apiFetch('/affiliate/settings'),
  updateSettings: (data) => apiFetch('/affiliate/settings', { method: 'PATCH', body: data }),
};

export const newsletterApi = {
  subscribe: (data) => apiFetch('/newsletter/subscriptions', { method: 'POST', body: data }),
  unsubscribe: (data) => apiFetch('/newsletter/unsubscribe', { method: 'POST', body: data }),
};

export const adminAnalyticsApi = {
  overview: (params) => apiFetch('/analytics/overview', { params }),
  traffic: (params) => apiFetch('/analytics/traffic', { params }),
  sales: (params) => apiFetch('/analytics/sales', { params }),
  conversion: (params) => apiFetch('/analytics/conversion', { params }),
  products: (params) => apiFetch('/analytics/products', { params }),
  customers: (params) => apiFetch('/analytics/customers', { params }),
};

export const adminActivityApi = {
  list: (params) => apiFetch('/admin/activity', { params }),
  get: (id) => apiFetch(`/admin/activity/${id}`),
};

export const adminReportsApi = {
  list: (params) => apiFetch('/admin/reports', { params }),
  create: (data) => apiFetch('/admin/reports', { method: 'POST', body: data }),
  get: (id) => apiFetch(`/admin/reports/${id}`),
  retry: (id) => apiFetch(`/admin/reports/${id}/retry`, { method: 'POST', body: {} }),
  downloadUrl: (id) => `${API_BASE_URL}/admin/reports/${id}/download`,
};

export const adminInventoryApi = {
  list: (params) => apiFetch('/admin/inventory', { params }),
  adjustments: (params) => apiFetch('/admin/inventory/adjustments', { params }),
  storeAdjustment: (data) => apiFetch('/admin/inventory/adjustments', { method: 'POST', body: data }),
  adjustProduct: (productId, data) => apiFetch(`/admin/inventory/${productId}/adjust`, { method: 'POST', body: data }),
  updateThreshold: (productId, data) => apiFetch(`/admin/inventory/${productId}/threshold`, { method: 'PATCH', body: data }),
};

export const adminRewardCampaignsApi = {
  list: (params) => apiFetch('/admin/reward-campaigns', { params }),
  get: (id) => apiFetch(`/admin/reward-campaigns/${id}`),
  wins: (id, params) => apiFetch(`/admin/reward-campaigns/${id}/wins`, { params }),
  create: (data) => apiFetch('/admin/reward-campaigns', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/admin/reward-campaigns/${id}`, { method: 'PATCH', body: data }),
  remove: (id) => apiFetch(`/admin/reward-campaigns/${id}`, { method: 'DELETE' }),
};

export const adminVideosApi = {
  list: (params) => apiFetch('/admin/videos', { params }),
  create: (data) => apiFetch('/admin/videos', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/admin/videos/${id}`, { method: 'PATCH', body: data }),
  remove: (id) => apiFetch(`/admin/videos/${id}`, { method: 'DELETE' }),
};

export const reviewsApi = {
  list: (productId, params) => apiFetch(`/products/${productId}/reviews`, { params }),
  create: (productId, data) => apiFetch(`/products/${productId}/reviews`, { method: 'POST', body: data }),
  update: (reviewId, data) => apiFetch(`/reviews/${reviewId}`, { method: 'PATCH', body: data }),
  remove: (reviewId) => apiFetch(`/reviews/${reviewId}`, { method: 'DELETE' }),
  helpful: (reviewId) => apiFetch(`/reviews/${reviewId}/helpful`, { method: 'POST', body: {} }),
};

export const rewardsApi = {
  list: () => apiFetch('/rewards'),
  spin: (idempotencyKey) => {
    const key = idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `spin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    return apiFetch('/rewards/spin', { method: 'POST', body: {}, headers: { 'Idempotency-Key': key } });
  },
  redeem: (rewardId) => apiFetch(`/rewards/${rewardId}/redeem`, { method: 'POST', body: {} }),
};

export const referralsApi = {
  resolve: (code) => apiFetch('/referrals/resolve', { method: 'POST', body: { code } }),
  me: () => apiFetch('/referrals/me'),
  shareEvent: (data) => apiFetch('/referrals/share-events', { method: 'POST', body: data }),
  invitations: (params) => apiFetch('/referrals/invitations', { params }),
  invite: (data) => apiFetch('/referrals/invitations', { method: 'POST', body: data }),
};

export const microstoresApi = {
  list: (params) => apiFetch('/microstores', { params }),
  get: (slug) => apiFetch(`/microstores/${slug}`),
  products: (slug, params) => apiFetch(`/microstores/${slug}/products`, { params }),
  trackClick: (slug, data) => apiFetch(`/microstores/${slug}/clicks`, { method: 'POST', body: data || {} }),
  getChat: (slug) => apiFetch(`/microstores/${slug}/chat`),
  sendChatMessage: (slug, data) => apiFetch(`/microstores/${slug}/chat/messages`, { method: 'POST', body: data }),
};

export const myMicrostoreApi = {
  get: () => apiFetch('/my-microstore'),
  create: (data) => apiFetch('/my-microstore', { method: 'POST', body: data }),
  update: (data) => apiFetch('/my-microstore', { method: 'PATCH', body: data }),
  addProduct: (data) => apiFetch('/my-microstore/products', { method: 'POST', body: data }),
  updateProduct: (productId, data) => apiFetch(`/my-microstore/products/${productId}`, { method: 'PATCH', body: data }),
  removeProduct: (productId) => apiFetch(`/my-microstore/products/${productId}`, { method: 'DELETE' }),
  analytics: () => apiFetch('/my-microstore/analytics'),
  orders: (params) => apiFetch('/my-microstore/orders', { params }),
  bulkUpdateOrderStatus: (data) => apiFetch('/my-microstore/orders/bulk-status', { method: 'PATCH', body: data }),
  inventory: (params) => apiFetch('/my-microstore/inventory', { params }),
  customers: (params) => apiFetch('/my-microstore/customers', { params }),
  reviews: (params) => apiFetch('/my-microstore/reviews', { params }),
  earnings: () => apiFetch('/my-microstore/earnings'),
  withdrawals: (params) => apiFetch('/my-microstore/withdrawals', { params }),
  requestWithdrawal: (data) => apiFetch('/my-microstore/withdrawals', { method: 'POST', body: data }),
  transactions: (params) => apiFetch('/my-microstore/transactions', { params }),
  chats: (params) => apiFetch('/my-microstore/chats', { params }),
  getChat: (conversationId) => apiFetch(`/my-microstore/chats/${conversationId}`),
  replyChat: (conversationId, data) => apiFetch(`/my-microstore/chats/${conversationId}/messages`, { method: 'POST', body: data }),
};

// Mirrors myMicrostoreApi/microstoresApi exactly — the backend exposes the
// same endpoint set 1:1 under /my-celebrity-store and /celebrity-stores,
// same undocumented-field-names situation.
export const myCelebrityStoreApi = {
  get: () => apiFetch('/my-celebrity-store'),
  create: (data) => apiFetch('/my-celebrity-store', { method: 'POST', body: data }),
  update: (data) => apiFetch('/my-celebrity-store', { method: 'PATCH', body: data }),
  addProduct: (data) => apiFetch('/my-celebrity-store/products', { method: 'POST', body: data }),
  updateProduct: (productId, data) => apiFetch(`/my-celebrity-store/products/${productId}`, { method: 'PATCH', body: data }),
  removeProduct: (productId) => apiFetch(`/my-celebrity-store/products/${productId}`, { method: 'DELETE' }),
  analytics: () => apiFetch('/my-celebrity-store/analytics'),
  orders: (params) => apiFetch('/my-celebrity-store/orders', { params }),
  bulkUpdateOrderStatus: (data) => apiFetch('/my-celebrity-store/orders/bulk-status', { method: 'PATCH', body: data }),
  inventory: (params) => apiFetch('/my-celebrity-store/inventory', { params }),
  customers: (params) => apiFetch('/my-celebrity-store/customers', { params }),
  reviews: (params) => apiFetch('/my-celebrity-store/reviews', { params }),
  earnings: () => apiFetch('/my-celebrity-store/earnings'),
  withdrawals: (params) => apiFetch('/my-celebrity-store/withdrawals', { params }),
  requestWithdrawal: (data) => apiFetch('/my-celebrity-store/withdrawals', { method: 'POST', body: data }),
  transactions: (params) => apiFetch('/my-celebrity-store/transactions', { params }),
  chats: (params) => apiFetch('/my-celebrity-store/chats', { params }),
  getChat: (conversationId) => apiFetch(`/my-celebrity-store/chats/${conversationId}`),
  replyChat: (conversationId, data) => apiFetch(`/my-celebrity-store/chats/${conversationId}/messages`, { method: 'POST', body: data }),
};

export const celebrityStoresApi = {
  list: (params) => apiFetch('/celebrity-stores', { params }),
  get: (slug) => apiFetch(`/celebrity-stores/${slug}`),
  products: (slug, params) => apiFetch(`/celebrity-stores/${slug}/products`, { params }),
  trackClick: (slug, data) => apiFetch(`/celebrity-stores/${slug}/clicks`, { method: 'POST', body: data || {} }),
  getChat: (slug) => apiFetch(`/celebrity-stores/${slug}/chat`),
  sendChatMessage: (slug, data) => apiFetch(`/celebrity-stores/${slug}/chat/messages`, { method: 'POST', body: data }),
};

export const videosApi = {
  list: (params) => apiFetch('/videos', { params }),
  get: (id) => apiFetch(`/videos/${id}`),
  event: (id, data) => apiFetch(`/videos/${id}/events`, { method: 'POST', body: data }),
  eventsBatch: (data) => apiFetch('/videos/events/batch', { method: 'POST', body: data }),
};

export const careersApi = {
  jobs: (params) => apiFetch('/jobs', { params }),
  job: (slug) => apiFetch(`/jobs/${slug}`),
  apply: (jobId, formData) => apiFetch(`/jobs/${jobId}/applications`, { method: 'POST', body: formData }),
  applyOpen: (formData) => apiFetch('/jobs/open-applications', { method: 'POST', body: formData }),
};

export const privacyApi = {
  getConsents: () => apiFetch('/privacy/consents'),
  updateConsents: (data) => apiFetch('/privacy/consents', { method: 'PUT', body: data }),
  verifyAge: (data) => apiFetch('/age-verification', { method: 'POST', body: data }),
  exportData: () => apiFetch('/account/data-export', { method: 'POST', body: {} }),
  getExport: (id) => apiFetch(`/account/data-export/${id}`),
  downloadExportUrl: (id) => `${API_BASE_URL}/account/data-export/${id}/download`,
  requestDeletion: (data) => apiFetch('/account/deletion-request', { method: 'POST', body: data || {} }),
  cancelDeletion: () => apiFetch('/account/deletion-request', { method: 'DELETE' }),
};

export const userPreferencesApi = {
  get: () => apiFetch('/user-preferences'),
  update: (data) => apiFetch('/user-preferences', { method: 'PUT', body: data }),
};

export const staffInvitationsApi = {
  accept: (data) => apiFetch('/staff/invitations/accept', { method: 'POST', body: data }),
};

export const notificationsApi = {
  list: (params) => apiFetch('/notifications', { params }),
  unreadCount: () => apiFetch('/notifications/unread-count'),
  markRead: (id) => apiFetch(`/notifications/${id}/read`, { method: 'PATCH', body: {} }),
  readAll: () => apiFetch('/notifications/read-all', { method: 'POST', body: {} }),
  preferences: () => apiFetch('/notification-preferences'),
  updatePreferences: (data) => apiFetch('/notification-preferences', { method: 'PUT', body: data }),
};

export const returnsApi = {
  list: (params) => apiFetch('/returns', { params }),
  get: (id) => apiFetch(`/returns/${id}`),
  cancel: (id, data) => apiFetch(`/returns/${id}/cancel`, { method: 'POST', body: data || {} }),
};

export const contentApi = {
  home: () => apiFetch('/home', { auth: false }),
  page: (slug) => apiFetch(`/content/${slug}`, { auth: false }),
  blogPosts: (params) => apiFetch('/blog/posts', { params, auth: false }),
  blogPost: (slug) => apiFetch(`/blog/posts/${slug}`, { auth: false }),
  verifyUnsubscribe: (params) => apiFetch('/newsletter/unsubscribe/verify', { params, auth: false }),
};

export const publicSettingsApi = {
  get: () => apiFetch('/settings/public', { auth: false }),
};

export const analyticsApi = {
  track: (data) => apiFetch('/analytics/events', { method: 'POST', body: data, auth: false }),
};

export const clientErrorsApi = {
  report: (data) => apiFetch('/client-errors', { method: 'POST', body: data }),
};
