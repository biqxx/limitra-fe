import { ComingSoon } from '@/components/microstore/Microstore';

export default function Page() {
  return (
    <ComingSoon
      title="Promotion"
      icon="gift"
      desc="Promotion tools for MicroStores aren't available from the backend yet."
      bullets={['Discount codes for your store', 'Featured-product boosts', 'Social sharing kits']}
    />
  );
}
