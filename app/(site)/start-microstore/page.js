import { CreatorSignupPage } from '@/components/pages/CreatorSignup';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Start a Limitra Microstore',
  description:
    'Launch your own Limitra Microstore and curate your favourite products for your audience.',
  path: '/start-microstore',
});

export default function Page() {
  return <CreatorSignupPage program="microstore" />;
}
