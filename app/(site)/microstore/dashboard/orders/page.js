import { ComingSoon } from '@/components/microstore/Microstore';

export default function Page() {
  return (
    <ComingSoon
      title="Orders"
      icon="cart"
      desc="Order history scoped to a MicroStore isn't available from the backend yet."
      bullets={['Order status & fulfillment tracking', 'Customer order history for your store', 'Delivery timelines']}
    />
  );
}
