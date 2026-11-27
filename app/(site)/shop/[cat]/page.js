import { ShopPage } from '@/components/pages/ShopPage';
import {
  JsonLd,
  SITE_NAME,
  buildMetadata,
  canonicalUrl,
  fetchApiJson,
  truncateText,
} from '@/lib/seo';

function formatSlugTitle(slug) {
  if (!slug || slug === 'all') return 'All Products';
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function findCategory(catSlug) {
  if (!catSlug || catSlug === 'all') return null;
  const data = await fetchApiJson('/categories', { revalidate: 600 });
  const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return list.find((c) => c?.slug === catSlug) || null;
}

export async function generateMetadata({ params }) {
  const { cat } = await params;
  const category = await findCategory(cat);
  const name = category?.name || formatSlugTitle(cat);
  const title = cat === 'all' ? 'Shop All Products' : `Shop ${name}`;
  const description =
    truncateText(category?.description, 160) ||
    `Browse ${name.toLowerCase()} on ${SITE_NAME} — curated deals, verified brands, and fast delivery across Nigeria.`;

  return buildMetadata({
    title,
    description,
    noindex: cat !== 'all' && !category,
    path: `/shop/${encodeURIComponent(cat || 'all')}`,
    images: category?.image?.url || category?.image_url,
  });
}

export default async function ShopCatPage({ params }) {
  const { cat } = await params;
  const category = await findCategory(cat);
  const name = category?.name || formatSlugTitle(cat);
  const pageUrl = canonicalUrl(`/shop/${encodeURIComponent(cat || 'all')}`);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: cat === 'all' ? 'Shop All Products' : name,
        url: pageUrl,
        ...(category?.description ? { description: truncateText(category.description, 300) } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl('/') },
          { '@type': 'ListItem', position: 2, name, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <ShopPage cat={cat} />
    </>
  );
}
