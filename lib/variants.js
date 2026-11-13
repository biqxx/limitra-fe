// Shared helpers for reconciling two different "variant" shapes:
// - the admin editor's authoring shape: attribute groups, one per dimension
//   (e.g. Colour, Storage), each option optionally carrying a colour swatch
//   or its own price override — {name, type, options:[{label|name, hex, price}]}.
// - the backend's REAL shape: a flat array of per-SKU records, confirmed live
//   via a 422 on POST /admin/products requiring "variants.0.sku",
//   "variants.0.attributes" and "variants.0.stock" on each item —
//   {sku, attributes: {Colour: 'Red', Storage: '256GB'}, stock}.
// Used by both components/admin/AdminCatalog.jsx (authoring) and
// components/pages/ProductPage.jsx (buyer-facing display/selection), so a fix
// to this reconciliation only has to happen in one place.

export function comboKey(attributes) {
  return Object.entries(attributes || {})
    .filter(([, v]) => v != null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('|');
}

// Cross-multiplies every group's options into one entry per real SKU combination.
export function cartesianCombos(groups) {
  const usable = (groups || []).filter(g => g?.name && Array.isArray(g.options) && g.options.length);
  if (!usable.length) return [];
  const label = (g, o) => (g.type === 'color' ? o.name : o.label);
  const attrSets = usable.reduce(
    (acc, g) => acc.flatMap(attrs => g.options.map(o => ({ ...attrs, [g.name]: label(g, o) }))),
    [{}]
  );
  return attrSets.map(attributes => ({ attributes, key: comboKey(attributes) }));
}

export function slugPart(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12);
}

export function defaultSku(productName, attributes) {
  const parts = [slugPart(productName).slice(0, 6) || 'PROD', ...Object.values(attributes || {}).map(v => slugPart(v).slice(0, 4))];
  return parts.filter(Boolean).join('-');
}

// Best-effort reconstruction of authoring groups from the backend's flat
// records — for a product whose variants were configured elsewhere (another
// admin's browser, or straight from product sourcing), so there is no local
// authoring copy. Loses colour swatches and per-option price overrides since
// the backend never stores those, but surfaces the real attributes/options.
export function groupsFromFlatVariants(flat) {
  const order = [];
  const sets = new Map();
  (flat || []).forEach(v => {
    const attrs = v?.attributes && typeof v.attributes === 'object' ? v.attributes : {};
    Object.entries(attrs).forEach(([name, value]) => {
      if (value == null || value === '') return;
      if (!sets.has(name)) { sets.set(name, new Set()); order.push(name); }
      sets.get(name).add(String(value));
    });
  });
  return order.map(name => ({ name, type: 'text', options: [...sets.get(name)].map(label => ({ label, price: null })) }));
}

export function stockMapFromFlatVariants(flat) {
  const map = {};
  (flat || []).forEach(v => {
    if (!v || typeof v !== 'object') return;
    const attrs = v.attributes && typeof v.attributes === 'object' ? v.attributes : {};
    const key = comboKey(attrs);
    if (key) map[key] = { sku: v.sku || '', stock: v.stock ?? '' };
  });
  return map;
}
