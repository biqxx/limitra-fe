'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { adminCategoriesApi, businessSettingsApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useAdminToast } from './AdminToastContext';
import { AdmHead } from './AdminShared';

const percentKeys = new Set([
  'pricing.sales_tax_basis_points',
  'pricing.customs_basis_points',
  'pricing.profit_markup_basis_points',
  'pricing.reprice_threshold_basis_points',
]);

const moneyKeys = new Set([
  'pricing.processing_fee_ngn_minor',
  'pricing.fx_buffer_ngn_minor',
  'pricing.rounding_unit_ngn_minor',
  'pricing.local_shipping_ngn_minor',
]);

function displayValue(setting) {
  if (percentKeys.has(setting.key)) return Number(setting.value) / 100;
  if (moneyKeys.has(setting.key)) return Number(setting.value) / 100;
  if (setting.key === 'pricing.air_cargo_usd_cents_per_lb') return Number(setting.value) / 100;
  if (setting.type === 'array') return (setting.value || []).join(', ');
  return setting.value;
}

function storedValue(setting, value) {
  if (setting.type === 'boolean') return Boolean(value);
  if (setting.type === 'array') return String(value).split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  if (percentKeys.has(setting.key) || moneyKeys.has(setting.key) || setting.key === 'pricing.air_cargo_usd_cents_per_lb') {
    return Math.round(Number(value) * 100);
  }
  return Math.round(Number(value));
}

function unitFor(setting) {
  if (percentKeys.has(setting.key)) return '%';
  if (moneyKeys.has(setting.key)) return '₦';
  if (setting.key === 'pricing.air_cargo_usd_cents_per_lb') return '$ / lb';
  if (setting.key === 'pricing.max_weight_ounces') return 'oz';
  if (setting.key === 'pricing.max_us_delivery_days') return 'days';
  return '';
}

function categoryMarkupDisplay(category) {
  if (category?.profit_markup_basis_points == null) return '';
  return String(Number(category.profit_markup_basis_points) / 100);
}

function categoryMarkupBasisPoints(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.min(100000, Math.round(num * 100));
}

export function AdminPricing() {
  const toast = useAdminToast();
  const [settings, setSettings] = useState([]);
  const [draft, setDraft] = useState({});
  const [categories, setCategories] = useState([]);
  const [catDraft, setCatDraft] = useState({});
  const [catFilter, setCatFilter] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [response, rawCats] = await Promise.all([
        businessSettingsApi.list({ group: 'pricing' }),
        adminCategoriesApi.list().catch(() => []),
      ]);
      const items = Array.isArray(response) ? response : response?.items || response?.data || [];
      setSettings(items);
      setDraft(Object.fromEntries(items.map(setting => [setting.key, displayValue(setting)])));

      const catList = Array.isArray(rawCats) ? rawCats : rawCats?.items || rawCats?.data || [];
      setCategories(catList);
      const nextCatDraft = {};
      catList.forEach(cat => {
        nextCatDraft[cat.id] = categoryMarkupDisplay(cat);
        (cat.subcategories || []).forEach(sub => {
          nextCatDraft[sub.id] = categoryMarkupDisplay(sub);
        });
      });
      setCatDraft(nextCatDraft);
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  // Initial network hydration is intentionally triggered when the page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const changed = useMemo(() => settings.filter(setting => {
    const next = storedValue(setting, draft[setting.key]);
    return JSON.stringify(next) !== JSON.stringify(setting.value);
  }), [draft, settings]);

  const flatCategories = useMemo(() => {
    const rows = [];
    categories.forEach(cat => {
      rows.push({ ...cat, _isSub: false, _parentName: null });
      (cat.subcategories || []).forEach(sub => {
        rows.push({ ...sub, _isSub: true, _parentName: cat.name, _parentId: cat.id });
      });
    });
    return rows;
  }, [categories]);

  const changedCategories = useMemo(() => flatCategories.filter(cat => {
    const nextBp = categoryMarkupBasisPoints(catDraft[cat.id]);
    const currentBp = cat.profit_markup_basis_points == null ? null : Number(cat.profit_markup_basis_points);
    return nextBp !== currentBp;
  }), [catDraft, flatCategories]);

  const totalChanges = changed.length + changedCategories.length;
  const globalMarkupPct = Number(draft['pricing.profit_markup_basis_points'] ?? 0);

  const filteredCategories = useMemo(() => {
    const q = catFilter.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(cat =>
      cat.name?.toLowerCase().includes(q)
      || (cat.subcategories || []).some(sub => sub.name?.toLowerCase().includes(q))
    );
  }, [categories, catFilter]);

  const save = async () => {
    if (totalChanges === 0) return;
    setSaving(true);
    try {
      if (changed.length > 0) {
        await businessSettingsApi.update(changed.map(setting => ({
          key: setting.key,
          value: storedValue(setting, draft[setting.key]),
        })));
      }
      for (const cat of changedCategories) {
        await adminCategoriesApi.update(cat.id, {
          profit_markup_basis_points: categoryMarkupBasisPoints(catDraft[cat.id]),
        });
      }
      toast('Pricing rules saved. Catalog repricing has been queued.');
      await load();
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdmHead title="Pricing rules" sub="The Limitra API is the single source of truth for sourced-product prices.">
        <button className="adm-btn primary" onClick={save} disabled={saving || totalChanges === 0}>
          <Icon name="check" size={15} /> {saving ? 'Saving…' : `Save ${totalChanges || ''} change${totalChanges === 1 ? '' : 's'}`}
        </button>
      </AdmHead>

      <div className="adm-note" style={{ marginBottom: 18 }}>
        <Icon name="info" size={15} /> Saving any rule or category markup override queues a background review of affected sourced products. New prices still require administrator approval before publishing.
      </div>

      <div className="panel" style={{ padding: 0, marginBottom: 22 }}>
        {!loaded ? <div className="adm-soon"><p>Loading pricing rules…</p></div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 0 }}>
            {settings.map(setting => {
              const isDecimal = percentKeys.has(setting.key) || moneyKeys.has(setting.key) || setting.key === 'pricing.air_cargo_usd_cents_per_lb';
              return (
                <label key={setting.key} className="adm-field" style={{ padding: 20, margin: 0, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><b>{setting.label}</b><small className="muted">v{setting.version}</small></span>
                  {setting.type === 'boolean' ? (
                    <select value={draft[setting.key] ? 'yes' : 'no'} onChange={event => setDraft(current => ({ ...current, [setting.key]: event.target.value === 'yes' }))}>
                      <option value="no">No — charge at checkout</option>
                      <option value="yes">Yes — include in product price</option>
                    </select>
                  ) : setting.type === 'array' ? (
                    <textarea rows="4" value={draft[setting.key] ?? ''} onChange={event => setDraft(current => ({ ...current, [setting.key]: event.target.value }))} placeholder="Comma-separated keywords" />
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input type="number" min="0" step={isDecimal ? '0.01' : '1'} value={draft[setting.key] ?? ''} onChange={event => setDraft(current => ({ ...current, [setting.key]: event.target.value }))} />
                      {unitFor(setting) && <small className="muted" style={{ position: 'absolute', right: 12, top: 12 }}>{unitFor(setting)}</small>}
                    </div>
                  )}
                  <small className="muted" style={{ lineHeight: 1.5 }}>{setting.description}</small>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {loaded && categories.length > 0 && (
        <div className="panel" style={{ padding: 20 }}>
          <div className="row between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17 }}>Category &amp; subcategory profit markup overrides</h3>
              <small className="muted">Precedence: subcategory override → category override → global default ({Number.isFinite(globalMarkupPct) ? `${globalMarkupPct}%` : '—'}). Leave blank to inherit.</small>
            </div>
            <input
              type="search"
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              placeholder="Filter categories…"
              style={{ maxWidth: 240, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}
            />
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {filteredCategories.map(cat => {
              const catVal = catDraft[cat.id] ?? '';
              const catEff = catVal !== '' ? `${catVal}%` : `${globalMarkupPct}% (global)`;
              const subs = cat.subcategories || [];
              const q = catFilter.trim().toLowerCase();
              const visibleSubs = q && !cat.name?.toLowerCase().includes(q)
                ? subs.filter(s => s.name?.toLowerCase().includes(q))
                : subs;

              return (
                <div key={cat.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                  <div className="row between" style={{ gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <b>{cat.name}</b>
                      <small className="muted" style={{ display: 'block', marginTop: 2 }}>Effective markup: {catEff}</small>
                    </div>
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <div style={{ position: 'relative', width: 130 }}>
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          step="0.01"
                          placeholder={String(globalMarkupPct)}
                          value={catVal}
                          onChange={e => setCatDraft(c => ({ ...c, [cat.id]: e.target.value }))}
                          style={{ width: '100%', paddingRight: 28 }}
                        />
                        <small className="muted" style={{ position: 'absolute', right: 10, top: 10 }}>%</small>
                      </div>
                      {catVal !== '' && (
                        <button type="button" className="adm-btn ghost" onClick={() => setCatDraft(c => ({ ...c, [cat.id]: '' }))}>Clear</button>
                      )}
                    </div>
                  </div>

                  {visibleSubs.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'grid', gap: 8 }}>
                      {visibleSubs.map(sub => {
                        const subVal = catDraft[sub.id] ?? '';
                        const subEff = subVal !== '' ? `${subVal}%` : (catVal !== '' ? `${catVal}% (category)` : `${globalMarkupPct}% (global)`);
                        return (
                          <div key={sub.id} className="row between" style={{ gap: 12, paddingLeft: 12, flexWrap: 'wrap' }}>
                            <div>
                              <span style={{ fontSize: 13.5 }}>{sub.name}</span>
                              <small className="muted" style={{ marginLeft: 8 }}>({subEff})</small>
                            </div>
                            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                              <div style={{ position: 'relative', width: 130 }}>
                                <input
                                  type="number"
                                  min="0"
                                  max="1000"
                                  step="0.01"
                                  placeholder={catVal !== '' ? catVal : String(globalMarkupPct)}
                                  value={subVal}
                                  onChange={e => setCatDraft(c => ({ ...c, [sub.id]: e.target.value }))}
                                  style={{ width: '100%', paddingRight: 28 }}
                                />
                                <small className="muted" style={{ position: 'absolute', right: 10, top: 10 }}>%</small>
                              </div>
                              {subVal !== '' && (
                                <button type="button" className="adm-btn ghost" onClick={() => setCatDraft(c => ({ ...c, [sub.id]: '' }))}>Clear</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
