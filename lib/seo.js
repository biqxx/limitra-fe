export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://limitra.com.ng'
).replace(/\/+$/, '');

export const SITE_NAME = 'Limitra';

export const DEFAULT_DESCRIPTION =
  'Shop curated electronics, fashion, lifestyle, beauty, and home essentials on Limitra — Nigeria\'s premium marketplace with verified sellers, creator microstores, and fast nationwide delivery.';

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'https://api.limitra.com.ng/api/v1'
).replace(/\/+$/, '');

export function canonicalUrl(path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized === '/' ? SITE_URL : `${SITE_URL}${normalized}`;
}

export function truncateText(value, maxLength = 158) {
  const clean = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function fetchApiJson(path, { revalidate = 300, timeoutMs = 8000 } = {}) {
  const url = path.startsWith('http')
    ? path
    : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const payload = await res.json().catch(() => null);
    if (payload && payload.success === false) return null;
    return payload?.data ?? payload ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPaginatedAll(
  path,
  { perPage = 100, maxPages = 50, revalidate = 3600 } = {}
) {
  const all = [];
  const sep = path.includes('?') ? '&' : '?';

  for (let page = 1; page <= maxPages; page += 1) {
    const data = await fetchApiJson(`${path}${sep}per_page=${perPage}&page=${page}`, {
      revalidate,
    });
    if (!data) break;

    const items = Array.isArray(data)
      ? data
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
          ? data.data
          : [];

    all.push(...items);

    const lastPage = Number(data?.pagination?.last_page || 1);
    if (page >= lastPage || items.length === 0) break;
  }

  return all;
}

export function buildMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  images,
  type = 'website',
  noindex = false,
  keywords,
} = {}) {
  const canonical = canonicalUrl(path);
  const desc = truncateText(description, 160) || DEFAULT_DESCRIPTION;
  const imageList = Array.isArray(images)
    ? images.filter(Boolean)
    : images
      ? [images]
      : [];

  return {
    ...(title ? { title } : {}),
    description: desc,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical },
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Premium Marketplace`,
      description: desc,
      url: canonical,
      siteName: SITE_NAME,
      type,
      locale: 'en_NG',
      ...(imageList.length > 0 ? { images: imageList } : {}),
    },
    twitter: {
      card: imageList.length > 0 ? 'summary_large_image' : 'summary',
      title: title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Premium Marketplace`,
      description: desc,
      ...(imageList.length > 0 ? { images: imageList } : {}),
    },
  };
}

export function JsonLd({ data }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

