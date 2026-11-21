import { Suspense } from 'react';
import { SearchPage } from '@/components/pages/ShopPage';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata({ searchParams }) {
  const { q } = await searchParams;
  return buildMetadata({
    title: q ? `Search results for "${q}"` : 'Search Products',
    description: 'Search curated products, brands, and categories on Limitra.',
    path: '/search',
    noindex: true,
  });
}

async function SearchBody({ searchParams }) {
  const { q } = await searchParams;
  return <SearchPage q={q} />;
}

export default function SearchRoutePage({ searchParams }) {
  return (
    <Suspense fallback={null}>
      <SearchBody searchParams={searchParams} />
    </Suspense>
  );
}
