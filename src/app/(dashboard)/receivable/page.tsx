import { getCustomers } from '@/actions/customers';
import { getAccounts } from '@/actions/accounts';
import { getReceivables } from '@/actions/receivables';
import { ReceivableManager } from '@/components/receivable/receivable-manager';

type ReceivablePageProps = {
  searchParams?: { aging?: string; asOf?: string } | Promise<{ aging?: string; asOf?: string }>;
};

const RECEIVABLE_STATUSES = ['unpaid', 'partial', 'paid'] as const;
type ReceivableStatus = (typeof RECEIVABLE_STATUSES)[number];

function toReceivableStatus(status: string): ReceivableStatus {
  return RECEIVABLE_STATUSES.includes(status as ReceivableStatus) ? (status as ReceivableStatus) : 'unpaid';
}

function matchesAgingBucket(days: number, bucket: string) {
  if (bucket === '0-30') return days <= 30;
  if (bucket === '31-60') return days >= 31 && days <= 60;
  if (bucket === '61+') return days >= 61;
  return true;
}

export default async function ReceivablePage({ searchParams }: ReceivablePageProps) {
  const params = (await Promise.resolve(searchParams)) ?? {};
  const agingBucket = params.aging ?? '';
  const asOfDate = params.asOf ? new Date(params.asOf) : new Date();

  const [entries, customers, accounts] = await Promise.all([
    getReceivables(),
    getCustomers(),
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
    <ReceivableManager
      entries={filteredEntries.map((entry) => ({
        ...entry,
        status: toReceivableStatus(entry.status),
      }))}
      customers={customers.map((customer) => ({ _id: customer._id, name: customer.name }))}
      accounts={accounts.map((account) => ({ _id: account._id, name: account.name }))}
      filterContext={agingBucket ? `Aging filter: ${agingBucket} days as of ${params.asOf ?? 'today'}` : undefined}
      clearFilterHref={agingBucket ? '/receivable' : undefined}
    />
  );
}
