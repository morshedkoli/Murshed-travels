'use client';

import { useMemo, useState } from 'react';
import { Download, Pencil, Plus, Search, Trash2, UserCheck, UserPlus, Users, Wallet } from 'lucide-react';
import { createEmployee, deleteEmployee, getEmployees, updateEmployee } from '@/actions/employees';
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

type BusinessType = 'travel' | 'isp';

type EmployeeRow = {
    _id: string;
    name: string;
    role: string;
    phone: string;
    baseSalary: number;
    active: boolean;
    businessId: BusinessType;
};

type EmployeeManagerProps = {
    entries: EmployeeRow[];
};

type FormState = {
    name: string;
    role: string;
    phone: string;
    baseSalary: string;
    businessId: BusinessType;
    active: 'active' | 'inactive';
};

const initialForm: FormState = {
    name: '',
    role: '',
    phone: '',
    baseSalary: '',
    businessId: 'isp',
    active: 'active',
};

function money(value: number) {
    return `৳${value.toLocaleString()}`;
}

export function EmployeeManager({ entries }: EmployeeManagerProps) {
    const [rows, setRows] = useState(entries);
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(initialForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    const filteredRows = useMemo(() => {
        if (!searchQuery) return rows;
        const query = searchQuery.toLowerCase();
        return rows.filter(row => 
            row.name.toLowerCase().includes(query) ||
            row.role.toLowerCase().includes(query) ||
            row.phone.toLowerCase().includes(query)
        );
    }, [rows, searchQuery]);

    const activeCount = useMemo(() => filteredRows.filter((row) => row.active).length, [filteredRows]);
    const inactiveCount = useMemo(() => filteredRows.filter((row) => !row.active).length, [filteredRows]);
    const activePayroll = useMemo(
        () => filteredRows.filter((row) => row.active).reduce((sum, row) => sum + row.baseSalary, 0),
        [filteredRows]
    );

    function openCreate() {
        setEditingId(null);
        setForm(initialForm);
        setError('');
        setIsOpen(true);
    }

    function openEdit(row: EmployeeRow) {
        setEditingId(row._id);
        setForm({
            name: row.name,
            role: row.role,
            phone: row.phone,
            baseSalary: String(row.baseSalary),
            businessId: row.businessId,
            active: row.active ? 'active' : 'inactive',
        });
        setError('');
        setIsOpen(true);
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setError('');

        const payload = {
            name: form.name,
            role: form.role,
            phone: form.phone,
            baseSalary: Number(form.baseSalary),
            businessId: form.businessId,
            active: form.active === 'active',
        };

        try {
            const result = editingId ? await updateEmployee(editingId, payload) : await createEmployee(payload);

            if ('error' in result) {
                setError(result.error ?? 'Failed to save employee');
                toast({ title: 'Could not save employee', description: result.error ?? 'Please try again.', variant: 'error' });
                return;
            }

            const latest = await getEmployees();
            setRows(latest);
            setIsOpen(false);
            setEditingId(null);
            setForm(initialForm);
            toast({ title: editingId ? 'Employee updated' : 'Employee created', variant: 'success' });
        } catch {
            setError('Failed to save employee');
            toast({ title: 'Could not save employee', description: 'Please try again.', variant: 'error' });
        } finally {
            setSaving(false);
        }
    }

    function handleDelete(id: string) {
        setDeleteTargetId(id);
    }

    async function confirmDelete() {
        if (!deleteTargetId) return;
        const result = await deleteEmployee(deleteTargetId);
        if (!('error' in result)) {
            setRows((prev) => prev.filter((row) => row._id !== deleteTargetId));
            setDeleteTargetId(null);
            toast({ title: 'Employee deleted', variant: 'success' });
            return;
        }

        toast({ title: 'Delete failed', description: result.error ?? 'Failed to delete employee', variant: 'error' });
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Total Employees</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-blue-700 dark:text-blue-400">{filteredRows.length}</p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                            <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Active</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-emerald-700 dark:text-emerald-400">{activeCount}</p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
                            <UserPlus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Inactive</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-amber-700 dark:text-amber-400">{inactiveCount}</p>
                </div>

                <div className="rounded-xl border border-border/50 bg-card p-4">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
                            <Wallet className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Monthly Payroll</span>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-purple-600">{money(activePayroll)}</p>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search employees..."
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
                        Add Employee
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/50 bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead>
                            <tr className="border-b border-border/50 bg-muted/50">
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Employee</th>
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">Phone</th>
                                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Business</th>
                                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">Status</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Base Salary</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="rounded-full bg-muted p-3">
                                                <Users className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">No employees yet</p>
                                                <p className="text-sm text-muted-foreground">Get started by adding your first employee</p>
                                            </div>
                                            <Button size="sm" onClick={openCreate} className="mt-2">
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Employee
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr key={row._id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                    <Users className="h-4 w-4" />
                                                </div>
                                                <span className="font-medium">{row.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">{row.role}</td>
                                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{row.phone}</td>
                                        <td className="hidden px-4 py-3 lg:table-cell">
                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                row.businessId === 'travel' 
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                                                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                            }`}>
                                                {row.businessId}
                                            </span>
                                        </td>
                                        <td className="hidden px-4 py-3 lg:table-cell">
                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                row.active
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                            }`}>
                                                {row.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold">{money(row.baseSalary)}</td>
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
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
                        <DialogDescription>
                            {editingId ? 'Update employee details below.' : 'Create a new employee profile for payroll tracking.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="employee-name">Full Name</Label>
                                <Input
                                    id="employee-name"
                                    placeholder="John Doe"
                                    value={form.name}
                                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="employee-role">Role</Label>
                                <Input
                                    id="employee-role"
                                    placeholder="Software Engineer"
                                    value={form.role}
                                    onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="employee-phone">Phone</Label>
                                <Input
                                    id="employee-phone"
                                    placeholder="+880 1XXX XXXXXX"
                                    value={form.phone}
                                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="employee-salary">Base Salary (৳)</Label>
                                <Input
                                    id="employee-salary"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={form.baseSalary}
                                    onChange={(event) => setForm((prev) => ({ ...prev, baseSalary: event.target.value }))}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Business</Label>
                                <Select
                                    value={form.businessId}
                                    onValueChange={(value) => setForm((prev) => ({ ...prev, businessId: value as BusinessType }))}
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
                                <Label>Status</Label>
                                <Select
                                    value={form.active}
                                    onValueChange={(value) => setForm((prev) => ({ ...prev, active: value as 'active' | 'inactive' }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
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
                title="Delete employee"
                description="This action cannot be undone. Employee profile will be permanently removed."
                confirmLabel="Delete"
                destructive
                onConfirm={confirmDelete}
            />
        </div>
    );
}
