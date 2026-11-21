import { ComingSoon } from '@/components/microstore/Microstore';

export default function Page() {
  return (
    <ComingSoon
      title="Reviews"
      icon="star"
      desc="Product/store reviews scoped to a MicroStore aren't available from the backend yet."
      bullets={['Reviews left on your curated products', 'Respond to customer feedback', 'Review rating trends']}
    />
  );
}
