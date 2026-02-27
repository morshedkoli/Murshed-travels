'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BriefcaseBusiness, Download, History, Package, PencilLine, Trash2, TrendingUp, Wallet } from 'lucide-react';
import { deleteVendorServiceTemplate, recordVendorBillPayment, updateVendorServiceTemplatePrice } from '@/actions/vendors';
import { getPayableSettlementHistory } from '@/actions/payables';
import { AddVendorServiceTemplateForm } from '@/components/vendors/add-vendor-service-template-form';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { generateVendorLedgerPDF, type LedgerEntry } from '@/lib/pdf-generator';

type VendorTemplate = {
    _id?: string;
    name: string;
    serviceType: string;
    category: string;
    defaultPrice: number;
    defaultCost: number;
};

type VendorProfile = {
    _id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    serviceCategoryLabels: string[];
    status?: string | null;
    rating?: number | null;
    balance?: number;
    serviceTemplates: VendorTemplate[];
};

type VendorServiceRow = {
    _id: string;
    name: string;
    serviceType: string;
    category: string;
    status: 'pending' | 'in-progress' | 'ready' | 'delivered' | 'cancelled';
    customerId: string;
    customerName: string;
    cost: number;
    price: number;
};

type VendorLedger = {
    payables: Array<{
        _id: string;
        date: string;
        amount: number;
        paidAmount: number;
        dueAmount: number;
        status: 'unpaid' | 'partial' | 'paid';
        description: string;
    }>;
    deliveredServices: Array<{
        _id: string;
        name: string;
        date: string;
        price: number;
        cost: number;
        profit: number;
    }>;
    totalDue: number;
};

type VendorProfileViewProps = {
    vendor: VendorProfile;
    services: VendorServiceRow[];
    ledger: VendorLedger;
    accounts: Array<{ _id: string; name: string }>;
    transactions: Array<{
        _id: string;
        date: string;
        amount: number;
        type: 'income' | 'expense';
        category: string;
        accountName: string;
        description: string;
    }>;
};

type SettlementHistoryRow = {
    _id: string;
    date: string;
    amount: number;
    accountName: string;
    description: string;
};

function money(value: number) {
    return `৳${value.toLocaleString()}`;
}

function toBadgeVariant(status: VendorServiceRow['status']) {
    if (status === 'in-progress') return 'info';
    if (status === 'ready') return 'primary';
    return status;
}

export function VendorProfileView({ vendor, services, ledger, accounts, transactions }: VendorProfileViewProps) {
    const { toast } = useToast();
    const [templates, setTemplates] = useState<VendorTemplate[]>(vendor.serviceTemplates ?? []);
    const [vendorDue, setVendorDue] = useState(ledger.totalDue);
    const [payableRows, setPayableRows] = useState(ledger.payables);
    const [catalogNotice, setCatalogNotice] = useState<string>('');
    const [editingTemplate, setEditingTemplate] = useState<VendorTemplate | null>(null);
    const [nextPrice, setNextPrice] = useState<string>('');
    const [nextCost, setNextCost] = useState<string>('');
    const [savingPrice, setSavingPrice] = useState(false);
    const [deletingTemplate, setDeletingTemplate] = useState<VendorTemplate | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentAccountId, setPaymentAccountId] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [paying, setPaying] = useState(false);
    const [historyTargetName, setHistoryTargetName] = useState('');
    const [historyRows, setHistoryRows] = useState<SettlementHistoryRow[]>([]);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);

    const stats = useMemo(() => {
        const totalRevenue = services.reduce((sum, row) => sum + row.price, 0);
        const pendingCount = services.filter((row) => row.status === 'pending' || row.status === 'in-progress').length;
        return { totalRevenue, pendingCount };
    }, [services]);

    async function handleVendorPayment(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const amount = Number(paymentAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast({ title: 'Invalid amount', description: 'Enter an amount greater than 0.', variant: 'error' });
            return;
        }

        if (!paymentAccountId) {
            toast({ title: 'Account required', description: 'Select a settlement account.', variant: 'error' });
            return;
        }

        setPaying(true);
        const result = await recordVendorBillPayment({
            vendorId: vendor._id,
            accountId: paymentAccountId,
            amount,
            date: paymentDate,
            note: paymentNote || undefined,
        });
        setPaying(false);

        if ('error' in result) {
            toast({ title: 'Payment failed', description: result.error, variant: 'error' });
            return;
        }

        const paid = result.appliedAmount ?? amount;
        const nextRows = payableRows.map((row) => ({ ...row }));
        let remaining = paid;
        for (let index = 0; index < nextRows.length && remaining > 0; index += 1) {
            const row = nextRows[index];
            const due = Math.max(0, row.amount - row.paidAmount);
            if (due <= 0) continue;
            const settled = Math.min(due, remaining);
            row.paidAmount += settled;
            row.dueAmount = Math.max(0, row.amount - row.paidAmount);
            row.status = row.paidAmount >= row.amount ? 'paid' : 'partial';
            remaining -= settled;
        }

        setPayableRows(nextRows);
        setVendorDue(typeof result.totalDue === 'number' ? result.totalDue : Math.max(0, vendorDue - paid));
        setPaymentOpen(false);
        setPaymentAmount('');
        setPaymentAccountId('');
        setPaymentNote('');
        toast({ title: 'Bill payment recorded', description: `Paid ${money(paid)} to vendor dues.`, variant: 'success' });
    }

    async function openSettlementHistory(row: VendorLedger['payables'][number]) {
        setHistoryTargetName(row.description || 'Service payable');
        setHistoryRows([]);
        setHistoryOpen(true);
        setHistoryLoading(true);
        const items = await getPayableSettlementHistory(row._id);
        setHistoryRows(items);
        setHistoryLoading(false);
    }

    // Vendor activity types for ledger
    type VendorActivityItem = {
        id: string;
        date: string;
        type: 'service' | 'payment' | 'payable';
        title: string;
        description?: string;
        amount: number;
        meta?: Record<string, string | number>;
    };

    // Combine all vendor activities - only delivered services and payments
    const activities = useMemo<VendorActivityItem[]>(() => {
        const items: VendorActivityItem[] = [];

        // Only DELIVERED services (cost to vendor after delivery)
        services
            .filter(service => service.status === 'delivered')
            .forEach(service => {
                items.push({
                    id: `service-${service._id}`,
                    date: new Date().toISOString(), // Use current date as fallback
                    type: 'service',
                    title: `${service.name} (Delivered)`,
                    description: `${service.category} • ${service.customerName || 'No customer'}`,
                    amount: service.cost,
                    meta: {
                        category: service.category,
                        customer: service.customerName || '-',
                        status: service.status,
                    }
                });
            });

        // Vendor Payments (from transactions - expense type) - Group by date
        // These are the "Pay Bill" transactions
        const paymentGroups: Record<string, { amount: number; descriptions: string[]; accounts: string[] }> = {};
        transactions
            .filter(t => t.type === 'expense')
            .forEach(t => {
                const dateKey = t.date.split('T')[0];
                if (!paymentGroups[dateKey]) {
                    paymentGroups[dateKey] = { amount: 0, descriptions: [], accounts: [] };
                }
                paymentGroups[dateKey].amount += t.amount;
                if (t.description) paymentGroups[dateKey].descriptions.push(t.description);
                if (t.accountName) paymentGroups[dateKey].accounts.push(t.accountName);
            });

        // Add consolidated payments
        Object.entries(paymentGroups).forEach(([date, data]) => {
            const uniqueAccounts = [...new Set(data.accounts)];
            items.push({
                id: `payment-${date}`,
                date: date,
                type: 'payment',
                title: 'Pay Bill',
                description: data.descriptions.length > 0 
                    ? `${data.descriptions.join(', ')}${uniqueAccounts.length > 0 ? ` • ${uniqueAccounts.join(', ')}` : ''}`
                    : (uniqueAccounts.length > 0 ? `Via: ${uniqueAccounts.join(', ')}` : 'Vendor payment'),
                amount: data.amount,
                meta: {
                    account: uniqueAccounts.join(', '),
                    count: data.descriptions.length || 1,
                }
            });
        });

        // Sort by date descending (newest first)
        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [services, transactions]);

    function handleExportLedger() {
        // Sort activities by date ascending (oldest first) for the ledger
        const sortedActivities = [...activities].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Build ledger entries with running balance
        const entries: LedgerEntry[] = [];
        let runningBalance = 0;
        let totalDebits = 0;
        let totalCredits = 0;

        sortedActivities.forEach((activity) => {
            let debit = 0;
            let credit = 0;

            if (activity.type === 'service') {
                // Delivered service cost creates a debit (we owe vendor)
                debit = activity.amount;
                totalDebits += activity.amount;
            } else if (activity.type === 'payment') {
                // Payment creates a credit (we paid vendor)
                credit = activity.amount;
                totalCredits += activity.amount;
            }

            runningBalance = runningBalance + debit - credit;

            entries.push({
                date: activity.date,
                description: activity.title,
                reference: activity.type === 'service' ? 'SRV' : 'PMT',
                debit,
                credit,
                balance: runningBalance,
            });
        });

        // Calculate opening balance (assume 0 if we don't have historical data)
        const openingBalance = 0;
        const closingBalance = runningBalance;

        generateVendorLedgerPDF({
            vendorName: vendor.name,
            vendorPhone: vendor.phone || undefined,
            vendorEmail: vendor.email || undefined,
            entries,
            openingBalance,
            closingBalance,
            totalDebits,
            totalCredits,
            generatedDate: new Date().toISOString(),
        });

        toast({
            title: 'Ledger exported',
            description: 'Vendor ledger PDF has been downloaded successfully.',
            variant: 'success',
        });
    }

    async function handlePriceUpdate(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!editingTemplate) {
            return;
        }

        const numericPrice = Number(nextPrice);
        const numericCost = Number(nextCost);
        if (!Number.isFinite(numericPrice) || numericPrice < 0 || !Number.isFinite(numericCost) || numericCost < 0) {
            toast({
                title: 'Invalid values',
                description: 'Please enter valid price and cost amounts that are 0 or greater.',
                variant: 'error',
            });
            return;
        }

        setSavingPrice(true);
        const result = await updateVendorServiceTemplatePrice(vendor._id, {
            name: editingTemplate.name,
            defaultPrice: numericPrice,
            defaultCost: numericCost,
        });
        setSavingPrice(false);

        if ('error' in result) {
            toast({
                title: 'Price update failed',
                description: result.error,
                variant: 'error',
            });
            return;
        }

        setTemplates((current) => current.map((template) => {
            if (template.name !== editingTemplate.name) return template;
            return {
                ...template,
                defaultPrice: numericPrice,
                defaultCost: numericCost,
            };
        }));
        setCatalogNotice(`Price and cost updated for ${editingTemplate.name}.`);
        setEditingTemplate(null);
        setNextPrice('');
        setNextCost('');
        toast({
            title: 'Service updated',
            description: 'Vendor listed service price and cost updated successfully.',
            variant: 'success',
        });
    }

    async function handleDeleteTemplate() {
        if (!deletingTemplate) {
            return;
        }

        setDeleting(true);
        const result = await deleteVendorServiceTemplate(vendor._id, deletingTemplate.name);
        setDeleting(false);

        if ('error' in result) {
            toast({
                title: 'Delete failed',
                description: result.error,
                variant: 'error',
            });
            return;
        }

        setTemplates((current) => current.filter((template) => template.name !== deletingTemplate.name));
        setCatalogNotice(`Vendor listed service removed: ${deletingTemplate.name}.`);
        toast({
            title: 'Service deleted',
            description: 'Vendor listed service has been removed.',
            variant: 'success',
        });
        setDeletingTemplate(null);
    }

    return (
        <div className="space-y-8">
            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 p-6 sm:p-8 dark:from-violet-950/25 dark:via-purple-950/20 dark:to-pink-950/25">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20 dark:shadow-violet-900/30">
                            <BriefcaseBusiness className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{vendor.name}</h1>
                            <p className="text-sm text-muted-foreground">{vendor.serviceCategoryLabels.length ? vendor.serviceCategoryLabels.join(', ') : 'Vendor profile'}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{vendor.phone || '-'} {vendor.email ? `• ${vendor.email}` : ''}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link href="/vendors">
                            <Button variant="outline" size="sm">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>
                        </Link>
                        <Button size="sm" onClick={() => setPaymentOpen(true)}>
                            Pay Bill
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportLedger}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Ledger
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border/60"><CardContent className="p-5"><p className="text-xs uppercase tracking-wider text-muted-foreground">Listed Services</p><p className="mt-2 text-2xl font-bold">{templates.length}</p></CardContent></Card>
                <Card className="border-blue-200/60 bg-blue-50/30"><CardContent className="p-5"><p className="text-xs uppercase tracking-wider text-blue-700/80">Pending/Active</p><p className="mt-2 text-2xl font-bold text-blue-700">{stats.pendingCount}</p></CardContent></Card>
                <Card className="border-emerald-200/60 bg-emerald-50/30"><CardContent className="p-5"><p className="text-xs uppercase tracking-wider text-emerald-700/80">Revenue</p><p className="mt-2 text-2xl font-bold text-emerald-700">{money(stats.totalRevenue)}</p></CardContent></Card>
                <Card className="border-rose-200/60 bg-rose-50/30"><CardContent className="p-5"><p className="text-xs uppercase tracking-wider text-rose-700/80">Vendor Due</p><p className="mt-2 text-2xl font-bold text-rose-700">{money(vendorDue)}</p></CardContent></Card>
            </div>

            <Tabs defaultValue="catalog" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="catalog">Service Catalog</TabsTrigger>
                    <TabsTrigger value="ledger">All Transactions</TabsTrigger>
                </TabsList>

                <TabsContent value="catalog">
                    <Card className="border-border/60">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg flex items-center gap-2"><Package className="h-5 w-5 text-violet-500" /> Service Catalog</CardTitle>
                                <AddVendorServiceTemplateForm
                                    vendorId={vendor._id}
                                    onSaved={(next, meta) => {
                                        setTemplates(next);
                                        setCatalogNotice(meta.updated ? 'Vendor listed service updated in catalog.' : 'Vendor listed service added to catalog.');
                                    }}
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {catalogNotice ? (
                                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                                    {catalogNotice}
                                </div>
                            ) : null}
                            {templates.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">No listed services yet. Add vendor listed services with default price and cost.</p>
                            ) : (
                                <div className="space-y-3">
                                    {templates.map((template, index) => (
                                        <div key={template._id || `${template.name}-${template.category}-${index}`} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <p className="font-semibold text-foreground">{template.name}</p>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 gap-1 px-2 text-xs"
                                                        onClick={() => {
                                                            setEditingTemplate(template);
                                                            setNextPrice(String(template.defaultPrice));
                                                            setNextCost(String(template.defaultCost));
                                                        }}
                                                    >
                                                        <PencilLine className="h-3 w-3" />
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="destructive"
                                                        className="h-7 gap-1 px-2 text-xs"
                                                        onClick={() => setDeletingTemplate(template)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                        Delete
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="mt-2 grid grid-cols-1 gap-3 text-sm">
                                                <div><p className="text-xs text-muted-foreground">Price</p><p className="font-semibold">{money(template.defaultPrice)}</p></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="ledger" className="space-y-4">
                    {/* Only Delivered Services and Pay Bill Transactions */}
                    <Card className="border-border/60">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <History className="h-5 w-5 text-indigo-500" /> 
                                Transaction History
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {activities.length === 0 ? (
                                <div className="text-center py-8">
                                    <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">No transactions yet</p>
                                    <p className="text-xs text-muted-foreground">Delivered services and payments will appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {activities.map((activity) => (
                                        <div 
                                            key={activity.id} 
                                            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors"
                                        >
                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                                                activity.type === 'service' 
                                                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            }`}>
                                                {activity.type === 'service' ? <BriefcaseBusiness className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="font-medium text-sm">{activity.title}</p>
                                                        <p className="text-xs text-muted-foreground">{activity.description}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">{new Date(activity.date).toLocaleDateString('en-GB')}</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        {activity.type === 'service' && (
                                                            <p className="font-semibold text-sm text-blue-600">+{money(activity.amount)}</p>
                                                        )}
                                                        {activity.type === 'payment' && (
                                                            <p className="font-semibold text-sm text-emerald-600">-{money(activity.amount)}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Only Delivered Services Table */}
                    <Card className="border-border/60">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Delivered Services</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {services.filter(s => s.status === 'delivered').length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">No delivered services yet.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[720px] text-sm">
                                        <thead>
                                            <tr className="border-b border-border/50">
                                                <th className="py-3 text-left font-medium text-muted-foreground">Service</th>
                                                <th className="py-3 text-left font-medium text-muted-foreground">Customer</th>
                                                <th className="py-3 text-right font-medium text-muted-foreground">Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/30">
                                            {services
                                                .filter(service => service.status === 'delivered')
                                                .map((service) => (
                                                    <tr key={service._id} className="hover:bg-muted/30">
                                                        <td className="py-3">
                                                            <p className="font-medium">{service.name}</p>
                                                            <p className="text-xs text-muted-foreground">{service.category}</p>
                                                        </td>
                                                        <td className="py-3 text-muted-foreground">
                                                            {service.customerId ? 
                                                                <Link href={`/customers/${service.customerId}`} className="hover:text-primary hover:underline">
                                                                    {service.customerName || '-'}
                                                                </Link> : '-'
                                                            }
                                                        </td>
                                                        <td className="py-3 text-right font-medium text-rose-600">{money(service.cost)}</td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog
                open={Boolean(editingTemplate)}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingTemplate(null);
                        setNextPrice('');
                        setNextCost('');
                    }
                }}
            >
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Edit Vendor Listed Service</DialogTitle>
                        <DialogDescription>
                            {editingTemplate ? `Update the default price and cost for ${editingTemplate.name}.` : 'Update service pricing'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handlePriceUpdate} className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-template-price">Default Price</Label>
                                <Input
                                    id="edit-template-price"
                                    name="defaultPrice"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    value={nextPrice}
                                    onChange={(event) => setNextPrice(event.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-template-cost">Default Cost</Label>
                                <Input
                                    id="edit-template-cost"
                                    name="defaultCost"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    required
                                    value={nextCost}
                                    onChange={(event) => setNextCost(event.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setEditingTemplate(null);
                                    setNextPrice('');
                                    setNextCost('');
                                }}
                                disabled={savingPrice}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={savingPrice}>{savingPrice ? 'Saving...' : 'Save Changes'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={Boolean(deletingTemplate)}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeletingTemplate(null);
                    }
                }}
                title="Delete Vendor Listed Service"
                description={deletingTemplate ? `This will remove ${deletingTemplate.name} from the vendor catalog.` : 'This action cannot be undone.'}
                confirmLabel={deleting ? 'Deleting...' : 'Delete'}
                destructive
                onConfirm={handleDeleteTemplate}
            />

            <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>Pay Vendor Bill</DialogTitle>
                        <DialogDescription>
                            Record a payment and adjust this vendor&apos;s payable balance.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleVendorPayment} className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="vendor-payment-date">Date</Label>
                                <Input
                                    id="vendor-payment-date"
                                    type="date"
                                    value={paymentDate}
                                    onChange={(event) => setPaymentDate(event.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="vendor-payment-amount">Amount</Label>
                                <Input
                                    id="vendor-payment-amount"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={paymentAmount}
                                    onChange={(event) => setPaymentAmount(event.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Settlement Account</Label>
                            <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((account) => (
                                        <SelectItem key={account._id} value={account._id}>{account.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="vendor-payment-note">Note (optional)</Label>
                            <Input
                                id="vendor-payment-note"
                                value={paymentNote}
                                onChange={(event) => setPaymentNote(event.target.value)}
                                placeholder="Optional payment note"
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)} disabled={paying}>Cancel</Button>
                            <Button type="submit" disabled={paying}>{paying ? 'Saving...' : 'Record Payment'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent className="sm:max-w-[620px]">
                    <DialogHeader>
                        <DialogTitle>Payment History</DialogTitle>
                        <DialogDescription>Settlement timeline for {historyTargetName}.</DialogDescription>
                    </DialogHeader>
                    {historyLoading ? (
                        <p className="text-sm text-muted-foreground">Loading payments...</p>
                    ) : historyRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No payment history found.</p>
                    ) : (
                        <div className="space-y-2">
                            {historyRows.map((item) => (
                                <div key={item._id} className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{money(item.amount)}</p>
                                            <p className="text-xs text-muted-foreground">{item.accountName}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString('en-GB')}</p>
                                    </div>
                                    {item.description ? <p className="mt-1 text-xs text-muted-foreground">{item.description}</p> : null}
                                </div>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
