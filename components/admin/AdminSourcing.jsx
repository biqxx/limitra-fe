'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { categoriesApi, sourcingApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { AdmHead, AdmSelect } from './AdminShared';
import { useAdminToast } from './AdminToastContext';

const productId = (product) => String(product.external_product_id || product.supplier_id || product.id || '');
const productSource = (product) => String(product.source || product.supplier || '').toLowerCase();
const productKey = (product) => `${productSource(product)}:${productId(product)}`;
const productTitle = (product) => product.title || product.name || 'Untitled supplier product';
const productImage = (product) => product.image_url || product.image || product.thumbnail || product.gallery?.[0] || '';
const money = (value, currency = 'USD') => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Price unavailable';
  try { return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString()}`; }
};

function normalizeCategories(payload) {
  const items = Array.isArray(payload) ? payload : payload?.items || payload?.data || [];
  return items.filter(category => !category.parent_id).map(category => ({
    ...category,
    subcategories: category.subcategories || category.subCategories || [],
  }));
}

function sourceLabel(source) {
  if (source === 'ebay') return 'eBay';
  if (source === 'amazon') return 'Amazon';
  return source || 'Supplier';
}

export function AdminSourcing() {
  const toast = useAdminToast();
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [source, setSource] = useState('all');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [queue, setQueue] = useState([]);
  const [searching, setSearching] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([sourcingApi.sources(), categoriesApi.list()])
      .then(([sourceData, categoryData]) => {
        if (!active) return;
        setSources(Array.isArray(sourceData) ? sourceData : []);
        setCategories(normalizeCategories(categoryData));
      })
      .catch(error => { if (active) toast(messageFrom(error)); });
    return () => { active = false; };
  }, [toast]);

  const enabledSources = sources.filter(item => item.enabled);
  const sourceOptions = [
    { value: 'all', label: 'All suppliers' },
    ...enabledSources.map(item => ({ value: item.id, label: item.name })),
  ];
  const selectable = results.filter(item => !item.imported && productId(item) && productSource(item));
  const allSelected = selectable.length > 0 && selectable.every(item => selected.has(productKey(item)));
  const selectedProducts = results.filter(item => selected.has(productKey(item)));
  const readyItems = queue.filter(item => item.state === 'ready');

  const runSearch = async (nextPage = 1) => {
    const q = (nextPage === 1 ? query : submittedQuery).trim();
    if (q.length < 2) { toast('Enter at least two characters to search.'); return; }
    setSearching(true);
    try {
      const payload = await sourcingApi.search({ source, q, page: nextPage });
      const products = Array.isArray(payload?.products) ? payload.products : [];
      setResults(products);
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
    if (product.imported) return;
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

  const prepareSelected = async () => {
    if (!selectedProducts.length) return;
    setPreparing(true);
    const existing = new Set(queue.map(item => item.key));
    const pending = selectedProducts.filter(item => !existing.has(productKey(item)));
    setQueue(current => [
      ...current,
      ...pending.map(product => ({ key: productKey(product), product, state: 'enhancing', error: '' })),
    ]);

    for (const product of pending) {
      const key = productKey(product);
      try {
        const payload = await sourcingApi.enhance({
          source: productSource(product),
          external_product_id: productId(product),
        });
        setQueue(current => current.map(item => item.key === key ? {
          ...item,
          state: 'ready',
          supplier: payload.supplier_product,
          draft: {
            ...payload.enhanced,
            category_id: payload.enhanced?.category_id ? String(payload.enhanced.category_id) : '',
            subcategory_id: payload.enhanced?.subcategory_id ? String(payload.enhanced.subcategory_id) : '',
            specifications: payload.enhanced?.specifications || [],
          },
        } : item));
      } catch (error) {
        setQueue(current => current.map(item => item.key === key ? { ...item, state: 'error', error: messageFrom(error) } : item));
      }
    }
    setPreparing(false);
    setSelected(new Set());
  };

  const retryEnhancement = async (item) => {
    setQueue(current => current.map(row => row.key === item.key ? { ...row, state: 'enhancing', error: '' } : row));
    try {
      const payload = await sourcingApi.enhance({
        source: productSource(item.product),
        external_product_id: productId(item.product),
      });
      setQueue(current => current.map(row => row.key === item.key ? {
        ...row,
        state: 'ready',
        supplier: payload.supplier_product,
        draft: {
          ...payload.enhanced,
          category_id: payload.enhanced?.category_id ? String(payload.enhanced.category_id) : '',
          subcategory_id: payload.enhanced?.subcategory_id ? String(payload.enhanced.subcategory_id) : '',
          specifications: payload.enhanced?.specifications || [],
        },
      } : row));
    } catch (error) {
      setQueue(current => current.map(row => row.key === item.key ? { ...row, state: 'error', error: messageFrom(error) } : row));
    }
  };

  const updateDraft = (key, field, value) => {
    setQueue(current => current.map(item => item.key === key
      ? { ...item, draft: { ...item.draft, [field]: value } }
      : item));
  };

  const updateSpecification = (key, index, field, value) => {
    setQueue(current => current.map(item => {
      if (item.key !== key) return item;
      const specifications = item.draft.specifications.map((specification, i) => i === index ? { ...specification, [field]: value } : specification);
      return { ...item, draft: { ...item.draft, specifications } };
    }));
  };

  const removeSpecification = (key, index) => {
    setQueue(current => current.map(item => item.key === key
      ? { ...item, draft: { ...item.draft, specifications: item.draft.specifications.filter((_, i) => i !== index) } }
      : item));
  };

  const publishReady = async () => {
    if (!readyItems.length) return;
    const missingCategory = readyItems.find(item => !item.draft.category_id);
    if (missingCategory) { toast(`Choose a category for “${missingCategory.draft.name}”.`); return; }
    setPublishing(true);

    for (const item of readyItems) {
      setQueue(current => current.map(row => row.key === item.key ? { ...row, state: 'publishing', error: '' } : row));
      try {
        const imported = await sourcingApi.import({
          source: productSource(item.product),
          external_product_id: productId(item.product),
          category_id: Number(item.draft.category_id),
          subcategory_id: item.draft.subcategory_id ? Number(item.draft.subcategory_id) : null,
          name: item.draft.name.trim(),
          brand: item.draft.brand?.trim() || null,
          description: item.draft.description?.trim() || null,
          specifications: item.draft.specifications
            .map(specification => ({ name: specification.name.trim(), value: specification.value.trim() }))
            .filter(specification => specification.name && specification.value),
        });
        setQueue(current => current.map(row => row.key === item.key ? {
          ...row,
          state: 'imported',
          importedProduct: imported.product,
        } : row));
        setResults(current => current.map(product => productKey(product) === item.key
          ? { ...product, imported: true, product_id: imported.product?.id }
          : product));
      } catch (error) {
        setQueue(current => current.map(row => row.key === item.key ? { ...row, state: 'error', error: messageFrom(error) } : row));
      }
    }

    setPublishing(false);
    toast('Finished adding prepared products to the catalog.');
  };

  const hasNext = useMemo(() => {
    const lastPage = Number(pagination?.last_page || pagination?.pages || 0);
    if (lastPage) return page < lastPage;
    return Boolean(pagination?.has_next || pagination?.next_page || results.length > 0);
  }, [page, pagination, results.length]);

  return (
    <div className="src-page">
      <AdmHead title="Product sourcing" sub="Search suppliers, improve listings with AI, then add reviewed products as drafts." />

      <section className="panel src-search-panel">
        <form className="src-search" onSubmit={event => { event.preventDefault(); runSearch(1); }}>
          <div className="src-source-select">
            <span>Supplier</span>
            <AdmSelect value={source} options={sourceOptions} onChange={setSource} />
          </div>
          <label className="src-query">
            <span>What are you looking for?</span>
            <div><Icon name="search" size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. wireless headphones" /></div>
          </label>
          <button className="adm-btn primary src-search-btn" type="submit" disabled={searching || query.trim().length < 2}>
            <Icon name={searching ? 'refresh' : 'search'} size={16} /> {searching ? 'Searching…' : 'Search products'}
          </button>
        </form>
        {sources.some(item => !item.enabled) && <p className="src-source-note">Unavailable sources: {sources.filter(item => !item.enabled).map(item => `${item.name}${item.reason ? ` — ${item.reason}` : ''}`).join(', ')}</p>}
      </section>

      {(results.length > 0 || submittedQuery) && (
        <section className="src-results-section">
          <div className="src-section-head">
            <div><h2>Supplier results</h2><p>{results.length} results for “{submittedQuery}”</p></div>
            <div className="src-bulk-actions">
              <button className="adm-btn ghost" onClick={toggleAll} disabled={!selectable.length}>{allSelected ? 'Clear selection' : 'Select page'}</button>
              <button className="adm-btn primary" onClick={prepareSelected} disabled={!selectedProducts.length || preparing}>
                <Icon name="spark" size={16} /> {preparing ? 'AI is rewriting…' : `Rewrite selected (${selectedProducts.length})`}
              </button>
            </div>
          </div>

          {results.length ? <div className="src-grid">
            {results.map(product => {
              const key = productKey(product);
              const checked = selected.has(key);
              const image = productImage(product);
              return (
                <article key={key} className={'src-card' + (checked ? ' selected' : '') + (product.imported ? ' imported' : '')}>
                  <button className="src-card-pick" onClick={() => toggleProduct(product)} disabled={product.imported} aria-label={checked ? 'Deselect product' : 'Select product'}>
                    {checked && <Icon name="check" size={15} stroke={3} />}
                  </button>
                  <div className="src-card-image">{image ? <img src={image} alt="" /> : <Icon name="package" size={30} />}</div>
                  <div className="src-card-body">
                    <span className="src-source-badge">{sourceLabel(productSource(product))}</span>
                    <h3>{productTitle(product)}</h3>
                    <p className="src-card-price">{money(product.price, product.currency || 'USD')}</p>
                    {Number(product.final_price_ngn) > 0 && <p className="src-final-price">Limitra price {money(product.final_price_ngn, 'NGN')}</p>}
                    {product.imported
                      ? <Link className="src-imported-link" href={`/admin/products/${product.product_id}`}>Already added · View product</Link>
                      : <small>ID: {productId(product)}</small>}
                  </div>
                </article>
              );
            })}
          </div> : <div className="src-empty"><Icon name="search" size={28} /><b>No supplier products found</b><span>Try a broader search phrase or another supplier.</span></div>}

          <div className="src-pagination">
            <button className="adm-btn ghost" disabled={searching || page <= 1} onClick={() => runSearch(page - 1)}><Icon name="chevleft" size={15} /> Previous</button>
            <span>Page {page}</span>
            <button className="adm-btn ghost" disabled={searching || !hasNext} onClick={() => runSearch(page + 1)}>Next <Icon name="chevright" size={15} /></button>
          </div>
        </section>
      )}

      {queue.length > 0 && (
        <section className="src-review-section">
          <div className="src-section-head">
            <div><h2>Review queue</h2><p>AI suggestions stay editable until you add them to the catalog.</p></div>
            <button className="adm-btn primary" onClick={publishReady} disabled={!readyItems.length || publishing}>
              <Icon name="plus" size={16} /> {publishing ? 'Adding drafts…' : `Add ready drafts (${readyItems.length})`}
            </button>
          </div>
          <div className="src-review-list">
            {queue.map(item => <ReviewItem
              key={item.key}
              item={item}
              categories={categories}
              onChange={(field, value) => updateDraft(item.key, field, value)}
              onSpecChange={(index, field, value) => updateSpecification(item.key, index, field, value)}
              onSpecRemove={index => removeSpecification(item.key, index)}
              onSpecAdd={() => updateDraft(item.key, 'specifications', [...item.draft.specifications, { name: '', value: '' }])}
              onRetry={() => retryEnhancement(item)}
              onRemove={() => setQueue(current => current.filter(row => row.key !== item.key))}
            />)}
          </div>
        </section>
      )}
    </div>
  );
}

function ReviewItem({ item, categories, onChange, onSpecChange, onSpecRemove, onSpecAdd, onRetry, onRemove }) {
  const image = productImage(item.supplier || item.product);
  if (item.state === 'enhancing') return <div className="panel src-review-loading"><Icon name="spark" size={20} /><div><b>Improving {productTitle(item.product)}</b><span>Fetching full details and rewriting the listing with AI…</span></div></div>;
  if (item.state === 'error') return <div className="panel src-review-error"><Icon name="info" size={20} /><div><b>{productTitle(item.product)}</b><span>{item.error}</span></div><button className="adm-btn ghost" onClick={onRetry}>Retry</button><button className="adm-icon-btn" onClick={onRemove} aria-label="Remove"><Icon name="close" size={17} /></button></div>;
  if (item.state === 'imported') return <div className="panel src-review-done"><Icon name="check" size={20} stroke={3} /><div><b>{item.importedProduct?.name || productTitle(item.product)}</b><span>Added to the catalog as a draft.</span></div><Link className="adm-btn ghost" href={`/admin/products/${item.importedProduct?.id}`}>Review product</Link></div>;
  if (item.state === 'publishing') return <div className="panel src-review-loading"><Icon name="refresh" size={20} /><div><b>Adding {item.draft.name}</b><span>Saving the reviewed listing and supplier record…</span></div></div>;

  const category = categories.find(entry => String(entry.id) === String(item.draft.category_id));
  const subcategories = category?.subcategories || [];
  return (
    <article className="panel src-review-card">
      <div className="src-review-summary">
        <div className="src-review-image">{image ? <img src={image} alt="" /> : <Icon name="package" size={30} />}</div>
        <div><span className="src-source-badge">{sourceLabel(productSource(item.product))}</span><b>{productTitle(item.product)}</b><small>{money(item.supplier?.final_price_ngn, 'NGN')} · {productId(item.product)}</small></div>
        <button className="adm-icon-btn" onClick={onRemove} aria-label="Remove from review queue"><Icon name="close" size={18} /></button>
      </div>
      <div className="src-review-form">
        <label className="adm-field src-wide"><span>Improved product name</span><input value={item.draft.name || ''} onChange={event => onChange('name', event.target.value)} /></label>
        <label className="adm-field"><span>Brand</span><input value={item.draft.brand || ''} onChange={event => onChange('brand', event.target.value)} /></label>
        <label className="adm-field"><span>Category</span><select value={item.draft.category_id || ''} onChange={event => { onChange('category_id', event.target.value); onChange('subcategory_id', ''); }}><option value="">Choose category</option>{categories.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
        <label className="adm-field"><span>Subcategory</span><select value={item.draft.subcategory_id || ''} onChange={event => onChange('subcategory_id', event.target.value)} disabled={!category}><option value="">No subcategory</option>{subcategories.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
        <label className="adm-field src-wide"><span>Improved description</span><textarea rows={4} value={item.draft.description || ''} onChange={event => onChange('description', event.target.value)} /></label>
        <div className="adm-field src-wide"><span>Product details</span><div className="src-spec-list">{item.draft.specifications.map((specification, index) => <div className="src-spec-row" key={index}><input aria-label="Specification name" value={specification.name} onChange={event => onSpecChange(index, 'name', event.target.value)} placeholder="Detail" /><input aria-label="Specification value" value={specification.value} onChange={event => onSpecChange(index, 'value', event.target.value)} placeholder="Value" /><button onClick={() => onSpecRemove(index)} aria-label="Remove specification"><Icon name="close" size={15} /></button></div>)}</div><button className="adm-btn ghost sm src-add-spec" onClick={onSpecAdd}><Icon name="plus" size={14} /> Add detail</button></div>
      </div>
    </article>
  );
}
