import { CreatorSignupPage } from '@/components/pages/CreatorSignup';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Apply to Start a Creator Microstore',
  images: '/assets/img/micro.png',
  description:
    'Launch your own Limitra Microstore and curate your favourite products for your audience.',
  path: '/start-microstore',
});

export default function Page() {
  return <CreatorSignupPage program="microstore" />;
}
