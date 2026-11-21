import { canonicalUrl, fetchApiJson, fetchPaginatedAll } from '@/lib/seo';

export const revalidate = 3600;

const STATIC_PUBLIC_ROUTES = [
  { path: '/', changeFrequency: 'daily', priority: 1.0 },
  { path: '/shop/all', changeFrequency: 'daily', priority: 0.9 },
  { path: '/microstores', changeFrequency: 'daily', priority: 0.8 },
  { path: '/microstores/explore', changeFrequency: 'daily', priority: 0.8 },
  { path: '/celebrity-stores', changeFrequency: 'daily', priority: 0.8 },
  { path: '/videos', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/blog', changeFrequency: 'daily', priority: 0.8 },
  { path: '/affiliate', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/become-affiliate', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/start-microstore', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/become-celebrity', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/careers', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/channels', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/help', changeFrequency: 'monthly', priority: 0.6 },
];

function safeDate(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function sitemap() {
  const now = new Date();
  const entries = new Map();

  const addEntry = (path, opts = {}) => {
    const url = canonicalUrl(path);
    if (!entries.has(url)) {
      entries.set(url, {
        url,
        lastModified: opts.lastModified || now,
        changeFrequency: opts.changeFrequency || 'weekly',
        priority: opts.priority ?? 0.7,
        ...(opts.images?.length ? { images: opts.images } : {}),
      });
    }
  };

  for (const route of STATIC_PUBLIC_ROUTES) {
    addEntry(route.path, {
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    });
  }

  const [categoriesData, products, microstores, blogPosts] = await Promise.all([
    fetchApiJson('/categories', { revalidate }),
    fetchPaginatedAll('/products', { perPage: 100, maxPages: 100, revalidate }),
    fetchPaginatedAll('/microstores', { perPage: 50, maxPages: 50, revalidate }),
    fetchPaginatedAll('/blog/posts', { perPage: 50, maxPages: 50, revalidate }),
  ]);

  const categories = Array.isArray(categoriesData)
    ? categoriesData
    : Array.isArray(categoriesData?.items)
      ? categoriesData.items
      : [];

  for (const cat of categories) {
    if (!cat?.slug) continue;
    addEntry(`/shop/${encodeURIComponent(cat.slug)}`, {
      lastModified: safeDate(cat.updated_at) || now,
      changeFrequency: 'daily',
      priority: 0.85,
    });
    const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
    for (const sub of subs) {
      if (!sub?.slug) continue;
      addEntry(`/shop/${encodeURIComponent(cat.slug)}/${encodeURIComponent(sub.slug)}`, {
        lastModified: safeDate(sub.updated_at) || safeDate(cat.updated_at) || now,
        changeFrequency: 'daily',
        priority: 0.8,
      });
    }
  }

  for (const product of products) {
    const identifier = product?.slug || product?.id;
    if (!identifier) continue;
    const productImages = Array.isArray(product.images)
      ? product.images
          .map((img) => (typeof img === 'string' ? img : img?.url || img?.path))
          .filter((src) => typeof src === 'string' && /^https?:\/\//i.test(src))
          .slice(0, 5)
      : [];

    addEntry(`/product/${encodeURIComponent(identifier)}`, {
      lastModified: safeDate(product.updated_at || product.created_at) || now,
      changeFrequency: 'daily',
      priority: 0.9,
      images: productImages,
    });
  }

  for (const store of microstores) {
    if (!store?.slug) continue;
    const storeImages = [store.avatar_url, store.banner_url].filter(
      (src) => typeof src === 'string' && /^https?:\/\//i.test(src)
    );
    addEntry(`/microstores/${encodeURIComponent(store.slug)}`, {
      lastModified: safeDate(store.updated_at || store.created_at) || now,
      changeFrequency: 'weekly',
      priority: 0.75,
      images: storeImages,
    });
  }

  for (const post of blogPosts) {
    const slug = post?.slug || post?.id;
    if (!slug) continue;
    addEntry(`/blog/${encodeURIComponent(slug)}`, {
      lastModified: safeDate(post.updated_at || post.published_at || post.created_at) || now,
      changeFrequency: 'weekly',
      priority: 0.75,
    });
  }

  return Array.from(entries.values());
}

