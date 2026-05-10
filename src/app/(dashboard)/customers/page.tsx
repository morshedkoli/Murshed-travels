import Link from 'next/link';
import { Building2, Mail, MapPin, Phone, Plus, Users } from 'lucide-react';
import { getCustomers } from '@/actions/customers';
import { getServices } from '@/actions/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function money(value: number) {
    return `৳${value.toLocaleString()}`;
}

export default async function CustomersPage() {
    const [customers, services] = await Promise.all([getCustomers(), getServices()]);
    const totalReceivable = customers.reduce((sum, customer) => sum + Math.max(customer.balance ?? 0, 0), 0);
    const totalAdvance = customers.reduce((sum, customer) => sum + Math.max(-(customer.balance ?? 0), 0), 0);
    const customersWithBalance = customers.filter(c => (c.balance ?? 0) > 0).length;
    const customersWithAdvance = customers.filter(c => (c.balance ?? 0) < 0).length;

    const serviceByCustomer = services.reduce<Record<string, typeof services>>((acc, row) => {
        if (!row.customerId) return acc;
        if (!acc[row.customerId]) acc[row.customerId] = [];
        acc[row.customerId].push(row);
        return acc;
    }, {});

    const customerFlowRows = customers
        .map((customer) => {
            const rows = serviceByCustomer[customer._id] ?? [];
            const activeServices = rows.filter((row) => row.status !== 'delivered' && row.status !== 'cancelled').length;
            const deliveredServices = rows.filter((row) => row.status === 'delivered');
            const deliveredValue = deliveredServices.reduce((sum, row) => sum + row.price, 0);

            return {
                ...customer,
                activeServices,
                deliveredCount: deliveredServices.length,
                deliveredValue,
            };
        })
        .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-semibold">Customers</h1>
                    <p className="text-sm text-muted-foreground">Manage customer profiles and track balances</p>
                </div>
                <Link href="/customers/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Customer
                    </Button>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-semibold">{customers.length}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">With Due</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-semibold text-amber-600">{customersWithBalance}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Receivable</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-semibold text-amber-600">{money(totalReceivable)}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Advance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-semibold text-emerald-600">{money(totalAdvance)}</span>
                            <span className="text-xs text-muted-foreground">{customersWithAdvance} customers</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Customer Cards Grid */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold tracking-tight">Customer Directory</h2>
                    <span className="text-sm text-muted-foreground">{customers.length} total</span>
                </div>
                {customers.length === 0 ? (
                    <Card className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <Users className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">No customers yet</p>
                        <p className="text-xs text-muted-foreground">Add your first customer to get started</p>
                        <Link href="/customers/new" className="mt-4">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Customer
                            </Button>
                        </Link>
                    </Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {customerFlowRows.map((customer) => (
                            <Card key={customer._id} className="group overflow-hidden transition-all hover:shadow-md hover:border-primary/20">
                                <CardContent className="p-0">
                                    <div className="p-5">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                                    <Building2 className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <Link 
                                                        href={`/customers/${customer._id}`} 
                                                        className="font-semibold text-base hover:text-primary hover:underline transition-colors"
                                                    >
                                                        {customer.name}
                                                    </Link>
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                                        <Phone className="h-3 w-3" />
                                                        {customer.phone}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`flex flex-col items-end rounded-md px-2.5 py-1 text-right text-xs font-medium ${
                                                (customer.balance ?? 0) > 0
                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                                                    : (customer.balance ?? 0) < 0
                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                                        : 'bg-muted text-muted-foreground'
                                            }`}>
                                                <span className="opacity-75 uppercase tracking-wider" style={{ fontSize: '10px' }}>
                                                    {(customer.balance ?? 0) < 0 ? 'Advance' : (customer.balance ?? 0) > 0 ? 'Due' : 'Settled'}
                                                </span>
                                                <span className="text-sm font-bold">
                                                    {money(Math.abs(customer.balance ?? 0))}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border/50 pt-4">
                                            <div>
                                                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Activity</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center justify-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                                                        {customer.activeServices} Active
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Delivered</p>
                                                <p className="text-sm font-semibold">
                                                    {customer.deliveredCount} <span className="text-xs font-normal text-muted-foreground">({money(customer.deliveredValue)})</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex border-t border-border/50 bg-muted/20 p-2">
                                        <Link href={`/services?customerId=${customer._id}&create=1`} className="flex-1">
                                            <Button variant="ghost" size="sm" className="w-full h-8 text-xs text-muted-foreground hover:text-foreground">
                                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                                Service
                                            </Button>
                                        </Link>
                                        <div className="w-px bg-border/50 my-1 mx-1"></div>
                                        <Link href={`/customers/${customer._id}`} className="flex-1">
                                            <Button variant="ghost" size="sm" className="w-full h-8 text-xs text-muted-foreground hover:text-primary">
                                                View Profile
                                            </Button>
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
