import { HelpPage } from '@/components/pages/Account';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Help Center & Customer Support',
  description:
    'Get help with Limitra orders, shipping, Redstar delivery tracking, returns, payments, and account support.',
  path: '/help',
});

export default function HelpIndexPage() {
  return <HelpPage />;
}
