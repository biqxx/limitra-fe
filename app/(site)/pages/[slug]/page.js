import { CmsContentClient } from '@/components/pages/CmsContentClient';
import {
  JsonLd,
  SITE_NAME,
  buildMetadata,
  canonicalUrl,
  fetchApiJson,
  truncateText,
} from '@/lib/seo';

async function getContentEntry(slug) {
  if (!slug) return null;
  const data = await fetchApiJson(`/content/${encodeURIComponent(slug)}`, { revalidate: 300 });
  return data?.entry || data || null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const entry = await getContentEntry(slug);

  const title = entry?.title || slug.replace(/-/g, ' ');
  const rawBody = typeof entry?.body === 'string' ? entry.body : '';
  const description =
    truncateText(entry?.description || rawBody, 160) ||
    `${title} — ${SITE_NAME}.`;

  return buildMetadata({
    title,
    description,
    noindex: !entry,
    images: entry?.cover_image_url || entry?.image_url,
    path: `/pages/${encodeURIComponent(slug)}`,
  });
}

export default async function CmsContentPage({ params }) {
  const { slug } = await params;
  const entry = await getContentEntry(slug);
  const pageUrl = canonicalUrl(`/pages/${encodeURIComponent(slug)}`);

  const jsonLd = entry
    ? {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: entry.title || slug,
        url: pageUrl,
      }
    : null;

  return (
    <>
      <JsonLd data={jsonLd} />
      <CmsContentClient slug={slug} initialEntry={entry} />
    </>
  );
}
