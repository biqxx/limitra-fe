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
  publishedTime,
  modifiedTime,
} = {}) {
  if (noindex) {
    return { title, description: description === DEFAULT_DESCRIPTION ? undefined : description, robots: { index: false, follow: false } };
  }

  const canonical = canonicalUrl(path);
  const desc = truncateText(description, 160) || DEFAULT_DESCRIPTION;
  const imageList = Array.isArray(images)
    ? images.filter(Boolean)
    : images
      ? [images]
      : [];

  const brandedTitle = title ? title + ' | ' + SITE_NAME : SITE_NAME;
  const shareImages = imageList.length ? imageList : [{ url: '/assets/logo-icon.png', alt: SITE_NAME }];

  return {
    title: { absolute: brandedTitle },
    description: desc,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical },
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    openGraph: {
      title: brandedTitle,
      description: desc,
      url: canonical,
      siteName: SITE_NAME,
      type,
      locale: 'en_NG',
      images: shareImages,
      ...(type === 'article' && publishedTime ? { publishedTime } : {}),
      ...(type === 'article' && modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: imageList.length > 0 ? 'summary_large_image' : 'summary',
      title: brandedTitle,
      description: desc,
      images: shareImages,
    },
  };
}

export function JsonLd({ data }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

