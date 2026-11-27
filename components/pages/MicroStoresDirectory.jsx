'use client';
/* LIMITRA, MicroStores directory — browse all MicroStore Partners.
   Wired to the real backend: GET /microstores (microstoresApi.list). That
   endpoint only documents page/per_page params — no server-side search,
   category or sort — so this fetches one page (per_page: 100) and filters/
   sorts client-side, same approach as ShopPage/MicroStorePage. Response
   field names aren't documented either; read defensively, same fields
   MicroStorePage already reads for a single store. There's no tags/category
   field on a real store, so (unlike the old demo-data version) this has no
   category filter — it would have nothing real to filter by. */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { useStore } from '@/components/store/StoreProvider';
import { Breadcrumbs } from '@/components/ui/Shared';
import { microstoresApi } from '@/lib/api/endpoints';

const SORTS = [['popular', 'Most popular'], ['rating', 'Top rated'], ['az', 'Name: A → Z']];
const TINTS = ['#0438B6', '#F67208', '#107A45', '#8E55E6', '#E5484D', '#C9890A'];

function unwrapStores(res) {
  if (Array.isArray(res)) return res;
  for (const k of ['data', 'items', 'microstores']) if (Array.isArray(res?.[k])) return res[k];
  return [];
}

function normalizeStore(s, i) {
  return {
    slug: s.slug,
    name: s.name || 'MicroStore',
    tagline: s.tagline || '',
    rating: s.rating ?? s.average_rating ?? null,
    reviews: s.reviews_count ?? s.reviews ?? null,
    verified: !!s.verified,
    logoUrl: s.logo_url || null,
    bannerUrl: s.banner_url || null,
    tint: s.theme_color || TINTS[i % TINTS.length],
  };
}

function StoreCard({ store }) {
  const { go, toast } = useStore();
  const openStore = () => {
    microstoresApi.trackClick(store.slug, { source: 'directory' }).catch(() => {});
    go('microstore', store.slug);
  };
  return (
    <div className="ms-dir-card card">
      <div
        className="ms-dir-cover"
        onClick={openStore}
        style={store.bannerUrl
          ? { backgroundImage: `url(${store.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: `linear-gradient(135deg, ${store.tint}, ${store.tint}99)` }}
      />
      <div className="ms-dir-body">
        <span className="ms-dir-avatar" style={{ background: store.tint }}>
          {store.logoUrl ? <img src={store.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} /> : <Icon name="store" size={18} />}
        </span>
        <b onClick={openStore}>{store.name}</b>
        {store.tagline && <p className="muted">{store.tagline}</p>}
        <div className="ms-dir-meta">
          {store.rating != null && <span><Icon name="star" size={13} fill="var(--gold)" /> {Number(store.rating).toFixed(1)} {store.reviews != null && <small>({store.reviews})</small>}</span>}
          {store.verified && <span className="ms-dir-verified"><Icon name="shield" size={13} /> Verified</span>}
        </div>
        <button className="btn btn-primary btn-sm btn-block" onClick={() => toast('Following ' + store.name)}>Follow Store</button>
      </div>
    </div>
  );
}

export function MicroStoresDirectory() {
  const { go, toast } = useStore();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('popular');

  useEffect(() => {
    microstoresApi.list({ per_page: 100 })
      .then((res) => setStores(unwrapStores(res).map(normalizeStore)))
      .catch((e) => toast('Could not load MicroStores'))
      .finally(() => setLoading(false));
  }, [toast]);

  const list = useMemo(() => {
    let r = stores.filter((s) =>
      (!q || s.name.toLowerCase().includes(q.toLowerCase())) &&
      (status === 'all' || (status === 'verified' && s.verified) || (status === 'top' && (s.rating ?? 0) >= 4.7))
    );
    r = [...r].sort((a, b) => {
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === 'az') return a.name.localeCompare(b.name);
      return (b.reviews ?? 0) - (a.reviews ?? 0);
    });
    return r;
  }, [stores, q, status, sort]);

  return (
    <div className="page page-fade">
      <div className="wrap"><Breadcrumbs items={[{ label: 'Home', to: ['home'] }, { label: 'MicroStores', to: ['microstores'] }, { label: 'Explore' }]} /></div>

      <section className="sec" style={{ paddingTop: 10 }}>
        <div className="wrap">
          <div className="ms-explore-hero">
            <span className="eyebrow">Limitra MicroStores</span>
            <h1>Explore Amazing Stores <span className="hl">on Limitra</span></h1>
            <p className="muted">Discover MicroStore Partners, support independent sellers and find exactly what you need — all in one place.</p>
            <div className="ms-hero-trust" style={{ marginTop: 20, maxWidth: 600 }}>
              <span><Icon name="package" size={16} />No inventory required</span>
              <span><Icon name="truck" size={16} />Products, delivery &amp; returns handled by Limitra</span>
              <span><Icon name="dollar" size={16} />Earn on delivered sales</span>
              <span><Icon name="spark" size={16} />AI content tools for your store</span>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap ms-dir-layout">
          <aside className="ms-dir-side">
            <div className="ms-search">
              <Icon name="search" size={16} className="muted" />
              <input className="input" placeholder="Search stores…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="filter-block">
              <h5>Store status</h5>
              {[['all', 'All stores'], ['verified', 'Verified stores'], ['top', 'Top rated']].map(([v, l]) => (
                <label key={v} className="check">
                  <input type="radio" name="dirstatus" checked={status === v} onChange={() => setStatus(v)} />
                  <span className="cbox round"><Icon name="check" size={12} stroke={3} /></span>{l}
                </label>
              ))}
            </div>
            <div className="filter-block">
              <h5>Sort by</h5>
              <div className="sort-wrap" style={{ width: '100%', borderRadius: 'var(--r-sm)' }}>
                <select className="sort-sel" style={{ width: '100%' }} value={sort} onChange={e => setSort(e.target.value)}>
                  {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <Icon name="chevdown" size={15} className="muted sort-chev" />
              </div>
            </div>
          </aside>

          <div>
            {loading ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-faint)' }}>Loading stores…</div>
            ) : stores.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-faint)' }}>No MicroStores have opened yet — check back soon.</div>
            ) : list.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-faint)' }}>No stores match your filters.</div>
            ) : (
              <div className="ms-dir-grid">
                {list.map(s => <StoreCard key={s.slug} store={s} />)}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="ms-sell-banner">
            <span className="ms-sell-ic"><Icon name="store" size={22} /></span>
            <div><b>Want to sell on Limitra?</b><p>Start your own MicroStore, earn commissions and reach thousands of customers.</p></div>
            <button className="btn btn-accent" onClick={() => go('microstores')}>Create your own MicroStore</button>
          </div>
        </div>
      </section>
    </div>
  );
}
