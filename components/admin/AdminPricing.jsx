'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { businessSettingsApi } from '@/lib/api/endpoints';
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

export function AdminPricing() {
  const toast = useAdminToast();
  const [settings, setSettings] = useState([]);
  const [draft, setDraft] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await businessSettingsApi.list({ group: 'pricing' });
      const items = Array.isArray(response) ? response : response?.items || response?.data || [];
      setSettings(items);
      setDraft(Object.fromEntries(items.map(setting => [setting.key, displayValue(setting)])));
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

  const save = async () => {
    if (!changed.length) return;
    setSaving(true);
    try {
      await businessSettingsApi.update(changed.map(setting => ({
        key: setting.key,
        value: storedValue(setting, draft[setting.key]),
      })));
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
        <button className="adm-btn primary" onClick={save} disabled={saving || changed.length === 0}>
          <Icon name="check" size={15} /> {saving ? 'Saving…' : `Save ${changed.length || ''} change${changed.length === 1 ? '' : 's'}`}
        </button>
      </AdmHead>

      <div className="adm-note" style={{ marginBottom: 18 }}>
        <Icon name="info" size={15} /> Saving any rule queues a background review of all sourced products. New prices still require administrator approval before publishing.
      </div>

      <div className="panel" style={{ padding: 0 }}>
        {!loaded ? <div className="adm-soon"><p>Loading pricing rules…</p></div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 0 }}>
            {settings.map(setting => (
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
                    <input type="number" min="0" step={percentKeys.has(setting.key) ? '0.01' : '0.01'} value={draft[setting.key] ?? ''} onChange={event => setDraft(current => ({ ...current, [setting.key]: event.target.value }))} />
                    {unitFor(setting) && <small className="muted" style={{ position: 'absolute', right: 12, top: 12 }}>{unitFor(setting)}</small>}
                  </div>
                )}
                <small className="muted" style={{ lineHeight: 1.5 }}>{setting.description}</small>
              </label>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
