import { CareersPage } from '@/components/pages/CareersPage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Careers and Job Openings',
  description:
    'Explore open roles in engineering, commerce, operations, and creator partnerships at Limitra.',
  path: '/careers',
});

export default function CareersRoutePage() {
  return <CareersPage />;
}
