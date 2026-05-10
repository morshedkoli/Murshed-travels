import { getAccounts } from '@/actions/accounts';
import { getExpenseEntries } from '@/actions/expense';
import { getVendors } from '@/actions/vendors';
import { ExpenseManager } from '@/components/expense/expense-manager';

export const dynamic = 'force-dynamic';

export default async function ExpensePage() {
    const [entries, accounts, vendors] = await Promise.all([
        getExpenseEntries(),
        getAccounts(),
        getVendors(),
    ]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-semibold">Expense</h1>
                <p className="text-sm text-muted-foreground">Track and manage all expense transactions</p>
            </div>

            <ExpenseManager
                entries={entries}
                accounts={accounts.map((a) => ({ _id: a._id, name: a.name }))}
                vendors={vendors.map((v) => ({ _id: v._id, name: v.name }))}
            />
        </div>
    );
}
