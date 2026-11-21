import { ComingSoon } from '@/components/microstore/Microstore';

export default function Page() {
  return (
    <ComingSoon
      title="Inventory"
      icon="package"
      desc="Stock tracking for MicroStore products isn't available from the backend yet."
      bullets={['Stock levels per curated product', 'Low-stock alerts', 'Restock requests to Limitra']}
    />
  );
}
