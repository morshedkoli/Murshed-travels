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

            {/* Vendor Cards Grid */}
            <div>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold tracking-tight">Vendor Directory</h2>
                    <span className="text-sm text-muted-foreground">{vendors.length} total</span>
                </div>
                {vendors.length === 0 ? (
                    <Card className="flex flex-col items-center justify-center py-12 text-center">
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
                    </Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {vendorFlowRows.map((vendor) => (
                            <Card key={vendor._id} className="group overflow-hidden transition-all hover:shadow-md hover:border-primary/20">
                                <CardContent className="p-0">
                                    <div className="p-5">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                                                    <BriefcaseBusiness className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <Link 
                                                        href={`/vendors/${vendor._id}`} 
                                                        className="font-semibold text-base hover:text-primary hover:underline transition-colors"
                                                    >
                                                        {vendor.name}
                                                    </Link>
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                                        <Phone className="h-3 w-3" />
                                                        {vendor.phone || 'No phone'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`flex flex-col items-end rounded-md px-2.5 py-1 text-right text-xs font-medium ${
                                                (vendor.balance ?? 0) > 0
                                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
                                                    : 'bg-muted text-muted-foreground'
                                            }`}>
                                                <span className="opacity-75 uppercase tracking-wider" style={{ fontSize: '10px' }}>
                                                    {(vendor.balance ?? 0) > 0 ? 'Payable' : 'Settled'}
                                                </span>
                                                <span className="text-sm font-bold">
                                                    {money(Math.max(vendor.balance ?? 0, 0))}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex items-center gap-2">
                                            <Tags className="h-3 w-3 text-muted-foreground" />
                                            <div className="flex flex-wrap items-center gap-1">
                                                {vendor.serviceTemplates && vendor.serviceTemplates.length > 0 ? (
                                                    <>
                                                        {vendor.serviceTemplates.slice(0, 2).map((item: { name: string; category: string }) => (
                                                            <span key={`${vendor._id}-${item.name}-${item.category}`} className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                                {item.name}
                                                            </span>
                                                        ))}
                                                        {vendor.serviceTemplates.length > 2 && (
                                                            <span className="text-[10px] text-muted-foreground font-medium">+{vendor.serviceTemplates.length - 2} more</span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                        {vendor.serviceType || 'General Vendor'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/50 pt-4">
                                            <div>
                                                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Active Services</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center justify-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/20 dark:text-purple-400">
                                                        {vendor.activeServices} Active
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Delivered Cost</p>
                                                <p className="text-sm font-semibold">
                                                    {money(vendor.deliveredCost)} <span className="text-xs font-normal text-muted-foreground">({vendor.deliveredCount})</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex border-t border-border/50 bg-muted/20 p-2">
                                        <Link href={`/vendors/${vendor._id}#service-templates`} className="flex-1">
                                            <Button variant="ghost" size="sm" className="w-full h-8 text-xs text-muted-foreground hover:text-foreground">
                                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                                Template
                                            </Button>
                                        </Link>
                                        <div className="w-px bg-border/50 my-1 mx-1"></div>
                                        <Link href={`/vendors/${vendor._id}`} className="flex-1">
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
