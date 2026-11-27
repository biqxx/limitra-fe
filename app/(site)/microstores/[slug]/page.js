import { MicroStorePage } from '@/components/pages/MicroStorePage';
import {
  JsonLd,
  SITE_NAME,
  buildMetadata,
  canonicalUrl,
  fetchApiJson,
  truncateText,
} from '@/lib/seo';

async function getMicrostore(slug) {
  if (!slug) return null;
  const data = await fetchApiJson(`/microstores/${encodeURIComponent(slug)}`, { revalidate: 300 });
  return data?.microstore || data || null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const store = await getMicrostore(slug);

  if (!store) {
    return buildMetadata({
      title: 'Creator Microstore',
      description: `Discover curated creator storefronts on ${SITE_NAME}.`,
      path: `/microstores/${encodeURIComponent(slug)}`,
    });
  }

  const description =
    truncateText(store.tagline || store.bio, 160) ||
    `Shop curated picks from ${store.name} on ${SITE_NAME}.`;
  const images = [store.banner_url, store.cover_url, store.avatar_url, store.logo_url].filter(Boolean);

  return buildMetadata({
    title: store.name,
    description,
    path: `/microstores/${encodeURIComponent(store.slug || slug)}`,
    images,
  });
}

export default async function MicroStoreRoutePage({ params }) {
  const { slug } = await params;
  const store = await getMicrostore(slug);
  const storeUrl = canonicalUrl(`/microstores/${encodeURIComponent(store?.slug || slug)}`);

  const jsonLd = store
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Store',
            name: store.name,
            url: storeUrl,
            ...(store.bio || store.tagline
              ? { description: truncateText(store.tagline || store.bio, 300) }
              : {}),
            ...(store.avatar_url || store.banner_url || store.cover_url || store.logo_url
              ? { image: store.banner_url || store.cover_url || store.avatar_url || store.logo_url }
              : {}),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl('/') },
              { '@type': 'ListItem', position: 2, name: 'Microstores', item: canonicalUrl('/microstores') },
              { '@type': 'ListItem', position: 3, name: store.name, item: storeUrl },
            ],
          },
        ],
      }
    : null;

  return (
    <>
      <JsonLd data={jsonLd} />
      <MicroStorePage slug={slug} />
    </>
  );
}
