'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, History, Pencil, Plus, Trash2 } from 'lucide-react';
import {
    collectReceivablePayment,
    createReceivable,
    deleteReceivable,
    getReceivableSettlementHistory,
    getReceivables,
    updateReceivable,
} from '@/actions/receivables';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type BusinessType = 'travel' | 'isp';
type ReceivableStatus = 'unpaid' | 'partial' | 'paid';

type ReceivableRow = {
    _id: string;
    date: string;
    dueDate: string;
    amount: number;
    paidAmount: number;
    remainingAmount: number;
    businessId: BusinessType;
    customerId: string;
    customerName: string;
    status: ReceivableStatus;
    description: string;
};

type Option = {
    _id: string;
    name: string;
};

type ReceivableManagerProps = {
    entries: ReceivableRow[];
    customers: Option[];
    accounts: Option[];
    filterContext?: string;
    clearFilterHref?: string;
};

type SettlementHistoryRow = {
    _id: string;
    date: string;
    amount: number;
    accountName: string;
    description: string;
};

type FormState = {
    date: string;
    dueDate: string;
    amount: string;
    businessId: BusinessType;
    customerId: string;
    description: string;
    paymentAmount: string;
    settlementAccountId: string;
};

const initialForm: FormState = {
    date: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    amount: '',
    businessId: 'travel',
    customerId: '',
    description: '',
    paymentAmount: '0',
    settlementAccountId: '',
};

const statusClassMap: Record<ReceivableStatus, string> = {
    unpaid: 'bg-amber-100 text-amber-700 border-amber-200',
    partial: 'bg-blue-100 text-blue-700 border-blue-200',
    paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function money(value: number) {
    return `৳${value.toLocaleString()}`;
}

function toReceivableStatus(status: string): ReceivableStatus {
    if (status === 'partial') return 'partial';
    if (status === 'paid') return 'paid';
    return 'unpaid';
}

function normalizeReceivableRows(rows: Awaited<ReturnType<typeof getReceivables>>): ReceivableRow[] {
    return rows.map((row) => ({
        ...row,
        status: toReceivableStatus(row.status),
    }));
}

export function ReceivableManager({ entries, customers, accounts, filterContext, clearFilterHref }: ReceivableManagerProps) {
    const [rows, setRows] = useState<ReceivableRow[]>(normalizeReceivableRows(entries));
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(initialForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [historyTargetName, setHistoryTargetName] = useState('');
    const [historyRows, setHistoryRows] = useState<SettlementHistoryRow[]>([]);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [paymentTarget, setPaymentTarget] = useState<ReceivableRow | null>(null);
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDiscount, setPaymentDiscount] = useState('0');
    const [paymentExtraCharge, setPaymentExtraCharge] = useState('0');
    const [paymentAccountId, setPaymentAccountId] = useState('');
    const [paymentNote, setPaymentNote] = useState('');
    const [paymentSaving, setPaymentSaving] = useState(false);
    const { toast } = useToast();

    const totalOutstanding = useMemo(
        () => rows.reduce((sum, row) => sum + row.remainingAmount, 0),
        [rows]
    );
    const paymentNetDueReduction = (Number(paymentAmount) || 0) + (Number(paymentDiscount) || 0) - (Number(paymentExtraCharge) || 0);

    function openCreate() {
        setEditingId(null);
        setForm(initialForm);
        setError('');
        setIsOpen(true);
    }

    function openEdit(row: ReceivableRow) {
        setEditingId(row._id);
        setForm({
            date: row.date.slice(0, 10),
            dueDate: row.dueDate ? row.dueDate.slice(0, 10) : '',
            amount: String(row.amount),
            businessId: row.businessId,
            customerId: row.customerId,
            description: row.description || '',
            paymentAmount: '0',
            settlementAccountId: '',
        });
        setError('');
        setIsOpen(true);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setError('');

        const payload = {
            date: form.date,
            dueDate: form.dueDate,
            amount: Number(form.amount),
            businessId: form.businessId,
            customerId: form.customerId,
            description: form.description || undefined,
            paymentAmount: editingId ? Number(form.paymentAmount) : 0,
            settlementAccountId: editingId ? form.settlementAccountId || undefined : undefined,
        };

        try {
            const result = editingId
                ? await updateReceivable(editingId, payload)
                : await createReceivable(payload);

            if ('error' in result) {
                setError(result.error ?? 'Failed to save');
                toast({ title: 'Error', description: result.error ?? 'Please try again', variant: 'error' });
                return;
            }

            const latest = await getReceivables();
            setRows(normalizeReceivableRows(latest));
            setIsOpen(false);
            setEditingId(null);
            setForm(initialForm);
            toast({ title: editingId ? 'Updated' : 'Created', variant: 'success' });
        } catch {
            setError('Failed to save');
            toast({ title: 'Error', description: 'Please try again', variant: 'error' });
        } finally {
            setSaving(false);
        }
    }

    function handleDelete(id: string) {
        setDeleteTargetId(id);
    }

    async function confirmDelete() {
        if (!deleteTargetId) return;
        const result = await deleteReceivable(deleteTargetId);
        if (!('error' in result)) {
            setRows((prev) => prev.filter((row) => row._id !== deleteTargetId));
            setDeleteTargetId(null);
            toast({ title: 'Deleted', variant: 'success' });
            return;
        }
        toast({ title: 'Error', description: result.error ?? 'Failed to delete', variant: 'error' });
    }

    async function openHistory(row: ReceivableRow) {
        setHistoryTargetName(row.customerName);
        setHistoryRows([]);
        setHistoryOpen(true);
        setHistoryLoading(true);
        const items = await getReceivableSettlementHistory(row._id);
        setHistoryRows(items);
        setHistoryLoading(false);
    }

    function openPayment(row: ReceivableRow) {
        setPaymentTarget(row);
        setPaymentDate(new Date().toISOString().slice(0, 10));
        setPaymentAmount(row.remainingAmount > 0 ? String(row.remainingAmount) : '');
        setPaymentDiscount('0');
        setPaymentExtraCharge('0');
        setPaymentAccountId('');
        setPaymentNote('');
    }

    async function handleQuickPayment(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!paymentTarget) return;

        const amount = Number(paymentAmount);
        const discountAmount = Number(paymentDiscount || 0);
        const extraChargeAmount = Number(paymentExtraCharge || 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast({ title: 'Invalid amount', description: 'Enter amount greater than 0', variant: 'error' });
            return;
        }

        if (!Number.isFinite(discountAmount) || discountAmount < 0) {
            toast({ title: 'Invalid discount', description: 'Discount must be 0 or greater', variant: 'error' });
            return;
        }

        if (!Number.isFinite(extraChargeAmount) || extraChargeAmount < 0) {
            toast({ title: 'Invalid extra charge', description: 'Extra charge must be 0 or greater', variant: 'error' });
            return;
        }

        if (amount > paymentTarget.remainingAmount) {
            toast({ title: 'Amount too high', description: 'Cannot exceed remaining amount', variant: 'error' });
            return;
        }

        if (!paymentAccountId) {
            toast({ title: 'Account required', description: 'Select settlement account', variant: 'error' });
            return;
        }

        setPaymentSaving(true);
        const result = await collectReceivablePayment({
            receivableId: paymentTarget._id,
            amount,
            discountAmount,
            extraChargeAmount,
            settlementAccountId: paymentAccountId,
            date: paymentDate,
            note: paymentNote || undefined,
        });
        setPaymentSaving(false);

        if ('error' in result) {
            toast({ title: 'Error', description: result.error ?? 'Payment failed', variant: 'error' });
            return;
        }

        const latest = await getReceivables();
        setRows(normalizeReceivableRows(latest));
        setPaymentTarget(null);
        setPaymentAmount('');
        setPaymentDiscount('0');
        setPaymentExtraCharge('0');
        setPaymentAccountId('');
        setPaymentNote('');
        toast({ title: 'Payment recorded', variant: 'success' });
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-semibold">Receivables</h1>
                    <p className="text-sm text-muted-foreground">Track and collect customer payments</p>
                    {filterContext && (
                        <p className="mt-1 text-xs text-amber-600">
                            {filterContext}
                            {clearFilterHref && (
                                <Link href={clearFilterHref} className="ml-2 underline">Clear</Link>
                            )}
                        </p>
                    )}
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Receivable
                </Button>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Open Receivables</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold">{rows.length}</span>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <span className="text-2xl font-semibold text-amber-600">{money(totalOutstanding)}</span>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px] text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Customer</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Business</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Due Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Total</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Paid</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Remaining</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                                            No receivable records
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row) => (
                                        <tr key={row._id} className="hover:bg-muted/30">
                                            <td className="px-4 py-3 font-medium">{row.customerName}</td>
                                            <td className="px-4 py-3 text-muted-foreground uppercase">{row.businessId}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{row.dueDate ? formatDate(row.dueDate) : '-'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClassMap[row.status]}`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">{money(row.amount)}</td>
                                            <td className="px-4 py-3 text-right text-muted-foreground">{money(row.paidAmount)}</td>
                                            <td className="px-4 py-3 text-right font-medium">{money(row.remainingAmount)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(row)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => openPayment(row)}>
                                                        <span className="text-xs font-bold">৳</span>
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openHistory(row)}>
                                                        <History className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(row._id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Receivable' : 'Add Receivable'}</DialogTitle>
                        <DialogDescription>
                            {editingId ? 'Update receivable details' : 'Create new customer receivable'}
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Due Date</Label>
                                <Input type="date" value={form.dueDate} onChange={(e) => setForm(p => ({ ...p, dueDate: e.target.value }))} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Amount</Label>
                                <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Business</Label>
                                <Select value={form.businessId} onValueChange={(v) => setForm(p => ({ ...p, businessId: v as BusinessType }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="travel">Travel</SelectItem>
                                        <SelectItem value="isp">ISP</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label>Customer</Label>
                                <Select value={form.customerId} onValueChange={(v) => setForm(p => ({ ...p, customerId: v }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select customer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customers.map((c) => (
                                            <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {editingId && (
                                <>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Payment Received</Label>
                                        <Input type="number" min="0" step="0.01" value={form.paymentAmount} onChange={(e) => setForm(p => ({ ...p, paymentAmount: e.target.value }))} />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Settlement Account</Label>
                                        <Select value={form.settlementAccountId} onValueChange={(v) => setForm(p => ({ ...p, settlementAccountId: v }))}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select account" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accounts.map((a) => (
                                                    <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input placeholder="Optional note" value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Payment History</DialogTitle>
                        <DialogDescription>{historyTargetName}</DialogDescription>
                    </DialogHeader>

                    {historyLoading ? (
                        <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : historyRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No payments recorded</p>
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

            {/* Payment Dialog */}
            <Dialog open={Boolean(paymentTarget)} onOpenChange={(open) => { if (!open) setPaymentTarget(null); }}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Receive Payment</DialogTitle>
                        <DialogDescription>{paymentTarget?.customerName}</DialogDescription>
                    </DialogHeader>

                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Remaining due</p>
                        <p className="text-lg font-semibold">{money(paymentTarget?.remainingAmount ?? 0)}</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleQuickPayment}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Amount</Label>
                                <Input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Discount</Label>
                                <Input type="number" min="0" step="0.01" value={paymentDiscount} onChange={(e) => setPaymentDiscount(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Extra Charge</Label>
                                <Input type="number" min="0" step="0.01" value={paymentExtraCharge} onChange={(e) => setPaymentExtraCharge(e.target.value)} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Account</Label>
                            <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((a) => (
                                        <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
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
                            <Button type="button" variant="outline" onClick={() => setPaymentTarget(null)} disabled={paymentSaving}>Cancel</Button>
                            <Button type="submit" disabled={paymentSaving}>{paymentSaving ? 'Saving...' : 'Receive'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={Boolean(deleteTargetId)}
                onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
                title="Delete receivable"
                description="This action cannot be undone."
                confirmLabel="Delete"
                destructive
                onConfirm={confirmDelete}
            />
        </div>
    );
}
