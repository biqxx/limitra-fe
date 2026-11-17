'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { useStore } from '@/components/store/StoreProvider';
import { paymentsApi, walletApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { naira } from '@/lib/data';

const SUCCESS_STATUSES = new Set(['success', 'successful', 'succeeded', 'completed', 'paid']);
const FAILED_STATUSES = new Set(['failed', 'cancelled', 'canceled', 'abandoned', 'reversed', 'error']);

function PaymentCallbackContent() {
  const searchParams = useSearchParams();
  const { clearCart, loadWallet } = useStore();
  const ref = searchParams.get('reference') || searchParams.get('trxref') || searchParams.get('transaction_id') || searchParams.get('tx_ref') || '';
  const kindParam = searchParams.get('kind');
  const orderId = searchParams.get('order_id');
  const isDeposit = kindParam === 'deposit' || ref.startsWith('WLT-DEP-');

  const [state, setState] = useState('loading'); // loading | success | failed | pending
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ref) {
      setState('failed');
      setError('No payment reference was provided.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (isDeposit) {
          const res = await walletApi.verifyDeposit(ref);
          const dep = res?.deposit || res;
          const status = String(dep?.status || '').toLowerCase();
          if (cancelled) return;
          setDetails({
            reference: dep?.reference || ref,
            amount: dep?.amount ?? (dep?.amount_minor != null ? Number(dep.amount_minor) / 100 : null),
            status,
          });
          if (SUCCESS_STATUSES.has(status)) {
            await loadWallet?.();
            setState('success');
          } else if (FAILED_STATUSES.has(status)) {
            setState('failed');
          } else {
            setState('pending');
          }
        } else {
          const res = await paymentsApi.statusByReference(ref);
          const data = res?.data || res;
          const status = String(data?.status || '').toLowerCase();
          if (cancelled) return;
          setDetails({
            reference: data?.reference || ref,
            amount: data?.amount ?? null,
            status,
            orderId: orderId || data?.order_id,
          });
          if (SUCCESS_STATUSES.has(status)) {
            await clearCart?.().catch(() => {});
            setState('success');
          } else if (FAILED_STATUSES.has(status)) {
            setState('failed');
          } else {
            setState('pending');
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(messageFrom(err));
        setState('failed');
      }
    })();

    return () => { cancelled = true; };
  }, [ref, isDeposit, orderId, clearCart, loadWallet]);

  const iconName = state === 'success' ? 'check' : state === 'loading' || state === 'pending' ? 'clock' : 'info';
  const title =
    state === 'loading'
      ? 'Confirming your payment…'
      : state === 'success'
        ? (isDeposit ? 'Wallet deposit successful' : 'Payment successful')
        : state === 'pending'
          ? 'Payment is still processing'
          : (isDeposit ? 'Wallet deposit failed' : 'Payment failed');

  const subtitle =
    state === 'loading'
      ? 'Please wait while we verify your transaction with Paystack.'
      : error
        ? error
        : state === 'success'
          ? (isDeposit ? 'Your wallet has been credited and is ready to use at checkout.' : 'Your order payment has been confirmed.')
          : state === 'pending'
            ? 'Your transaction has not settled yet. Refresh in a moment or check your account.'
            : 'We could not confirm a successful payment for this transaction.';

  return (
    <div className="page page-fade">
      <div className="wrap" style={{ maxWidth: 560, paddingTop: 48, paddingBottom: 64 }}>
        <div className="acct-panel" style={{ textAlign: 'center', padding: '36px 28px' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              margin: '0 auto 16px',
              display: 'grid',
              placeItems: 'center',
              background: state === 'success' ? 'rgba(31, 138, 91, 0.12)' : state === 'failed' ? 'rgba(220, 38, 38, 0.12)' : 'var(--surface-2)',
              color: state === 'success' ? 'var(--success, #1f8a5b)' : state === 'failed' ? 'var(--danger, #dc2626)' : 'var(--text)',
            }}
          >
            <Icon name={iconName} size={26} />
          </div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>{title}</h1>
          <p className="muted" style={{ marginBottom: 20 }}>{subtitle}</p>

          {details && (
            <div style={{ textAlign: 'left', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '14px 0', marginBottom: 22, display: 'grid', gap: 8 }}>
              <div className="row between"><span className="muted">Reference</span><b>{details.reference}</b></div>
              {details.amount != null && (
                <div className="row between"><span className="muted">Amount</span><b>{naira(Number(details.amount))}</b></div>
              )}
              {details.status && (
                <div className="row between"><span className="muted">Status</span><b style={{ textTransform: 'capitalize' }}>{details.status}</b></div>
              )}
            </div>
          )}

          <div className="row" style={{ gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {isDeposit ? (
              <Link href="/account/wallet" className="btn btn-primary btn-sm">Go to Wallet</Link>
            ) : (
              <Link href="/account/orders" className="btn btn-primary btn-sm">View Orders</Link>
            )}
            {state !== 'success' && !isDeposit && (
              <Link href="/checkout" className="btn btn-ghost btn-sm">Return to Checkout</Link>
            )}
            <Link href="/" className="btn btn-ghost btn-sm">Back to Store</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<div className="page page-fade"><div className="wrap" style={{ padding: 48, textAlign: 'center' }}>Confirming your payment…</div></div>}>
      <PaymentCallbackContent />
    </Suspense>
  );
}
