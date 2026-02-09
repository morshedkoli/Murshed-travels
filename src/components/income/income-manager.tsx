'use client';

import { useMemo, useState } from 'react';
import { Download, FileText, Inbox, Pencil, Plus, Search, Trash2, TrendingUp } from 'lucide-react';
import { createIncome, deleteIncome, getIncomeEntries, updateIncome } from '@/actions/income';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type IncomeRow = {
    _id: string;
    date: string;
    amount: number;
    category: string;
    accountId: string;
    accountName: string;
    customerId: string;
    customerName: string;
    description: string;
};

type Option = {
    _id: string;
    name: string;
};

type IncomeManagerProps = {
    entries: IncomeRow[];
    accounts: Option[];
    customers: Option[];
};

type FormState = {
    date: string;
    amount: string;
    category: string;
    accountId: string;
    customerId: string;
    description: string;
};

const NEW_CATEGORY_VALUE = '__new__';

const initialForm: FormState = {
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    category: '',
    accountId: '',
    customerId: 'none',
    description: '',
};

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
});

function formatDate(value: string) {
    return dateFormatter.format(new Date(value));
}

function money(value: number) {
    return `৳${value.toLocaleString()}`;
}

export function IncomeManager({ entries, accounts, customers }: IncomeManagerProps) {
    const [rows, setRows] = useState(entries);
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(initialForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [customCategory, setCustomCategory] = useState('');
    const [useCustomCategory, setUseCustomCategory] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    const filteredRows = useMemo(() => {
        if (!searchQuery) return rows;
        const query = searchQuery.toLowerCase();
        return rows.filter(row => 
            row.category.toLowerCase().includes(query) ||
            row.accountName.toLowerCase().includes(query) ||
            row.customerName.toLowerCase().includes(query) ||
            row.description?.toLowerCase().includes(query)
        );
    }, [rows, searchQuery]);

    const totalIncome = useMemo(() => filteredRows.reduce((sum, row) => sum + row.amount, 0), [filteredRows]);
    const categoryOptions = useMemo(() => {
        const scoped = rows
            .map((row) => row.category)
            .filter(Boolean);

        const unique = Array.from(new Set(scoped));
        if (form.category && !unique.includes(form.category)) {
            unique.push(form.category);
        }

        return unique.sort((a, b) => a.localeCompare(b));
    }, [rows, form.category]);

    function openCreate() {
        setEditingId(null);
        setForm(initialForm);
        setCustomCategory('');
        setUseCustomCategory(false);
        setError('');
        setIsOpen(true);
    }

    function openEdit(row: IncomeRow) {
        setEditingId(row._id);
        setForm({
            date: row.date.slice(0, 10),
            amount: String(row.amount),
            category: row.category,
            accountId: row.accountId,
            customerId: row.customerId || 'none',
            description: row.description || '',
        });
        setCustomCategory('');
        setUseCustomCategory(false);
        setError('');
        setIsOpen(true);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setError('');

        const finalCategory = useCustomCategory ? customCategory.trim() : form.category;

        const payload = {
            date: form.date,
            amount: Number(form.amount),
            category: finalCategory,
            accountId: form.accountId,
            customerId: form.customerId === 'none' ? undefined : form.customerId,
            description: form.description || undefined,
        };

        try {
            const result = editingId ? await updateIncome(editingId, payload) : await createIncome(payload);

            if ('error' in result) {
                setError(result.error ?? 'Failed to save income');
                toast({ title: 'Could not save income', description: result.error ?? 'Please try again.', variant: 'error' });
                return;
            }

            const latest = await getIncomeEntries();
            setRows(latest);
            setIsOpen(false);
            setEditingId(null);
            setForm(initialForm);
            setCustomCategory('');
            setUseCustomCategory(false);
            toast({ title: editingId ? 'Income updated' : 'Income created', variant: 'success' });
        } catch {
            setError('Failed to save income');
            toast({ title: 'Could not save income', description: 'Please try again.', variant: 'error' });
        } finally {
            setSaving(false);
        }
    }

    function handleDelete(id: string) {
        setDeleteTargetId(id);
    }

    async function confirmDelete() {
        if (!deleteTargetId) return;
        const result = await deleteIncome(deleteTargetId);
        if (!('error' in result)) {
            setRows((prev) => prev.filter((row) => row._id !== deleteTargetId));
            setDeleteTargetId(null);
            toast({ title: 'Income record deleted', variant: 'success' });
            return;
        }

        toast({ title: 'Delete failed', description: result.error ?? 'Failed to delete income', variant: 'error' });
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Total Income</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-emerald-700 dark:text-emerald-400">{money(totalIncome)}</p>
                </div>

                <div className="rounded-xl border border-border/50 bg-card p-4">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-muted p-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Entries</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold">{filteredRows.length}</p>
                </div>

                <div className="rounded-xl border border-border/50 bg-card p-4">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Avg per Entry</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold">
                        {money(filteredRows.length > 0 ? Math.round(totalIncome / filteredRows.length) : 0)}
                    </p>
                </div>

                <div className="rounded-xl border border-border/50 bg-card p-4">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
                            <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Categories</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold">
                        {new Set(filteredRows.map(r => r.category)).size}
                    </p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search income..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                    <Button size="sm" className="gap-2" onClick={openCreate}>
                        <Plus className="h-4 w-4" />
                        Add Income
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/50 bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                        <thead>
                            <tr className="border-b border-border/50 bg-muted/50">
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Account</th>
                                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Customer</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="rounded-full bg-muted p-3">
                                                <Inbox className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">No income records</p>
                                                <p className="text-sm text-muted-foreground">Get started by adding your first income entry</p>
                                            </div>
                                            <Button size="sm" onClick={openCreate} className="mt-2">
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Income
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr key={row._id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 text-muted-foreground">{formatDate(row.date)}</td>
                                        <td className="px-4 py-3 font-medium">{row.category}</td>
                                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{row.accountName}</td>
                                        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{row.customerName || '-'}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{money(row.amount)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8"
                                                    onClick={() => openEdit(row)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDelete(row._id)}
                                                >
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
            </div>

            {/* Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Income' : 'Add Income'}</DialogTitle>
                        <DialogDescription>
                            {editingId ? 'Update the income record details below.' : 'Create a new income record. This will increase your account balance.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="income-date">Date</Label>
                                <Input
                                    id="income-date"
                                    type="date"
                                    value={form.date}
                                    onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="income-amount">Amount (৳)</Label>
                                <Input
                                    id="income-amount"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={form.amount}
                                    onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select
                                    value={useCustomCategory ? NEW_CATEGORY_VALUE : form.category}
                                    onValueChange={(value) => {
                                        if (value === NEW_CATEGORY_VALUE) {
                                            setUseCustomCategory(true);
                                            setForm((prev) => ({ ...prev, category: '' }));
                                            return;
                                        }

                                        setUseCustomCategory(false);
                                        setCustomCategory('');
                                        setForm((prev) => ({ ...prev, category: value }));
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categoryOptions.map((category) => (
                                            <SelectItem key={category} value={category}>
                                                {category}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value={NEW_CATEGORY_VALUE}>+ Add new category</SelectItem>
                                    </SelectContent>
                                </Select>
                                {useCustomCategory && (
                                    <Input
                                        placeholder="Enter new category"
                                        value={customCategory}
                                        onChange={(event) => setCustomCategory(event.target.value)}
                                        required
                                    />
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Account</Label>
                                <Select
                                    value={form.accountId}
                                    onValueChange={(value) => setForm((prev) => ({ ...prev, accountId: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map((account) => (
                                            <SelectItem key={account._id} value={account._id}>
                                                {account.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Customer (Optional)</Label>
                                <Select
                                    value={form.customerId}
                                    onValueChange={(value) => setForm((prev) => ({ ...prev, customerId: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select customer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {customers.map((customer) => (
                                            <SelectItem key={customer._id} value={customer._id}>
                                                {customer.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="income-description">Description (Optional)</Label>
                            <Input
                                id="income-description"
                                placeholder="Add any additional details..."
                                value={form.description}
                                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                            />
                        </div>

                        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={Boolean(deleteTargetId)}
                onOpenChange={(open) => {
                    if (!open) setDeleteTargetId(null);
                }}
                title="Delete income record"
                description="This action cannot be undone. The income entry and account impact will be removed."
                confirmLabel="Delete"
                destructive
                onConfirm={confirmDelete}
            />
        </div>
    );
}
