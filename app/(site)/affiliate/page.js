import { AffiliatePage } from '@/components/pages/AffiliatePage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Limitra Affiliate Program — Earn Commissions',
  description:
    'Join the Limitra Affiliate Program, share curated products with your audience, and earn commissions on every verified purchase.',
  path: '/affiliate',
});

export default function AffiliateRoutePage() {
  return <AffiliatePage />;
}
