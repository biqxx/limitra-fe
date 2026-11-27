import { CreatorSignupPage } from '@/components/pages/CreatorSignup';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Apply to the Affiliate Program',
  images: '/assets/img/affiliate-hero.png',
  description:
    'Apply to the Limitra Affiliate Program and earn commissions promoting curated products.',
  path: '/become-affiliate',
});

export default function Page() {
  return <CreatorSignupPage program="affiliate" />;
}
