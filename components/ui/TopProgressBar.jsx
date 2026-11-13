'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() || ''}`;
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const trickleRef = useRef(null);
  const hideRef = useRef(null);
  const safetyRef = useRef(null);
  const activeRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (trickleRef.current) { clearInterval(trickleRef.current); trickleRef.current = null; }
    if (hideRef.current) { clearTimeout(hideRef.current); hideRef.current = null; }
    if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null; }
  }, []);

  const done = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearTimers();
    setProgress(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 220);
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    activeRef.current = true;
    setVisible(true);
    setProgress(18);
    trickleRef.current = setInterval(() => {
      setProgress(p => (p >= 90 ? p : p + Math.max(1.5, (90 - p) * 0.14)));
    }, 140);
    safetyRef.current = setTimeout(done, 8000);
  }, [clearTimers, done]);

  useEffect(() => {
    done();
  }, [routeKey, done]);

  useEffect(() => {
    const onNavStart = () => start();
    const onPopState = () => start();
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = e.target?.closest?.('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//')) return;
      const nextUrl = new URL(href, window.location.origin);
      const current = `${window.location.pathname}${window.location.search}`;
      const target = `${nextUrl.pathname}${nextUrl.search}`;
      if (target !== current) start();
    };

    window.addEventListener('lim:nav-start', onNavStart);
    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('lim:nav-start', onNavStart);
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onClick, true);
      clearTimers();
    };
  }, [start, clearTimers]);

  if (!visible) return null;

  return (
    <div className="top-progress" aria-hidden="true">
      <div className="top-progress-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}
