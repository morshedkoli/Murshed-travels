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

            {/* Customers Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Customer List</CardTitle>
                </CardHeader>
                <CardContent>
                    {customers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
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
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px] text-sm">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="py-3 text-left font-medium text-muted-foreground">Customer</th>
                                        <th className="py-3 text-center font-medium text-muted-foreground">Active</th>
                                        <th className="hidden py-3 text-center font-medium text-muted-foreground md:table-cell">Delivered</th>
                                        <th className="hidden py-3 text-right font-medium text-muted-foreground lg:table-cell">Delivered Value</th>
                                        <th className="py-3 text-right font-medium text-muted-foreground">Balance</th>
                                        <th className="py-3 text-right font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {customerFlowRows.map((customer) => (
                                        <tr key={customer._id} className="hover:bg-muted/50">
                                            <td className="py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                                        <Building2 className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <Link 
                                                            href={`/customers/${customer._id}`} 
                                                            className="font-medium hover:text-primary hover:underline underline-offset-2"
                                                        >
                                                            {customer.name}
                                                        </Link>
                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                                            <Phone className="h-3 w-3" />
                                                            {customer.phone}
                                                        </div>
                                                        {customer.email && (
                                                            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground mt-0.5 lg:flex">
                                                                <Mail className="h-3 w-3" />
                                                                {customer.email}
                                                            </div>
                                                        )}
                                                        {customer.address && (
                                                            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground mt-0.5 xl:flex">
                                                                <MapPin className="h-3 w-3" />
                                                                <span className="truncate max-w-[200px]">{customer.address}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 text-center font-medium">{customer.activeServices}</td>
                                            <td className="hidden py-3 text-center font-medium md:table-cell">{customer.deliveredCount}</td>
                                            <td className="hidden py-3 text-right font-medium lg:table-cell">{money(customer.deliveredValue)}</td>
                                            <td className={`py-3 text-right font-semibold ${
                                                (customer.balance ?? 0) > 0
                                                    ? 'text-amber-600'
                                                    : (customer.balance ?? 0) < 0
                                                        ? 'text-emerald-600'
                                                        : 'text-muted-foreground'
                                            }`}>
                                                {(customer.balance ?? 0) < 0
                                                    ? `${money(Math.abs(customer.balance ?? 0))} (Adv)`
                                                    : money(customer.balance ?? 0)}
                                            </td>
                                            <td className="py-3">
                                                <div className="flex justify-end gap-2">
                                                    <Link href={`/services?customerId=${customer._id}&create=1`}>
                                                        <Button variant="outline" size="sm">Service</Button>
                                                    </Link>
                                                    <Link href={`/customers/${customer._id}`}>
                                                        <Button size="sm">View</Button>
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
