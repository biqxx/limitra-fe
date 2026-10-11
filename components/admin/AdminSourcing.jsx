'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { sourcingApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { AdmHead, AdmSelect } from './AdminShared';
import { useAdminToast } from './AdminToastContext';

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
    <AdmHead title="Product sourcing" sub="Search suppliers, then let AI rewrite and save selected products as catalog drafts in the background." />

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
            {product.imported ? <Link className="src-imported-link" href={`/admin/products/${product.product_id}`}>Already added · View product</Link> : queued ? <small>Queued for AI rewrite</small> : <small>ID: {productId(product)}</small>}
          </div>
        </article>;
      })}</div> : <div className="src-empty"><Icon name="search" size={28} /><b>No supplier products found</b><span>Try a broader search phrase or another supplier.</span></div>}

      <div className="src-pagination"><button className="adm-btn ghost" disabled={searching || page <= 1} onClick={() => runSearch(page - 1)}><Icon name="chevleft" size={15} /> Previous</button><span>Page {page}</span><button className="adm-btn ghost" disabled={searching || !hasNext} onClick={() => runSearch(page + 1)}>Next <Icon name="chevright" size={15} /></button></div>
    </section>}

    {jobs.length > 0 && <section className="src-review-section">
      <div className="src-section-head"><div><h2>Background queue</h2><p>You can leave this page. The server will keep processing these products.</p></div><button className="adm-btn ghost" onClick={() => loadJobs().catch(error => toast(messageFrom(error)))}><Icon name="refresh" size={15} /> Refresh</button></div>
      <div className="src-review-list">{jobs.map(job => <SourcingJob key={job.id} job={job} onRetry={() => queueProducts([job])} />)}</div>
    </section>}
  </div>;
}

function SourcingJob({ job, onRetry }) {
  const title = job.enhanced_content?.name || job.supplier_product?.title || `${sourceLabel(job.supplier)} product ${job.external_product_id}`;
  if (job.status === 'completed') return <div className="panel src-review-done"><Icon name="check" size={20} stroke={3} /><div><b>{title}</b><span>{job.warning || 'AI rewrite completed and the product was added as a draft.'}</span></div><Link className="adm-btn ghost" href={`/admin/products/${job.product_id}`}>Review product</Link></div>;
  if (job.status === 'failed') return <div className="panel src-review-error"><Icon name="info" size={20} /><div><b>{title}</b><span>{job.error || 'This product could not be processed.'}</span></div><button className="adm-btn ghost" onClick={onRetry}>Retry</button></div>;
  return <div className="panel src-review-loading"><Icon name="refresh" size={20} /><div><b>{title}</b><span>{job.status === 'processing' ? 'AI is rewriting and saving this product…' : 'Waiting for a background worker…'}</span></div></div>;
}
