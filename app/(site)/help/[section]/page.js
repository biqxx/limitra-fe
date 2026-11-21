import { HelpPage } from '@/components/pages/Account';
import { buildMetadata } from '@/lib/seo';

function formatSection(section) {
  return String(section || 'Help Center')
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export async function generateMetadata({ params }) {
  const { section } = await params;
  const label = formatSection(section);
  return buildMetadata({
    title: `${label} — Help Center`,
    description: `Find answers about ${label.toLowerCase()}, orders, shipping, and returns on Limitra.`,
    path: `/help/${encodeURIComponent(section)}`,
  });
}

export default async function HelpSectionPage({ params }) {
  const { section } = await params;
  return <HelpPage section={section} />;
}
