'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { contentApi, newsletterApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';

function UnsubscribeInner() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const emailParam = params.get('email') || '';
  const [email, setEmail] = useState(emailParam);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    contentApi.verifyUnsubscribe({ token })
      .then((res) => { if (res?.email) setEmail(res.email); })
      .catch(() => {});
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await newsletterApi.unsubscribe({ email: email.trim(), token: token || undefined });
      setStatus('You have been unsubscribed from Limitra newsletter emails.');
    } catch (err) {
      setStatus(messageFrom(err, 'Could not process unsubscribe request.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-fade">
      <div className="wrap" style={{ maxWidth: 460, padding: '72px 0' }}>
        <div className="card" style={{ padding: 28 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Newsletter preferences</h1>
          <p className="muted" style={{ fontSize: 14, marginBottom: 18 }}>Confirm your email address below to unsubscribe.</p>
          <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required />
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Unsubscribe'}</button>
          </form>
          {status && <p style={{ marginTop: 14, fontSize: 13.5 }}>{status}</p>}
        </div>
      </div>
    </div>
  );
}

export default function NewsletterUnsubscribePage() {
  return (
    <Suspense fallback={<div className="wrap" style={{ padding: '72px 0' }}>Loading…</div>}>
      <UnsubscribeInner />
    </Suspense>
  );
}

