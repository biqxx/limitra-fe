'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import '@/styles/admin.css';
import '@/styles/aff-dashboard.css';
import { Icon } from '@/components/icons/Icon';
import { useStore } from '@/components/store/StoreProvider';
import { naira } from '@/lib/data';
import { myMicrostoreApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { hasMicrostoreAccess } from '@/lib/auth/permissions';

export function MicrostoreDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, authLoading, logout, toast, theme, toggleTheme } = useStore();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [newProdId, setNewProdId] = useState('');
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const allowed = isAuthenticated && hasMicrostoreAccess(user);

  useEffect(() => {
    if (authLoading) return;
    if (!allowed) {
      router.replace('/access-denied?need=microstore');
    }
  }, [authLoading, allowed, router]);

  const loadStore = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const res = await myMicrostoreApi.get();
      const s = res?.microstore || res;
      setStore(s);
      setTitle(s?.name || s?.title || '');
      setTagline(s?.tagline || s?.bio || '');
      setProducts(Array.isArray(s?.products) ? s.products : Array.isArray(res?.products) ? res.products : []);
    } catch (e) {
      toast(messageFrom(e, 'Could not load your MicroStore'), 'error');
    } finally {
      setLoading(false);
    }
  }, [allowed, toast]);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  if (authLoading || !allowed) return null;

  const saveProfile = async () => {
    setSaving(true);
    try {
      await myMicrostoreApi.update({ name: title.trim(), tagline: tagline.trim() });
      toast('MicroStore updated');
      await loadStore();
    } catch (e) {
      toast(messageFrom(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const addProduct = async (e) => {
    e.preventDefault();
    if (!newProdId.trim()) return;
    setSaving(true);
    try {
      await myMicrostoreApi.addProduct({ product_id: Number(newProdId), curator_note: newNote.trim() || undefined });
      toast('Product added to MicroStore');
      setNewProdId('');
      setNewNote('');
      await loadStore();
    } catch (err) {
      toast(messageFrom(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleFeatured = async (p) => {
    try {
      await myMicrostoreApi.updateProduct(p.product_id || p.id, { is_featured: !p.is_featured });
      toast('Updated product');
      await loadStore();
    } catch (e) {
      toast(messageFrom(e), 'error');
    }
  };

  const removeProd = async (p) => {
    try {
      await myMicrostoreApi.removeProduct(p.product_id || p.id);
      toast('Removed from MicroStore');
      await loadStore();
    } catch (e) {
      toast(messageFrom(e), 'error');
    }
  };

  const signOut = async () => {
    try { await logout(); } catch {}
    router.replace('/');
  };

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand">
          <Link href="/" className="adm-logo">LIMITRA</Link>
          <span className="adm-pill info">MicroStore</span>
        </div>
        <div className="adm-nav">
          <div className="adm-nav-g">
            <span>Storefront</span>
            <Link href="/microstore/dashboard" className="adm-nav-i on">
              <Icon name="store" size={16} /> My MicroStore
            </Link>
            {store?.slug && (
              <Link href={`/microstores/${store.slug}`} className="adm-nav-i">
                <Icon name="eye" size={16} /> View Public Store
              </Link>
            )}
            <Link href="/microstores" className="adm-nav-i">
              <Icon name="grid" size={16} /> Browse MicroStores
            </Link>
          </div>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-top">
          <div className="adm-top-l">
            <b>{store?.name || 'MicroStore Dashboard'}</b>
          </div>
          <div className="adm-top-r">
            <button className="adm-icon-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
            </button>
            <button className="adm-btn ghost" onClick={signOut}>Sign out</button>
          </div>
        </header>

        <main className="adm-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="adm-h">
            <div>
              <h1>My MicroStore</h1>
              <p>Curate your storefront profile and featured catalog products.</p>
            </div>
            <div className="adm-h-actions">
              <button className="adm-btn ghost" onClick={loadStore} disabled={loading}>
                <Icon name="refresh" size={14} /> Refresh
              </button>
            </div>
          </div>

          {loading ? <p className="muted">Loading MicroStore…</p> : !store ? (
            <div className="panel"><p className="muted">No MicroStore profile is active for this account yet.</p></div>
          ) : (
            <>
              <div className="panel">
                <div className="panel-h"><h3>Storefront Details</h3>{store.slug && <small className="muted">/microstores/{store.slug}</small>}</div>
                <div className="adm-field-row">
                  <label className="adm-field"><span>Store name</span><input value={title} onChange={e => setTitle(e.target.value)} /></label>
                  <label className="adm-field"><span>Tagline</span><input value={tagline} onChange={e => setTagline(e.target.value)} /></label>
                </div>
                <button className="adm-btn primary" style={{ marginTop: 12 }} disabled={saving} onClick={saveProfile}>{saving ? 'Saving…' : 'Save store details'}</button>
              </div>

              <div className="panel">
                <div className="panel-h"><h3>Add Product to MicroStore</h3></div>
                <form className="adm-field-row" onSubmit={addProduct} style={{ alignItems: 'flex-end' }}>
                  <label className="adm-field"><span>Product ID</span><input type="number" min="1" value={newProdId} onChange={e => setNewProdId(e.target.value)} placeholder="e.g. 12" /></label>
                  <label className="adm-field"><span>Curator note (optional)</span><input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Why you recommend it" /></label>
                  <button className="adm-btn primary" type="submit" disabled={saving || !newProdId.trim()}>Add product</button>
                </form>
              </div>

              <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="panel-h" style={{ padding: '18px 20px 12px', marginBottom: 0 }}><h3>Curated Products ({products.length})</h3></div>
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead><tr><th>Product</th><th>Price</th><th>Featured</th><th></th></tr></thead>
                    <tbody>
                      {products.length === 0 ? (
                        <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 24 }}>No curated products yet.</td></tr>
                      ) : products.map((p) => (
                        <tr key={p.id || p.product_id}>
                          <td><b>{p.product?.name || p.name || `Product #${p.product_id || p.id}`}</b></td>
                          <td>{naira(Number(p.product?.price || p.price || 0))}</td>
                          <td><button className={'adm-pill ' + (p.is_featured ? 'ok' : 'muted')} onClick={() => toggleFeatured(p)}>{p.is_featured ? 'Featured' : 'Standard'}</button></td>
                          <td><div className="adm-rowact"><button className="del" title="Remove" onClick={() => removeProd(p)}><Icon name="trash" size={15} /></button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
