'use client';
/* LIMITRA, Cart & Checkout flow — ported from legacy/pages-cart.jsx */
import { Fragment, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { useStore } from '@/components/store/StoreProvider';
import { Modal, AddressForm, Field } from '@/components/forms/Shared';
import { Thumb, REAL_IMG, QtyStepper, Breadcrumbs, EmptyState } from '@/components/ui/Shared';
import { naira, byId, unitPriceOf } from '@/lib/data';
import { ordersApi, checkoutApi, paymentsApi, promotionsApi, deliveryApi, pickupLocationsApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';

// Real payment_method values the backend accepts (POST /checkout/quote) — the
// UI's own radio values (card/transfer/cod) map to these at submit time.
const PAYMENT_METHOD_API = { card: 'card', transfer: 'bank_transfer', cod: 'cash_on_delivery' };

const SHIP_FEE = 3500;
const FREE_SHIP = 150000;

// Pickup only reliably works today when every pickup location is shown
// regardless of delivery-zone matching (zone/method admin config is still
// being set up and GET /delivery/options often comes back empty) — so it's
// offered as its own always-visible option alongside whatever real options
// /delivery/options returns, not gated behind one of those options being a
// zone-matched pickup method.
const PICKUP_METHOD_VALUE = '__pickup__';

export function OrderSummary({ items, promo, ship, children, cta, onCta, ctaIcon, useCredit, onToggleCredit }) {
  const { walletBalance } = useStore();
  const sub = items.reduce((s, it) => s + unitPriceOf(it, byId(it.id) || it.product) * it.qty, 0);
  const disc = promo ? Math.round(sub * promo.pct) : 0;
  const shipping = ship == null ? 0 : ship;
  const beforeCredit = Math.max(0, sub - disc) + shipping;
  const credit = useCredit ? Math.min(walletBalance, beforeCredit) : 0;
  const total = beforeCredit - credit;
  return (
    <aside className="summary card">
      <h3>Order summary</h3>
      <div className="sum-row"><span className="muted">Subtotal ({items.reduce((s, i) => s + i.qty, 0)} items)</span><b>{naira(sub)}</b></div>
      {disc > 0 && <div className="sum-row"><span className="muted">Discount <span className="badge badge-soft" style={{ marginLeft: 4 }}>{promo.code}</span></span><b style={{ color: 'var(--success)' }}>−{naira(disc)}</b></div>}
      <div className="sum-row"><span className="muted">Delivery</span>{shipping === 0 ? <b style={{ color: 'var(--success)' }}>Free</b> : <b>{naira(shipping)}</b>}</div>
      {children}
      {walletBalance > 0 && onToggleCredit && (
        <label className="credit-row">
          <input type="checkbox" checked={!!useCredit} onChange={e => onToggleCredit(e.target.checked)} />
          <span className="cbox"><Icon name="check" size={12} stroke={3} /></span>
          <span className="credit-label"><span className="credit-label-main">Apply Lim Cash <img src="/assets/limcash.png" alt="" className="limcash-ic sm" /></span><small className="muted">{naira(walletBalance)} available</small></span>
          {credit > 0 && <b style={{ color: 'var(--success)' }}>−{naira(credit)}</b>}
        </label>
      )}
      <div className="sum-total"><span>Total</span><span>{naira(total)}</span></div>
      {shipping > 0
        ? <p className="ship-hint"><Icon name="truck" size={14} /> Add {naira(FREE_SHIP - (sub - disc))} more for free delivery</p>
        : <p className="ship-hint ship-hint-free"><Icon name="truck" size={14} /> Standard delivery is currently free</p>}
      {cta && <button className="btn btn-primary btn-block btn-lg" onClick={() => onCta(total, credit)} style={{ marginTop: 16 }}>{ctaIcon && <Icon name={ctaIcon} size={18} />}{cta}</button>}
      <div className="sum-trust"><span><Icon name="lock" size={14} /> Secure checkout</span><span><Icon name="shield" size={14} /> Buyer protection</span></div>
    </aside>
  );
}

function PromoBox({ promo, setPromo, cartId }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [checking, setChecking] = useState(false);
  const apply = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    if (!cartId) { setErr('Sign in to apply a promo code'); return; }
    setChecking(true);
    try {
      // Response shape isn't documented (generic SuccessResponse) — read the
      // discount percentage defensively (as a whole number like 15, or
      // already a fraction like 0.15); falls back to 0 if neither is present,
      // the code still "applies" server-side at checkout either way, just
      // shown with no visible discount here.
      const res = await promotionsApi.validate(c, cartId);
      const raw = Number(res?.discount_percentage ?? res?.percentage ?? res?.pct ?? 0);
      const pct = raw > 1 ? raw / 100 : raw;
      setPromo({ code: c, pct });
      setErr('');
    } catch (e) {
      setErr(messageFrom(e));
      setPromo(null);
    } finally {
      setChecking(false);
    }
  };
  return (
    <div className="promo-box">
      <div className="v-label" style={{ marginBottom: 8 }}>Promo code</div>
      <div className="row" style={{ gap: 8 }}>
        <input className={'input' + (err ? ' err' : '')} placeholder="Enter code" value={code} onChange={e => { setCode(e.target.value); setErr(''); }} />
        <button className="btn btn-ghost" disabled={checking} onClick={apply} style={{ flex: 'none' }}>{checking ? 'Checking…' : 'Apply'}</button>
      </div>
      {err && <span className="err-msg" style={{ marginTop: 6, display: 'block' }}>{err}</span>}
      {promo && <span className="row" style={{ gap: 6, color: 'var(--success)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginTop: 8 }}><Icon name="check" size={14} stroke={3} /> {promo.code} applied</span>}
    </div>
  );
}

export function CartPage() {
  const { cart, setQty, removeItem, clearCart, go, toast, cartId, promo, setPromo } = useStore();
  const [useCredit, setUseCredit] = useState(false);
  useEffect(() => { try { setUseCredit(localStorage.getItem('lim_use_credit') === '1'); } catch (e) {} }, []);
  const toggleCredit = (v) => { setUseCredit(v); localStorage.setItem('lim_use_credit', v ? '1' : '0'); };

  if (cart.length === 0) {
    return (
      <div className="page page-fade"><div className="wrap">
        <Breadcrumbs items={[{ label: 'Home', to: ['home'] }, { label: 'Cart' }]} />
        <EmptyState icon="cart" title="Your cart is empty" body="Looks like you haven’t added anything yet. Explore the store and find something you’ll love." action="Start shopping" onAction={() => go('shop', 'all')} />
      </div></div>
    );
  }

  return (
    <div className="page page-fade"><div className="wrap">
      <Breadcrumbs items={[{ label: 'Home', to: ['home'] }, { label: 'Shopping cart' }]} />
      <div className="row between" style={{ margin: '8px 0 24px', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 30 }}>Shopping cart <span className="muted" style={{ fontWeight: 600, fontSize: 18 }}>· {cart.length} {cart.length === 1 ? 'item' : 'items'}</span></h1>
        <button className="link-btn" onClick={() => { clearCart(); toast('Cart cleared'); }}>Clear cart</button>
      </div>

      <div className="cart-layout">
        <div className="cart-items">
          {cart.map(it => {
            const p = byId(it.id) || it.product;
            if (!p) return null;
            return (
              <div className="cart-item" key={it.key}>
                <div className="ci-thumb" onClick={() => go('product', p.id)}><Thumb product={p} src={REAL_IMG[p.id]} /></div>
                <div className="ci-info">
                  <span className="pc-brand">{p.brand}</span>
                  <h4 onClick={() => go('product', p.id)} style={{ cursor: 'pointer' }}>{p.name}</h4>
                  <div className="ci-meta">
                    {Object.entries(it.variants || {}).map(([g, v]) => (
                      <span className="ci-tag" key={g}>{v.hex && <i style={{ background: v.hex }} />}{v.label}</span>
                    ))}
                    <span className="row" style={{ gap: 5, color: 'var(--success)' }}><Icon name="check" size={13} stroke={3} /> In stock</span>
                  </div>
                  <div className="ci-bottom">
                    <QtyStepper value={it.qty} onChange={q => setQty(it.key, q)} />
                    <button className="ci-remove" onClick={() => { removeItem(it.key); toast('Removed from cart'); }}><Icon name="trash" size={16} /> Remove</button>
                  </div>
                </div>
                <div className="ci-price">
                  {(() => {
                    const unit = unitPriceOf(it, p);
                    const onSale = p.was > unit;
                    return (
                      <>
                        {onSale ? <small className="ci-was">{naira(p.was * it.qty)}</small> : null}
                        <b className={onSale ? 'sale' : ''}>{naira(unit * it.qty)}</b>
                        {onSale ? <small className="ci-save">Save {naira((p.was - unit) * it.qty)}</small> : (it.qty > 1 ? <small className="muted">{naira(unit)} each</small> : null)}
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
          <button className="btn btn-ghost" onClick={() => go('shop', 'all')} style={{ marginTop: 8 }}><Icon name="chevleft" size={16} /> Continue shopping</button>
        </div>

        <OrderSummary items={cart} promo={promo} cta="Proceed to checkout" ctaIcon="lock" onCta={() => go('checkout')} useCredit={useCredit} onToggleCredit={toggleCredit}>
          <PromoBox promo={promo} setPromo={setPromo} cartId={cartId} />
        </OrderSummary>
      </div>
    </div></div>
  );
}

/* ---------------- CHECKOUT ---------------- */
const STEPS = [['Shipping', 'location'], ['Payment', 'card'], ['Review', 'check']];

function Stepper({ step }) {
  return (
    <div className="stepper">
      {STEPS.map(([label, ic], i) => (
        <Fragment key={i}>
          <div className={'step' + (i === step ? ' active' : '') + (i < step ? ' done' : '')}>
            <span className="step-dot">{i < step ? <Icon name="check" size={16} stroke={3} /> : <Icon name={ic} size={16} />}</span>
            <span className="step-label">{label}</span>
          </div>
          {i < STEPS.length - 1 && <span className={'step-line' + (i < step ? ' done' : '')} />}
        </Fragment>
      ))}
    </div>
  );
}

export function CheckoutPage() {
  const { cart, cartTotal, cartId, clearCart, go, toast, addresses, saveAddress, walletBalance, promo, user, isAuthenticated } = useStore();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [orderId, setOrderId] = useState(null);
  const [transferInfo, setTransferInfo] = useState(null); // real bank_transfer details, once we have them
  const [placing, setPlacing] = useState(false);
  const [resolvingReturn, setResolvingReturn] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [idemKey] = useState(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()));
  const [useCredit, setUseCreditState] = useState(false);
  useEffect(() => { try { setUseCreditState(localStorage.getItem('lim_use_credit') === '1'); } catch (e) {} }, []);
  const setUseCredit = (v) => { setUseCreditState(v); localStorage.setItem('lim_use_credit', v ? '1' : '0'); };
  const primaryAddr = addresses.find(a => a.is_default) || addresses[0];
  const [selAddr, setSelAddr] = useState(primaryAddr ? primaryAddr.id : null);
  const [email, setEmail] = useState(user?.email || '');
  useEffect(() => { if (user?.email) setEmail(e => e || user.email); }, [user]);
  const [method, setMethod] = useState(null);
  const [deliveryOptions, setDeliveryOptions] = useState([]);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');
  const [pickupLocations, setPickupLocations] = useState([]);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupError, setPickupError] = useState('');
  const [selectedPickup, setSelectedPickup] = useState(null);
  const [payMethod, setPayMethod] = useState('card');
  const [addrModal, setAddrModal] = useState(false);
  const [errs, setErrs] = useState({});

  const activeAddr = addresses.find(a => a.id === selAddr);
  const selectedOption = deliveryOptions.find(o => o.value === method);
  const hasRealPickup = deliveryOptions.some(o => o.isPickup);
  const isPickupMode = method === PICKUP_METHOD_VALUE || !!selectedOption?.isPickup;

  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  // addresses loads asynchronously, after selAddr's initial (synchronous,
  // one-time) useState default is already locked in — on a fresh page load
  // that default sees an empty addresses list and permanently settles on
  // null unless re-synced here once the real list arrives (or the
  // previously-selected address is later removed).
  useEffect(() => {
    if (addresses.length === 0) return;
    if (selAddr != null && addresses.some(a => a.id === selAddr)) return;
    const fallback = addresses.find(a => a.is_default) || addresses[0];
    if (fallback) setSelAddr(fallback.id);
  }, [addresses, selAddr]);

  // Real delivery options/fees for this cart+address — see deliveryApi.options
  // (lib/api/endpoints.js). Refetched on address change since fee/availability
  // plausibly vary by destination; response field names are undocumented, so
  // every field is read defensively under several plausible names. Waits for
  // selAddr too — firing with cart_id alone (no address_id/state/city) 422s.
  useEffect(() => {
    if (!cartId || !selAddr) return;
    let cancelled = false;
    (async () => {
      setDeliveryLoading(true);
      setDeliveryError('');
      try {
        const res = await deliveryApi.options({
          cart_id: cartId,
          address_id: selAddr || undefined,
          country: activeAddr?.country || 'NG',
          state: activeAddr?.state || undefined,
          city: activeAddr?.city || undefined,
        });
        let list = Array.isArray(res) ? res
          : (res?.data ?? res?.options ?? res?.items ?? res?.delivery_options ?? res?.methods ?? res?.results ?? res?.list ?? []);
        if (!Array.isArray(list)) list = [];
        // Zone-based response shapes ([{ zone, methods: [...] }, ...] or a
        // single { zone, methods: [...] }) nest the actual methods one level
        // deeper — flatten those into a plain list of methods.
        if (list.length && list.every(x => Array.isArray(x?.methods))) list = list.flatMap(z => z.methods);
        const normalized = list.map(o => {
          const label = o.name ?? o.label ?? o.title ?? 'Delivery option';
          return {
            value: String(o.code ?? o.method ?? o.slug ?? o.key ?? o.id ?? o.name ?? ''),
            label,
            sub: o.description ?? o.eta ?? o.duration ?? o.delivery_time ?? '',
            fee: Number(o.fee ?? o.price ?? o.amount ?? o.cost ?? 0),
            disabled: o.available === false || o.is_available === false || !!o.disabled,
            // No field in the undocumented response explicitly flags a pickup-type
            // method — inferred from its own type/flag fields or, failing that,
            // its label text, since "pickup" methods need a location picked from
            // GET /pickup-locations rather than just being delivered.
            isPickup: !!(o.type === 'pickup' || o.requires_pickup_location || o.is_pickup || /pickup|collect/i.test(label)),
          };
        }).filter(o => o.value);
        if (cancelled) return;
        if (normalized.length === 0) console.warn('[delivery] GET /delivery/options returned no usable options — raw response:', res);
        setDeliveryOptions(normalized);
        setMethod(prev => {
          if (prev && normalized.some(o => o.value === prev)) return prev;
          return (normalized.find(o => !o.disabled) || normalized[0])?.value ?? null;
        });
      } catch (e) {
        if (!cancelled) setDeliveryError(messageFrom(e));
      } finally {
        if (!cancelled) setDeliveryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cartId, selAddr, activeAddr?.country, activeAddr?.state, activeAddr?.city]);

  // Every pickup location is fetched unconditionally, with no address/zone
  // filter — delivery-zone/method admin config is still being set up and
  // GET /delivery/options often comes back empty, so pickup is offered as
  // its own standalone option (see PICKUP_METHOD_VALUE) rather than gated
  // behind a zone-matched pickup method actually showing up there.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPickupLoading(true);
      setPickupError('');
      try {
        const res = await pickupLocationsApi.list();
        let list = Array.isArray(res) ? res
          : (res?.data ?? res?.locations ?? res?.items ?? res?.options ?? res?.results ?? res?.list ?? []);
        if (!Array.isArray(list)) list = [];
        const normalized = list.filter(o => o.active !== false).map(o => ({
          id: o.id ?? o.code ?? o.slug ?? o.key,
          name: o.name ?? o.label ?? o.title ?? 'Pickup location',
          address: o.line1 ?? o.address ?? o.description ?? [o.city, o.state].filter(Boolean).join(', '),
        })).filter(o => o.id != null);
        if (cancelled) return;
        if (normalized.length === 0) console.warn('[pickup] GET /pickup-locations returned no usable locations — raw response:', res);
        setPickupLocations(normalized);
        setSelectedPickup(prev => (prev && normalized.some(o => o.id === prev)) ? prev : (normalized[0]?.id ?? null));
      } catch (e) {
        if (!cancelled) setPickupError(messageFrom(e));
      } finally {
        if (!cancelled) setPickupLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Returning from a payment gateway's hosted page (card/bank_transfer
  // redirect via `callback_url`). The exact query param a gateway appends
  // isn't documented anywhere in this app — `reference`/`trxref` (Paystack)
  // and `transaction_id`/`tx_ref` (Flutterwave) are checked defensively
  // since either is plausible. The order itself already exists (created
  // before the redirect); this only confirms whether payment succeeded.
  useEffect(() => {
    const ref = searchParams.get('reference') || searchParams.get('trxref') || searchParams.get('transaction_id') || searchParams.get('tx_ref');
    if (!ref) return;
    const retOrderId = searchParams.get('order_id');
    (async () => {
      setResolvingReturn(true);
      try {
        const status = await paymentsApi.statusByReference(ref);
        const raw = String(status?.status ?? status?.data?.status ?? '').toLowerCase();
        const ok = ['success', 'successful', 'succeeded', 'completed', 'paid'].includes(raw);
        if (ok) {
          await clearCart();
          setOrderId(retOrderId || status?.order_id || ref);
        } else {
          setPlaceError(raw ? `Payment ${raw} — you can try again from your cart.` : 'We couldn’t confirm this payment. Check your orders page or try again.');
        }
      } catch (e) {
        setPlaceError(messageFrom(e));
      } finally {
        setResolvingReturn(false);
      }
    })();
  }, [searchParams]);

  if (resolvingReturn) {
    return (
      <div className="page page-fade"><div className="wrap">
        <EmptyState icon="lock" title="Confirming your payment…" body="This only takes a moment." />
      </div></div>
    );
  }

  if (!isAuthenticated && !orderId) {
    return (
      <div className="page page-fade"><div className="wrap">
        <EmptyState icon="user" title="Sign in to check out" body="Orders are tied to your account — sign in to continue." action="Sign in" onAction={() => go('auth', 'signin')} />
      </div></div>
    );
  }

  if (cart.length === 0 && !orderId) {
    return (
      <div className="page page-fade"><div className="wrap">
        <EmptyState icon="cart" title="Nothing to check out" body="Your cart is empty. Add a few products first." action="Browse products" onAction={() => go('shop', 'all')} />
      </div></div>
    );
  }

  const addNewAddress = async (d) => { const created = await saveAddress(d); setSelAddr(created.id); setAddrModal(false); };

  const validateShip = () => {
    const e = {};
    if (!activeAddr) e.addr = 'Select or add a delivery address';
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Enter a valid email';
    if (!method) e.method = 'Select a delivery method';
    if (isPickupMode && !selectedPickup) e.pickup = 'Select a pickup location';
    setErrs(e); return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 0 && !validateShip()) return;
    setStep(s => s + 1);
  };

  const placeOrder = async () => {
    if (placing) return;
    setPlacing(true);
    setPlaceError('');
    const apiMethod = PAYMENT_METHOD_API[payMethod];
    try {
      // Quote prices the cart against the chosen address/method/promo/credit
      // and returns a quote_id; ordersApi.create() then needs that quote_id
      // plus payment_method/contact_email in its own body — contrary to the
      // spec, which claims no request body at all (confirmed live: order
      // creation 422s without them). See lib/api/endpoints.js.
      const quote = await checkoutApi.quote({
        cart_id: cartId,
        address_id: selAddr,
        // PICKUP_METHOD_VALUE is a local sentinel (no zone-matched pickup
        // method is guaranteed to exist) — 'pickup' is sent instead, matching
        // the `type` value confirmed required on admin delivery methods.
        delivery_method: method === PICKUP_METHOD_VALUE ? 'pickup' : method,
        // Not in the documented quote schema, but sent defensively when a
        // pickup-type method is selected — see the pickup-locations effect.
        pickup_location_id: isPickupMode ? selectedPickup || undefined : undefined,
        payment_method: apiMethod,
        promotion_code: promo?.code || undefined,
        use_wallet_credit: useCredit || undefined,
      });
      const quoteId = quote?.quote_id ?? quote?.id ?? quote?.data?.quote_id ?? quote?.data?.id;
      const order = await ordersApi.create({
        quote_id: quoteId,
        payment_method: apiMethod,
        contact_email: email,
      }, idemKey);
      const newOrderId = order?.id ?? order?.order_id ?? order?.order_number ?? order?.data?.id ?? null;

      // The order exists from here on regardless of payment outcome — the
      // cart's job is done (re-quoting the same items into a second order
      // would be wrong), so it's cleared now rather than only on confirmed
      // payment.
      await clearCart();

      if (apiMethod === 'cash_on_delivery') {
        setOrderId(newOrderId ?? idemKey);
        toast('Order placed successfully!');
        return;
      }

      const callbackUrl = new URL('/checkout', window.location.origin);
      if (newOrderId) callbackUrl.searchParams.set('order_id', newOrderId);
      // Response shape isn't documented (generic SuccessResponse) — read a
      // hosted-page redirect URL defensively under any plausible field name.
      const payment = await paymentsApi.initialize({
        order_id: newOrderId,
        method: apiMethod,
        callback_url: callbackUrl.toString(),
      }, idemKey + '-pay');
      const redirectUrl = payment?.authorization_url ?? payment?.payment_url ?? payment?.checkout_url ?? payment?.url ?? payment?.data?.authorization_url;
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return; // navigating away
      }

      if (apiMethod === 'bank_transfer') {
        const info = {
          bank: payment?.bank_name ?? payment?.account?.bank_name,
          account: payment?.account_number ?? payment?.account?.account_number,
          name: payment?.account_name ?? payment?.account?.account_name,
          amount: payment?.amount ?? payment?.data?.amount,
          reference: payment?.reference ?? payment?.payment_reference ?? payment?.data?.reference,
        };
        if (info.account) {
          setTransferInfo(info);
          setOrderId(newOrderId ?? idemKey);
          return;
        }
      }

      // The order itself was created successfully (and the cart's already
      // cleared above) even though we got neither a payment redirect nor
      // usable transfer details back — show the real confirmation rather
      // than leave the customer on a now-empty checkout page with only an
      // error banner. Payment can still be completed later from the orders
      // page; Idempotency-Key means retrying "Place order" won't double-create it.
      setOrderId(newOrderId ?? idemKey);
      toast('Order placed successfully!');
    } catch (err) {
      setPlaceError(messageFrom(err));
    } finally {
      setPlacing(false);
    }
  };

  if (orderId) return <OrderSuccess orderId={orderId} email={email} eta={isPickupMode ? 'Ready for pickup' : selectedOption?.sub} pending={!!transferInfo} transferInfo={transferInfo} />;

  const shipFee = isPickupMode ? 0 : (selectedOption?.fee ?? 0);
  const methodLabel = isPickupMode ? 'Pickup station (Free)' : (selectedOption ? `${selectedOption.label}${selectedOption.sub ? ' · ' + selectedOption.sub : ''}${selectedOption.fee === 0 ? ' (Free)' : ''}` : '');

  return (
    <div className="page page-fade"><div className="wrap page-narrow">
      <Breadcrumbs items={[{ label: 'Home', to: ['home'] }, { label: 'Cart', to: ['cart'] }, { label: 'Checkout' }]} />
      <h1 style={{ fontSize: 28, margin: '6px 0 26px' }}>Checkout</h1>
      <Stepper step={step} />

      <div className="checkout-layout">
        <div className="checkout-main">
          {step === 0 && (
            <div className="co-card card">
              <div className="row between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <h3 className="co-h" style={{ marginBottom: 0 }}>Delivery address</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setAddrModal(true)}><Icon name="plus" size={15} /> Add new address</button>
              </div>
              {errs.addr && <span className="err-msg" style={{ marginBottom: 10, display: 'block' }}>{errs.addr}</span>}
              {addresses.length === 0 ? (
                <button className="addr-add" onClick={() => setAddrModal(true)} style={{ width: '100%', minHeight: 120 }}><Icon name="plus" size={24} /><span>Add a delivery address</span></button>
              ) : (
                <div className="addr-select">
                  {addresses.map(a => (
                    <label key={a.id} className={'addr-pick' + (selAddr === a.id ? ' on' : '')}>
                      <input type="radio" name="addr" checked={selAddr === a.id} onChange={() => setSelAddr(a.id)} />
                      <span className="rc-radio" />
                      <div className="ap-body">
                        <div className="row" style={{ gap: 8 }}><b>{a.recipient_name || (a.type === 'billing' ? 'Billing address' : 'Delivery address')}</b>{a.is_default && <span className="badge badge-soft" style={{ fontSize: 10 }}>Default</span>}</div>
                        {a.phone && <p className="muted" style={{ fontSize: 12.5 }}>{a.phone}</p>}
                        <p className="muted">{[a.line1 ?? a.address_line_1, a.line2 ?? a.address_line_2].filter(Boolean).join(', ')}, {a.city}{a.state ? ', ' + a.state : ''}</p>
                        {a.landmark && <p className="muted" style={{ fontSize: 12.5 }}>Near {a.landmark}</p>}
                      </div>
                      <button type="button" className="ap-edit" onClick={(e) => { e.preventDefault(); setSelAddr(a.id); setAddrModal('edit-' + a.id); }} title="Edit"><Icon name="edit" size={15} /></button>
                    </label>
                  ))}
                </div>
              )}

              <h4 className="co-sub">Contact email</h4>
              <Field label="Order updates will be sent here" full value={email} onChange={setEmail} err={errs.email} placeholder="you@email.com" />

              <h4 className="co-sub">Delivery method</h4>
              {errs.method && <span className="err-msg" style={{ marginBottom: 10, display: 'block' }}>{errs.method}</span>}
              {(deliveryLoading || (!selAddr && addresses.length > 0)) && <p className="muted" style={{ marginBottom: 10 }}>Loading delivery options…</p>}
              {deliveryError && (
                <div className="co-note" style={{ color: 'var(--danger)', marginBottom: 10 }}>
                  <Icon name="info" size={17} />{deliveryError}
                </div>
              )}
              {deliveryOptions.length === 0 && pickupLocations.length === 0 && !deliveryLoading && !pickupLoading ? (
                <p className="muted">No delivery options are available for this address.</p>
              ) : (
                <div className="radio-cards">
                  {deliveryOptions.map(o => (
                    <label key={o.value} className={'radio-card' + (method === o.value ? ' on' : '') + (o.disabled ? ' disabled' : '')}>
                      <input type="radio" name="ship" checked={method === o.value} disabled={o.disabled} onChange={() => !o.disabled && setMethod(o.value)} />
                      <span className="rc-radio" />
                      <div className="rc-body"><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</div>
                      {o.disabled ? <span className="rc-soon">Unavailable</span> : <span className="rc-price">{o.fee === 0 ? 'Free' : naira(o.fee)}</span>}
                    </label>
                  ))}
                  {!hasRealPickup && pickupLocations.length > 0 && (
                    <label className={'radio-card' + (method === PICKUP_METHOD_VALUE ? ' on' : '')}>
                      <input type="radio" name="ship" checked={method === PICKUP_METHOD_VALUE} onChange={() => setMethod(PICKUP_METHOD_VALUE)} />
                      <span className="rc-radio" />
                      <div className="rc-body"><b>Pickup station</b><small>Collect from any available location</small></div>
                      <span className="rc-price">Free</span>
                    </label>
                  )}
                </div>
              )}

              {isPickupMode && (
                <div style={{ marginTop: 16 }}>
                  <h4 className="co-sub">Pickup location</h4>
                  {errs.pickup && <span className="err-msg" style={{ marginBottom: 10, display: 'block' }}>{errs.pickup}</span>}
                  {pickupLoading ? (
                    <p className="muted">Loading pickup locations…</p>
                  ) : pickupError ? (
                    <div className="co-note" style={{ color: 'var(--danger)' }}>
                      <Icon name="info" size={17} />{pickupError}
                    </div>
                  ) : pickupLocations.length === 0 ? (
                    <p className="muted">No pickup locations are available for this address.</p>
                  ) : (
                    <div className="radio-cards">
                      {pickupLocations.map(p => (
                        <label key={p.id} className={'radio-card' + (selectedPickup === p.id ? ' on' : '')}>
                          <input type="radio" name="pickup" checked={selectedPickup === p.id} onChange={() => setSelectedPickup(p.id)} />
                          <span className="rc-radio" />
                          <div className="rc-body"><b>{p.name}</b>{p.address && <small>{p.address}</small>}</div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="co-card card">
              <h3 className="co-h">Payment method</h3>
              <div className="radio-cards">
                {[['card', 'card', 'Credit / Debit card', 'Visa, Mastercard, Verve'], ['transfer', 'dollar', 'Bank transfer', 'Pay by direct bank transfer'], ['cod', 'truck', 'Pay on delivery', 'Cash or POS at your door']].map(([val, ic, t, sub]) => (
                  <label key={val} className={'radio-card' + (payMethod === val ? ' on' : '')}>
                    <input type="radio" name="pay" checked={payMethod === val} onChange={() => setPayMethod(val)} />
                    <span className="rc-radio" />
                    <span className="rc-ic"><Icon name={ic} size={19} /></span>
                    <div className="rc-body"><b>{t}</b><small>{sub}</small></div>
                  </label>
                ))}
              </div>

              {payMethod === 'card' && (
                <div className="co-note" style={{ marginTop: 18 }}><Icon name="lock" size={17} />You’ll securely enter your card details on the next screen.</div>
              )}
              {payMethod === 'transfer' && (
                <div className="co-note" style={{ marginTop: 18 }}><Icon name="info" size={17} />You’ll get the account details to transfer to once you place your order.</div>
              )}
              {payMethod === 'cod' && <div className="co-note"><Icon name="info" size={17} />Have the exact amount ready. Our rider accepts cash and card on delivery.</div>}
            </div>
          )}

          {step === 2 && (
            <div className="co-card card">
              <h3 className="co-h">Review your order</h3>
              <div className="review-block">
                <div className="rb-head"><span><Icon name="location" size={16} /> Delivery to</span><button className="link-btn" onClick={() => setStep(0)}>Edit</button></div>
                {activeAddr && <p><b>{activeAddr.recipient_name || (activeAddr.type === 'billing' ? 'Billing address' : 'Delivery address')}</b>{activeAddr.phone && <> · {activeAddr.phone}</>}<br />{[activeAddr.line1 ?? activeAddr.address_line_1, activeAddr.line2 ?? activeAddr.address_line_2].filter(Boolean).join(', ')}, {activeAddr.city}{activeAddr.state ? ', ' + activeAddr.state : ''}<br />{email}</p>}
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{methodLabel}</div>
                {isPickupMode && (() => { const p = pickupLocations.find(l => l.id === selectedPickup); return p ? <div className="muted" style={{ fontSize: 13 }}>Pickup at: <b>{p.name}</b>{p.address ? ` — ${p.address}` : ''}</div> : null; })()}
              </div>
              <div className="review-block">
                <div className="rb-head"><span><Icon name="card" size={16} /> Payment</span><button className="link-btn" onClick={() => setStep(1)}>Edit</button></div>
                <p>{{ card: 'Credit / Debit card', transfer: 'Bank transfer', cod: 'Pay on delivery' }[payMethod]}</p>
              </div>
              <div className="review-block">
                <div className="rb-head"><span><Icon name="bag" size={16} /> {cart.reduce((s, i) => s + i.qty, 0)} items</span><button className="link-btn" onClick={() => go('cart')}>Edit cart</button></div>
                <div className="review-items">
                  {cart.map(it => { const p = byId(it.id) || it.product; if (!p) return null; return (
                    <div className="rev-item" key={it.key}>
                      <div className="rev-item-thumb"><Thumb product={p} src={REAL_IMG[p.id]} /></div>
                      <span className="rev-item-name">{p.name}<small className="muted"> × {it.qty}</small></span>
                      <b>{naira(unitPriceOf(it, p) * it.qty)}</b>
                    </div>
                  ); })}
                </div>
              </div>
              {(() => {
                const disc = promo ? Math.round(cartTotal * promo.pct) : 0;
                const beforeCredit = Math.max(0, cartTotal - disc) + shipFee;
                const credit = useCredit ? Math.min(walletBalance, beforeCredit) : 0;
                const total = beforeCredit - credit;
                return (
                  <div className="review-block review-totals">
                    <div className="rb-head"><span><Icon name="dollar" size={16} /> Order total</span></div>
                    <div className="rev-tot-row"><span className="muted">Subtotal</span><b>{naira(cartTotal)}</b></div>
                    {disc > 0 && <div className="rev-tot-row"><span className="muted">Discount <span className="badge badge-soft" style={{ marginLeft: 4 }}>{promo.code}</span></span><b style={{ color: 'var(--success)' }}>−{naira(disc)}</b></div>}
                    <div className="rev-tot-row"><span className="muted">Delivery</span>{shipFee === 0 ? <b style={{ color: 'var(--success)' }}>Free</b> : <b>{naira(shipFee)}</b>}</div>
                    {credit > 0 && <div className="rev-tot-row"><span className="muted"><img src="/assets/limcash.png" alt="" className="limcash-ic sm" /> Lim Cash applied</span><b style={{ color: 'var(--success)' }}>−{naira(credit)}</b></div>}
                    <div className="rev-tot-row rev-tot-grand"><span>Total</span><b>{naira(total)}</b></div>
                  </div>
                );
              })()}
            </div>
          )}

          {placeError && <span className="err-msg" style={{ display: 'block', marginBottom: 12 }}>{placeError}</span>}
          <div className="co-nav">
            <button className="btn btn-ghost" onClick={() => step === 0 ? go('cart') : setStep(s => s - 1)}><Icon name="chevleft" size={16} /> {step === 0 ? 'Back to cart' : 'Back'}</button>
            {step < 2
              ? <button className="btn btn-primary btn-lg" onClick={next}>Continue <Icon name="arrowr" size={17} /></button>
              : <button className="btn btn-accent btn-lg" disabled={placing} onClick={placeOrder}><Icon name="lock" size={17} /> {placing ? 'Placing order…' : 'Place order'}</button>}
          </div>
        </div>

        <OrderSummary items={cart} promo={promo} ship={shipFee} useCredit={useCredit} onToggleCredit={setUseCredit} />
      </div>

      {addrModal && (
        <Modal title={typeof addrModal === 'string' && addrModal.startsWith('edit-') ? 'Edit address' : 'Add a new address'} sub="Where should we deliver your order?" onClose={() => setAddrModal(false)}>
          <AddressForm
            initial={typeof addrModal === 'string' && addrModal.startsWith('edit-') ? addresses.find(a => a.id === Number(addrModal.slice(5))) : null}
            onSave={async (d) => { if (d.id) { await saveAddress(d); setSelAddr(d.id); setAddrModal(false); } else { await addNewAddress(d); } }}
            onCancel={() => setAddrModal(false)} />
        </Modal>
      )}
    </div></div>
  );
}

export function OrderSuccess({ orderId, email, eta, pending, transferInfo }) {
  const { go, toast } = useStore();
  const [copied, setCopied] = useState('');
  eta = eta || 'Delivery timing will be confirmed on your order page';
  const copy = (txt, key) => { navigator.clipboard?.writeText(txt); setCopied(key); toast('Copied'); setTimeout(() => setCopied(''), 1600); };
  return (
    <div className="page page-fade"><div className="wrap">
      <div className="success-screen">
        <div className="success-check"><Icon name={pending ? 'info' : 'check'} size={48} stroke={3} /></div>
        <h1>{pending ? 'Order placed — awaiting payment' : 'Order confirmed!'}</h1>
        <p className="muted">{pending
          ? 'We’ll process your order as soon as your bank transfer is confirmed.'
          : <>Thank you for your order. A confirmation has been sent to <b>{email || 'your email'}</b>.</>}</p>
        {pending && transferInfo && (
          <div className="success-card card" style={{ textAlign: 'left', marginBottom: 16 }}>
            <p className="muted" style={{ marginBottom: 10 }}>Transfer the exact amount to:</p>
            <div className="xfer-rows">
              {[['Bank', transferInfo.bank, 'bank'], ['Account number', transferInfo.account, 'acct'], ['Account name', transferInfo.name, 'name'], ['Amount', transferInfo.amount != null ? naira(Number(transferInfo.amount)) : null, 'amt'], ['Reference', transferInfo.reference, 'ref']]
                .filter(([, value]) => value)
                .map(([label, value, key]) => (
                  <div className="xfer-row" key={key}>
                    <span className="muted">{label}</span>
                    <div className="xfer-val">
                      <b className={key === 'acct' ? 'mono lg' : ''}>{value}</b>
                      <button className="xfer-copy" onClick={() => copy(value, key)} aria-label={'Copy ' + label}>
                        <Icon name={copied === key ? 'check' : 'copy'} size={14} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
        <div className="success-card card">
          <div className="row between"><span className="muted">Order number</span><b style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{orderId}</b></div>
          {!pending && <div className="row between" style={{ marginTop: 12 }}><span className="muted">Estimated delivery</span><b style={{ color: 'var(--success)' }}>{eta}</b></div>}
        </div>
        <div className="row" style={{ gap: 12, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-lg" onClick={() => go('tracking', orderId)}><Icon name="truck" size={18} /> Track order</button>
          <button className="btn btn-outline btn-lg" onClick={() => go('shop', 'all')}>Continue shopping</button>
        </div>
      </div>
    </div></div>
  );
}
