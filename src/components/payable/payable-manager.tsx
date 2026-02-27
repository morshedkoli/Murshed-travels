'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { History, Pencil, Plus, Trash2 } from 'lucide-react';
import {
    createPayable,
    deletePayable,
    getPayableSettlementHistory,
    getPayables,
    updatePayable,
} from '@/actions/payables';
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
type PayableStatus = 'unpaid' | 'partial' | 'paid';

type PayableRow = {
    _id: string;
    date: string;
    dueDate: string;
    amount: number;
    paidAmount: number;
    remainingAmount: number;
    businessId: BusinessType;
    vendorId: string;
    vendorName: string;
    status: PayableStatus;
    description: string;
};

type Option = {
    _id: string;
    name: string;
    balance?: number;
};

type PayableManagerProps = {
    entries: PayableRow[];
    vendors: Option[];
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
    vendorId: string;
    description: string;
    paymentAmount: string;
    settlementAccountId: string;
};

const initialForm: FormState = {
    date: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    amount: '',
    businessId: 'travel',
    vendorId: '',
    description: '',
    paymentAmount: '0',
    settlementAccountId: '',
};

const statusClassMap: Record<PayableStatus, string> = {
    unpaid: 'bg-rose-100 text-rose-700 border-rose-200',
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

export function PayableManager({ entries, vendors, accounts, filterContext, clearFilterHref }: PayableManagerProps) {
    const [rows, setRows] = useState(entries);
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
    const { toast } = useToast();

    const totalOutstanding = useMemo(
        () => rows.reduce((sum, row) => sum + row.remainingAmount, 0),
        [rows]
    );

    function openCreate() {
        setEditingId(null);
        setForm(initialForm);
        setError('');
        setIsOpen(true);
    }

    function openEdit(row: PayableRow) {
        setEditingId(row._id);
        setForm({
            date: row.date.slice(0, 10),
            dueDate: row.dueDate ? row.dueDate.slice(0, 10) : '',
            amount: String(row.amount),
            businessId: row.businessId,
            vendorId: row.vendorId,
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
            vendorId: form.vendorId,
            description: form.description || undefined,
            paymentAmount: editingId ? Number(form.paymentAmount) : 0,
            settlementAccountId: editingId ? form.settlementAccountId || undefined : undefined,
        };

        try {
            const result = editingId
                ? await updatePayable(editingId, payload)
                : await createPayable(payload);

            if ('error' in result) {
                setError(result.error ?? 'Failed to save');
                toast({ title: 'Error', description: result.error ?? 'Please try again', variant: 'error' });
                return;
            }

            const latest = await getPayables();
            setRows(latest as PayableRow[]);
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
        const result = await deletePayable(deleteTargetId);
        if (!('error' in result)) {
            setRows((prev) => prev.filter((row) => row._id !== deleteTargetId));
            setDeleteTargetId(null);
            toast({ title: 'Deleted', variant: 'success' });
            return;
        }
        toast({ title: 'Error', description: result.error ?? 'Failed to delete', variant: 'error' });
    }

    async function openHistory(row: PayableRow) {
        setHistoryTargetName(row.vendorName);
        setHistoryRows([]);
        setHistoryOpen(true);
        setHistoryLoading(true);
        const items = await getPayableSettlementHistory(row._id);
        setHistoryRows(items);
        setHistoryLoading(false);
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-semibold">Payables</h1>
                    <p className="text-sm text-muted-foreground">Track and settle vendor payments</p>
                    {filterContext && (
                        <p className="mt-1 text-xs text-rose-600">
                            {filterContext}
                            {clearFilterHref && (
                                <Link href={clearFilterHref} className="ml-2 underline">Clear</Link>
                            )}
                        </p>
                    )}
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Payable
                </Button>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Open Payables</CardTitle>
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
                        <span className="text-2xl font-semibold text-rose-600">{money(totalOutstanding)}</span>
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
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Vendor</th>
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
                                            No payable records
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row) => (
                                        <tr key={row._id} className="hover:bg-muted/30">
                                            <td className="px-4 py-3 font-medium">{row.vendorName}</td>
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
                        <DialogTitle>{editingId ? 'Edit Payable' : 'Add Payable'}</DialogTitle>
                        <DialogDescription>
                            {editingId ? 'Update payable details' : 'Create new vendor payable'}
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
                                <Label>Vendor</Label>
                                <Select value={form.vendorId} onValueChange={(v) => setForm(p => ({ ...p, vendorId: v }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select vendor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vendors.map((v) => (
                                            <SelectItem key={v._id} value={v._id}>{v.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {editingId && (
                                <>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Payment Made</Label>
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
                                        {(() => {
                                            const acct = accounts.find(a => a._id === form.settlementAccountId);
                                            const payAmt = Number(form.paymentAmount) || 0;
                                            if (!acct || acct.balance === undefined) return null;
                                            const insufficient = payAmt > acct.balance;
                                            return (
                                                <p className={`text-xs mt-1 ${insufficient ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                                                    Account balance: {money(acct.balance)}
                                                    {insufficient && ' — payment will overdraft this account'}
                                                </p>
                                            );
                                        })()}
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

            <ConfirmDialog
                open={Boolean(deleteTargetId)}
                onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
                title="Delete payable"
                description="This action cannot be undone."
                confirmLabel="Delete"
                destructive
                onConfirm={confirmDelete}
            />
        </div>
    );
}
