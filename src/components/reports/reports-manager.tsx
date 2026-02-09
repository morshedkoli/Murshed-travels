'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { BarChart3, CalendarRange, Download, PiggyBank, Printer, TrendingDown, TrendingUp } from 'lucide-react';
import {
    Area,
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { getReportSnapshot, type ReportSnapshot } from '@/actions/reports';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type ReportsManagerProps = {
    initialReport: ReportSnapshot;
};

type FilterForm = {
    fromDate: string;
    toDate: string;
    businessId: 'all' | 'travel' | 'isp';
    trendWindow: '6m' | '12m';
};

type ChartMode = 'bar-line' | 'area';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
});

function formatMoney(value: number) {
    return `৳${value.toLocaleString()}`;
}

function toCsvValue(value: string | number) {
    const stringValue = String(value ?? '');
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
}

function formatDate(value: string) {
    return dateFormatter.format(new Date(value));
}

export function ReportsManager({ initialReport }: ReportsManagerProps) {
    const [report, setReport] = useState(initialReport);
    const [filters, setFilters] = useState<FilterForm>(initialReport.filters);
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();
    const [chartMode, setChartMode] = useState<ChartMode>('bar-line');

    function buildCsv() {
        const lines: string[] = [];

        lines.push('"Murshed Travels Report"');
        lines.push([toCsvValue('From'), toCsvValue(report.filters.fromDate), toCsvValue('To'), toCsvValue(report.filters.toDate)].join(','));
        lines.push([toCsvValue('Business'), toCsvValue(report.filters.businessId), toCsvValue('Trend Window'), toCsvValue(report.filters.trendWindow)].join(','));
        lines.push('');

        lines.push('"Aging Buckets"');
        lines.push([
            toCsvValue('Type'),
            toCsvValue('0-30 Days'),
            toCsvValue('0-30 Count'),
            toCsvValue('31-60 Days'),
            toCsvValue('31-60 Count'),
            toCsvValue('61+ Days'),
            toCsvValue('61+ Count'),
            toCsvValue('Total'),
            toCsvValue('Total Count'),
        ].join(','));
        lines.push([
            toCsvValue('Receivable'),
            toCsvValue(report.aging.receivable.bucket0To30),
            toCsvValue(report.aging.receivable.bucket0To30Count),
            toCsvValue(report.aging.receivable.bucket31To60),
            toCsvValue(report.aging.receivable.bucket31To60Count),
            toCsvValue(report.aging.receivable.bucket61Plus),
            toCsvValue(report.aging.receivable.bucket61PlusCount),
            toCsvValue(report.aging.receivable.total),
            toCsvValue(report.aging.receivable.totalCount),
        ].join(','));
        lines.push([
            toCsvValue('Payable'),
            toCsvValue(report.aging.payable.bucket0To30),
            toCsvValue(report.aging.payable.bucket0To30Count),
            toCsvValue(report.aging.payable.bucket31To60),
            toCsvValue(report.aging.payable.bucket31To60Count),
            toCsvValue(report.aging.payable.bucket61Plus),
            toCsvValue(report.aging.payable.bucket61PlusCount),
            toCsvValue(report.aging.payable.total),
            toCsvValue(report.aging.payable.totalCount),
        ].join(','));
        lines.push('');

        lines.push('"Overview"');
        lines.push([toCsvValue('Total Income'), toCsvValue(report.overview.totalIncome)].join(','));
        lines.push([toCsvValue('Total Expense'), toCsvValue(report.overview.totalExpense)].join(','));
        lines.push([toCsvValue('Net Profit'), toCsvValue(report.overview.netProfit)].join(','));
        lines.push([toCsvValue('Transactions'), toCsvValue(report.overview.transactionCount)].join(','));
        lines.push('');

        lines.push('"Monthly Trend"');
        lines.push([toCsvValue('Month'), toCsvValue('Income'), toCsvValue('Expense'), toCsvValue('Net')].join(','));
        for (const row of report.monthlyTrend) {
            lines.push([toCsvValue(row.month), toCsvValue(row.income), toCsvValue(row.expense), toCsvValue(row.net)].join(','));
        }
        lines.push('');

        lines.push('"Business Breakdown"');
        lines.push([toCsvValue('Business'), toCsvValue('Income'), toCsvValue('Expense'), toCsvValue('Net'), toCsvValue('Count')].join(','));
        for (const row of report.businessSummary) {
            lines.push([toCsvValue(row.businessId), toCsvValue(row.income), toCsvValue(row.expense), toCsvValue(row.net), toCsvValue(row.count)].join(','));
        }
        lines.push('');

        lines.push('"Recent Transactions"');
        lines.push([
            toCsvValue('Date'),
            toCsvValue('Type'),
            toCsvValue('Category'),
            toCsvValue('Business'),
            toCsvValue('Account'),
            toCsvValue('Party'),
            toCsvValue('Amount'),
            toCsvValue('Description'),
        ].join(','));
        for (const row of report.recentTransactions) {
            lines.push([
                toCsvValue(new Date(row.date).toISOString().slice(0, 10)),
                toCsvValue(row.type),
                toCsvValue(row.category),
                toCsvValue(row.businessId),
                toCsvValue(row.accountName),
                toCsvValue(row.partyName),
                toCsvValue(row.amount),
                toCsvValue(row.description || ''),
            ].join(','));
        }

        return lines.join('\n');
    }

    function handleExportCsv() {
        const csv = buildCsv();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `murshed-travels-report-${report.filters.fromDate}-to-${report.filters.toDate}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function handlePrint() {
        window.print();
    }

    function handleGenerate() {
        setError('');

        if (!filters.fromDate || !filters.toDate) {
            setError('From and to date are required');
            return;
        }

        if (new Date(filters.fromDate) > new Date(filters.toDate)) {
            setError('From date cannot be later than to date');
            return;
        }

        startTransition(async () => {
            const next = await getReportSnapshot(filters);
            setReport(next);
        });
    }

    const rangeLabel = `${formatDate(report.filters.fromDate)} - ${formatDate(report.filters.toDate)}`;

    return (
        <div className="space-y-5 report-print-root">
            {isPending ? (
                <div className="report-no-print inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary animate-pulse">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Updating report view...
                </div>
            ) : null}
            <div className="rounded-2xl border border-border/70 bg-background p-5 shadow-sm report-no-print">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Reports</h2>
                        <p className="text-sm text-muted-foreground">Generate performance snapshots by date and business segment.</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-xs text-muted-foreground">
                        <CalendarRange className="h-4 w-4" />
                        {rangeLabel}
                    </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                    <div className="space-y-2">
                        <Label htmlFor="report-from-date">From Date</Label>
                        <Input
                            id="report-from-date"
                            type="date"
                            value={filters.fromDate}
                            onChange={(event) => setFilters((prev) => ({ ...prev, fromDate: event.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="report-to-date">To Date</Label>
                        <Input
                            id="report-to-date"
                            type="date"
                            value={filters.toDate}
                            onChange={(event) => setFilters((prev) => ({ ...prev, toDate: event.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Business</Label>
                        <Select
                            value={filters.businessId}
                            onValueChange={(value) => setFilters((prev) => ({ ...prev, businessId: value as 'all' | 'travel' | 'isp' }))}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select business" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Businesses</SelectItem>
                                <SelectItem value="travel">Travel</SelectItem>
                                <SelectItem value="isp">ISP</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Trend Window</Label>
                        <Select
                            value={filters.trendWindow}
                            onValueChange={(value) => setFilters((prev) => ({ ...prev, trendWindow: value as '6m' | '12m' }))}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select window" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="6m">Last 6 months</SelectItem>
                                <SelectItem value="12m">Last 12 months</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Chart View</Label>
                        <Select value={chartMode} onValueChange={(value) => setChartMode(value as ChartMode)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select chart" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="bar-line">Bar + Line</SelectItem>
                                <SelectItem value="area">Area</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-end">
                        <Button className="w-full gap-2" onClick={handleGenerate} disabled={isPending}>
                            <BarChart3 className="h-4 w-4" />
                            {isPending ? 'Generating...' : 'Generate'}
                        </Button>
                    </div>

                    <div className="flex items-end">
                        <Button className="w-full gap-2" variant="outline" onClick={handleExportCsv}>
                            <Download className="h-4 w-4" />
                            Export CSV
                        </Button>
                    </div>

                    <div className="flex items-end">
                        <Button className="w-full gap-2" variant="outline" onClick={handlePrint}>
                            <Printer className="h-4 w-4" />
                            Print Report
                        </Button>
                    </div>
                </div>

                {error ? <p className="mt-3 text-sm font-medium text-destructive">{error}</p> : null}
            </div>

            <div className="hidden report-print-only rounded-2xl border border-border/70 bg-background p-5">
                <h1 className="text-2xl font-bold text-foreground">Murshed Travels Report</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Date: {formatDate(report.filters.fromDate)} - {formatDate(report.filters.toDate)} | Business: {report.filters.businessId.toUpperCase()} | Window: {report.filters.trendWindow}
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-border/70">
                    <CardHeader className="pb-2">
                        <CardDescription>Total Income</CardDescription>
                        <CardTitle className="text-3xl text-success">{formatMoney(report.overview.totalIncome)}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5" />
                            In selected period
                        </span>
                    </CardContent>
                </Card>

                <Card className="border-border/70">
                    <CardHeader className="pb-2">
                        <CardDescription>Total Expense</CardDescription>
                        <CardTitle className="text-3xl text-danger">{formatMoney(report.overview.totalExpense)}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            <TrendingDown className="h-3.5 w-3.5" />
                            In selected period
                        </span>
                    </CardContent>
                </Card>

                <Card className="border-border/70">
                    <CardHeader className="pb-2">
                        <CardDescription>Net Profit</CardDescription>
                        <CardTitle className={`text-3xl ${report.overview.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                            {formatMoney(report.overview.netProfit)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Income minus expense
                    </CardContent>
                </Card>

                <Card className="border-border/70">
                    <CardHeader className="pb-2">
                        <CardDescription>Transactions</CardDescription>
                        <CardTitle className="text-3xl">{report.overview.transactionCount}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            <PiggyBank className="h-3.5 w-3.5" />
                            Recorded entries
                        </span>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card className="border-border/70">
                    <CardHeader>
                        <CardTitle>Receivable Aging</CardTitle>
                        <CardDescription>Outstanding receivable grouped by age bucket.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <Link href={`/receivable?aging=0-30&asOf=${report.filters.toDate}`} className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2 transition-colors hover:bg-primary/6">
                            <span className="text-muted-foreground">0-30 Days</span>
                            <span className="inline-flex items-center gap-2">
                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">{report.aging.receivable.bucket0To30Count}</span>
                                <span className="font-semibold text-foreground">{formatMoney(report.aging.receivable.bucket0To30)}</span>
                            </span>
                        </Link>
                        <Link href={`/receivable?aging=31-60&asOf=${report.filters.toDate}`} className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2 transition-colors hover:bg-primary/6">
                            <span className="text-muted-foreground">31-60 Days</span>
                            <span className="inline-flex items-center gap-2">
                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">{report.aging.receivable.bucket31To60Count}</span>
                                <span className="font-semibold text-foreground">{formatMoney(report.aging.receivable.bucket31To60)}</span>
                            </span>
                        </Link>
                        <Link href={`/receivable?aging=61%2B&asOf=${report.filters.toDate}`} className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2 transition-colors hover:bg-primary/6">
                            <span className="text-muted-foreground">61+ Days</span>
                            <span className="inline-flex items-center gap-2">
                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">{report.aging.receivable.bucket61PlusCount}</span>
                                <span className="font-semibold text-foreground">{formatMoney(report.aging.receivable.bucket61Plus)}</span>
                            </span>
                        </Link>
                        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                            <span className="font-semibold text-primary">Total</span>
                            <span className="inline-flex items-center gap-2">
                                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">{report.aging.receivable.totalCount}</span>
                                <span className="font-semibold text-primary">{formatMoney(report.aging.receivable.total)}</span>
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/70">
                    <CardHeader>
                        <CardTitle>Payable Aging</CardTitle>
                        <CardDescription>Outstanding payable grouped by age bucket.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <Link href={`/payable?aging=0-30&asOf=${report.filters.toDate}`} className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2 transition-colors hover:bg-primary/6">
                            <span className="text-muted-foreground">0-30 Days</span>
                            <span className="inline-flex items-center gap-2">
                                <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-semibold text-secondary">{report.aging.payable.bucket0To30Count}</span>
                                <span className="font-semibold text-foreground">{formatMoney(report.aging.payable.bucket0To30)}</span>
                            </span>
                        </Link>
                        <Link href={`/payable?aging=31-60&asOf=${report.filters.toDate}`} className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2 transition-colors hover:bg-primary/6">
                            <span className="text-muted-foreground">31-60 Days</span>
                            <span className="inline-flex items-center gap-2">
                                <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-semibold text-secondary">{report.aging.payable.bucket31To60Count}</span>
                                <span className="font-semibold text-foreground">{formatMoney(report.aging.payable.bucket31To60)}</span>
                            </span>
                        </Link>
                        <Link href={`/payable?aging=61%2B&asOf=${report.filters.toDate}`} className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2 transition-colors hover:bg-primary/6">
                            <span className="text-muted-foreground">61+ Days</span>
                            <span className="inline-flex items-center gap-2">
                                <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-semibold text-secondary">{report.aging.payable.bucket61PlusCount}</span>
                                <span className="font-semibold text-foreground">{formatMoney(report.aging.payable.bucket61Plus)}</span>
                            </span>
                        </Link>
                        <div className="flex items-center justify-between rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2">
                            <span className="font-semibold text-secondary">Total</span>
                            <span className="inline-flex items-center gap-2">
                                <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] font-semibold text-secondary">{report.aging.payable.totalCount}</span>
                                <span className="font-semibold text-secondary">{formatMoney(report.aging.payable.total)}</span>
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card className="border-border/70 xl:col-span-2">
                    <CardHeader>
                        <CardTitle>Monthly Trend ({report.filters.trendWindow})</CardTitle>
                        <CardDescription>Income and expense movement across recent months.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[320px] w-full rounded-2xl border border-border/70 bg-background p-3">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={report.monthlyTrend} margin={{ top: 12, right: 12, left: 8, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                                    <YAxis
                                        tick={{ fontSize: 12 }}
                                        stroke="hsl(var(--muted-foreground))"
                                        tickFormatter={(value) => `${Number(value).toLocaleString()}`}
                                    />
                                    <Tooltip
                                        formatter={(value, name) => {
                                            const amount = typeof value === 'number' ? value : Number(value ?? 0);
                                            return [formatMoney(amount), String(name ?? '')];
                                        }}
                                        contentStyle={{ borderRadius: '10px', border: '1px solid hsl(var(--border))' }}
                                    />
                                    <Legend />
                                    {chartMode === 'bar-line' ? (
                                        <>
                                            <Bar dataKey="income" name="Income" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="expense" name="Expense" fill="hsl(var(--danger))" radius={[4, 4, 0, 0]} />
                                        </>
                                    ) : (
                                        <>
                                            <Area
                                                type="monotone"
                                                dataKey="income"
                                                name="Income"
                                                stroke="hsl(var(--success))"
                                                fill="hsl(var(--success))"
                                                fillOpacity={0.2}
                                                strokeWidth={2}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="expense"
                                                name="Expense"
                                                stroke="hsl(var(--danger))"
                                                fill="hsl(var(--danger))"
                                                fillOpacity={0.2}
                                                strokeWidth={2}
                                            />
                                        </>
                                    )}
                                    <Line
                                        type="monotone"
                                        dataKey="net"
                                        name="Net"
                                        stroke="hsl(var(--secondary))"
                                        strokeWidth={2}
                                        dot={{ r: 2 }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            {report.monthlyTrend.map((row) => (
                                <div key={`trend-${row.month}`} className="rounded-lg border border-border/70 bg-background px-3 py-2 text-xs">
                                    <p className="text-muted-foreground">{row.month}</p>
                                    <p className={`font-semibold ${row.net >= 0 ? 'text-success' : 'text-danger'}`}>{formatMoney(row.net)}</p>
                                </div>
                            ))}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">Bars show income/expense and line shows net outcome.</p>
                    </CardContent>
                </Card>

                <Card className="border-border/70">
                    <CardHeader>
                        <CardTitle>Income Categories</CardTitle>
                        <CardDescription>Top income heads in selected period.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-background">
                            <table className="min-w-full text-left text-sm">
                                <thead className="border-b border-border/70 bg-card">
                                    <tr className="text-muted-foreground">
                                        <th className="px-4 py-3 font-semibold">Category</th>
                                        <th className="px-4 py-3 text-right font-semibold">Count</th>
                                        <th className="px-4 py-3 text-right font-semibold">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.categorySummary.income.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                                                No income entries in this period. Try widening date range.
                                            </td>
                                        </tr>
                                    ) : (
                                        report.categorySummary.income.map((row) => (
                                            <tr key={`income-${row.category}`} className="border-b border-border/60 last:border-0">
                                                <td className="px-4 py-3 font-medium text-foreground">{row.category}</td>
                                                <td className="px-4 py-3 text-right text-muted-foreground">{row.count}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-foreground">{formatMoney(row.amount)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/70">
                    <CardHeader>
                        <CardTitle>Expense Categories</CardTitle>
                        <CardDescription>Top expense heads in selected period.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-background">
                            <table className="min-w-full text-left text-sm">
                                <thead className="border-b border-border/70 bg-card">
                                    <tr className="text-muted-foreground">
                                        <th className="px-4 py-3 font-semibold">Category</th>
                                        <th className="px-4 py-3 text-right font-semibold">Count</th>
                                        <th className="px-4 py-3 text-right font-semibold">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.categorySummary.expense.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                                                No expense entries in this period. Try widening date range.
                                            </td>
                                        </tr>
                                    ) : (
                                        report.categorySummary.expense.map((row) => (
                                            <tr key={`expense-${row.category}`} className="border-b border-border/60 last:border-0">
                                                <td className="px-4 py-3 font-medium text-foreground">{row.category}</td>
                                                <td className="px-4 py-3 text-right text-muted-foreground">{row.count}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-foreground">{formatMoney(row.amount)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-5">
                <Card className="border-border/70 xl:col-span-2">
                    <CardHeader>
                        <CardTitle>Business Breakdown</CardTitle>
                        <CardDescription>Income, expense, and net by business line.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-background">
                            <table className="min-w-full text-left text-sm">
                                <thead className="border-b border-border/70 bg-card">
                                    <tr className="text-muted-foreground">
                                        <th className="px-4 py-3 font-semibold">Business</th>
                                        <th className="px-4 py-3 text-right font-semibold">Income</th>
                                        <th className="px-4 py-3 text-right font-semibold">Expense</th>
                                        <th className="px-4 py-3 text-right font-semibold">Net</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.businessSummary.map((row) => (
                                        <tr key={row.businessId} className="border-b border-border/60 last:border-0">
                                            <td className="px-4 py-3 font-medium uppercase text-foreground">{row.businessId}</td>
                                            <td className="px-4 py-3 text-right text-success">{formatMoney(row.income)}</td>
                                            <td className="px-4 py-3 text-right text-danger">{formatMoney(row.expense)}</td>
                                            <td className={`px-4 py-3 text-right font-semibold ${row.net >= 0 ? 'text-success' : 'text-danger'}`}>
                                                {formatMoney(row.net)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/70 xl:col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Transactions</CardTitle>
                        <CardDescription>Latest 12 transactions in selected range.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-2xl border border-border/70 bg-background">
                            <table className="min-w-full text-left text-sm">
                                <thead className="border-b border-border/70 bg-card">
                                    <tr className="text-muted-foreground">
                                        <th className="px-4 py-3 font-semibold">Date</th>
                                        <th className="px-4 py-3 font-semibold">Type</th>
                                        <th className="px-4 py-3 font-semibold">Category</th>
                                        <th className="px-4 py-3 font-semibold">Business</th>
                                        <th className="px-4 py-3 font-semibold">Account</th>
                                        <th className="px-4 py-3 font-semibold">Party</th>
                                        <th className="px-4 py-3 text-right font-semibold">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.recentTransactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                                No transactions found for this filter set.
                                            </td>
                                        </tr>
                                    ) : (
                                        report.recentTransactions.map((row) => (
                                            <tr key={row._id} className="border-b border-border/60 last:border-0">
                                                <td className="px-4 py-3 text-muted-foreground">{formatDate(row.date)}</td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                                                            row.type === 'income'
                                                                ? 'bg-success/15 text-success'
                                                                : 'bg-danger/15 text-danger'
                                                        }`}
                                                    >
                                                        {row.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">{row.category}</td>
                                                <td className="px-4 py-3 text-muted-foreground uppercase">{row.businessId}</td>
                                                <td className="px-4 py-3 text-muted-foreground">{row.accountName}</td>
                                                <td className="px-4 py-3 text-muted-foreground">{row.partyName}</td>
                                                <td
                                                    className={`px-4 py-3 text-right font-semibold ${
                                                        row.type === 'income' ? 'text-success' : 'text-danger'
                                                    }`}
                                                >
                                                    {formatMoney(row.amount)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <style jsx global>{`
                @media print {
                    body {
                        background: white !important;
                    }

                    .report-no-print {
                        display: none !important;
                    }

                    .report-print-only {
                        display: block !important;
                    }

                    .report-print-root {
                        gap: 12px !important;
                    }
                }
            `}</style>
        </div>
    );
}
