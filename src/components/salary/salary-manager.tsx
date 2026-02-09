'use client';

import { useMemo, useState } from 'react';
import { CalendarPlus2, CheckCircle2, Download } from 'lucide-react';
import { generateMonthlySalaries, getSalaryRecords, paySalary } from '@/actions/salaries';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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

type SalaryRow = {
    _id: string;
    employeeId: string;
    employeeName: string;
    employeeRole: string;
    amount: number;
    month: string;
    year: number;
    status: 'unpaid' | 'paid';
    businessId: 'travel' | 'isp';
    paidDate: string;
    createdAt: string;
};

type Option = {
    _id: string;
    name: string;
};

type SalaryManagerProps = {
    entries: SalaryRow[];
    accounts: Option[];
};

function currentMonth() {
    return new Date().toISOString().slice(0, 7);
}

function getRecentMonths(count = 6) {
    const result: string[] = [];
    const current = new Date();
    for (let i = 0; i < count; i += 1) {
        const date = new Date(current.getFullYear(), current.getMonth() - i, 1);
        result.push(date.toISOString().slice(0, 7));
    }
    return result;
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
});

function formatDate(value: string) {
    return dateFormatter.format(new Date(value));
}

function monthLabel(value: string) {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function toCsvValue(value: string | number) {
    const stringValue = String(value ?? '');
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
}

export function SalaryManager({ entries, accounts }: SalaryManagerProps) {
    const [rows, setRows] = useState(entries);
    const [monthInput, setMonthInput] = useState(currentMonth());
    const [generating, setGenerating] = useState(false);
    const [payTarget, setPayTarget] = useState<SalaryRow | null>(null);
    const [payAccountId, setPayAccountId] = useState('');
    const [paying, setPaying] = useState(false);
    const { toast } = useToast();
    const monthChips = useMemo(() => getRecentMonths(8), []);

    const unpaidAmount = useMemo(
        () => rows.filter((row) => row.status === 'unpaid').reduce((sum, row) => sum + row.amount, 0),
        [rows]
    );

    async function refreshRows(month?: string) {
        const [yearStr, monthStr] = (month ?? monthInput).split('-');
        const latest = await getSalaryRecords({
            month: `${yearStr}-${monthStr}`,
            year: Number(yearStr),
        });
        setRows(latest);
    }

    async function handleGenerate() {
        const [yearStr, monthStr] = monthInput.split('-');
        if (!yearStr || !monthStr) {
            toast({ title: 'Invalid month', description: 'Please select a valid month', variant: 'error' });
            return;
        }

        setGenerating(true);
        const result = await generateMonthlySalaries({
            month: `${yearStr}-${monthStr}`,
            year: Number(yearStr),
            businessId: 'isp',
        });
        setGenerating(false);

        if ('error' in result) {
            toast({ title: 'Generate failed', description: result.error, variant: 'error' });
            return;
        }

        await refreshRows(monthInput);
        toast({
            title: 'Salary sheet generated',
            description: `Created ${result.createdCount}, updated ${result.updatedCount}`,
            variant: 'success',
        });
    }

    async function handleMonthChipSelect(month: string) {
        setMonthInput(month);
        await refreshRows(month);
    }

    function handleExportCsv() {
        const lines: string[] = [];
        lines.push('"Salary Sheet"');
        lines.push([toCsvValue('Month'), toCsvValue(monthInput)].join(','));
        lines.push('');
        lines.push([
            toCsvValue('Employee'),
            toCsvValue('Role'),
            toCsvValue('Month'),
            toCsvValue('Amount'),
            toCsvValue('Status'),
            toCsvValue('Paid Date'),
        ].join(','));

        for (const row of rows) {
            lines.push([
                toCsvValue(row.employeeName),
                toCsvValue(row.employeeRole),
                toCsvValue(row.month),
                toCsvValue(row.amount),
                toCsvValue(row.status),
                toCsvValue(row.paidDate ? formatDate(row.paidDate) : '-'),
            ].join(','));
        }

        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `salary-sheet-${monthInput}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    async function handlePaySalary() {
        if (!payTarget) return;
        if (!payAccountId) {
            toast({ title: 'Account required', description: 'Select payment account first', variant: 'error' });
            return;
        }

        setPaying(true);
        const result = await paySalary({ salaryId: payTarget._id, accountId: payAccountId });
        setPaying(false);

        if ('error' in result) {
            toast({ title: 'Payment failed', description: result.error, variant: 'error' });
            return;
        }

        await refreshRows();
        setPayTarget(null);
        setPayAccountId('');
        toast({ title: 'Salary marked paid', variant: 'success' });
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Salary</h2>
                    <p className="text-sm text-muted-foreground">Generate ISP monthly salary sheet and mark payouts against an account.</p>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                        <Label htmlFor="salary-month">Month</Label>
                        <Input id="salary-month" type="month" value={monthInput} onChange={(e) => setMonthInput(e.target.value)} />
                    </div>
                    <Button className="gap-2" onClick={handleGenerate} disabled={generating}>
                        <CalendarPlus2 className="h-4 w-4" />
                        {generating ? 'Generating...' : 'Generate Sheet'}
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={handleExportCsv}>
                        <Download className="h-4 w-4" />
                        Export CSV
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {monthChips.map((month) => (
                    <Button
                        key={month}
                        size="sm"
                        variant={monthInput === month ? 'primary' : 'outline'}
                        onClick={() => handleMonthChipSelect(month)}
                    >
                        {monthLabel(month)}
                    </Button>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                    <p className="text-sm text-muted-foreground">Total Records</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">{rows.length}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                    <p className="text-sm text-muted-foreground">Unpaid Count</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">{rows.filter((row) => row.status === 'unpaid').length}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                    <p className="text-sm text-muted-foreground">Unpaid Amount</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">৳{unpaidAmount.toLocaleString()}</p>
                </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/60">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-border/70 bg-card">
                        <tr className="text-xs uppercase tracking-[0.04em] text-muted-foreground">
                            <th className="px-4 py-2.5 font-semibold">Employee</th>
                            <th className="px-4 py-2.5 font-semibold">Role</th>
                            <th className="px-4 py-2.5 font-semibold">Month</th>
                            <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                            <th className="px-4 py-2.5 font-semibold">Status</th>
                            <th className="px-4 py-2.5 font-semibold">Paid Date</th>
                            <th className="px-4 py-2.5 text-right font-semibold">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                    No salary records yet. Generate monthly sheet to start payroll.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row._id} className="border-b border-border/60 last:border-0 hover:bg-primary/5">
                                    <td className="px-4 py-2.5 font-medium text-foreground">{row.employeeName}</td>
                                    <td className="px-4 py-2.5 text-muted-foreground">{row.employeeRole}</td>
                                    <td className="px-4 py-2.5 text-muted-foreground">{row.month}</td>
                                    <td className="px-4 py-2.5 text-right font-semibold text-foreground">৳{row.amount.toLocaleString()}</td>
                                    <td className="px-4 py-2.5">
                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === 'paid' ? 'bg-success/15 text-success' : 'bg-secondary/15 text-secondary'}`}>
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-muted-foreground">{row.paidDate ? formatDate(row.paidDate) : '-'}</td>
                                    <td className="px-4 py-2.5 text-right">
                                        {row.status === 'unpaid' ? (
                                            <Button variant="outline" size="sm" className="gap-1" onClick={() => setPayTarget(row)}>
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                Mark Paid
                                            </Button>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Completed</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <Dialog open={Boolean(payTarget)} onOpenChange={(open) => !open && setPayTarget(null)}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Pay Salary</DialogTitle>
                        <DialogDescription>
                            Choose account to mark salary paid for {payTarget?.employeeName}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-muted-foreground">
                            Amount: <span className="font-semibold text-foreground">৳{payTarget?.amount.toLocaleString()}</span>
                        </div>

                        <div className="space-y-2">
                            <Label>Payment Account</Label>
                            <Select value={payAccountId} onValueChange={setPayAccountId}>
                                <SelectTrigger className="w-full">
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
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setPayTarget(null)}>
                            Cancel
                        </Button>
                        <Button type="button" disabled={paying} onClick={handlePaySalary}>
                            {paying ? 'Processing...' : 'Confirm Payment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
