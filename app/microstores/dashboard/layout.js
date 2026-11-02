'use client';
/* MicroStore Partner dashboard shell — same shape as app/affiliate/dashboard/layout.js
   (sidebar + topbar wrapping {children}), adapted for a store identity instead of a
   personal affiliate identity: the sidebar header shows the partner's store (logo, name,
   verified badge) instead of an avatar, and there's a "View Store" button pinned under the
   nav instead of a theme/account menu driving everything.

   Unlike the Affiliate dashboard, this route has no auth guard — there's no MicroStore
   Partner signup/login flow yet (same situation as the public MicroStoresPage/MicroStorePage,
   see lib/microstoresData.js), so this is reachable directly as a demo rather than gated
   behind a real partner account. */
import { Suspense, useState, useEffect, Fragment } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { PARTNER, MY_STORE, PARTNER_NAV, partnerPath } from '@/components/microstore-partner/MicroStorePartner';
import { MicroStorePartnerToastProvider } from '@/components/microstore-partner/MicroStorePartnerToastContext';
import { StoreProvider, useStore } from '@/components/store/StoreProvider';
import '@/styles/admin.css';
import '@/styles/aff-dashboard.css';
import '@/styles/ms-dashboard.css';

export default function MsPartnerDashboardLayout({ children }) {
  return (
    <Suspense fallback={null}>
      <StoreProvider>
        <MsPartnerDashboardShell>{children}</MsPartnerDashboardShell>
      </StoreProvider>
    </Suspense>
  );
}

function MsPartnerDashboardShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { go } = useStore();

  const [collapsed, setCollapsed] = useState(false);
  const [mobOpen, setMobOpen] = useState(false);
  const [theme, setTheme] = useState('light');

  useEffect(() => { try { setTheme(localStorage.getItem('lim_theme') || 'light'); } catch (e) {} }, []);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); try { localStorage.setItem('lim_theme', theme); } catch (e) {} }, [theme]);
  useEffect(() => { setMobOpen(false); window.scrollTo(0, 0); }, [pathname]);

  const nav = (p) => { router.push(partnerPath(p)); };
  const isActive = (key) => pathname === partnerPath(key);
  const currentKey = PARTNER_NAV.flatMap(([, items]) => items).find(([key]) => isActive(key))?.[0] || 'dashboard';

  return (
    <MicroStorePartnerToastProvider>
      <div className={'adm' + (collapsed ? ' collapsed' : '') + (mobOpen ? ' mobopen' : '')}>
        {mobOpen && <div className="adm-scrim" onClick={() => setMobOpen(false)} />}
        <aside className="adm-side">
          <div className="ms-side-store">
            <span className="ms-side-store-logo" style={{ background: MY_STORE?.color }}><Icon name="store" size={20} /></span>
            <div className="ms-side-store-info">
              <b>{MY_STORE?.name}</b>
              <span className="ms-side-store-verified"><Icon name="check" size={11} stroke={3} /> Verified</span>
            </div>
            <button className="adm-collapse-btn" onClick={() => setCollapsed(c => !c)} aria-label="Collapse sidebar" title="Collapse sidebar"><Icon name="chevleft" size={17} /></button>
          </div>
          <nav className="adm-nav">
            {PARTNER_NAV.map(([grp, items]) => (
              <Fragment key={grp}>
                <div className="adm-nav-grp">{grp}</div>
                {items.map(([key, label, ic]) => (
                  <button key={key} className={'adm-link' + (isActive(key) ? ' on' : '')} onClick={() => nav(key)} title={label}><Icon name={ic} size={18} /><span>{label}</span></button>
                ))}
              </Fragment>
            ))}
          </nav>
          <button className="adm-btn primary block ms-side-viewstore" onClick={() => go('microstore', MY_STORE?.slug)}><Icon name="store" size={15} /> View Store</button>
        </aside>
        <div className="adm-main">
          <div className="adm-top">
            <button className="adm-burger" onClick={() => { if (window.matchMedia('(max-width: 860px)').matches) setMobOpen(o => !o); else setCollapsed(c => !c); }} aria-label="Toggle menu"><Icon name="menu" size={20} /></button>
            <span style={{ flex: 1 }} />
            <div className="adm-top-actions">
              <button className="adm-icon-btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Theme"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} /></button>
              <div className="adm-avatar" title={PARTNER.name}>{PARTNER.initials}</div>
            </div>
          </div>
          <div className="adm-body" data-page={currentKey}>{children}</div>
        </div>
      </div>
    </MicroStorePartnerToastProvider>
  );
}
