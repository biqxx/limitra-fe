'use client';
/* LIMITRA, Spin & Win signup reward wheel — ported from legacy/spin.jsx */
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useStore } from '@/components/store/StoreProvider';
import { rewardsApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { naira } from '@/lib/data';

/* prize segments, value drives checkout discount; weight drives probability */
export const SPIN_PRIZES = [
  { label: '5% OFF', kind: 'pct', value: 0.05, codePrefix: 'WELCOME5_', color: '#2F4BDB', weight: 35 },
  { label: '10% OFF', kind: 'pct', value: 0.10, codePrefix: 'WELCOME10_', color: '#0438B6', weight: 25 },
  { label: '₦5,000', kind: 'fixed', value: 5000, codePrefix: 'CASH5K_', color: '#F67208', weight: 15 },
  { label: '20% OFF', kind: 'pct', value: 0.20, codePrefix: 'WELCOME20_', color: '#E5241F', weight: 8 },
  { label: '₦1,000', kind: 'fixed', value: 1000, codePrefix: 'CASH1K_', color: '#1F8A5B', weight: 10 },
  { label: '₦2,500', kind: 'fixed', value: 2500, codePrefix: 'CASH25_', color: '#7A5AE0', weight: 5 },
  { label: 'Free Ship', kind: 'ship', value: 0, codePrefix: 'FREESHIP_', color: '#0E9BD6', weight: 8 },
  { label: 'Mystery 🎁', kind: 'pct', value: 0.12, codePrefix: 'MYSTERY_', color: '#D6247C', weight: 4 },
];

function weightedPick(prizes) {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < prizes.length; i++) { if ((r -= prizes[i].weight) <= 0) return i; }
  return 0;
}

function Confetti({ on }) {
  if (!on) return null;
  const bits = Array.from({ length: 60 });
  const cols = ['#0438B6', '#F67208', '#1F8A5B', '#E5241F', '#7A5AE0', '#F5A623'];
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((_, i) => (
        <span key={i} style={{ left: (i / 60 * 100) + '%', background: cols[i % cols.length], animationDelay: (((i * 37) % 60) / 100) + 's', animationDuration: (1.8 + ((i * 19) % 16) / 10) + 's', transform: `rotate(${(i * 53) % 360}deg)` }} />
      ))}
    </div>
  );
}

export function SpinWheel({ onClose }) {
  const { claimSpin, isAuthenticated, toast, go } = useStore();
  const [spinning, setSpinning] = useState(false);
  const [rot, setRot] = useState(0);
  const [result, setResult] = useState(null);
  const spinTimerRef = useRef(null);
  useEffect(() => () => { if (spinTimerRef.current) clearTimeout(spinTimerRef.current); }, []);
  const n = SPIN_PRIZES.length;
  const seg = 360 / n;

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && (result || !spinning)) onClose(); };
    window.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [result, spinning, onClose]);

  const spin = async () => {
    if (spinning || result) return;
    setSpinning(true);
    let idx = weightedPick(SPIN_PRIZES);
    let serverPrize = null;
    if (isAuthenticated) {
      try {
        const res = await rewardsApi.spin();
        const rw = res?.reward ?? res?.data?.reward ?? res?.data ?? res;
        if (rw) {
          serverPrize = rw;
          const matchIdx = SPIN_PRIZES.findIndex((p) =>
            (rw.label && p.label.toLowerCase() === String(rw.label).toLowerCase()) ||
            (rw.value != null && Number(p.value) === Number(rw.value))
          );
          if (matchIdx >= 0) idx = matchIdx;
        }
      } catch (err) {
        toast(messageFrom(err, 'Unable to spin right now'), 'error');
        setSpinning(false);
        return;
      }
    }
    const visualIdx = (idx - 2 + n) % n;
    const target = 360 * 6 + (360 - (visualIdx * seg + seg / 2));
    setRot(target);
    spinTimerRef.current = setTimeout(() => {
      const basePrize = SPIN_PRIZES[idx];
      const prize = serverPrize ? { ...basePrize, label: serverPrize.label || basePrize.label, code: serverPrize.code || serverPrize.coupon_code } : basePrize;
      const code = prize.code || claimSpin(prize);
      setResult({ ...prize, code });
      setSpinning(false);
    }, 4200);
  };

  // conic-gradient wheel background
  const grad = SPIN_PRIZES.map((p, i) => `${p.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(', ');

  return (
    <div className="spin-overlay">
      <Confetti on={!!result} />
      <div className="spin-modal" role="dialog" aria-label="Spin and win">
        {(result || !spinning) && <button className="spin-x" onClick={onClose} aria-label="Close">✕</button>}
        {!result ? (
          <>
            <div className="spin-head">
              <span className="spin-emoji">🎉</span>
              <h2>Welcome to Limitra!</h2>
              <p>Spin the wheel and unlock your exclusive signup reward.</p>
            </div>
            <div className="wheel-wrap">
              <span className="wheel-ptr" />
              <div className="wheel" style={{ background: `conic-gradient(${grad})`, transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 4.1s cubic-bezier(.17,.67,.2,1)' : 'none' }}>
                {SPIN_PRIZES.map((p, i) => (
                  <span key={i} className="wheel-label" style={{ transform: `rotate(${i * seg + seg / 2}deg)` }}>
                    <b style={{ transform: 'rotate(-90deg)' }}>{p.label}</b>
                  </span>
                ))}
              </div>
              <button className="wheel-hub" onClick={spin} disabled={spinning} aria-label="Spin">{spinning ? '…' : 'SPIN'}</button>
            </div>
            <button className="btn btn-accent btn-block btn-lg" onClick={spin} disabled={spinning} style={{ marginTop: 22 }}>{spinning ? 'Spinning…' : 'Spin to win'}</button>
            <p className="spin-terms">One spin per account. Rewards valid 7 days. <Link href="/help/terms" onClick={onClose}>Terms apply</Link>.</p>
          </>
        ) : (
          <div className="spin-result">
            <span className="spin-emoji big">🎉</span>
            <h2>Congratulations!</h2>
            {result.kind === 'fixed' ? (
              <>
                <p className="sr-prize">You won <b>{naira(result.value)}</b>. It’s been added to your points.</p>
                <div className="sr-code" style={{ textAlign: 'center' }}>
                  <small>Added to Lim Cash</small>
                  <div className="sr-code-row" style={{ justifyContent: 'center' }}><code>+{naira(result.value)}</code></div>
                </div>
                <p className="muted" style={{ fontSize: 13 }}>Use your points to offset any order at checkout.</p>
                <button className="btn btn-accent btn-block btn-lg" onClick={onClose} style={{ marginTop: 16 }}>Start shopping</button>
                <button className="spin-later" onClick={() => { onClose(); go('account', 'referrals'); }}>View my points</button>
              </>
            ) : (
              <>
                <p className="sr-prize">You won <b>{result.label}{result.kind === 'ship' ? '' : ''}</b>{result.kind === 'pct' ? ' your first order' : ''}.</p>
                <div className="sr-code">
                  <small>Your code</small>
                  <div className="sr-code-row"><code>{result.code}</code><button className="btn btn-primary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(result.code); } catch (e) {} toast('Code copied'); }}>Copy</button></div>
                </div>
                <p className="muted" style={{ fontSize: 13 }}>Expires in 7 days · auto-applied at checkout</p>
                <button className="btn btn-accent btn-block btn-lg" onClick={onClose} style={{ marginTop: 16 }}>Start shopping</button>
                <button className="spin-later" onClick={() => { onClose(); go('account', 'rewards'); }}>View in My Rewards</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
