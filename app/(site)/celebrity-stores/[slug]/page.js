import { CelebrityStorePage } from '@/components/pages/CelebrityStorePage';
import {
  JsonLd,
  SITE_NAME,
  buildMetadata,
  canonicalUrl,
  fetchApiJson,
  truncateText,
} from '@/lib/seo';

async function getCelebrityStore(slug) {
  if (!slug) return null;
  const data = await fetchApiJson(`/celebrity-stores/${encodeURIComponent(slug)}`, { revalidate: 300 });
  return data?.celebrity_store || data || null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const store = await getCelebrityStore(slug);

  if (!store) {
    return buildMetadata({
      title: 'Celebrity Store',
      description: `Discover curated celebrity storefronts on ${SITE_NAME}.`,
      path: `/celebrity-stores/${encodeURIComponent(slug)}`,
    });
  }

  const description =
    truncateText(store.tagline || store.bio, 160) ||
    `Shop curated picks from ${store.name} on ${SITE_NAME}.`;
  const images = [store.banner_url, store.avatar_url].filter(Boolean);

  return buildMetadata({
    title: store.name,
    description,
    path: `/celebrity-stores/${encodeURIComponent(store.slug || slug)}`,
    images,
  });
}

export default async function CelebrityStoreRoutePage({ params }) {
  const { slug } = await params;
  const store = await getCelebrityStore(slug);
  const storeUrl = canonicalUrl(`/celebrity-stores/${encodeURIComponent(store?.slug || slug)}`);

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
            ...(store.avatar_url || store.banner_url
              ? { image: store.banner_url || store.avatar_url }
              : {}),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl('/') },
              { '@type': 'ListItem', position: 2, name: 'Celebrity Stores', item: canonicalUrl('/celebrity-stores') },
              { '@type': 'ListItem', position: 3, name: store.name, item: storeUrl },
            ],
          },
        ],
      }
    : null;

  return (
    <>
      <JsonLd data={jsonLd} />
      <CelebrityStorePage slug={slug} />
    </>
  );
}
