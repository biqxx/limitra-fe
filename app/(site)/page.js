import { HomePage } from '@/components/pages/HomePage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Limitra — Curated Marketplace & Creator Microstores',
  description:
    'Discover trending electronics, fashion, lifestyle, and creator-curated storefronts on Limitra with verified quality and nationwide delivery.',
  path: '/',
});

export default function Home() {
  return <HomePage />;
}
