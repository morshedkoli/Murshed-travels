import Link from 'next/link';
import { Plus, Smartphone, Landmark, Wallet, CreditCard, Building, TrendingUp } from 'lucide-react';
import { getAccounts } from '@/actions/accounts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function money(value: number) {
    return `৳${value.toLocaleString()}`;
}

export default async function AccountsPage() {
    const accounts = await getAccounts();
    
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const bankAccounts = accounts.filter(a => a.type === 'Bank');
    const mobileAccounts = accounts.filter(a => a.type === 'Mobile Banking');
    const cashAccounts = accounts.filter(a => a.type === 'Cash');

    const getTypeIcon = (type: string) => {
        if (type === 'Bank') return Landmark;
        if (type === 'Mobile Banking') return Smartphone;
        return Wallet;
    };

    const getTypeColor = (type: string) => {
        if (type === 'Bank') return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
        if (type === 'Mobile Banking') return 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400';
        return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-semibold">Accounts</h1>
                    <p className="text-sm text-muted-foreground">Manage settlement accounts for transactions</p>
                </div>
                <Link href="/accounts/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Account
                    </Button>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold text-emerald-600">{money(totalBalance)}</span>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Bank Accounts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold">{bankAccounts.length}</span>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Mobile Banking</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold">{mobileAccounts.length}</span>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Cash Accounts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold">{cashAccounts.length}</span>
                    </CardContent>
                </Card>
            </div>

            {/* Accounts Grid */}
            {accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <CreditCard className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">No accounts yet</p>
                    <p className="text-xs text-muted-foreground">Add your first account to start tracking</p>
                    <Link href="/accounts/new" className="mt-4">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Account
                        </Button>
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {accounts.map((account) => {
                        const Icon = getTypeIcon(account.type);
                        const colorClass = getTypeColor(account.type);

                        return (
                            <div
                                key={account._id}
                                className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${colorClass}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium">{account.name}</h3>
                                            <p className="text-xs text-muted-foreground">{account.type}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <p className="text-xs text-muted-foreground">Current Balance</p>
                                    <p className="text-xl font-semibold">{money(account.balance || 0)}</p>
                                </div>

                                {(account.bankName || account.accountNumber) && (
                                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                        {account.bankName && (
                                            <div className="flex items-center gap-1.5">
                                                <Building className="h-3 w-3" />
                                                {account.bankName}
                                            </div>
                                        )}
                                        {account.accountNumber && (
                                            <div className="font-mono">**** {account.accountNumber.slice(-4)}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Add Account Card */}
                    <Link href="/accounts/new">
                        <div className="flex h-full min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/30">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                                <Plus className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="mt-2 text-sm font-medium text-muted-foreground">Add New Account</p>
                        </div>
                    </Link>
                </div>
            )}
        </div>
    );
}
