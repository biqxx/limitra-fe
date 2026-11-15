'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useStore } from '@/components/store/StoreProvider';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshUser, toast } = useStore();
  const [error, setError] = useState('');

  useEffect(() => {
    const provider = params.get('provider') || 'google';
    const code = params.get('code');
    const state = params.get('state');
    if (!code) {
      setError('Missing OAuth authorization code.');
      return;
    }
    authApi.socialCallback(provider, { code, state })
      .then(async () => {
        const user = await refreshUser();
        toast('Signed in successfully');
        router.replace(user?.role === 'admin' ? '/admin' : '/account');
      })
      .catch((err) => setError(messageFrom(err, 'Could not complete social sign-in.')));
  }, [params, refreshUser, router, toast]);

  return (
    <div className="page page-fade">
      <div className="wrap" style={{ padding: '80px 0', textAlign: 'center', maxWidth: 460 }}>
        <h2>{error ? 'Sign-in failed' : 'Completing sign-in…'}</h2>
        <p className="muted" style={{ marginTop: 10 }}>
          {error || 'Verifying your account with the provider…'}
        </p>
      </div>
    </div>
  );
}

export default function SocialCallbackPage() {
  return (
    <Suspense fallback={<div className="wrap" style={{ padding: '80px 0', textAlign: 'center' }}>Completing sign-in…</div>}>
      <CallbackInner />
    </Suspense>
  );
}

