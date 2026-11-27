import { HelpPage } from '@/components/pages/Account';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Help Center & Customer Support',
  description: 'Find answers about Limitra orders, delivery, returns, and payments or contact customer support.',
  path: '/help',
});

export default async function HelpSectionPage({ params }) {
  const { section } = await params;
  return <HelpPage section={section} />;
}
