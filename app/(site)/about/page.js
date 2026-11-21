import { AboutPage } from '@/components/pages/AboutPage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'About Limitra',
  description:
    'Learn how Limitra connects shoppers with curated products, verified brands, creator microstores, and fast delivery across Nigeria.',
  path: '/about',
});

export default function AboutRoutePage() {
  return <AboutPage />;
}
