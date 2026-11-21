import { MicroStoresPage } from '@/components/pages/MicroStoresPage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Creator Microstores — Curate & Sell',
  description:
    'Launch your own Limitra Microstore, curate your favourite products, and earn from every sale without holding inventory.',
  path: '/microstores',
});

export default function MicroStoresRoutePage() {
  return <MicroStoresPage />;
}
