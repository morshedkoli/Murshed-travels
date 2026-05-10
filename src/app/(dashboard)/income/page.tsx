import { getAccounts } from '@/actions/accounts';
import { getCustomers } from '@/actions/customers';
import { getIncomeEntries } from '@/actions/income';
import { IncomeManager } from '@/components/income/income-manager';

export const dynamic = 'force-dynamic';

export default async function IncomePage() {
    const [entries, accounts, customers] = await Promise.all([
        getIncomeEntries(),
        getAccounts(),
        getCustomers(),
    ]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-semibold">Income</h1>
                <p className="text-sm text-muted-foreground">Track and manage all income transactions</p>
            </div>

            <IncomeManager
                entries={entries}
                accounts={accounts.map((a) => ({ _id: a._id, name: a.name }))}
                customers={customers.map((c) => ({ _id: c._id, name: c.name }))}
            />
        </div>
    );
}
