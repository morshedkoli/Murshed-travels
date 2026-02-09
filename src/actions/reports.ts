'use server';

import { unstable_noStore as noStore } from 'next/cache';
import connect from '@/lib/db';
import Payable from '@/models/Payable';
import Receivable from '@/models/Receivable';
import Transaction from '@/models/Transaction';
import '@/models/Account';
import '@/models/Customer';
import '@/models/Vendor';

type BusinessFilter = 'all' | 'travel' | 'isp';
type TrendWindow = '6m' | '12m';

export type ReportFilters = {
    fromDate?: string;
    toDate?: string;
    businessId?: BusinessFilter;
    trendWindow?: TrendWindow;
};

export type ReportSnapshot = {
    filters: {
        fromDate: string;
        toDate: string;
        businessId: BusinessFilter;
        trendWindow: TrendWindow;
    };
    overview: {
        totalIncome: number;
        totalExpense: number;
        netProfit: number;
        transactionCount: number;
    };
    categorySummary: {
        income: Array<{ category: string; amount: number; count: number }>;
        expense: Array<{ category: string; amount: number; count: number }>;
    };
    businessSummary: Array<{
        businessId: 'travel' | 'isp';
        income: number;
        expense: number;
        net: number;
        count: number;
    }>;
    monthlyTrend: Array<{
        month: string;
        income: number;
        expense: number;
        net: number;
    }>;
    aging: {
        receivable: {
            bucket0To30: number;
            bucket0To30Count: number;
            bucket31To60: number;
            bucket31To60Count: number;
            bucket61Plus: number;
            bucket61PlusCount: number;
            total: number;
            totalCount: number;
        };
        payable: {
            bucket0To30: number;
            bucket0To30Count: number;
            bucket31To60: number;
            bucket31To60Count: number;
            bucket61Plus: number;
            bucket61PlusCount: number;
            total: number;
            totalCount: number;
        };
    };
    recentTransactions: Array<{
        _id: string;
        date: string;
        type: 'income' | 'expense';
        category: string;
        businessId: 'travel' | 'isp';
        amount: number;
        accountName: string;
        partyName: string;
        description: string;
    }>;
};

function formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
}

function normalizeDate(value: string | undefined, fallback: Date) {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date;
}

function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function normalizeBusiness(value?: string): BusinessFilter {
    if (value === 'travel' || value === 'isp') return value;
    return 'all';
}

function buildBusinessMatch(businessId: BusinessFilter) {
    if (businessId === 'all') return {};
    if (businessId === 'travel') {
        return {
            $or: [
                { businessId: 'travel' },
                { businessId: { $exists: false } },
                { businessId: null },
            ],
        };
    }

    return { businessId: 'isp' };
}

function normalizeTrendWindow(value?: string): TrendWindow {
    return value === '12m' ? '12m' : '6m';
}

function monthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date) {
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

export async function getReportSnapshot(filters: ReportFilters = {}): Promise<ReportSnapshot> {
    noStore();
    await connect();

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultTo = now;

    const fromDate = startOfDay(normalizeDate(filters.fromDate, defaultFrom));
    const toDate = endOfDay(normalizeDate(filters.toDate, defaultTo));
    const businessId = normalizeBusiness(filters.businessId);
    const trendWindow = normalizeTrendWindow(filters.trendWindow);

    const dateMatch = { date: { $gte: fromDate, $lte: toDate } };
    const businessMatch = buildBusinessMatch(businessId);
    const baseMatch = { ...dateMatch, ...businessMatch };

    const trendMonths = trendWindow === '12m' ? 12 : 6;
    const trendStart = new Date(toDate.getFullYear(), toDate.getMonth() - (trendMonths - 1), 1);
    const trendMatch = {
        date: { $gte: trendStart, $lte: toDate },
        ...businessMatch,
    };

    const [overviewAgg, categoryAgg, businessAgg, trendAgg, recent, receivableOpen, payableOpen] = await Promise.all([
        Transaction.aggregate([
            { $match: baseMatch },
            {
                $group: {
                    _id: null,
                    totalIncome: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0],
                        },
                    },
                    totalExpense: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0],
                        },
                    },
                    transactionCount: { $sum: 1 },
                },
            },
        ]),
        Transaction.aggregate([
            { $match: baseMatch },
            {
                $group: {
                    _id: { type: '$type', category: '$category' },
                    amount: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { amount: -1 } },
        ]),
        Transaction.aggregate([
            { $match: baseMatch },
            {
                $addFields: {
                    effectiveBusinessId: { $ifNull: ['$businessId', 'travel'] },
                },
            },
            {
                $group: {
                    _id: { businessId: '$effectiveBusinessId', type: '$type' },
                    amount: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]),
        Transaction.aggregate([
            { $match: trendMatch },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' },
                        type: '$type',
                    },
                    amount: { $sum: '$amount' },
                },
            },
        ]),
        Transaction.find(baseMatch)
            .sort({ date: -1, createdAt: -1 })
            .limit(12)
            .populate('accountId', 'name')
            .populate({ path: 'customerId', select: 'name', strictPopulate: false })
            .populate({ path: 'vendorId', select: 'name', strictPopulate: false }),
        Receivable.find({
            status: { $in: ['unpaid', 'partial'] },
            ...businessMatch,
        }).select('amount paidAmount dueDate date'),
        Payable.find({
            status: { $in: ['unpaid', 'partial'] },
            ...businessMatch,
        }).select('amount paidAmount dueDate date'),
    ]);

    const overviewRow = overviewAgg[0] ?? { totalIncome: 0, totalExpense: 0, transactionCount: 0 };
    const totalIncome = overviewRow.totalIncome ?? 0;
    const totalExpense = overviewRow.totalExpense ?? 0;
    const transactionCount = overviewRow.transactionCount ?? 0;

    const incomeCategories = categoryAgg
        .filter((item) => item._id?.type === 'income')
        .map((item) => ({
            category: item._id?.category ?? 'Uncategorized',
            amount: item.amount ?? 0,
            count: item.count ?? 0,
        }));

    const expenseCategories = categoryAgg
        .filter((item) => item._id?.type === 'expense')
        .map((item) => ({
            category: item._id?.category ?? 'Uncategorized',
            amount: item.amount ?? 0,
            count: item.count ?? 0,
        }));

    const businessSummaryMap = new Map<'travel' | 'isp', { income: number; expense: number; count: number }>([
        ['travel', { income: 0, expense: 0, count: 0 }],
        ['isp', { income: 0, expense: 0, count: 0 }],
    ]);

    for (const item of businessAgg) {
        const key = item?._id?.businessId as 'travel' | 'isp' | undefined;
        if (!key || !businessSummaryMap.has(key)) continue;

        const current = businessSummaryMap.get(key)!;
        if (item?._id?.type === 'income') current.income += item.amount ?? 0;
        if (item?._id?.type === 'expense') current.expense += item.amount ?? 0;
        current.count += item.count ?? 0;
    }

    const trendMap = new Map<string, { income: number; expense: number }>();
    for (let index = 0; index < trendMonths; index += 1) {
        const pointDate = new Date(trendStart.getFullYear(), trendStart.getMonth() + index, 1);
        trendMap.set(monthKey(pointDate), { income: 0, expense: 0 });
    }

    for (const row of trendAgg) {
        const year = row?._id?.year as number | undefined;
        const month = row?._id?.month as number | undefined;
        const type = row?._id?.type as 'income' | 'expense' | undefined;
        if (!year || !month || !type) continue;

        const key = `${year}-${String(month).padStart(2, '0')}`;
        const current = trendMap.get(key);
        if (!current) continue;

        if (type === 'income') current.income += row.amount ?? 0;
        if (type === 'expense') current.expense += row.amount ?? 0;
    }

    const monthlyTrend = Array.from(trendMap.entries()).map(([key, values]) => {
        const [year, month] = key.split('-').map((part) => Number(part));
        const date = new Date(year, month - 1, 1);
        return {
            month: monthLabel(date),
            income: values.income,
            expense: values.expense,
            net: values.income - values.expense,
        };
    });

    const receivableAging = {
        bucket0To30: 0,
        bucket0To30Count: 0,
        bucket31To60: 0,
        bucket31To60Count: 0,
        bucket61Plus: 0,
        bucket61PlusCount: 0,
        total: 0,
        totalCount: 0,
    };
    const payableAging = {
        bucket0To30: 0,
        bucket0To30Count: 0,
        bucket31To60: 0,
        bucket31To60Count: 0,
        bucket61Plus: 0,
        bucket61PlusCount: 0,
        total: 0,
        totalCount: 0,
    };

    function bucketize(target: {
        bucket0To30: number;
        bucket0To30Count: number;
        bucket31To60: number;
        bucket31To60Count: number;
        bucket61Plus: number;
        bucket61PlusCount: number;
        total: number;
        totalCount: number;
    }, dueDate: Date, amount: number) {
        if (amount <= 0) return;
        const msPerDay = 24 * 60 * 60 * 1000;
        const days = Math.max(0, Math.floor((toDate.getTime() - dueDate.getTime()) / msPerDay));

        if (days <= 30) {
            target.bucket0To30 += amount;
            target.bucket0To30Count += 1;
        } else if (days <= 60) {
            target.bucket31To60 += amount;
            target.bucket31To60Count += 1;
        } else {
            target.bucket61Plus += amount;
            target.bucket61PlusCount += 1;
        }

        target.total += amount;
        target.totalCount += 1;
    }

    for (const row of receivableOpen) {
        const amount = Math.max(0, (row.amount ?? 0) - (row.paidAmount ?? 0));
        const due = row.dueDate ?? row.date;
        if (!due) continue;
        bucketize(receivableAging, new Date(due), amount);
    }

    for (const row of payableOpen) {
        const amount = Math.max(0, (row.amount ?? 0) - (row.paidAmount ?? 0));
        const due = row.dueDate ?? row.date;
        if (!due) continue;
        bucketize(payableAging, new Date(due), amount);
    }

    return {
        filters: {
            fromDate: formatDate(fromDate),
            toDate: formatDate(toDate),
            businessId,
            trendWindow,
        },
        overview: {
            totalIncome,
            totalExpense,
            netProfit: totalIncome - totalExpense,
            transactionCount,
        },
        categorySummary: {
            income: incomeCategories,
            expense: expenseCategories,
        },
        businessSummary: Array.from(businessSummaryMap.entries()).map(([id, item]) => ({
            businessId: id,
            income: item.income,
            expense: item.expense,
            net: item.income - item.expense,
            count: item.count,
        })),
        monthlyTrend,
        aging: {
            receivable: receivableAging,
            payable: payableAging,
        },
        recentTransactions: recent.map((entry) => ({
            _id: entry._id.toString(),
            date: entry.date.toISOString(),
            type: entry.type,
            category: entry.category,
            businessId: entry.businessId ?? 'travel',
            amount: entry.amount,
            accountName: entry.accountId?.name ?? 'Unknown Account',
            partyName: entry.customerId?.name ?? entry.vendorId?.name ?? '-',
            description: entry.description ?? '',
        })),
    };
}
