import { BlogPostClient } from '@/components/pages/BlogPostClient';
import {
  JsonLd,
  SITE_NAME,
  buildMetadata,
  canonicalUrl,
  fetchApiJson,
  truncateText,
} from '@/lib/seo';

async function getBlogPost(slug) {
  if (!slug) return null;
  const data = await fetchApiJson(`/blog/posts/${encodeURIComponent(slug)}`, { revalidate: 300 });
  return data?.post || data || null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    return buildMetadata({
      title: 'Blog Article',
      description: `Read articles and buying guides on ${SITE_NAME}.`,
      path: `/blog/${encodeURIComponent(slug)}`,
      type: 'article',
    });
  }

  return buildMetadata({
    title: post.title,
    description:
      truncateText(post.excerpt || post.body || post.content, 160) ||
      `${post.title} on ${SITE_NAME} Journal.`,
    path: `/blog/${encodeURIComponent(post.slug || slug)}`,
    images: post.cover_image_url || post.image_url,
    type: 'article',
  });
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  const articleUrl = canonicalUrl(`/blog/${encodeURIComponent(post?.slug || slug)}`);

  const jsonLd = post
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'BlogPosting',
            headline: post.title,
            url: articleUrl,
            ...(post.excerpt ? { description: truncateText(post.excerpt, 300) } : {}),
            ...(post.cover_image_url || post.image_url
              ? { image: post.cover_image_url || post.image_url }
              : {}),
            ...(post.published_at ? { datePublished: post.published_at } : {}),
            ...(post.updated_at ? { dateModified: post.updated_at } : {}),
            publisher: { '@type': 'Organization', name: SITE_NAME },
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl('/') },
              { '@type': 'ListItem', position: 2, name: 'Blog', item: canonicalUrl('/blog') },
              { '@type': 'ListItem', position: 3, name: post.title, item: articleUrl },
            ],
          },
        ],
      }
    : null;

  return (
    <>
      <JsonLd data={jsonLd} />
      <BlogPostClient slug={slug} initialPost={post} />
    </>
  );
}
