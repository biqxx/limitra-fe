import { CreatorSignupPage } from '@/components/pages/CreatorSignup';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Apply for a Celebrity Store',
  images: '/assets/img/celebrity-hero.png',
  description:
    'Apply for an official Limitra Celebrity Storefront and showcase your signature collections.',
  path: '/become-celebrity',
});

export default function Page() {
  return <CreatorSignupPage program="celebrity" />;
}
