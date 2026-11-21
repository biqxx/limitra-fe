import { ComingSoon } from '@/components/microstore/Microstore';

export default function Page() {
  return (
    <ComingSoon
      title="Customers"
      icon="user"
      desc="Customer data scoped to a MicroStore isn't available from the backend yet."
      bullets={['Customer list & order history', 'Repeat-buyer insights', 'Direct customer messaging']}
    />
  );
}
