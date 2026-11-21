import { ComingSoon } from '@/components/microstore/Microstore';

export default function Page() {
  return (
    <ComingSoon
      title="Transactions"
      icon="list"
      desc="Transaction history for MicroStore owners isn't available from the backend yet."
      bullets={['Full transaction ledger', 'Refund records', 'Exportable statements']}
    />
  );
}
