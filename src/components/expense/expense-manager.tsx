'use client';

import { useMemo, useState } from 'react';
import { Download, FileText, Inbox, Pencil, Plus, Search, Trash2, TrendingDown } from 'lucide-react';
import { createExpense, deleteExpense, getExpenseEntries, updateExpense } from '@/actions/expense';
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

type ExpenseRow = {
    _id: string;
    date: string;
    amount: number;
    category: string;
    businessId: 'travel' | 'isp';
    accountId: string;
    accountName: string;
    vendorId: string;
    vendorName: string;
    description: string;
};

type Option = {
    _id: string;
    name: string;
};

type ExpenseManagerProps = {
    entries: ExpenseRow[];
    accounts: Option[];
    vendors: Option[];
};

type FormState = {
    date: string;
    amount: string;
    category: string;
    businessId: 'travel' | 'isp';
    accountId: string;
    vendorId: string;
    description: string;
};

const NEW_CATEGORY_VALUE = '__new__';

const initialForm: FormState = {
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    category: '',
    businessId: 'travel',
    accountId: '',
    vendorId: 'none',
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

export function ExpenseManager({ entries, accounts, vendors }: ExpenseManagerProps) {
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
            row.vendorName.toLowerCase().includes(query) ||
            row.description?.toLowerCase().includes(query)
        );
    }, [rows, searchQuery]);

    const totalExpense = useMemo(() => filteredRows.reduce((sum, row) => sum + row.amount, 0), [filteredRows]);
    const categoryOptions = useMemo(() => {
        const scoped = rows
            .filter((row) => row.businessId === form.businessId)
            .map((row) => row.category)
            .filter(Boolean);

        const unique = Array.from(new Set(scoped));
        if (form.category && !unique.includes(form.category)) {
            unique.push(form.category);
        }

        return unique.sort((a, b) => a.localeCompare(b));
    }, [rows, form.businessId, form.category]);

    function openCreate() {
        setEditingId(null);
        setForm(initialForm);
        setCustomCategory('');
        setUseCustomCategory(false);
        setError('');
        setIsOpen(true);
    }

    function openEdit(row: ExpenseRow) {
        setEditingId(row._id);
        setForm({
            date: row.date.slice(0, 10),
            amount: String(row.amount),
            category: row.category,
            businessId: row.businessId,
            accountId: row.accountId,
            vendorId: row.vendorId || 'none',
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
            businessId: form.businessId,
            accountId: form.accountId,
            vendorId: form.vendorId === 'none' ? undefined : form.vendorId,
            description: form.description || undefined,
        };

        try {
            const result = editingId ? await updateExpense(editingId, payload) : await createExpense(payload);

            if ('error' in result) {
                setError(result.error ?? 'Failed to save expense');
                toast({ title: 'Could not save expense', description: result.error ?? 'Please try again.', variant: 'error' });
                return;
            }

            const latest = await getExpenseEntries();
            setRows(latest);
            setIsOpen(false);
            setEditingId(null);
            setForm(initialForm);
            setCustomCategory('');
            setUseCustomCategory(false);
            toast({ title: editingId ? 'Expense updated' : 'Expense created', variant: 'success' });
        } catch {
            setError('Failed to save expense');
            toast({ title: 'Could not save expense', description: 'Please try again.', variant: 'error' });
        } finally {
            setSaving(false);
        }
    }

    function handleDelete(id: string) {
        setDeleteTargetId(id);
    }

    async function confirmDelete() {
        if (!deleteTargetId) return;
        const result = await deleteExpense(deleteTargetId);
        if (!('error' in result)) {
            setRows((prev) => prev.filter((row) => row._id !== deleteTargetId));
            setDeleteTargetId(null);
            toast({ title: 'Expense record deleted', variant: 'success' });
            return;
        }

        toast({ title: 'Delete failed', description: result.error ?? 'Failed to delete expense', variant: 'error' });
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-950/20">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                            <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <span className="text-sm font-medium text-red-800 dark:text-red-300">Total Expense</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-red-700 dark:text-red-400">{money(totalExpense)}</p>
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
                            <TrendingDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Avg per Entry</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold">
                        {money(filteredRows.length > 0 ? Math.round(totalExpense / filteredRows.length) : 0)}
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
                        placeholder="Search expenses..."
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
                        Add Expense
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/50 bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-sm">
                        <thead>
                            <tr className="border-b border-border/50 bg-muted/50">
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Business</th>
                                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Account</th>
                                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Vendor</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="rounded-full bg-muted p-3">
                                                <Inbox className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">No expense records</p>
                                                <p className="text-sm text-muted-foreground">Get started by adding your first expense entry</p>
                                            </div>
                                            <Button size="sm" onClick={openCreate} className="mt-2">
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Expense
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr key={row._id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 text-muted-foreground">{formatDate(row.date)}</td>
                                        <td className="px-4 py-3 font-medium">{row.category}</td>
                                        <td className="hidden px-4 py-3 md:table-cell">
                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                row.businessId === 'travel' 
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                                                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                            }`}>
                                                {row.businessId}
                                            </span>
                                        </td>
                                        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{row.accountName}</td>
                                        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{row.vendorName || '-'}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-red-600">{money(row.amount)}</td>
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
                        <DialogTitle>{editingId ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
                        <DialogDescription>
                            {editingId ? 'Update the expense record details below.' : 'Create a new expense record. This will deduct from your account balance.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="expense-date">Date</Label>
                                <Input
                                    id="expense-date"
                                    type="date"
                                    value={form.date}
                                    onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="expense-amount">Amount (৳)</Label>
                                <Input
                                    id="expense-amount"
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
                                <Label>Business</Label>
                                <Select
                                    value={form.businessId}
                                    onValueChange={(value) => setForm((prev) => ({ ...prev, businessId: value as 'travel' | 'isp' }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select business" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="travel">Travel</SelectItem>
                                        <SelectItem value="isp">ISP</SelectItem>
                                    </SelectContent>
                                </Select>
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
                                <Label>Vendor (Optional)</Label>
                                <Select
                                    value={form.vendorId}
                                    onValueChange={(value) => setForm((prev) => ({ ...prev, vendorId: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select vendor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {vendors.map((vendor) => (
                                            <SelectItem key={vendor._id} value={vendor._id}>
                                                {vendor.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="expense-description">Description (Optional)</Label>
                            <Input
                                id="expense-description"
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
                title="Delete expense record"
                description="This action cannot be undone. The expense entry and account impact will be removed."
                confirmLabel="Delete"
                destructive
                onConfirm={confirmDelete}
            />
        </div>
    );
}
