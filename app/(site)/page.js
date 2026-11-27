import { HomePage } from '@/components/pages/HomePage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Online Shopping in Nigeria',
  images: '/assets/img/hero-shop3d.png',
  description:
    'Discover trending electronics, fashion, lifestyle, and creator-curated storefronts on Limitra with verified quality and nationwide delivery.',
  path: '/',
});

export default function Home() {
  return <HomePage />;
}
