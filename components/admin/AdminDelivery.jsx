'use client';
/* Delivery & Shipping admin — configures the zones/methods/pickup points that
   deliveryApi.options() and pickupLocationsApi.list() (components/pages/Cart.jsx)
   resolve against for a customer's address. None of the admin request/response
   shapes are documented (empty `{}` request schemas, generic SuccessResponse
   replies everywhere) — every read is defensive, and the field names sent on
   create/update are a best-effort guess until live validation says otherwise.
   There is no DELETE route for zones, methods or pickup points — only
   create/list/update — so "Active" is the only way to retire one. */
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { adminDeliveryZonesApi, adminDeliveryMethodsApi, adminPickupLocationsApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { slugify } from '@/lib/data';
import { useAdminToast } from './AdminToastContext';
import { AdmHead } from './AdminShared';

// POST /admin/delivery-methods confirmed (live 422) to require `code` and
// `type` — neither is in the spec (empty request schema), so the `type`
// options below are a guess; if the backend rejects one, its error will say
// what's actually allowed.
const METHOD_TYPES = ['standard', 'express', 'same_day', 'pickup'];

const asList = (res) => {
  const list = Array.isArray(res) ? res : (res?.data ?? res?.items ?? res?.results ?? []);
  return Array.isArray(list) ? list : [];
};
const toArray = (s) => String(s || '').split(',').map(v => v.trim()).filter(Boolean);

function zoneDraft(zone) {
  return {
    id: zone?.id ?? null,
    name: zone?.name || '',
    country: zone?.country || 'NG',
    states: toArray(zone?.states ?? zone?.state).join(', '),
    cities: toArray(zone?.cities ?? zone?.city).join(', '),
    active: zone ? zone.active !== false : true,
  };
}
function methodDraft(method) {
  return {
    id: method?.id ?? null,
    name: method?.name || '',
    code: method?.code || '',
    type: method?.type || 'standard',
    description: method?.description || method?.eta || '',
    fee: method?.fee ?? method?.price ?? 0,
    min_days: method?.min_days ?? '',
    max_days: method?.max_days ?? '',
    active: method ? method.active !== false : true,
  };
}
function pickupDraft(p) {
  return {
    id: p?.id ?? null,
    name: p?.name || '',
    code: p?.code || '',
    address: p?.line1 ?? p?.address ?? '',
    city: p?.city || '',
    state: p?.state || '',
    country: p?.country || 'NG',
    phone: p?.phone || '',
    active: p ? p.active !== false : true,
  };
}

function Drawer({ title, sub, saving, canSave, onClose, onSave, saveLabel, children }) {
  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="adm-drawer-h">
          <div><h3>{title}</h3>{sub && <small className="muted">{sub}</small>}</div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">{children}</div>
        <div className="adm-drawer-f">
          <button className="adm-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="adm-btn primary" onClick={onSave} disabled={saving || !canSave}>{saving ? 'Saving…' : saveLabel}</button>
        </div>
      </aside>
    </>
  );
}

const SECTIONS = [['zones', 'Zones'], ['methods', 'Methods'], ['pickup', 'Pickup locations']];

export function AdminDelivery() {
  const toast = useAdminToast();
  const [section, setSection] = useState('zones');

  const [zones, setZones] = useState([]);
  const [methods, setMethods] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [attachPick, setAttachPick] = useState({}); // { [zoneId]: methodId }

  const [draftZone, setDraftZone] = useState(null);
  const [draftMethod, setDraftMethod] = useState(null);
  const [draftPickup, setDraftPickup] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [z, m, p] = await Promise.all([
        adminDeliveryZonesApi.list({ per_page: 100 }),
        adminDeliveryMethodsApi.list({ per_page: 100 }),
        adminPickupLocationsApi.list({ per_page: 100 }),
      ]);
      setZones(asList(z));
      setMethods(asList(m));
      setPickups(asList(p));
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  // Initial network hydration is intentionally triggered when the page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleExpanded = (id) => setExpanded(cur => { const next = new Set(cur); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const saveZone = async () => {
    if (!draftZone?.name.trim()) return;
    setSaving(true);
    const body = {
      name: draftZone.name.trim(),
      country: draftZone.country || 'NG',
      states: toArray(draftZone.states),
      cities: toArray(draftZone.cities),
      active: draftZone.active,
    };
    try {
      if (draftZone.id) await adminDeliveryZonesApi.update(draftZone.id, body);
      else await adminDeliveryZonesApi.create(body);
      toast(draftZone.id ? 'Zone updated' : 'Zone added');
      setDraftZone(null);
      await loadAll();
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleZoneActive = async (zone) => {
    try {
      await adminDeliveryZonesApi.update(zone.id, { active: !zone.active });
      toast(zone.active ? 'Zone deactivated' : 'Zone activated');
      await loadAll();
    } catch (error) { toast(messageFrom(error)); }
  };

  const saveMethod = async () => {
    if (!draftMethod?.name.trim()) return;
    setSaving(true);
    const body = {
      name: draftMethod.name.trim(),
      code: draftMethod.code.trim() || slugify(draftMethod.name),
      type: draftMethod.type,
      description: draftMethod.description.trim() || undefined,
      fee: Math.max(0, Number(draftMethod.fee) || 0),
      min_days: draftMethod.min_days === '' ? undefined : Number(draftMethod.min_days),
      max_days: draftMethod.max_days === '' ? undefined : Number(draftMethod.max_days),
      active: draftMethod.active,
    };
    try {
      if (draftMethod.id) await adminDeliveryMethodsApi.update(draftMethod.id, body);
      else await adminDeliveryMethodsApi.create(body);
      toast(draftMethod.id ? 'Method updated' : 'Method added');
      setDraftMethod(null);
      await loadAll();
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleMethodActive = async (method) => {
    try {
      await adminDeliveryMethodsApi.update(method.id, { active: !method.active });
      toast(method.active ? 'Method deactivated' : 'Method activated');
      await loadAll();
    } catch (error) { toast(messageFrom(error)); }
  };

  // PUT .../zones/{zone}/methods/{method} is a full replace, not a partial
  // patch — confirmed live: calls with only some fields 422 on whichever ones
  // were left out (fee, then estimated_days_min/max). So every call here
  // resends the complete set, merging in whatever one field actually changed.
  const zoneMethodBody = (zm, method, overrides) => ({
    active: zm ? zm.active !== false : true,
    fee: Number(zm?.fee ?? method?.fee ?? 0),
    estimated_days_min: Number(zm?.estimated_days_min ?? zm?.min_days ?? method?.min_days ?? 1) || 1,
    estimated_days_max: Number(zm?.estimated_days_max ?? zm?.max_days ?? method?.max_days ?? 1) || 1,
    ...overrides,
  });

  const attachMethod = async (zone) => {
    const methodId = attachPick[zone.id];
    if (!methodId) return;
    const method = methods.find(m => String(m.id) === String(methodId));
    try {
      await adminDeliveryZonesApi.setMethod(zone.id, methodId, zoneMethodBody(null, method, {}));
      toast('Method attached to zone');
      setAttachPick(cur => ({ ...cur, [zone.id]: '' }));
      await loadAll();
    } catch (error) { toast(messageFrom(error)); }
  };

  const toggleZoneMethodActive = async (zone, zm) => {
    const methodId = zm.id ?? zm.method_id ?? zm.method?.id;
    const method = zm.method || methods.find(m => String(m.id) === String(methodId));
    try {
      await adminDeliveryZonesApi.setMethod(zone.id, methodId, zoneMethodBody(zm, method, { active: !(zm.active !== false) }));
      toast('Updated');
      await loadAll();
    } catch (error) { toast(messageFrom(error)); }
  };

  const setZoneMethodField = async (zone, zm, overrides) => {
    const methodId = zm.id ?? zm.method_id ?? zm.method?.id;
    const method = zm.method || methods.find(m => String(m.id) === String(methodId));
    try {
      await adminDeliveryZonesApi.setMethod(zone.id, methodId, zoneMethodBody(zm, method, overrides));
      toast('Updated');
      await loadAll();
    } catch (error) { toast(messageFrom(error)); }
  };

  const savePickup = async () => {
    if (!draftPickup?.name.trim() || !draftPickup.address.trim()) return;
    setSaving(true);
    const body = {
      name: draftPickup.name.trim(),
      code: draftPickup.code.trim() || slugify(draftPickup.name),
      line1: draftPickup.address.trim(),
      city: draftPickup.city.trim() || undefined,
      state: draftPickup.state.trim() || undefined,
      country: draftPickup.country || 'NG',
      phone: draftPickup.phone.trim() || undefined,
      active: draftPickup.active,
    };
    try {
      if (draftPickup.id) await adminPickupLocationsApi.update(draftPickup.id, body);
      else await adminPickupLocationsApi.create(body);
      toast(draftPickup.id ? 'Pickup location updated' : 'Pickup location added');
      setDraftPickup(null);
      await loadAll();
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setSaving(false);
    }
  };

  const togglePickupActive = async (p) => {
    try {
      await adminPickupLocationsApi.update(p.id, { active: !p.active });
      toast(p.active ? 'Location deactivated' : 'Location activated');
      await loadAll();
    } catch (error) { toast(messageFrom(error)); }
  };

  const addLabel = { zones: 'Add zone', methods: 'Add method', pickup: 'Add location' }[section];
  const onAdd = () => {
    if (section === 'zones') setDraftZone(zoneDraft());
    else if (section === 'methods') setDraftMethod(methodDraft());
    else setDraftPickup(pickupDraft());
  };

  return (
    <>
      <AdmHead title="Delivery & Shipping" sub="Zones, delivery methods and pickup points the storefront's checkout resolves against.">
        <button className="adm-btn primary" onClick={onAdd}><Icon name="plus" size={15} /> {addLabel}</button>
      </AdmHead>

      <div className="adm-filters">
        {SECTIONS.map(([key, label]) => (
          <button key={key} className={'adm-chip' + (section === key ? ' on' : '')} onClick={() => setSection(key)}>{label}</button>
        ))}
      </div>

      {section === 'zones' && (
        <div className="panel cat-panel">
          {!loaded ? <div className="adm-soon"><p>Loading zones…</p></div> : zones.length === 0 ? (
            <div className="adm-soon"><div className="as-ic"><Icon name="location" size={26} /></div><h3>No delivery zones yet</h3><p>Add a zone to start matching customer addresses to delivery methods.</p></div>
          ) : zones.map(zone => {
            const open = expanded.has(zone.id);
            const zoneMethods = asList(zone.methods ?? zone.delivery_methods);
            const attachedIds = new Set(zoneMethods.map(zm => String(zm.id ?? zm.method_id ?? zm.method?.id)));
            const unattached = methods.filter(m => !attachedIds.has(String(m.id)));
            return (
              <section className="cat-group" key={zone.id}>
                <div className="cat-parent-row">
                  <button className="cat-expand" onClick={() => toggleExpanded(zone.id)} aria-label={open ? 'Collapse' : 'Expand'}><Icon name={open ? 'chevdown' : 'chevright'} size={17} /></button>
                  <div className="cat-icon"><Icon name="location" size={19} /></div>
                  <div className="cat-main"><b>{zone.name}</b><small>{[toArray(zone.states ?? zone.state).join(', '), zone.country || 'NG'].filter(Boolean).join(' · ') || 'No states set'} · {zoneMethods.length} method{zoneMethods.length === 1 ? '' : 's'}</small></div>
                  <span className={'adm-pill ' + (zone.active !== false ? 'ok' : 'muted')}>{zone.active !== false ? 'Active' : 'Inactive'}</span>
                  <div className="adm-rowact">
                    <button onClick={() => toggleZoneActive(zone)} title={zone.active !== false ? 'Deactivate zone' : 'Activate zone'} aria-label={zone.active !== false ? 'Deactivate zone' : 'Activate zone'}><Icon name={zone.active !== false ? 'eye' : 'check'} size={15} /></button>
                    <button onClick={() => setDraftZone(zoneDraft(zone))} title="Edit zone" aria-label="Edit zone"><Icon name="edit" size={15} /></button>
                  </div>
                </div>
                {open && (
                  <div style={{ padding: '4px 16px 14px 54px', borderTop: '1px solid color-mix(in srgb, var(--border) 65%, transparent)' }}>
                    {zoneMethods.length === 0 ? (
                      <p className="muted" style={{ margin: '4px 0 12px' }}>No methods attached to this zone yet.</p>
                    ) : zoneMethods.map(zm => {
                      const m = zm.method || methods.find(x => String(x.id) === String(zm.id ?? zm.method_id)) || {};
                      const active = zm.active !== false;
                      const curFee = Number(zm.fee ?? m.fee) || 0;
                      const curMin = Number(zm.estimated_days_min ?? zm.min_days ?? m.min_days) || 1;
                      const curMax = Number(zm.estimated_days_max ?? zm.max_days ?? m.max_days) || 1;
                      return (
                        <div key={zm.id ?? zm.method_id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', gap: 10, flexWrap: 'wrap' }}>
                          <div><b style={{ fontSize: 13 }}>{m.name ?? zm.name ?? 'Method'}</b></div>
                          <div className="row" style={{ gap: 8 }}>
                            <span className="muted" style={{ fontSize: 12.5 }}>₦</span>
                            <input type="number" min="0" defaultValue={curFee} style={{ width: 80 }} title="Fee"
                              onBlur={e => { const v = Number(e.target.value) || 0; if (v !== curFee) setZoneMethodField(zone, zm, { fee: v }); }} />
                            <input type="number" min="0" defaultValue={curMin} style={{ width: 54 }} title="Min days"
                              onBlur={e => { const v = Number(e.target.value) || 1; if (v !== curMin) setZoneMethodField(zone, zm, { estimated_days_min: v }); }} />
                            <span className="muted" style={{ fontSize: 12.5 }}>–</span>
                            <input type="number" min="0" defaultValue={curMax} style={{ width: 54 }} title="Max days"
                              onBlur={e => { const v = Number(e.target.value) || 1; if (v !== curMax) setZoneMethodField(zone, zm, { estimated_days_max: v }); }} />
                            <span className="muted" style={{ fontSize: 12.5 }}>days</span>
                            <button className={'adm-chip' + (active ? ' on' : '')} onClick={() => toggleZoneMethodActive(zone, zm)}>{active ? 'Active' : 'Inactive'}</button>
                          </div>
                        </div>
                      );
                    })}
                    {unattached.length > 0 && (
                      <div className="row" style={{ gap: 8, marginTop: 12 }}>
                        <select value={attachPick[zone.id] || ''} onChange={e => setAttachPick(cur => ({ ...cur, [zone.id]: e.target.value }))} style={{ flex: 1 }}>
                          <option value="">Attach a method…</option>
                          {unattached.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <button className="adm-btn ghost" onClick={() => attachMethod(zone)} disabled={!attachPick[zone.id]}>Attach</button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {section === 'methods' && (
        <div className="panel cat-panel">
          {!loaded ? <div className="adm-soon"><p>Loading methods…</p></div> : methods.length === 0 ? (
            <div className="adm-soon"><div className="as-ic"><Icon name="truck" size={26} /></div><h3>No delivery methods yet</h3><p>Add a method (e.g. Standard, Express) to attach it to zones.</p></div>
          ) : methods.map(method => (
            <div className="cat-parent-row" key={method.id}>
              <div className="cat-icon"><Icon name="truck" size={19} /></div>
              <div className="cat-main"><b>{method.name}</b><small>{[method.type, method.code, method.description, (method.min_days != null && method.max_days != null) ? `${method.min_days}–${method.max_days} days` : null].filter(Boolean).join(' · ')}</small></div>
              <span className="cat-products">{method.fee ? `₦ ${Number(method.fee).toLocaleString('en-NG')}` : 'Free'}</span>
              <span className={'adm-pill ' + (method.active !== false ? 'ok' : 'muted')}>{method.active !== false ? 'Active' : 'Inactive'}</span>
              <div className="adm-rowact">
                <button onClick={() => toggleMethodActive(method)} title={method.active !== false ? 'Deactivate' : 'Activate'} aria-label={method.active !== false ? 'Deactivate' : 'Activate'}><Icon name={method.active !== false ? 'eye' : 'check'} size={15} /></button>
                <button onClick={() => setDraftMethod(methodDraft(method))} title="Edit method" aria-label="Edit method"><Icon name="edit" size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {section === 'pickup' && (
        <div className="panel cat-panel">
          {!loaded ? <div className="adm-soon"><p>Loading pickup locations…</p></div> : pickups.length === 0 ? (
            <div className="adm-soon"><div className="as-ic"><Icon name="store" size={26} /></div><h3>No pickup locations yet</h3><p>Add a location customers can collect pickup orders from.</p></div>
          ) : pickups.map(p => (
            <div className="cat-parent-row" key={p.id}>
              <div className="cat-icon"><Icon name="store" size={19} /></div>
              <div className="cat-main"><b>{p.name}</b><small>{[p.line1 ?? p.address, p.city, p.state].filter(Boolean).join(', ')}</small></div>
              <span className={'adm-pill ' + (p.active !== false ? 'ok' : 'muted')}>{p.active !== false ? 'Active' : 'Inactive'}</span>
              <div className="adm-rowact">
                <button onClick={() => togglePickupActive(p)} title={p.active !== false ? 'Deactivate' : 'Activate'} aria-label={p.active !== false ? 'Deactivate' : 'Activate'}><Icon name={p.active !== false ? 'eye' : 'check'} size={15} /></button>
                <button onClick={() => setDraftPickup(pickupDraft(p))} title="Edit location" aria-label="Edit location"><Icon name="edit" size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {draftZone && (
        <Drawer title={draftZone.id ? 'Edit zone' : 'Add zone'} sub="Matches customer addresses by country/state/city." saving={saving} canSave={!!draftZone.name.trim()} onClose={() => setDraftZone(null)} onSave={saveZone} saveLabel={draftZone.id ? 'Save changes' : 'Add zone'}>
          <label className="adm-field"><span>Zone name</span><input value={draftZone.name} onChange={e => setDraftZone(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Lagos Mainland" autoFocus /></label>
          <label className="adm-field"><span>Country</span><input value={draftZone.country} onChange={e => setDraftZone(c => ({ ...c, country: e.target.value }))} placeholder="NG" /></label>
          <label className="adm-field"><span>States</span><input value={draftZone.states} onChange={e => setDraftZone(c => ({ ...c, states: e.target.value }))} placeholder="Lagos, Ogun (comma-separated)" /></label>
          <label className="adm-field"><span>Cities (optional)</span><input value={draftZone.cities} onChange={e => setDraftZone(c => ({ ...c, cities: e.target.value }))} placeholder="Ikeja, Lekki" /></label>
          <div className="cat-options">
            <label><input type="checkbox" checked={draftZone.active} onChange={e => setDraftZone(c => ({ ...c, active: e.target.checked }))} /><span><b>Active</b><small>Inactive zones won&apos;t match any address at checkout.</small></span></label>
          </div>
        </Drawer>
      )}

      {draftMethod && (
        <Drawer title={draftMethod.id ? 'Edit method' : 'Add method'} sub="Attach this to one or more zones to make it selectable at checkout." saving={saving} canSave={!!draftMethod.name.trim()} onClose={() => setDraftMethod(null)} onSave={saveMethod} saveLabel={draftMethod.id ? 'Save changes' : 'Add method'}>
          <label className="adm-field"><span>Method name</span><input value={draftMethod.name} onChange={e => setDraftMethod(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Express delivery" autoFocus /></label>
          <div className="adm-field-row">
            <label className="adm-field"><span>Code</span><input value={draftMethod.code} onChange={e => setDraftMethod(c => ({ ...c, code: e.target.value }))} placeholder={slugify(draftMethod.name) || 'auto from name'} /></label>
            <label className="adm-field"><span>Type</span>
              <select value={draftMethod.type} onChange={e => setDraftMethod(c => ({ ...c, type: e.target.value }))}>
                {METHOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <label className="adm-field"><span>Description</span><input value={draftMethod.description} onChange={e => setDraftMethod(c => ({ ...c, description: e.target.value }))} placeholder="e.g. 5–7 business days" /></label>
          <div className="adm-field-row">
            <label className="adm-field"><span>Fee (₦)</span><input type="number" min="0" value={draftMethod.fee} onChange={e => setDraftMethod(c => ({ ...c, fee: e.target.value }))} /></label>
            <label className="adm-field"><span>Min days</span><input type="number" min="0" value={draftMethod.min_days} onChange={e => setDraftMethod(c => ({ ...c, min_days: e.target.value }))} /></label>
            <label className="adm-field"><span>Max days</span><input type="number" min="0" value={draftMethod.max_days} onChange={e => setDraftMethod(c => ({ ...c, max_days: e.target.value }))} /></label>
          </div>
          <div className="cat-options">
            <label><input type="checkbox" checked={draftMethod.active} onChange={e => setDraftMethod(c => ({ ...c, active: e.target.checked }))} /><span><b>Active</b><small>Inactive methods won&apos;t appear at checkout.</small></span></label>
          </div>
        </Drawer>
      )}

      {draftPickup && (
        <Drawer title={draftPickup.id ? 'Edit pickup location' : 'Add pickup location'} saving={saving} canSave={!!(draftPickup.name.trim() && draftPickup.address.trim())} onClose={() => setDraftPickup(null)} onSave={savePickup} saveLabel={draftPickup.id ? 'Save changes' : 'Add location'}>
          <label className="adm-field"><span>Location name</span><input value={draftPickup.name} onChange={e => setDraftPickup(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Limitra Ikeja Hub" autoFocus /></label>
          <label className="adm-field"><span>Code</span><input value={draftPickup.code} onChange={e => setDraftPickup(c => ({ ...c, code: e.target.value }))} placeholder={slugify(draftPickup.name) || 'auto from name'} /></label>
          <label className="adm-field"><span>Address</span><input value={draftPickup.address} onChange={e => setDraftPickup(c => ({ ...c, address: e.target.value }))} placeholder="Street address" /></label>
          <div className="adm-field-row">
            <label className="adm-field"><span>City</span><input value={draftPickup.city} onChange={e => setDraftPickup(c => ({ ...c, city: e.target.value }))} /></label>
            <label className="adm-field"><span>State</span><input value={draftPickup.state} onChange={e => setDraftPickup(c => ({ ...c, state: e.target.value }))} /></label>
          </div>
          <label className="adm-field"><span>Phone (optional)</span><input value={draftPickup.phone} onChange={e => setDraftPickup(c => ({ ...c, phone: e.target.value }))} /></label>
          <div className="cat-options">
            <label><input type="checkbox" checked={draftPickup.active} onChange={e => setDraftPickup(c => ({ ...c, active: e.target.checked }))} /><span><b>Active</b><small>Inactive locations won&apos;t appear at checkout.</small></span></label>
          </div>
        </Drawer>
      )}
    </>
  );
}
