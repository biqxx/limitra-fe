import { VideosPage } from '@/components/video/Video';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Shoppable Videos & Product Demos',
  description:
    'Watch product unboxings, reviews, and live creator demos on Limitra and shop featured items directly.',
  path: '/videos',
});

export default function VideosRoutePage() {
  return <VideosPage />;
}
