import { ChannelsPage } from '@/components/pages/ChannelsPage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Limitra Channels & Official Community',
  description:
    'Connect with Limitra across official shopping channels, live drops, and social communities.',
  path: '/channels',
});

export default function ChannelsRoutePage() {
  return <ChannelsPage />;
}
