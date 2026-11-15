'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { sourcingApi, adminProductsApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { AdmHead, AdmSelect } from './AdminShared';
import { useAdminToast } from './AdminToastContext';
import { ProductEditDrawer, productToDraft, mapAdminProduct, saveAdminProduct } from './AdminCatalog';

const productId = (product) => String(product.external_product_id || product.supplier_id || product.id || '');
const productSource = (product) => String(product.source || product.supplier || '').toLowerCase();
const productKey = (product) => `${productSource(product)}:${productId(product)}`;
const productTitle = (product) => product.title || product.name || 'Untitled supplier product';
const productImage = (product) => {
  const value = product?.image_url || product?.image || product?.thumbnail || product?.gallery?.[0] || '';
  return typeof value === 'string' ? value.replace(/^http:\/\//i, 'https://') : '';
};
const money = (value, currency = 'USD') => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Price unavailable';
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString()}`; }
};

function sourceLabel(source) {
  if (source === 'ebay') return 'eBay';
  if (source === 'amazon') return 'Amazon';
  return source || 'Supplier';
}

function ProductImage({ product, className }) {
  const [failed, setFailed] = useState(false);
  const image = productImage(product);
  return <div className={className}>{image && !failed
    ? <img src={image} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <Icon name="package" size={30} />}</div>;
}

function mergeJobs(current, incoming) {
  const byId = new Map(current.map(job => [job.id, job]));
  incoming.forEach(job => byId.set(job.id, job));
  return [...byId.values()].sort((a, b) => Number(b.id) - Number(a.id));
}

export function AdminSourcing() {
  const toast = useAdminToast();
  const [sources, setSources] = useState([]);
  const [source, setSource] = useState('all');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [jobs, setJobs] = useState([]);
  const [searching, setSearching] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [enhancingKey, setEnhancingKey] = useState(null);
  const [reviewing, setReviewing] = useState(null); // product draft being reviewed in-place

  const enhanceItem = async (product) => {
    const key = productKey(product);
    setEnhancingKey(key);
    try {
      const enhanced = await sourcingApi.enhance({
        source: productSource(product),
        external_product_id: productId(product),
        title: productTitle(product),
        description: product.description || '',
      });
      setResults((cur) =>
        cur.map((item) =>
          productKey(item) === key
            ? { ...item, title: enhanced?.title || item.title, description: enhanced?.description || item.description, _enhanced: true }
            : item
        )
      );
      toast('Product copy enhanced with AI.');
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setEnhancingKey(null);
    }
  };

  const openReview = async (id) => {
    if (id == null) return;
    try {
      const detail = await adminProductsApi.get(id);
      setReviewing(productToDraft(mapAdminProduct(detail)));
    } catch (error) {
      toast(messageFrom(error));
    }
  };

  const loadJobs = useCallback(async () => {
    const payload = await sourcingApi.jobs({ per_page: 50 });
    setJobs(payload?.items || []);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([sourcingApi.sources(), sourcingApi.jobs({ per_page: 50 })])
      .then(([sourceData, jobData]) => {
        if (!active) return;
        setSources(Array.isArray(sourceData) ? sourceData : []);
        setJobs(jobData?.items || []);
      })
      .catch(error => { if (active) toast(messageFrom(error)); });
    return () => { active = false; };
  }, [toast]);

  const hasActiveJobs = jobs.some(job => ['queued', 'processing'].includes(job.status));
  useEffect(() => {
    if (!hasActiveJobs) return undefined;
    const timer = window.setInterval(() => loadJobs().catch(() => {}), 4000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, loadJobs]);

  const enabledSources = sources.filter(item => item.enabled);
  const sourceOptions = [
    { value: 'all', label: 'All suppliers' },
    ...enabledSources.map(item => ({ value: item.id, label: item.name })),
  ];
  const activeKeys = new Set(jobs.filter(job => ['queued', 'processing'].includes(job.status)).map(productKey));
  const selectable = results.filter(item => !item.imported && !activeKeys.has(productKey(item)) && productId(item) && productSource(item));
  const allSelected = selectable.length > 0 && selectable.every(item => selected.has(productKey(item)));
  const selectedProducts = results.filter(item => selected.has(productKey(item)));

  const runSearch = async (nextPage = 1) => {
    const q = (nextPage === 1 ? query : submittedQuery).trim();
    if (q.length < 2) { toast('Enter at least two characters to search.'); return; }
    setSearching(true);
    try {
      const payload = await sourcingApi.search({ source, q, page: nextPage });
      setResults(Array.isArray(payload?.products) ? payload.products : []);
      setPagination(payload?.pagination || payload || null);
      setSelected(new Set());
      setSubmittedQuery(q);
      setPage(Number(payload?.page || payload?.pagination?.current_page || nextPage));
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setSearching(false);
    }
  };

  const toggleProduct = (product) => {
    if (product.imported || activeKeys.has(productKey(product))) return;
    const key = productKey(product);
    setSelected(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(current => {
      const next = new Set(current);
      selectable.forEach(item => {
        if (allSelected) next.delete(productKey(item)); else next.add(productKey(item));
      });
      return next;
    });
  };

  const queueProducts = async (products = selectedProducts) => {
    if (!products.length) return;
    setQueueing(true);
    try {
      const queued = await sourcingApi.queue({
        products: products.map(product => ({ source: productSource(product), external_product_id: productId(product) })),
      });
      setJobs(current => mergeJobs(current, Array.isArray(queued) ? queued : []));
      setSelected(new Set());
      toast('Products queued. AI will rewrite and add each one as a draft in the background.');
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setQueueing(false);
    }
  };

  const hasNext = useMemo(() => {
    const lastPage = Number(pagination?.last_page || pagination?.pages || 0);
    if (lastPage) return page < lastPage;
    return Boolean(pagination?.has_next || pagination?.next_page || results.length > 0);
  }, [page, pagination, results.length]);

  return <div className="src-page">
    <AdmHead title="Product sourcing" sub="Search suppliers, then let AI rewrite and save selected products as catalog drafts in the background.">
      <Link href="/admin/sourcing-queue" className="adm-btn ghost">
        <Icon name="clock" size={15} /> Product queue{jobs.length > 0 ? ` (${jobs.length})` : ''}
      </Link>
    </AdmHead>

    <section className="panel src-search-panel">
      <form className="src-search" onSubmit={event => { event.preventDefault(); runSearch(1); }}>
        <div className="src-source-select"><span>Supplier</span><AdmSelect value={source} options={sourceOptions} onChange={setSource} /></div>
        <label className="src-query"><span>What are you looking for?</span><div><Icon name="search" size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. wireless headphones" /></div></label>
        <button className="adm-btn primary src-search-btn" type="submit" disabled={searching || query.trim().length < 2}><Icon name={searching ? 'refresh' : 'search'} size={16} /> {searching ? 'Searching…' : 'Search products'}</button>
      </form>
      {sources.some(item => !item.enabled) && <p className="src-source-note">Unavailable sources: {sources.filter(item => !item.enabled).map(item => `${item.name}${item.reason ? ` — ${item.reason}` : ''}`).join(', ')}</p>}
    </section>

    {(results.length > 0 || submittedQuery) && <section className="src-results-section">
      <div className="src-section-head">
        <div><h2>Supplier results</h2><p>{results.length} results for “{submittedQuery}”</p></div>
        <div className="src-bulk-actions">
          <button className="adm-btn ghost" onClick={toggleAll} disabled={!selectable.length}>{allSelected ? 'Clear selection' : 'Select page'}</button>
          <button className="adm-btn primary" onClick={() => queueProducts()} disabled={!selectedProducts.length || queueing}><Icon name="spark" size={16} /> {queueing ? 'Adding to queue…' : `Rewrite & add drafts (${selectedProducts.length})`}</button>
        </div>
      </div>

      {results.length ? <div className="src-grid">{results.map(product => {
        const key = productKey(product);
        const checked = selected.has(key);
        const queued = activeKeys.has(key);
        return <article key={key} className={'src-card' + (checked ? ' selected' : '') + (product.imported ? ' imported' : '')}>
          <button className="src-card-pick" onClick={() => toggleProduct(product)} disabled={product.imported || queued} aria-label={checked ? 'Deselect product' : 'Select product'}>{checked && <Icon name="check" size={15} stroke={3} />}</button>
          <ProductImage className="src-card-image" product={product} />
          <div className="src-card-body"><span className="src-source-badge">{sourceLabel(productSource(product))}</span><h3>{productTitle(product)}</h3><p className="src-card-price">{money(product.price, product.currency || 'USD')}</p>
            {product.imported ? <button type="button" className="src-imported-link" onClick={() => openReview(product.product_id)}>Already added · View product</button> : queued ? <small>Queued for AI rewrite</small> : (
              <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 4 }}>
                <small>ID: {productId(product)}</small>
                <button type="button" className="adm-btn ghost" style={{ padding: '4px 8px', fontSize: 11.5 }} disabled={enhancingKey === key} onClick={() => enhanceItem(product)}>
                  <Icon name="spark" size={12} /> {enhancingKey === key ? 'Enhancing…' : product._enhanced ? 'Enhanced' : 'AI Enhance'}
                </button>
              </div>
            )}
          </div>
        </article>;
      })}</div> : <div className="src-empty"><Icon name="search" size={28} /><b>No supplier products found</b><span>Try a broader search phrase or another supplier.</span></div>}

      <div className="src-pagination"><button className="adm-btn ghost" disabled={searching || page <= 1} onClick={() => runSearch(page - 1)}><Icon name="chevleft" size={15} /> Previous</button><span>Page {page}</span><button className="adm-btn ghost" disabled={searching || !hasNext} onClick={() => runSearch(page + 1)}>Next <Icon name="chevright" size={15} /></button></div>
    </section>}

    {reviewing && <ProductEditDrawer
      key={`${reviewing.id}:${(reviewing._raw?.sources || []).map(source => source.id).join(',')}`}
      draft={reviewing}
      onClose={() => setReviewing(null)}
      onSave={async (d) => {
        try {
          const pid = await saveAdminProduct(d, toast);
          if (pid == null) return; // blocked (pricing issue) — leave the drawer open
          setReviewing(null);
          await loadJobs().catch(() => {});
        } catch (error) {
          toast(messageFrom(error));
        }
      }}
    />}
  </div>;
}

export function AdminSourcingQueue() {
  const toast = useAdminToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('All');
  const [deletingId, setDeletingId] = useState(null);
  const [reviewing, setReviewing] = useState(null);

  const loadJobs = useCallback(async () => {
    try {
      const payload = await sourcingApi.jobs({ per_page: 50 });
      setJobs(payload?.items || []);
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const hasActiveJobs = jobs.some(job => ['queued', 'processing'].includes(job.status));
  useEffect(() => {
    if (!hasActiveJobs) return undefined;
    const timer = window.setInterval(() => loadJobs(), 4000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, loadJobs]);

  const openReview = async (id) => {
    if (id == null) return;
    try {
      const detail = await adminProductsApi.get(id);
      setReviewing(productToDraft(mapAdminProduct(detail)));
    } catch (error) {
      toast(messageFrom(error));
    }
  };

  const retryJob = async (job) => {
    try {
      const queued = await sourcingApi.queue({
        products: [{ source: productSource(job), external_product_id: productId(job) }],
      });
      setJobs(current => mergeJobs(current, Array.isArray(queued) ? queued : []));
      toast('Product re-queued for AI rewriting.');
    } catch (error) {
      toast(messageFrom(error));
    }
  };

  const deleteJob = async (job) => {
    setDeletingId(job.id);
    try {
      await sourcingApi.deleteJob(job.id);
      setJobs(current => current.filter(item => item.id !== job.id));
      toast('Item removed from product queue.');
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = jobs.filter(job => {
    if (tab === 'Queued') return ['queued', 'processing'].includes(job.status);
    if (tab === 'Completed') return job.status === 'completed';
    if (tab === 'Failed') return job.status === 'failed';
    return true;
  });

  return <div className="src-page">
    <AdmHead title="Product queue" sub="Background AI sourcing jobs. Review completed drafts, retry failed items, or remove items from the queue.">
      <Link href="/admin/sourcing" className="adm-btn ghost"><Icon name="search" size={15} /> Back to sourcing</Link>
      <button className="adm-btn ghost" onClick={() => loadJobs()}><Icon name="refresh" size={15} /> Refresh</button>
    </AdmHead>

    <div className="adm-filters">
      {['All', 'Queued', 'Completed', 'Failed'].map(t => (
        <button key={t} className={'adm-chip' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>{t}</button>
      ))}
    </div>

    {loading ? (
      <div className="panel" style={{ padding: 28, textAlign: 'center' }}><span className="muted">Loading product queue…</span></div>
    ) : filtered.length === 0 ? (
      <div className="src-empty">
        <Icon name="clock" size={28} />
        <b>No items in {tab === 'All' ? 'the product queue' : `${tab.toLowerCase()} status`}</b>
        <span>Queue products from <Link href="/admin/sourcing" className="link-btn">Product sourcing</Link> to see them here.</span>
      </div>
    ) : (
      <div className="src-review-list">
        {filtered.map(job => (
          <SourcingJob
            key={job.id}
            job={job}
            deleting={deletingId === job.id}
            onRetry={() => retryJob(job)}
            onReview={() => openReview(job.product_id)}
            onDelete={() => deleteJob(job)}
          />
        ))}
      </div>
    )}

    {reviewing && <ProductEditDrawer
      key={`${reviewing.id}:${(reviewing._raw?.sources || []).map(source => source.id).join(',')}`}
      draft={reviewing}
      onClose={() => setReviewing(null)}
      onSave={async (d) => {
        try {
          const pid = await saveAdminProduct(d, toast);
          if (pid == null) return;
          setReviewing(null);
          await loadJobs();
        } catch (error) {
          toast(messageFrom(error));
        }
      }}
    />}
  </div>;
}

function SourcingJob({ job, deleting, onRetry, onReview, onDelete }) {
  const title = job.enhanced_content?.name || job.supplier_product?.title || `${sourceLabel(job.supplier)} product ${job.external_product_id}`;
  const delBtn = (
    <button
      type="button"
      className="adm-btn ghost danger"
      disabled={deleting}
      onClick={onDelete}
      title="Remove from queue"
      aria-label="Remove from queue"
    >
      <Icon name="trash" size={15} /> {deleting ? 'Removing…' : 'Delete'}
    </button>
  );
  if (job.status === 'completed') {
    return (
      <div className="panel src-review-done">
        <Icon name="check" size={20} stroke={3} />
        <div><b>{title}</b><span>{job.warning || 'AI rewrite completed and the product was added as a draft.'}</span></div>
        <div className="row" style={{ gap: 8 }}>
          <button className="adm-btn ghost" onClick={onReview}>Review product</button>
          {delBtn}
        </div>
      </div>
    );
  }
  if (job.status === 'failed') {
    return (
      <div className="panel src-review-error">
        <Icon name="info" size={20} />
        <div><b>{title}</b><span>{job.error || 'This product could not be processed.'}</span></div>
        <div className="row" style={{ gap: 8 }}>
          <button className="adm-btn ghost" onClick={onRetry}>Retry</button>
          {delBtn}
        </div>
      </div>
    );
  }
  return (
    <div className="panel src-review-loading">
      <Icon name="refresh" size={20} />
      <div><b>{title}</b><span>{job.status === 'processing' ? 'AI is rewriting and saving this product…' : 'Waiting for a background worker…'}</span></div>
      {delBtn}
    </div>
  );
}
