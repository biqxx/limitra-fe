/* Strict permission-based access control helpers for Limitra Admin & Storefront. */

export const ADMIN_SCREEN_PERMISSIONS = {
  dashboard: ['analytics.read', 'orders.read', 'catalog.read', 'catalog.sourcing', 'customers.read', 'support.read', 'roles.read', 'microstores.read', 'celebrity_stores.read', 'procurement.read', 'cms.read', 'ai.read', 'affiliates.read', 'settings.read'],
  analytics: ['analytics.read'],
  products: ['catalog.read'],
  categories: ['catalog.read'],
  sourcing: ['catalog.sourcing'],
  'sourcing-queue': ['catalog.sourcing'],
  pricing: ['settings.read'],
  inventory: ['inventory.read'],
  orders: ['orders.read'],
  returns: ['returns.read', 'refunds.read'],
  coupons: ['promotions.read'],
  delivery: ['delivery.read'],
  procurement: ['procurement.read'],
  reviews: ['reviews.moderate'],
  customers: ['customers.read'],
  staff: ['staff.read', 'roles.read', 'customers.read'],
  affiliates: ['affiliates.read', 'commissions.read', 'payouts.read'],
  referrals: ['referrals.read', 'affiliates.read', 'rewards.read'],
  microstores: ['microstores.read'],
  'celebrity-stores': ['celebrity_stores.read', 'microstores.read'],
  spin: ['rewards.read'],
  videos: ['videos.read'],
  elo: ['ai.read'],
  cms: ['cms.read', 'media.read'],
  careers: ['careers.read'],
  roles: ['roles.read'],
  reports: ['reports.read'],
  support: ['support.read'],
  activity: ['audit_logs.read'],
  queues: ['queue.read'],
  notifications: ['notifications.read'],
  'mail-logs': ['mail_logs.read'],
  settings: ['settings.read'],
};

export const ADMIN_PANEL_PERMISSIONS = Array.from(
  new Set(Object.values(ADMIN_SCREEN_PERMISSIONS).flat())
);

export function getUserPermissions(user) {
  const raw = Array.isArray(user?.permissions) ? user.permissions : [];
  return new Set(
    raw
      .map((p) => (typeof p === 'string' ? p : p?.name || p?.key || p?.slug || ''))
      .filter(Boolean)
  );
}

export function hasPermission(user, perm) {
  if (!user || !perm) return false;
  const perms = getUserPermissions(user);
  return perms.has('*') || perms.has(perm);
}

export function hasAnyPermission(user, permsList) {
  if (!user || !Array.isArray(permsList) || permsList.length === 0) return false;
  const perms = getUserPermissions(user);
  if (perms.has('*')) return true;
  return permsList.some((p) => perms.has(p));
}

export function hasAnyAdminAccess(user) {
  return hasAnyPermission(user, ADMIN_PANEL_PERMISSIONS);
}

export function hasAffiliateAccess(user) {
  if (!user) return false;
  if (user.linked_roles?.affiliate) return true;
  if (user.role === 'affiliate') return true;
  if (Array.isArray(user.roles) && user.roles.some((r) => r?.name === 'affiliate')) return true;
  return false;
}

export function routeKeyFromPath(pathname) {
  if (!pathname || pathname === '/admin' || pathname === '/admin/') return 'dashboard';
  const rest = pathname.replace(/^\/admin\/?/, '');
  const seg = rest.split('/')[0];
  return seg || 'dashboard';
}

export function canAccessAdminRoute(user, pathname) {
  const key = routeKeyFromPath(pathname);
  const req = ADMIN_SCREEN_PERMISSIONS[key];
  if (!req) return hasAnyAdminAccess(user);
  return hasAnyPermission(user, req);
}

export function firstPermittedAdminPath(user) {
  const order = Object.keys(ADMIN_SCREEN_PERMISSIONS);
  for (const key of order) {
    if (hasAnyPermission(user, ADMIN_SCREEN_PERMISSIONS[key])) {
      return '/admin' + (key === 'dashboard' ? '' : '/' + key);
    }
  }
  return '/access-denied?need=admin';
}

