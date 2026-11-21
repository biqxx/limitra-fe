import { ComingSoon } from '@/components/microstore/Microstore';

export default function Page() {
  return (
    <ComingSoon
      title="Withdrawals"
      icon="wallet"
      desc="Withdrawals for MicroStore owners aren't available from the backend yet."
      bullets={['Request a payout', 'Manage payout methods', 'Withdrawal history']}
    />
  );
}
