'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { staffInvitationsApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';

function extractToken() {
  if (typeof window === 'undefined') return '';
  const hash = window.location.hash || '';
  if (hash.startsWith('#')) {
    const hashParams = new URLSearchParams(hash.slice(1));
    const fromHash = hashParams.get('token');
    if (fromHash) return fromHash.trim();
  }
  const searchParams = new URLSearchParams(window.location.search || '');
  return (searchParams.get('token') || '').trim();
}

export default function StaffInvitationPage() {
  const [token, setToken] = useState('');
  const [checked, setChecked] = useState(false);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = extractToken();
    const id = setTimeout(() => {
      setToken(t);
      setChecked(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    if (!token) {
      setError('This invitation link is missing its activation token.');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      setFieldErrors({ username: 'Username may only contain letters, numbers, and underscores.' });
      return;
    }
    if (password.length < 8) {
      setFieldErrors({ password: 'Password must be at least 8 characters.' });
      return;
    }
    if (password !== confirm) {
      setFieldErrors({ password_confirmation: 'Passwords do not match.' });
      return;
    }

    setBusy(true);
    try {
      await staffInvitationsApi.accept({
        token,
        username: username.trim(),
        password,
        password_confirmation: confirm,
        phone: phone.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      if (err?.errors && typeof err.errors === 'object') {
        const mapped = {};
        Object.entries(err.errors).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? v[0] : String(v);
        });
        setFieldErrors(mapped);
      }
      setError(messageFrom(err, 'Unable to accept this invitation. It may have expired or already been used.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '28px 26px', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <Link href="/" style={{ display: 'inline-block', marginBottom: 14 }}>
            <img src="/assets/logo.png" alt="Limitra" style={{ height: 30, display: 'block', margin: '0 auto' }} />
          </Link>
          <h1 style={{ fontSize: 22, margin: '0 0 6px' }}>
            {done ? 'Staff account activated' : 'Accept staff invitation'}
          </h1>
          <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
            {done
              ? 'Your Limitra staff account is ready. Sign in to access the admin console.'
              : 'Choose a username and password to complete your Limitra staff onboarding.'}
          </p>
        </div>

        {done ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link href="/auth/signin" className="btn btn-primary btn-block" style={{ textAlign: 'center' }}>
              Sign in now
            </Link>
            <Link href="/" className="btn btn-outline btn-block" style={{ textAlign: 'center' }}>
              Back to storefront
            </Link>
          </div>
        ) : checked && !token ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--red)', fontSize: 13.5, marginBottom: 16 }}>
              No invitation token was found in this link. Please open the full link from your invitation email or ask an admin to resend it.
            </p>
            <Link href="/auth/signin" className="btn btn-outline btn-block">Go to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {error && (
              <div style={{ padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'rgba(229,72,77,.1)', color: 'var(--red)', fontSize: 13 }}>
                {error}
              </div>
            )}

            <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. amina_bello"
                required
                autoComplete="username"
              />
              {fieldErrors.username && <small style={{ color: 'var(--red)' }}>{fieldErrors.username}</small>}
            </label>

            <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Phone number (optional)</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 800 000 0000"
                autoComplete="tel"
              />
              {fieldErrors.phone && <small style={{ color: 'var(--red)' }}>{fieldErrors.phone}</small>}
            </label>

            <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoComplete="new-password"
              />
              {fieldErrors.password && <small style={{ color: 'var(--red)' }}>{fieldErrors.password}</small>}
            </label>

            <label className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Confirm password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                required
                autoComplete="new-password"
              />
              {fieldErrors.password_confirmation && <small style={{ color: 'var(--red)' }}>{fieldErrors.password_confirmation}</small>}
            </label>

            <button type="submit" className="btn btn-primary btn-block" disabled={busy || !checked}>
              {busy ? 'Activating account…' : 'Activate staff account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

