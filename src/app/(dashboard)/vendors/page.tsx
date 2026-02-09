import Link from 'next/link';
import { BriefcaseBusiness, Plus, Phone, Store, Tags, Building2 } from 'lucide-react';
import { getServices } from '@/actions/services';
import { getVendors } from '@/actions/vendors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function money(value: number) {
    return `৳${value.toLocaleString()}`;
}

export default async function VendorsPage() {
    const [vendors, services] = await Promise.all([getVendors(), getServices()]);
    const totalPayable = vendors.reduce((sum, vendor) => sum + (vendor.balance ?? 0), 0);
    const vendorsWithBalance = vendors.filter(v => (v.balance ?? 0) > 0).length;

    const serviceByVendor = services.reduce<Record<string, typeof services>>((acc, row) => {
        if (!row.vendorId) return acc;
        if (!acc[row.vendorId]) acc[row.vendorId] = [];
        acc[row.vendorId].push(row);
        return acc;
    }, {});

    const vendorFlowRows = vendors
        .map((vendor) => {
            const rows = serviceByVendor[vendor._id] ?? [];
            const activeServices = rows.filter((row) => row.status !== 'delivered' && row.status !== 'cancelled').length;
            const deliveredRows = rows.filter((row) => row.status === 'delivered');
            const deliveredCost = deliveredRows.reduce((sum, row) => sum + row.cost, 0);
            return {
                ...vendor,
                activeServices,
                deliveredCount: deliveredRows.length,
                deliveredCost,
                templateCount: vendor.serviceTemplates?.length ?? 0,
            };
        })
        .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-semibold">Vendors</h1>
                    <p className="text-sm text-muted-foreground">Manage vendor profiles and track payables</p>
                </div>
                <Link href="/vendors/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Vendor
                    </Button>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Vendors</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold">{vendors.length}</span>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">With Due</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold text-rose-600">{vendorsWithBalance}</span>
                    </CardContent>
                </Card>

                <Card className="sm:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Payable</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold text-emerald-600">{money(totalPayable)}</span>
                    </CardContent>
                </Card>
            </div>

            {/* Vendors Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Vendor List</CardTitle>
                </CardHeader>
                <CardContent>
                    {vendors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                <Store className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">No vendors yet</p>
                            <p className="text-xs text-muted-foreground">Add your first vendor to get started</p>
                            <Link href="/vendors/new" className="mt-4">
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Vendor
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px] text-sm">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="py-3 text-left text-xs font-medium text-muted-foreground">Vendor</th>
                                        <th className="py-3 text-center text-xs font-medium text-muted-foreground">Active</th>
                                        <th className="hidden py-3 text-center text-xs font-medium text-muted-foreground md:table-cell">Delivered</th>
                                        <th className="hidden py-3 text-left text-xs font-medium text-muted-foreground lg:table-cell">Services</th>
                                        <th className="hidden py-3 text-right text-xs font-medium text-muted-foreground xl:table-cell">Delivered Cost</th>
                                        <th className="py-3 text-right text-xs font-medium text-muted-foreground">Due</th>
                                        <th className="py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {vendorFlowRows.map((vendor) => (
                                        <tr key={vendor._id} className="hover:bg-muted/30">
                                            <td className="py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                                                        <BriefcaseBusiness className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <Link href={`/vendors/${vendor._id}`} className="font-medium hover:text-primary hover:underline underline-offset-2">
                                                            {vendor.name}
                                                        </Link>
                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                                            <Phone className="h-3 w-3" />
                                                            {vendor.phone || '-'}
                                                        </div>
                                                        {vendor.serviceType && (
                                                            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground mt-0.5 md:flex">
                                                                <Tags className="h-3 w-3" />
                                                                {vendor.serviceType}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 text-center font-medium">{vendor.activeServices}</td>
                                            <td className="hidden py-3 text-center font-medium md:table-cell">{vendor.deliveredCount}</td>
                                            <td className="hidden py-3 lg:table-cell">
                                                {vendor.serviceTemplates && vendor.serviceTemplates.length > 0 ? (
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        {vendor.serviceTemplates.slice(0, 2).map((item: { name: string; category: string }) => (
                                                            <span key={`${vendor._id}-${item.name}-${item.category}`} className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                                                                {item.name}
                                                            </span>
                                                        ))}
                                                        {vendor.serviceTemplates.length > 2 && (
                                                            <span className="text-xs text-muted-foreground">+{vendor.serviceTemplates.length - 2}</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                        {vendor.serviceType || 'Not set'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="hidden py-3 text-right font-medium xl:table-cell">{money(vendor.deliveredCost)}</td>
                                            <td className={`py-3 text-right font-semibold ${(vendor.balance ?? 0) > 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>
                                                {money(vendor.balance ?? 0)}
                                            </td>
                                            <td className="py-3">
                                                <div className="flex justify-end gap-2">
                                                    <Link href={`/vendors/${vendor._id}#service-templates`}>
                                                        <Button variant="outline" size="sm">Service</Button>
                                                    </Link>
                                                    <Link href={`/vendors/${vendor._id}`}>
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
