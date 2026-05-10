'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Briefcase, Building2, CreditCard, Download, FileText, History, Mail, MapPin, Phone, Plus, TrendingUp, UserRound, Wallet } from 'lucide-react';
import { recordCustomerPayment } from '@/actions/customers';
import { getReceivableSettlementHistory } from '@/actions/receivables';
import { updateServiceStatus } from '@/actions/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { generateCustomerLedgerPDF, type LedgerEntry } from '@/lib/pdf-generator';

type CustomerProfile = {
    _id: string;
    name: string;
    phone: string;
    email?: string | null;
    address?: string | null;
    passportNumber?: string | null;
    nationality?: string | null;
    balance?: number;
};

type CustomerServiceRow = {
    _id: string;
    name: string;
    category: string;
    serviceType: string;
    status: 'pending' | 'in-progress' | 'ready' | 'delivered' | 'cancelled';
    deliveryDate?: string;
    vendorName: string;
    price: number;
    createdAt?: string;
};

type CustomerLedger = {
    receivables: Array<{
        _id: string;
        date: string;
        description: string;
        amount: number;
        paidAmount: number;
        dueAmount: number;
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

type CustomerProfileViewProps = {
    customer: CustomerProfile;
    services: CustomerServiceRow[];
    ledger: CustomerLedger;
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

type ActivityItem = {
    id: string;
    date: string;
    type: 'service' | 'payment' | 'receivable' | 'transaction';
    title: string;
    description?: string;
    amount: number;
    amountType?: 'credit' | 'debit' | 'neutral';
    status?: string;
    meta?: Record<string, string | number>;
};

function money(value: number) {
    return `৳${value.toLocaleString()}`;
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function CustomerProfileView({ customer, services, ledger, accounts, transactions }: CustomerProfileViewProps) {
    const { toast } = useToast();
    const [serviceRows, setServiceRows] = useState<CustomerServiceRow[]>(services);
    const [balance, setBalance] = useState(customer.balance ?? 0);
    const [receivableRows, setReceivableRows] = useState(ledger.receivables);
    const [totalDue, setTotalDue] = useState(ledger.totalDue);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDiscount, setPaymentDiscount] = useState('0');
    const [paymentExtraCharge, setPaymentExtraCharge] = useState('0');
    const [paymentAccountId, setPaymentAccountId] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [paymentSaving, setPaymentSaving] = useState(false);
    const [statusSavingId, setStatusSavingId] = useState('');
    const [deliveryDialogService, setDeliveryDialogService] = useState<CustomerServiceRow | null>(null);
    const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
    const [deliverySaving, setDeliverySaving] = useState(false);
    const [historyTargetName, setHistoryTargetName] = useState('');
    const [historyRows, setHistoryRows] = useState<SettlementHistoryRow[]>([]);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);

    const totalServiceValue = serviceRows.reduce((sum, row) => sum + row.price, 0);
    const deliveredCount = serviceRows.filter((row) => row.status === 'delivered').length;
    const pendingCount = serviceRows.filter((row) => row.status === 'pending' || row.status === 'in-progress').length;
    const outstandingBalance = Math.max(balance, 0);
    const advanceBalance = Math.max(-balance, 0);
    const paymentNetDueReduction = (Number(paymentAmount) || 0) + (Number(paymentDiscount) || 0) - (Number(paymentExtraCharge) || 0);

    // Combine all activities into one chronological list
    const activities = useMemo<ActivityItem[]>(() => {
        const items: ActivityItem[] = [];

        // Services
        serviceRows.forEach(service => {
            items.push({
                id: `service-${service._id}`,
                date: service.createdAt || new Date().toISOString(),
                type: 'service',
                title: service.name,
                description: `${service.category} • ${service.vendorName || 'No vendor'}`,
                amount: service.price,
                amountType: 'credit',
                status: service.status,
                meta: {
                    category: service.category,
                    vendor: service.vendorName || '-',
                }
            });
        });

        // Receivables
        receivableRows.forEach(rec => {
            items.push({
                id: `receivable-${rec._id}`,
                date: rec.date,
                type: 'receivable',
                title: rec.description || 'Service Receivable',
                description: `Total: ${money(rec.amount)} • Paid: ${money(rec.paidAmount)}`,
                amount: rec.dueAmount,
                amountType: 'neutral',
                meta: {
                    total: rec.amount,
                    paid: rec.paidAmount,
                    due: rec.dueAmount,
                }
            });
        });

        // Customer Payments (from transactions - income type) - Group by date
        const paymentGroups: Record<string, { amount: number; descriptions: string[]; accounts: string[] }> = {};
        transactions
            .filter(t => t.type === 'income')
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
                title: 'Payment Received',
                description: data.descriptions.length > 0 
                    ? `${data.descriptions.join(', ')}${uniqueAccounts.length > 0 ? ` • ${uniqueAccounts.join(', ')}` : ''}`
                    : (uniqueAccounts.length > 0 ? `Via: ${uniqueAccounts.join(', ')}` : 'Customer payment'),
                amount: data.amount,
                amountType: 'debit',
                meta: {
                    account: uniqueAccounts.join(', '),
                    count: data.descriptions.length || 1,
                }
            });
        });

        // Sort by date descending (newest first)
        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [serviceRows, receivableRows, transactions]);

    // Calculate totals from activities
    const activityStats = useMemo(() => {
        const services = activities.filter(a => a.type === 'service');
        const payments = activities.filter(a => a.type === 'payment');
        const receivables = activities.filter(a => a.type === 'receivable');

        return {
            totalServices: services.length,
            totalServiceAmount: services.reduce((sum, s) => sum + s.amount, 0),
            totalPayments: payments.length,
            totalPaymentAmount: payments.reduce((sum, p) => sum + p.amount, 0),
            totalReceivables: receivables.length,
            totalReceivableAmount: receivables.reduce((sum, r) => sum + r.amount, 0),
        };
    }, [activities]);

    function patchServiceRow(serviceId: string, updates: Partial<CustomerServiceRow>) {
        setServiceRows((prev) => prev.map((row) => (row._id === serviceId ? { ...row, ...updates } : row)));
    }

    async function handleStatusChange(row: CustomerServiceRow, nextStatus: CustomerServiceRow['status']) {
        if (row.status === nextStatus) return;

        if (nextStatus === 'delivered') {
            setDeliveryDialogService(row);
            setDeliveryDate(new Date().toISOString().slice(0, 10));
            return;
        }

        setStatusSavingId(row._id);
        const result = await updateServiceStatus(row._id, nextStatus);
        setStatusSavingId('');

        if ('error' in result) {
            toast({ title: 'Status update failed', description: result.error, variant: 'error' });
            return;
        }

        patchServiceRow(row._id, { status: nextStatus });
        toast({ title: 'Service status updated', variant: 'success' });
    }

    async function handleConfirmDelivered(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!deliveryDialogService) return;

        setDeliverySaving(true);
        const result = await updateServiceStatus(deliveryDialogService._id, 'delivered', { deliveryDate });
        setDeliverySaving(false);

        if ('error' in result) {
            toast({ title: 'Status update failed', description: result.error, variant: 'error' });
            return;
        }

        patchServiceRow(deliveryDialogService._id, {
            status: 'delivered',
            deliveryDate: `${deliveryDate}T00:00:00.000Z`,
        });
        setDeliveryDialogService(null);
        toast({ title: 'Service marked delivered', variant: 'success' });
    }

    async function handleRecordPayment(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const amount = Number(paymentAmount);
        const discountAmount = Number(paymentDiscount || 0);
        const extraChargeAmount = Number(paymentExtraCharge || 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast({ title: 'Invalid payment amount', description: 'Please enter an amount greater than 0.', variant: 'error' });
            return;
        }

        if (!Number.isFinite(discountAmount) || discountAmount < 0) {
            toast({ title: 'Invalid discount', description: 'Discount must be 0 or greater.', variant: 'error' });
            return;
        }

        if (!Number.isFinite(extraChargeAmount) || extraChargeAmount < 0) {
            toast({ title: 'Invalid extra charge', description: 'Extra charge must be 0 or greater.', variant: 'error' });
            return;
        }

        if (!paymentAccountId) {
            toast({ title: 'Account required', description: 'Select a settlement account to record payment.', variant: 'error' });
            return;
        }

        setPaymentSaving(true);
        const result = await recordCustomerPayment({
            customerId: customer._id,
            accountId: paymentAccountId,
            amount,
            discountAmount,
            extraChargeAmount,
            date: paymentDate,
            note: paymentNote || undefined,
        });
        setPaymentSaving(false);

        if ('error' in result) {
            toast({ title: 'Payment failed', description: result.error, variant: 'error' });
            return;
        }

        const paidAmount = result.appliedAmount ?? amount;
        const settledAmount = result.settledAmount ?? Math.min(paidAmount, totalDue);
        const advanceAmount = result.advanceAmount ?? Math.max(0, paidAmount - settledAmount);
        const nextReceivableRows = receivableRows.map((row) => ({ ...row }));
        let remainingToApply = settledAmount;
        for (let index = 0; index < nextReceivableRows.length && remainingToApply > 0; index += 1) {
            const row = nextReceivableRows[index];
            const due = Math.max(0, row.amount - row.paidAmount);
            if (due <= 0) continue;
            const applied = Math.min(due, remainingToApply);
            row.paidAmount += applied;
            row.dueAmount = Math.max(0, row.amount - row.paidAmount);
            remainingToApply -= applied;
        }

        setReceivableRows(nextReceivableRows);
        setTotalDue(typeof result.totalDue === 'number' ? result.totalDue : Math.max(0, totalDue - paidAmount));
        setBalance(balance - paidAmount);
        setPaymentOpen(false);
        setPaymentAmount('');
        setPaymentDiscount('0');
        setPaymentExtraCharge('0');
        setPaymentAccountId('');
        setPaymentNote('');

        toast({
            title: 'Payment recorded',
            description: advanceAmount > 0
                ? `Received ${money(paidAmount)}. Advance added: ${money(advanceAmount)}.`
                : `Received ${money(paidAmount)} and adjusted customer due.`,
            variant: 'success',
        });
    }

    async function openPaymentHistory(row: CustomerLedger['receivables'][number]) {
        setHistoryTargetName(row.description || 'Service receivable');
        setHistoryRows([]);
        setHistoryOpen(true);
        setHistoryLoading(true);
        const items = await getReceivableSettlementHistory(row._id);
        setHistoryRows(items);
        setHistoryLoading(false);
    }

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

        // Group payments by date to consolidate them
        const paymentGroups: Record<string, { amount: number; descriptions: string[] }> = {};
        const nonPaymentActivities: ActivityItem[] = [];

        sortedActivities.forEach((activity) => {
            if (activity.type === 'payment') {
                const dateKey = activity.date.split('T')[0]; // Group by date only
                if (!paymentGroups[dateKey]) {
                    paymentGroups[dateKey] = { amount: 0, descriptions: [] };
                }
                paymentGroups[dateKey].amount += activity.amount;
                if (activity.description) {
                    paymentGroups[dateKey].descriptions.push(activity.description);
                }
            } else {
                nonPaymentActivities.push(activity);
            }
        });

        // Merge consolidated payments back into activities
        const consolidatedPayments: ActivityItem[] = Object.entries(paymentGroups).map(([date, data]) => ({
            id: `payment-consolidated-${date}`,
            date,
            type: 'payment',
            title: 'Payment Received',
            description: data.descriptions.length > 0 
                ? `Via: ${data.descriptions.join(', ')}` 
                : 'Customer payment',
            amount: data.amount,
            amountType: 'debit',
        }));

        // Combine non-payment activities with consolidated payments
        const finalActivities = [...nonPaymentActivities, ...consolidatedPayments].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        finalActivities.forEach((activity) => {
            let debit = 0;
            let credit = 0;

            if (activity.type === 'service') {
                // Service creates a debit (customer owes money)
                debit = activity.amount;
                totalDebits += activity.amount;
            } else if (activity.type === 'payment') {
                // Payment creates a credit (customer paid money)
                credit = activity.amount;
                totalCredits += activity.amount;
            } else if (activity.type === 'receivable') {
                // Receivable - only count the due amount
                debit = activity.amount;
                totalDebits += activity.amount;
            }

            runningBalance = runningBalance + debit - credit;

            entries.push({
                date: activity.date,
                description: activity.title,
                reference: activity.type === 'service' ? 'SRV' : activity.type === 'payment' ? 'PMT' : 'REC',
                debit,
                credit,
                balance: runningBalance,
            });
        });

        // Calculate opening balance (assume 0 if we don't have historical data)
        const openingBalance = 0;
        const closingBalance = runningBalance;

        generateCustomerLedgerPDF({
            customerName: customer.name,
            customerPhone: customer.phone,
            customerEmail: customer.email || undefined,
            entries,
            openingBalance,
            closingBalance,
            totalDebits,
            totalCredits,
            generatedDate: new Date().toISOString(),
        });

        toast({
            title: 'Ledger exported',
            description: 'PDF has been downloaded successfully.',
            variant: 'success',
        });
    }

    const getActivityIcon = (type: ActivityItem['type']) => {
        switch (type) {
            case 'service': return <Briefcase className="h-4 w-4" />;
            case 'payment': return <CreditCard className="h-4 w-4" />;
            case 'receivable': return <Wallet className="h-4 w-4" />;
            default: return <History className="h-4 w-4" />;
        }
    };

    const getActivityColor = (type: ActivityItem['type']) => {
        switch (type) {
            case 'service': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
            case 'payment': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'receivable': return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
            default: return 'bg-muted text-muted-foreground';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        <UserRound className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">{customer.name}</h1>
                        <p className="text-sm text-muted-foreground">{customer.phone} {customer.email ? `• ${customer.email}` : ''}</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Link href="/customers">
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                    <Link href={`/services?customerId=${customer._id}&create=1`}>
                        <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Service
                        </Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => setPaymentOpen(true)}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Receive Payment
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportLedger}>
                        <Download className="mr-2 h-4 w-4" />
                        Export Ledger
                    </Button>
                </div>
            </div>

            {/* Financial Flow Summary */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-900/10 border-blue-100 dark:border-blue-900/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[11px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 uppercase">Total Billed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{money(totalServiceValue)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{serviceRows.length} service{serviceRows.length !== 1 ? 's' : ''} • {deliveredCount} delivered</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-900/10 border-emerald-100 dark:border-emerald-900/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[11px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">Total Paid</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                                {money(transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0))}
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{transactions.filter(t => t.type === 'income').length} payment{transactions.filter(t => t.type === 'income').length !== 1 ? 's' : ''} received</p>
                    </CardContent>
                </Card>

                <Card className={`bg-gradient-to-br ${
                    outstandingBalance > 0
                        ? 'from-amber-50 dark:from-amber-900/10 border-amber-100 dark:border-amber-900/20'
                        : 'from-emerald-50 dark:from-emerald-900/10 border-emerald-100 dark:border-emerald-900/20'
                }`}>
                    <CardHeader className="pb-2">
                        <CardTitle className={`text-[11px] font-semibold tracking-wider uppercase ${
                            outstandingBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>Outstanding Due</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <p className={`text-3xl font-bold ${
                                outstandingBalance > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                                {outstandingBalance > 0 ? money(outstandingBalance) : 'Cleared'}
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {outstandingBalance > 0 ? 'Customer still owes this amount' : 'No outstanding balance'}
                        </p>
                    </CardContent>
                </Card>

                <Card className={`bg-gradient-to-br ${
                    advanceBalance > 0
                        ? 'from-purple-50 dark:from-purple-900/10 border-purple-100 dark:border-purple-900/20'
                        : 'from-slate-50 dark:from-slate-900/10 border-slate-100 dark:border-slate-900/20'
                }`}>
                    <CardHeader className="pb-2">
                        <CardTitle className={`text-[11px] font-semibold tracking-wider uppercase ${
                            advanceBalance > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500 dark:text-slate-400'
                        }`}>Advance Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <p className={`text-3xl font-bold ${
                                advanceBalance > 0 ? 'text-purple-700 dark:text-purple-400' : 'text-slate-400'
                            }`}>
                                {advanceBalance > 0 ? money(advanceBalance) : '—'}
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {advanceBalance > 0 ? 'Customer paid more than billed' : 'No advance'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Flow explanation banner */}
            <div className="flex items-start gap-3 rounded-lg border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 px-4 py-3">
                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    <span className="font-semibold">How billing works: </span>
                    Every service added immediately creates a <span className="font-medium">due</span> for the customer (Total Billed). 
                    Payments are recorded separately and reduce the outstanding balance. 
                    <span className="font-medium"> Service completion ≠ payment</span> — a delivered service is still due until the customer pays.
                </p>
            </div>

            <Tabs defaultValue="services" className="space-y-4">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="services">Service History</TabsTrigger>
                    <TabsTrigger value="payments">Payment History</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="profit">Profit Summary</TabsTrigger>
                    <TabsTrigger value="profile">Profile Info</TabsTrigger>
                </TabsList>

                {/* Service History */}
                <TabsContent value="services">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-primary" />
                                Service History
                            </CardTitle>
                            <span className="text-xs text-muted-foreground">
                                {serviceRows.length} service{serviceRows.length !== 1 ? 's' : ''}
                            </span>
                        </CardHeader>
                        <CardContent className="p-0">
                            {serviceRows.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                                    <Briefcase className="h-8 w-8" />
                                    <p className="text-sm">No services yet</p>
                                    <Link href={`/services?customerId=${customer._id}&create=1`}>
                                        <Button size="sm" variant="outline" className="mt-1">
                                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                                            Add First Service
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/40">
                                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Service</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Category</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Vendor</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Delivery Date</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Price</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {serviceRows.map((service) => (
                                                <tr key={service._id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="px-4 py-3 font-medium">{service.name}</td>
                                                    <td className="px-4 py-3 text-muted-foreground">{service.category}</td>
                                                    <td className="px-4 py-3 text-muted-foreground">{service.vendorName || '-'}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                            service.status === 'delivered' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                            service.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                            service.status === 'ready' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                            service.status === 'in-progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                        }`}>
                                                            {service.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground">
                                                        {service.deliveryDate ? formatDate(service.deliveryDate) : <span className="text-xs italic">Pending</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold">{money(service.price)}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        {service.status !== 'delivered' && service.status !== 'cancelled' ? (
                                                            <Select
                                                                value={service.status}
                                                                onValueChange={(value) => handleStatusChange(service, value as CustomerServiceRow['status'])}
                                                                disabled={statusSavingId === service._id}
                                                            >
                                                                <SelectTrigger className="h-7 w-[110px] text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="pending">Pending</SelectItem>
                                                                    <SelectItem value="in-progress">In Progress</SelectItem>
                                                                    <SelectItem value="ready">Ready</SelectItem>
                                                                    <SelectItem value="delivered">Delivered</SelectItem>
                                                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-border bg-muted/20">
                                                <td colSpan={5} className="px-4 py-3 text-xs font-medium text-muted-foreground">Total</td>
                                                <td className="px-4 py-3 text-right font-bold">{money(totalServiceValue)}</td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Payment History */}
                <TabsContent value="payments">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-emerald-500" />
                                Payment History
                            </CardTitle>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">
                                    {transactions.filter(t => t.type === 'income').length} payment{transactions.filter(t => t.type === 'income').length !== 1 ? 's' : ''}
                                </span>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPaymentOpen(true)}>
                                    <Plus className="mr-1 h-3 w-3" />
                                    Receive Payment
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {transactions.filter(t => t.type === 'income').length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                                    <CreditCard className="h-8 w-8" />
                                    <p className="text-sm">No payments recorded yet</p>
                                    <Button size="sm" variant="outline" className="mt-1" onClick={() => setPaymentOpen(true)}>
                                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                                        Record First Payment
                                    </Button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/40">
                                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Account</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Note / Description</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {transactions
                                                .filter(t => t.type === 'income')
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                .map((t) => (
                                                    <tr key={t._id} className="hover:bg-muted/30 transition-colors">
                                                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(t.date)}</td>
                                                        <td className="px-4 py-3">
                                                            <span className="inline-flex items-center gap-1.5">
                                                                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                                                {t.accountName}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-muted-foreground">
                                                            {t.description || <span className="text-xs italic text-muted-foreground/60">No note</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">+{money(t.amount)}</td>
                                                    </tr>
                                                ))
                                            }
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-border bg-muted/20">
                                                <td colSpan={3} className="px-4 py-3 text-xs font-medium text-muted-foreground">Total Received</td>
                                                <td className="px-4 py-3 text-right font-bold text-emerald-600">
                                                    +{money(transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0))}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Unified Activity History */}
                <TabsContent value="activity">

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <History className="h-4 w-4 text-primary" />
                                Complete Activity History
                            </CardTitle>
                            <div className="flex items-center gap-4 text-sm">
                                <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                                    Services
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                                    Payments
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                    Due
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {activities.length === 0 ? (
                                <div className="text-center py-8">
                                    <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">No activity records yet</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {activities.map((activity) => (
                                        <div 
                                            key={activity.id} 
                                            className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors"
                                        >
                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${getActivityColor(activity.type)}`}>
                                                {getActivityIcon(activity.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="font-medium text-sm">{activity.title}</p>
                                                        <p className="text-xs text-muted-foreground">{activity.description}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">{formatDate(activity.date)}</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        {activity.type === 'service' && (
                                                            <p className="font-semibold text-sm">{money(activity.amount)}</p>
                                                        )}
                                                        {activity.type === 'payment' && (
                                                            <p className="font-semibold text-sm text-emerald-600">-{money(activity.amount)}</p>
                                                        )}
                                                        {activity.type === 'receivable' && (
                                                            <div>
                                                                <p className="font-semibold text-sm text-amber-600">{money(activity.amount)} due</p>
                                                                {activity.meta && (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Paid: {money(activity.meta.paid as number)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                        {activity.status && (
                                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium mt-1 ${
                                                                activity.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                                                                activity.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                                activity.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-muted text-muted-foreground'
                                                            }`}>
                                                                {activity.status}
                                                            </span>
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
                </TabsContent>

                {/* Profit Summary */}
                <TabsContent value="profit">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                                Service Profit Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {ledger.deliveredServices.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">No delivered services yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {ledger.deliveredServices.map((row) => (
                                        <div key={row._id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                                            <div>
                                                <p className="font-medium text-sm">{row.name}</p>
                                                <p className="text-xs text-muted-foreground">{formatDate(row.date)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-emerald-600">+{money(row.profit)}</p>
                                                <p className="text-xs text-muted-foreground">{money(row.price)} - {money(row.cost)}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="mt-4 pt-4 border-t border-border">
                                        <div className="flex justify-between items-center">
                                            <p className="font-medium">Total Profit</p>
                                            <p className="text-xl font-semibold text-emerald-600">
                                                +{money(ledger.deliveredServices.reduce((sum, s) => sum + s.profit, 0))}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Profile Info */}
                <TabsContent value="profile">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Profile Information</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 sm:grid-cols-2">
                            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Phone</p>
                                    <p className="font-medium text-sm">{customer.phone}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Email</p>
                                    <p className="font-medium text-sm">{customer.email || '-'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:col-span-2">
                                <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Address</p>
                                    <p className="font-medium text-sm">{customer.address || '-'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Passport</p>
                                    <p className="font-medium text-sm">{customer.passportNumber || '-'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Nationality</p>
                                    <p className="font-medium text-sm">{customer.nationality || '-'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Payment Dialog */}
            <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Receive Payment</DialogTitle>
                        <DialogDescription>Record payment from {customer.name}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRecordPayment} className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Date</Label>
                                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Amount</Label>
                                <Input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Discount</Label>
                                <Input type="number" min="0" step="0.01" value={paymentDiscount} onChange={(e) => setPaymentDiscount(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Extra Charge</Label>
                                <Input type="number" min="0" step="0.01" value={paymentExtraCharge} onChange={(e) => setPaymentExtraCharge(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Account</Label>
                            <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                                <SelectTrigger>
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
                            <Label>Note</Label>
                            <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Optional" />
                        </div>

                        <div
                            className={`rounded-md border px-3 py-2 text-xs ${
                                paymentNetDueReduction > 0
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : paymentNetDueReduction < 0
                                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                                        : 'border-border bg-muted/30 text-muted-foreground'
                            }`}
                        >
                            Net due reduction = Paid + Discount - Extra Charge = {money(paymentNetDueReduction)}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)} disabled={paymentSaving}>Cancel</Button>
                            <Button type="submit" disabled={paymentSaving}>{paymentSaving ? 'Saving...' : 'Record'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delivery Dialog */}
            <Dialog open={Boolean(deliveryDialogService)} onOpenChange={(open) => { if (!open) setDeliveryDialogService(null); }}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Mark Delivered</DialogTitle>
                        <DialogDescription>{deliveryDialogService?.name}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleConfirmDelivered} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Delivery Date</Label>
                            <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} required />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDeliveryDialogService(null)} disabled={deliverySaving}>Cancel</Button>
                            <Button type="submit" disabled={deliverySaving}>{deliverySaving ? 'Saving...' : 'Confirm'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Payment History Dialog */}
            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Payment History</DialogTitle>
                        <DialogDescription>{historyTargetName}</DialogDescription>
                    </DialogHeader>
                    {historyLoading ? (
                        <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : historyRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No payments found.</p>
                    ) : (
                        <div className="space-y-2">
                            {historyRows.map((item) => (
                                <div key={item._id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                                    <div>
                                        <p className="font-medium">{money(item.amount)}</p>
                                        <p className="text-xs text-muted-foreground">{item.accountName}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
