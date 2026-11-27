import { BlogIndexClient } from '@/components/pages/BlogIndexClient';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Shopping Guides and Marketplace News',
  description:
    'Read product buying guides, creator spotlights, and marketplace updates from Limitra.',
  path: '/blog',
});

export default function BlogIndexPage() {
  return <BlogIndexClient />;
}
