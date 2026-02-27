import { getPayables } from '@/actions/payables';
import { getVendors } from '@/actions/vendors';
import { getAccounts } from '@/actions/accounts';
import { PayableManager } from '@/components/payable/payable-manager';

type PayablePageProps = {
  searchParams?: { aging?: string; asOf?: string } | Promise<{ aging?: string; asOf?: string }>;
};

function matchesAgingBucket(days: number, bucket: string) {
  if (bucket === '0-30') return days <= 30;
  if (bucket === '31-60') return days >= 31 && days <= 60;
  if (bucket === '61+') return days >= 61;
  return true;
}

export default async function PayablePage({ searchParams }: PayablePageProps) {
  const params = (await Promise.resolve(searchParams)) ?? {};
  const agingBucket = params.aging ?? '';
  const asOfDate = params.asOf ? new Date(params.asOf) : new Date();

  const [entries, vendors, accounts] = await Promise.all([
    getPayables(),
    getVendors(),
    getAccounts(),
  ]);

  const filteredEntries = agingBucket
    ? entries.filter((item) => {
      if (item.remainingAmount <= 0) return false;
      const baseDate = item.dueDate || item.date;
      const due = new Date(baseDate);
      const days = Math.max(0, Math.floor((asOfDate.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)));
      return matchesAgingBucket(days, agingBucket);
    })
    : entries;

  return (
    <PayableManager
      entries={filteredEntries as any}
      vendors={vendors.map((vendor) => ({ _id: vendor._id, name: vendor.name }))}
      accounts={accounts.map((account) => ({ _id: account._id, name: account.name, balance: account.balance }))}
      filterContext={agingBucket ? `Aging filter: ${agingBucket} days as of ${params.asOf ?? 'today'}` : undefined}
      clearFilterHref={agingBucket ? '/payable' : undefined}
    />
  );
}
