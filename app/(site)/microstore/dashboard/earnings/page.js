import { ComingSoon } from '@/components/microstore/Microstore';

export default function Page() {
  return (
    <ComingSoon
      title="Earnings"
      icon="dollar"
      desc="Earnings for MicroStore owners aren't available from the backend yet."
      bullets={['Revenue breakdown by period', 'Commission history', 'Payout summaries']}
    />
  );
}
