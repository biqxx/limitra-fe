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
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function findCategoryPair(catSlug, subSlug) {
  const data = await fetchApiJson('/categories', { revalidate: 600 });
  const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  const category = list.find((c) => c?.slug === catSlug) || null;
  const subcategory = Array.isArray(category?.subcategories)
    ? category.subcategories.find((s) => s?.slug === subSlug) || null
    : null;
  return { category, subcategory };
}

export async function generateMetadata({ params }) {
  const { cat, sub } = await params;
  const { category, subcategory } = await findCategoryPair(cat, sub);
  const catName = category?.name || formatSlugTitle(cat);
  const subName = subcategory?.name || formatSlugTitle(sub);
  const title = `${subName} — ${catName}`;
  const description =
    truncateText(subcategory?.description || category?.description, 160) ||
    `Shop ${subName} in ${catName} on ${SITE_NAME} with verified sellers and fast nationwide delivery.`;

  return buildMetadata({
    title,
    description,
    path: `/shop/${encodeURIComponent(cat)}/${encodeURIComponent(sub)}`,
    images: subcategory?.image?.url || category?.image?.url,
  });
}

export default async function ShopCatSubPage({ params }) {
  const { cat, sub } = await params;
  const { category, subcategory } = await findCategoryPair(cat, sub);
  const catName = category?.name || formatSlugTitle(cat);
  const subName = subcategory?.name || formatSlugTitle(sub);
  const catUrl = canonicalUrl(`/shop/${encodeURIComponent(cat)}`);
  const subUrl = canonicalUrl(`/shop/${encodeURIComponent(cat)}/${encodeURIComponent(sub)}`);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `${subName} — ${catName}`,
        url: subUrl,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl('/') },
          { '@type': 'ListItem', position: 2, name: catName, item: catUrl },
          { '@type': 'ListItem', position: 3, name: subName, item: subUrl },
        ],
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <ShopPage cat={cat} sub={sub} />
    </>
  );
}
