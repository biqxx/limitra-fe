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

const marginKeys = new Set([
  'pricing.profit_markup_basis_points',
  'pricing.sales_tax_basis_points',
  'pricing.customs_basis_points',
  'pricing.reprice_threshold_basis_points',
]);

const logisticsKeys = new Set([
  'pricing.air_cargo_usd_cents_per_lb',
  'pricing.local_shipping_ngn_minor',
  'pricing.fx_buffer_ngn_minor',
  'pricing.processing_fee_ngn_minor',
  'pricing.rounding_unit_ngn_minor',
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
  const [onlyOverrides, setOnlyOverrides] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const hydrateDrafts = useCallback((items, catList) => {
    setDraft(Object.fromEntries(items.map(setting => [setting.key, displayValue(setting)])));
    const nextCatDraft = {};
    catList.forEach(cat => {
      nextCatDraft[cat.id] = categoryMarkupDisplay(cat);
      (cat.subcategories || []).forEach(sub => {
        nextCatDraft[sub.id] = categoryMarkupDisplay(sub);
      });
    });
    setCatDraft(nextCatDraft);
  }, []);

  const load = useCallback(async () => {
    try {
      const [response, rawCats] = await Promise.all([
        businessSettingsApi.list({ group: 'pricing' }),
        adminCategoriesApi.list().catch(() => []),
      ]);
      const items = Array.isArray(response) ? response : response?.items || response?.data || [];
      const catList = Array.isArray(rawCats) ? rawCats : rawCats?.items || rawCats?.data || [];
      setSettings(items);
      setCategories(catList);
      hydrateDrafts(items, catList);
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [hydrateDrafts, toast]);

  // Initial network hydration is intentionally triggered when the page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const isSettingDirty = useCallback((setting) => {
    const next = storedValue(setting, draft[setting.key]);
    return JSON.stringify(next) !== JSON.stringify(setting.value);
  }, [draft]);

  const changed = useMemo(() => settings.filter(isSettingDirty), [isSettingDirty, settings]);

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

  const isCatDirty = useCallback((cat) => {
    const nextBp = categoryMarkupBasisPoints(catDraft[cat.id]);
    const currentBp = cat.profit_markup_basis_points == null ? null : Number(cat.profit_markup_basis_points);
    return nextBp !== currentBp;
  }, [catDraft]);

  const changedCategories = useMemo(() => flatCategories.filter(isCatDirty), [flatCategories, isCatDirty]);

  const overrideCount = useMemo(
    () => flatCategories.filter(cat => String(catDraft[cat.id] ?? '').trim() !== '').length,
    [catDraft, flatCategories],
  );

  const totalChanges = changed.length + changedCategories.length;
  const globalMarkupPct = Number(draft['pricing.profit_markup_basis_points'] ?? 0);

  const ruleGroups = useMemo(() => {
    const margins = [];
    const logistics = [];
    const sourcing = [];
    settings.forEach(s => {
      if (marginKeys.has(s.key)) margins.push(s);
      else if (logisticsKeys.has(s.key)) logistics.push(s);
      else sourcing.push(s);
    });
    return [
      { id: 'margins', title: 'Margins, Taxes & Repricing', sub: 'Default profit markup, US sales tax, customs duty, and auto-reprice threshold.', icon: 'tag', items: margins },
      { id: 'logistics', title: 'Shipping, FX & Processing Fees', sub: 'Air cargo per-lb rate, local delivery, FX buffer, payment fees, and rounding.', icon: 'truck', items: logistics },
      { id: 'sourcing', title: 'Sourcing Guards & Exclusions', sub: 'Weight and delivery limits plus keyword filters applied during supplier import.', icon: 'shield', items: sourcing },
    ].filter(g => g.items.length > 0);
  }, [settings]);

  const filteredCategories = useMemo(() => {
    const q = catFilter.trim().toLowerCase();
    return categories.filter(cat => {
      const catHasOverride = String(catDraft[cat.id] ?? '').trim() !== '';
      const subHasOverride = (cat.subcategories || []).some(sub => String(catDraft[sub.id] ?? '').trim() !== '');
      if (onlyOverrides && !catHasOverride && !subHasOverride) return false;
      if (!q) return true;
      return cat.name?.toLowerCase().includes(q)
        || (cat.subcategories || []).some(sub => sub.name?.toLowerCase().includes(q));
    });
  }, [categories, catDraft, catFilter, onlyOverrides]);

  const resetDraft = () => {
    hydrateDrafts(settings, categories);
    toast('Unsaved changes discarded.');
  };

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
      <AdmHead title="Pricing rules" sub="Single source of truth for global margins, landed-cost fees, and category overrides.">
        {totalChanges > 0 && (
          <button type="button" className="adm-btn ghost" onClick={resetDraft} disabled={saving}>
            <Icon name="refresh" size={14} /> Discard
          </button>
        )}
        <button className="adm-btn primary" onClick={save} disabled={saving || totalChanges === 0}>
          <Icon name="check" size={15} /> {saving ? 'Saving…' : totalChanges > 0 ? `Save ${totalChanges} change${totalChanges === 1 ? '' : 's'}` : 'All changes saved'}
        </button>
      </AdmHead>

      <div className="prc-kpis">
        <div className="prc-kpi accent">
          <div className="prc-kpi-top"><span>Global Markup</span><Icon name="tag" size={15} /></div>
          <b>{loaded && Number.isFinite(globalMarkupPct) ? `${globalMarkupPct}%` : '—'}</b>
          <small>Default profit margin</small>
        </div>
        <div className="prc-kpi">
          <div className="prc-kpi-top"><span>Global Rules</span><Icon name="shield" size={15} /></div>
          <b>{loaded ? settings.length : '—'}</b>
          <small>Synced from Limitra API</small>
        </div>
        <div className="prc-kpi">
          <div className="prc-kpi-top"><span>Custom Overrides</span><Icon name="grid" size={15} /></div>
          <b>{loaded ? overrideCount : '—'}</b>
          <small>Across {flatCategories.length} categories</small>
        </div>
        <div className={`prc-kpi${totalChanges > 0 ? ' warn' : ''}`}>
          <div className="prc-kpi-top"><span>Pending Edits</span><Icon name="edit" size={15} /></div>
          <b>{totalChanges}</b>
          <small>{totalChanges > 0 ? 'Ready to save & reprice' : 'No unsaved changes'}</small>
        </div>
      </div>

      <div className="adm-note" style={{ marginBottom: 18 }}>
        <Icon name="info" size={15} /> Saving any rule or category markup override queues a background review of affected sourced products. New prices still require administrator approval before publishing.
      </div>

      {!loaded ? (
        <div className="panel"><div className="adm-soon"><p>Loading pricing rules…</p></div></div>
      ) : (
        ruleGroups.map(group => (
          <section key={group.id} className="prc-section">
            <div className="prc-sec-head">
              <div className="prc-sec-title">
                <span className="prc-sec-ic"><Icon name={group.icon} size={17} /></span>
                <div>
                  <h3>{group.title}</h3>
                  <small>{group.sub}</small>
                </div>
              </div>
              <span className="adm-pill muted">{group.items.length} rule{group.items.length === 1 ? '' : 's'}</span>
            </div>

            <div className="prc-grid">
              {group.items.map(setting => {
                const isDecimal = percentKeys.has(setting.key) || moneyKeys.has(setting.key) || setting.key === 'pricing.air_cargo_usd_cents_per_lb';
                const dirty = isSettingDirty(setting);
                const unit = unitFor(setting);
                return (
                  <label key={setting.key} className={`prc-rule${dirty ? ' dirty' : ''}${setting.type === 'array' ? ' wide' : ''}`}>
                    <div className="prc-rule-head">
                      <b>{setting.label}</b>
                      <div className="prc-rule-meta">
                        {dirty && <span className="adm-pill warn">Modified</span>}
                        <span className="prc-ver">v{setting.version}</span>
                      </div>
                    </div>

                    {setting.type === 'boolean' ? (
                      <div className="prc-input-wrap">
                        <select value={draft[setting.key] ? 'yes' : 'no'} onChange={event => setDraft(current => ({ ...current, [setting.key]: event.target.value === 'yes' }))}>
                          <option value="no">No — charge at checkout</option>
                          <option value="yes">Yes — include in product price</option>
                        </select>
                      </div>
                    ) : setting.type === 'array' ? (
                      <textarea className="prc-textarea" rows="3" value={draft[setting.key] ?? ''} onChange={event => setDraft(current => ({ ...current, [setting.key]: event.target.value }))} placeholder="Comma-separated keywords" />
                    ) : (
                      <div className="prc-input-wrap">
                        <input type="number" min="0" step={isDecimal ? '0.01' : '1'} value={draft[setting.key] ?? ''} onChange={event => setDraft(current => ({ ...current, [setting.key]: event.target.value }))} />
                        {unit && <span className="prc-unit">{unit}</span>}
                      </div>
                    )}

                    <p className="prc-rule-desc">{setting.description}</p>
                  </label>
                );
              })}
            </div>
          </section>
        ))
      )}

      {loaded && categories.length > 0 && (
        <section className="prc-section">
          <div className="prc-sec-head">
            <div className="prc-sec-title">
              <span className="prc-sec-ic"><Icon name="grid" size={17} /></span>
              <div>
                <h3>Category &amp; Subcategory Markup Overrides</h3>
                <small>Precedence: Subcategory → Category → Global ({Number.isFinite(globalMarkupPct) ? `${globalMarkupPct}%` : '—'}). Leave blank to inherit.</small>
              </div>
            </div>

            <div className="prc-cat-tools">
              <button type="button" className={`adm-chip${!onlyOverrides ? ' on' : ''}`} onClick={() => setOnlyOverrides(false)}>All</button>
              <button type="button" className={`adm-chip${onlyOverrides ? ' on' : ''}`} onClick={() => setOnlyOverrides(true)}>Overrides ({overrideCount})</button>
              <div className="adm-mini-search">
                <Icon name="search" size={14} />
                <input
                  type="search"
                  value={catFilter}
                  onChange={e => setCatFilter(e.target.value)}
                  placeholder="Filter categories…"
                />
              </div>
            </div>
          </div>

          <div className="prc-cat-list">
            {filteredCategories.length === 0 ? (
              <div className="adm-soon"><p>No categories match the current filter.</p></div>
            ) : filteredCategories.map(cat => {
              const catVal = String(catDraft[cat.id] ?? '').trim();
              const catDirty = isCatDirty(cat);
              const subs = cat.subcategories || [];
              const q = catFilter.trim().toLowerCase();
              const visibleSubs = subs.filter(s => {
                if (onlyOverrides && String(catDraft[s.id] ?? '').trim() === '' && catVal === '') return false;
                if (q && !cat.name?.toLowerCase().includes(q)) return s.name?.toLowerCase().includes(q);
                return true;
              });
              const isOpen = !collapsed[cat.id] || q !== '';

              return (
                <div key={cat.id} className="prc-cat-group">
                  <div className={`prc-cat-row${catDirty ? ' dirty' : ''}`}>
                    <div className="prc-cat-left">
                      {subs.length > 0 ? (
                        <button
                          type="button"
                          className="cat-expand"
                          aria-label={isOpen ? 'Collapse subcategories' : 'Expand subcategories'}
                          onClick={() => setCollapsed(c => ({ ...c, [cat.id]: !c[cat.id] }))}
                        >
                          <Icon name={isOpen ? 'chevdown' : 'chevright'} size={15} />
                        </button>
                      ) : <span style={{ width: 26 }} />}

                      <div className="prc-cat-name">
                        <b>{cat.name}</b>
                        {catVal !== '' ? (
                          <span className="adm-pill info">{catVal}% override</span>
                        ) : (
                          <span className="adm-pill muted">Inherits {globalMarkupPct}%</span>
                        )}
                        {catDirty && <span className="adm-pill warn">Modified</span>}
                        {subs.length > 0 && <small className="muted">{subs.length} subcategor{subs.length === 1 ? 'y' : 'ies'}</small>}
                      </div>
                    </div>

                    <div className="prc-cat-right">
                      <div className="prc-input-wrap prc-cat-input">
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          step="0.01"
                          placeholder={String(globalMarkupPct)}
                          value={catDraft[cat.id] ?? ''}
                          onChange={e => setCatDraft(c => ({ ...c, [cat.id]: e.target.value }))}
                        />
                        <span className="prc-unit">%</span>
                      </div>
                      {catVal !== '' && (
                        <button type="button" className="adm-btn ghost" onClick={() => setCatDraft(c => ({ ...c, [cat.id]: '' }))}>Clear</button>
                      )}
                    </div>
                  </div>

                  {isOpen && visibleSubs.length > 0 && (
                    <div className="prc-sub-list">
                      {visibleSubs.map(sub => {
                        const subVal = String(catDraft[sub.id] ?? '').trim();
                        const subDirty = isCatDirty(sub);
                        const inheritedLabel = catVal !== '' ? `Inherits ${catVal}% (category)` : `Inherits ${globalMarkupPct}% (global)`;
                        return (
                          <div key={sub.id} className={`prc-sub-row${subDirty ? ' dirty' : ''}`}>
                            <div className="prc-cat-left">
                              <span className="cat-branch" aria-hidden="true" />
                              <div className="prc-cat-name">
                                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{sub.name}</span>
                                {subVal !== '' ? (
                                  <span className="adm-pill info">{subVal}% override</span>
                                ) : (
                                  <span className="adm-pill muted">{inheritedLabel}</span>
                                )}
                                {subDirty && <span className="adm-pill warn">Modified</span>}
                              </div>
                            </div>

                            <div className="prc-cat-right">
                              <div className="prc-input-wrap prc-cat-input">
                                <input
                                  type="number"
                                  min="0"
                                  max="1000"
                                  step="0.01"
                                  placeholder={catVal !== '' ? catVal : String(globalMarkupPct)}
                                  value={catDraft[sub.id] ?? ''}
                                  onChange={e => setCatDraft(c => ({ ...c, [sub.id]: e.target.value }))}
                                />
                                <span className="prc-unit">%</span>
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
        </section>
      )}

      {totalChanges > 0 && (
        <div className="prc-savebar">
          <div className="prc-savebar-info">
            <span className="adm-pill warn">{totalChanges}</span>
            <span>Unsaved pricing change{totalChanges === 1 ? '' : 's'}</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="adm-btn ghost" onClick={resetDraft} disabled={saving}>Discard</button>
            <button type="button" className="adm-btn primary" onClick={save} disabled={saving}>
              <Icon name="check" size={15} /> {saving ? 'Saving…' : 'Save & queue reprice'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
