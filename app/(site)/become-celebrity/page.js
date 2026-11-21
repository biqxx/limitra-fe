import { CreatorSignupPage } from '@/components/pages/CreatorSignup';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Become a Limitra Celebrity Store',
  description:
    'Apply for an official Limitra Celebrity Storefront and showcase your signature collections.',
  path: '/become-celebrity',
});

export default function Page() {
  return <CreatorSignupPage program="celebrity" />;
}
