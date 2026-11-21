import { BlogIndexClient } from '@/components/pages/BlogIndexClient';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Limitra Journal — Stories & Buying Guides',
  description:
    'Read product buying guides, creator spotlights, and marketplace updates from Limitra.',
  path: '/blog',
});

export default function BlogIndexPage() {
  return <BlogIndexClient />;
}
