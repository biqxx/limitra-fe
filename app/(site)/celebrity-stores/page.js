import { CelebrityStoresPage } from '@/components/pages/CelebrityStoresPage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Celebrity Storefronts and Collections',
  images: '/assets/img/celebrity-hero.png',
  description:
    'Shop official celebrity storefronts and signature product collections curated by your favourite stars on Limitra.',
  path: '/celebrity-stores',
});

export default function CelebrityStoresRoutePage() {
  return <CelebrityStoresPage />;
}
