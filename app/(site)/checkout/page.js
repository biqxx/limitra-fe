import { CheckoutPage } from '@/components/pages/Cart';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Checkout',
  description: 'Complete your Limitra order securely.',
  path: '/checkout',
  noindex: true,
});

export default function CheckoutRoutePage() {
  return <CheckoutPage />;
}
