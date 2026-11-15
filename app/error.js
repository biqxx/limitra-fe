'use client';
/* Ported from legacy/500.html */
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { clientErrorsApi } from '@/lib/api/endpoints';

export default function GlobalError({ error, reset }) {
  const reportedRef = useRef(false);

  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    const page = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : 'unknown';
    const url = typeof window !== 'undefined' ? window.location.href : undefined;
    clientErrorsApi.report({
      page,
      url,
      message: error?.message ? String(error.message).slice(0, 900) : 'Unhandled client error',
      digest: error?.digest ? String(error.digest) : undefined,
    }).catch(() => {});
  }, [error]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <img src="/assets/logo.png" alt="Limitra" style={{ height: 30, margin: '0 auto 36px', display: 'block' }} />
        <div
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(80px, 18vw, 132px)', lineHeight: 0.9,
            letterSpacing: '-.04em', background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}
        >
          500
        </div>
        <h1 style={{ fontSize: 26, margin: '6px 0 10px' }}>Something went wrong</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 28, textWrap: 'pretty' }}>
          We hit an unexpected error on our end. It’s not you, it’s us. Our team has been notified. Please try again in a moment.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-lg" onClick={() => reset()}>Try again</button>
          <Link className="btn btn-outline btn-lg" href="/">Back to store</Link>
        </div>
        <div style={{ marginTop: 30, paddingTop: 24, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-faint)' }}>
          Still stuck? <Link style={{ color: 'var(--primary)', cursor: 'pointer' }} href="/help/contact">Contact our support team</Link> and we’ll help right away.
        </div>
      </div>
    </div>
  );
}
