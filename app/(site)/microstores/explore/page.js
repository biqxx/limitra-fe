import { MicroStoresDirectory } from '@/components/pages/MicroStoresDirectory';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Explore Creator Microstores',
  images: '/assets/img/micro.png',
  description:
    'Browse verified creator microstores and handpicked product collections across tech, fashion, beauty, and lifestyle on Limitra.',
  path: '/microstores/explore',
});

export default function MicroStoresExploreRoutePage() {
  return <MicroStoresDirectory />;
}
