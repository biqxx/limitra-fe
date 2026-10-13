'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { adminCategoriesApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useAdminToast } from './AdminToastContext';
import { AdmHead } from './AdminShared';

const ICONS = ['grid', 'phone', 'spark', 'shirt', 'makeup', 'store', 'gift', 'truck', 'heart', 'tag', 'package'];

const blankCategory = (parentId = null) => ({
  id: null,
  parent_id: parentId,
  name: '',
  slug: '',
  description: '',
  icon: 'grid',
  sort_order: 0,
  age_gated: false,
  active: true,
});

function categoryDraft(category) {
  return {
    id: category.id,
    parent_id: category.parent_id,
    name: category.name || '',
    slug: category.slug || '',
    description: category.description || '',
    icon: category.icon || 'grid',
    sort_order: category.sort_order ?? 0,
    age_gated: Boolean(category.age_gated),
    active: Boolean(category.active),
  };
}

function CategoryDrawer({ draft, parents, saving, onChange, onClose, onSave }) {
  const editing = Boolean(draft.id);
  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label={editing ? 'Edit category' : 'Add category'}>
        <div className="adm-drawer-h">
          <div><h3>{editing ? 'Edit category' : 'Add category'}</h3><small className="muted">Manage how this group appears in the storefront.</small></div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">
          <label className="adm-field">
            <span>Name</span>
            <input value={draft.name} onChange={event => onChange({ name: event.target.value })} placeholder="e.g. Phones & Tablets" autoFocus />
          </label>
          <label className="adm-field">
            <span>Parent category</span>
            <select value={draft.parent_id ?? ''} onChange={event => onChange({ parent_id: event.target.value ? Number(event.target.value) : null })}>
              <option value="">Top-level department</option>
              {parents.filter(parent => parent.id !== draft.id).map(parent => <option key={parent.id} value={parent.id}>{parent.name}</option>)}
            </select>
          </label>
          <label className="adm-field">
            <span>URL slug</span>
            <input value={draft.slug} onChange={event => onChange({ slug: event.target.value })} placeholder="Generated from the name when left blank" />
          </label>
          <label className="adm-field">
            <span>Description</span>
            <textarea rows="4" value={draft.description} onChange={event => onChange({ description: event.target.value })} placeholder="A short description for customers and search." />
          </label>
          <div className="adm-field-row">
            <label className="adm-field">
              <span>Icon</span>
              <select value={draft.icon} onChange={event => onChange({ icon: event.target.value })}>
                {ICONS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
              </select>
            </label>
            <label className="adm-field">
              <span>Display order</span>
              <input type="number" min="0" max="32767" value={draft.sort_order} onChange={event => onChange({ sort_order: event.target.value })} />
            </label>
          </div>
          <div className="cat-options">
            <label>
              <input type="checkbox" checked={draft.active} onChange={event => onChange({ active: event.target.checked })} />
              <span><b>Visible in store</b><small>Inactive categories remain available to administrators.</small></span>
            </label>
            <label>
              <input type="checkbox" checked={draft.age_gated} onChange={event => onChange({ age_gated: event.target.checked })} />
              <span><b>Age restricted</b><small>Require the storefront’s adult-content gate.</small></span>
            </label>
          </div>
        </div>
        <div className="adm-drawer-f">
          <button className="adm-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="adm-btn primary" onClick={onSave} disabled={saving || !draft.name.trim()}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add category'}</button>
        </div>
      </aside>
    </>
  );
}

export function AdminCategories() {
  const toast = useAdminToast();
  const [categories, setCategories] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [expanded, setExpanded] = useState(() => new Set());
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const response = await adminCategoriesApi.list();
      const items = Array.isArray(response) ? response : response?.items || response?.data || [];
      setCategories(items);
      setExpanded(current => current.size ? current : new Set(items.map(category => category.id)));
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  // Initial network hydration is intentionally triggered when the page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadCategories(); }, [loadCategories]);

  const subcategoryCount = categories.reduce((total, category) => total + (category.subcategories?.length || 0), 0);
  const inactiveCount = categories.reduce((total, category) => total + (category.active ? 0 : 1) + (category.subcategories || []).filter(item => !item.active).length, 0);
  const productCount = categories.reduce((total, category) => total + Number(category.products_count || 0), 0);

  const visibleCategories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matchesStatus = category => status === 'all' || (status === 'active' ? category.active : !category.active);
    const matchesText = category => !needle || `${category.name} ${category.slug} ${category.description || ''}`.toLowerCase().includes(needle);

    return categories.map(category => {
      const subcategories = (category.subcategories || []).filter(item => matchesStatus(item) && matchesText(item));
      const categoryMatches = matchesStatus(category) && matchesText(category);
      return categoryMatches || subcategories.length ? { ...category, subcategories: categoryMatches && !needle ? (category.subcategories || []).filter(matchesStatus) : subcategories } : null;
    }).filter(Boolean);
  }, [categories, query, status]);

  const toggleExpanded = id => setExpanded(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const saveCategory = async () => {
    if (!draft?.name.trim()) return;
    setSaving(true);
    const body = {
      parent_id: draft.parent_id,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      icon: draft.icon || null,
      sort_order: Math.max(0, Number(draft.sort_order) || 0),
      age_gated: draft.age_gated,
      active: draft.active,
    };
    if (draft.slug.trim()) body.slug = draft.slug.trim();

    try {
      if (draft.id) await adminCategoriesApi.update(draft.id, body);
      else await adminCategoriesApi.create(body);
      toast(draft.id ? 'Category updated' : 'Category added');
      setDraft(null);
      await loadCategories();
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (category, active) => {
    try {
      await adminCategoriesApi.update(category.id, { active });
      toast(active ? 'Category is now visible' : 'Category hidden from the store');
      await loadCategories();
    } catch (error) {
      toast(messageFrom(error));
    }
  };

  const removeCategory = async category => {
    if (!window.confirm(`Delete “${category.name}”? Categories in use cannot be deleted.`)) return;
    try {
      await adminCategoriesApi.remove(category.id);
      toast('Category deleted');
      await loadCategories();
    } catch (error) {
      toast(messageFrom(error));
    }
  };

  return (
    <>
      <AdmHead title="Categories" sub="Organize storefront departments, subcategories and visibility.">
        <button className="adm-btn primary" onClick={() => setDraft(blankCategory())}><Icon name="plus" size={15} /> Add category</button>
      </AdmHead>

      <div className="cat-kpis">
        <div><span>Departments</span><b>{categories.length}</b></div>
        <div><span>Subcategories</span><b>{subcategoryCount}</b></div>
        <div><span>Assigned products</span><b>{productCount}</b></div>
        <div><span>Hidden</span><b>{inactiveCount}</b></div>
      </div>

      <div className="adm-filters">
        <div className="adm-mini-search"><Icon name="search" size={16} className="muted" /><input placeholder="Search categories…" value={query} onChange={event => setQuery(event.target.value)} /></div>
        {['all', 'active', 'inactive'].map(value => <button key={value} className={'adm-chip' + (status === value ? ' on' : '')} onClick={() => setStatus(value)}>{value === 'all' ? 'All' : value === 'active' ? 'Visible' : 'Hidden'}</button>)}
      </div>

      <div className="panel cat-panel">
        {!loaded ? <div className="adm-soon"><p>Loading categories…</p></div> : visibleCategories.length === 0 ? (
          <div className="adm-soon"><div className="as-ic"><Icon name="list" size={26} /></div><h3>No categories found</h3><p>Try another search, or add a new storefront category.</p></div>
        ) : visibleCategories.map(category => {
          const open = expanded.has(category.id) || Boolean(query);
          return (
            <section className="cat-group" key={category.id}>
              <div className="cat-parent-row">
                <button className="cat-expand" onClick={() => toggleExpanded(category.id)} aria-label={open ? 'Collapse subcategories' : 'Expand subcategories'}><Icon name={open ? 'chevdown' : 'chevright'} size={17} /></button>
                <div className="cat-icon"><Icon name={category.icon || 'grid'} size={19} /></div>
                <div className="cat-main"><b>{category.name}</b><small>/{category.slug} · {category.subcategories?.length || 0} subcategories</small></div>
                <span className={'adm-pill ' + (category.active ? 'ok' : 'muted')}>{category.active ? 'Visible' : 'Hidden'}</span>
                {category.age_gated && <span className="adm-pill warn">18+</span>}
                <span className="cat-products">{category.products_count || 0} products</span>
                <div className="adm-rowact">
                  <button onClick={() => setDraft(blankCategory(category.id))} title="Add subcategory" aria-label="Add subcategory"><Icon name="plus" size={15} /></button>
                  <button onClick={() => setActive(category, !category.active)} title={category.active ? 'Hide category' : 'Show category'} aria-label={category.active ? 'Hide category' : 'Show category'}><Icon name={category.active ? 'eye' : 'check'} size={15} /></button>
                  <button onClick={() => setDraft(categoryDraft(category))} title="Edit category" aria-label="Edit category"><Icon name="edit" size={15} /></button>
                  <button className="del" onClick={() => removeCategory(category)} title="Delete category" aria-label="Delete category"><Icon name="trash" size={15} /></button>
                </div>
              </div>
              {open && (category.subcategories || []).map(item => (
                <div className="cat-child-row" key={item.id}>
                  <span className="cat-branch" />
                  <div className="cat-main"><b>{item.name}</b><small>/{item.slug} · order {item.sort_order}</small></div>
                  <span className={'adm-pill ' + (item.active ? 'ok' : 'muted')}>{item.active ? 'Visible' : 'Hidden'}</span>
                  {item.age_gated && <span className="adm-pill warn">18+</span>}
                  <span className="cat-products">{item.products_count || 0} products</span>
                  <div className="adm-rowact">
                    <button onClick={() => setActive(item, !item.active)} title={item.active ? 'Hide subcategory' : 'Show subcategory'} aria-label={item.active ? 'Hide subcategory' : 'Show subcategory'}><Icon name={item.active ? 'eye' : 'check'} size={15} /></button>
                    <button onClick={() => setDraft(categoryDraft(item))} title="Edit subcategory" aria-label="Edit subcategory"><Icon name="edit" size={15} /></button>
                    <button className="del" onClick={() => removeCategory(item)} title="Delete subcategory" aria-label="Delete subcategory"><Icon name="trash" size={15} /></button>
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>

      {draft && <CategoryDrawer draft={draft} parents={categories} saving={saving} onChange={changes => setDraft(current => ({ ...current, ...changes }))} onClose={() => setDraft(null)} onSave={saveCategory} />}
    </>
  );
}
