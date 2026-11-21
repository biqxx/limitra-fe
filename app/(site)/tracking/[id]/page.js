import { TrackingPage } from '@/components/pages/Account';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata({ params }) {
  const { id } = await params;
  return buildMetadata({
    title: 'Order Tracking',
    description: 'Track your Limitra shipment.',
    path: `/tracking/${encodeURIComponent(id || '')}`,
    noindex: true,
  });
}

export default async function TrackingRoutePage({ params }) {
  const { id } = await params;
  return <TrackingPage id={id} />;
}
