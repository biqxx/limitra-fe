'use client';
/* MicroStore Partner dashboard toast notifications — same pattern as
   components/affiliate/AffiliateToastContext.jsx, kept as its own context (rather than
   reusing that one directly) for the same reason the admin/affiliate dashboards each got
   their own: each dashboard shell mounts its own provider, so there's no real benefit to
   cross-importing one dashboard's context into another's component tree. */
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Icon } from '@/components/icons/Icon';

const MsPartnerToastCtx = createContext(null);

export function MicroStorePartnerToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const id = useRef(0);

  const addToast = useCallback((msg) => {
    const i = ++id.current;
    setItems(x => [...x, { i, msg }]);
    setTimeout(() => setItems(x => x.filter(t => t.i !== i)), 2600);
  }, []);

  return (
    <MsPartnerToastCtx.Provider value={addToast}>
      {children}
      <div className="adm-toasts">
        {items.map(t => (
          <div className="adm-toast" key={t.i}><Icon name="check" size={15} stroke={3} /> {t.msg}</div>
        ))}
      </div>
    </MsPartnerToastCtx.Provider>
  );
}

export function useMsPartnerToast() {
  const ctx = useContext(MsPartnerToastCtx);
  return ctx || (() => {});
}
