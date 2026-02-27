'use server';

import { unstable_noStore as noStore } from 'next/cache';
import { prisma } from '@/lib/prisma';

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

    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultTo = now;

    const fromDate = startOfDay(normalizeDate(filters.fromDate, defaultFrom));
    const toDate = endOfDay(normalizeDate(filters.toDate, defaultTo));
    const businessId = normalizeBusiness(filters.businessId);
    const trendWindow = normalizeTrendWindow(filters.trendWindow);

    try {
        const transactionWhere: any = {
            date: {
                gte: fromDate,
                lte: toDate
            }
        };

        if (businessId !== 'all') {
            if (businessId === 'travel') {
                transactionWhere.OR = [
                    { businessId: 'travel' },
                    { businessId: null }
                ];
            } else {
                transactionWhere.businessId = businessId;
            }
        }

        const transactions = await prisma.transaction.findMany({
            where: transactionWhere
        });

        let totalIncome = 0;
        let totalExpense = 0;
        const categoryMap = new Map<string, { type: 'income' | 'expense'; amount: number; count: number }>();
        const businessMap = new Map<'travel' | 'isp', { income: number; expense: number; count: number }>();

        businessMap.set('travel', { income: 0, expense: 0, count: 0 });
        businessMap.set('isp', { income: 0, expense: 0, count: 0 });

        for (const t of transactions) {
            const effectiveBusiness = t.businessId || 'travel';

            if (t.type === 'income') {
                totalIncome += t.amount || 0;
                const current = businessMap.get(effectiveBusiness as 'travel' | 'isp');
                if (current) {
                    current.income += t.amount || 0;
                    current.count += 1;
                }
            } else {
                totalExpense += t.amount || 0;
                const current = businessMap.get(effectiveBusiness as 'travel' | 'isp');
                if (current) {
                    current.expense += t.amount || 0;
                    current.count += 1;
                }
            }

            const key = `${t.type}-${t.category}`;
            const existing = categoryMap.get(key);
            if (existing) {
                existing.amount += t.amount || 0;
                existing.count += 1;
            } else {
                categoryMap.set(key, {
                    type: t.type as 'income' | 'expense',
                    amount: t.amount || 0,
                    count: 1,
                });
            }
        }

        const incomeCategories: Array<{ category: string; amount: number; count: number }> = [];
        const expenseCategories: Array<{ category: string; amount: number; count: number }> = [];

        categoryMap.forEach((value, key) => {
            const category = key.replace('income-', '').replace('expense-', '');
            if (value.type === 'income') {
                incomeCategories.push({ category, amount: value.amount, count: value.count });
            } else {
                expenseCategories.push({ category, amount: value.amount, count: value.count });
            }
        });

        incomeCategories.sort((a, b) => b.amount - a.amount);
        expenseCategories.sort((a, b) => b.amount - a.amount);

        const trendMonths = trendWindow === '12m' ? 12 : 6;
        const trendStart = new Date(toDate.getFullYear(), toDate.getMonth() - (trendMonths - 1), 1);
        const trendMap = new Map<string, { income: number; expense: number }>();

        for (let index = 0; index < trendMonths; index += 1) {
            const pointDate = new Date(trendStart.getFullYear(), trendStart.getMonth() + index, 1);
            trendMap.set(monthKey(pointDate), { income: 0, expense: 0 });
        }

        for (const t of transactions) {
            const date = new Date(t.date);
            const key = monthKey(date);
            const current = trendMap.get(key);
            if (current) {
                if (t.type === 'income') {
                    current.income += t.amount || 0;
                } else {
                    current.expense += t.amount || 0;
                }
            }
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
            bucket0To30: 0, bucket0To30Count: 0,
            bucket31To60: 0, bucket31To60Count: 0,
            bucket61Plus: 0, bucket61PlusCount: 0,
            total: 0, totalCount: 0,
        };
        const payableAging = {
            bucket0To30: 0, bucket0To30Count: 0,
            bucket31To60: 0, bucket31To60Count: 0,
            bucket61Plus: 0, bucket61PlusCount: 0,
            total: 0, totalCount: 0,
        };

        const receivableWhere: any = { status: { in: ['unpaid', 'partial'] } };
        const payableWhere: any = { status: { in: ['unpaid', 'partial'] } };

        if (businessId !== 'all') {
            if (businessId === 'travel') {
                receivableWhere.OR = [{ businessId: 'travel' }, { businessId: null }];
                payableWhere.OR = [{ businessId: 'travel' }, { businessId: null }];
            } else {
                receivableWhere.businessId = businessId;
                payableWhere.businessId = businessId;
            }
        }

        const [receivables, payables] = await Promise.all([
            prisma.receivable.findMany({ where: receivableWhere }),
            prisma.payable.findMany({ where: payableWhere }),
        ]);

        function bucketize(target: typeof receivableAging, dueDate: Date, amount: number) {
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

        for (const row of receivables) {
            const amount = Math.max(0, (row.amount || 0) - (row.paidAmount || 0));
            const due = row.dueDate ? new Date(row.dueDate) : new Date(row.date);
            bucketize(receivableAging, due, amount);
        }

        for (const row of payables) {
            const amount = Math.max(0, (row.amount || 0) - (row.paidAmount || 0));
            const due = row.dueDate ? new Date(row.dueDate) : new Date(row.date);
            bucketize(payableAging, due, amount);
        }

        const recent = await prisma.transaction.findMany({
            where: transactionWhere,
            include: {
                account: { select: { name: true } },
                customer: { select: { name: true } },
                vendor: { select: { name: true } }
            },
            orderBy: { date: 'desc' },
            take: 12
        });

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
                transactionCount: transactions?.length || 0,
            },
            categorySummary: {
                income: incomeCategories,
                expense: expenseCategories,
            },
            businessSummary: Array.from(businessMap.entries()).map(([id, item]) => ({
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
                _id: entry.id,
                date: entry.date.toISOString(),
                type: entry.type as 'income' | 'expense',
                category: entry.category,
                businessId: (entry.businessId as 'travel' | 'isp') || 'travel',
                amount: entry.amount,
                accountName: entry.account?.name || 'Unknown Account',
                partyName: entry.customer?.name || entry.vendor?.name || '-',
                description: entry.description || '',
            })),
        };
    } catch (error) {
        console.error('Report snapshot error:', error);
        return {
            filters: {
                fromDate: formatDate(fromDate),
                toDate: formatDate(toDate),
                businessId,
                trendWindow,
            },
            overview: {
                totalIncome: 0,
                totalExpense: 0,
                netProfit: 0,
                transactionCount: 0,
            },
            categorySummary: {
                income: [],
                expense: [],
            },
            businessSummary: [],
            monthlyTrend: [],
            aging: {
                receivable: {
                    bucket0To30: 0, bucket0To30Count: 0,
                    bucket31To60: 0, bucket31To60Count: 0,
                    bucket61Plus: 0, bucket61PlusCount: 0,
                    total: 0, totalCount: 0,
                },
                payable: {
                    bucket0To30: 0, bucket0To30Count: 0,
                    bucket31To60: 0, bucket31To60Count: 0,
                    bucket61Plus: 0, bucket61PlusCount: 0,
                    total: 0, totalCount: 0,
                },
            },
            recentTransactions: [],
        };
    }
}
