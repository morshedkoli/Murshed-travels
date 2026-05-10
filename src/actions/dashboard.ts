'use server';

import { prisma } from '@/lib/prisma';
import { unstable_noStore as noStore } from 'next/cache';

export async function getDashboardStats() {
    noStore();

    try {
        // 1. Total Balance (Sum of all accounts)
        const accounts = await prisma.account.findMany({ select: { balance: true } });
        const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

        // 2. Total Receivable (Outstanding)
        const receivables = await prisma.receivable.findMany({
            where: { status: { in: ['unpaid', 'partial'] } }
        });

        let totalReceivable = 0;
        let openReceivableCount = 0;
        for (const rec of receivables) {
            const remaining = Math.max(0, rec.amount - (rec.paidAmount || 0));
            totalReceivable += remaining;
            openReceivableCount++;
        }

        // 3. Total Payable (Outstanding)
        const payables = await prisma.payable.findMany({
            where: { status: { in: ['unpaid', 'partial'] } }
        });

        let totalPayable = 0;
        let openPayableCount = 0;
        for (const pay of payables) {
            const remaining = Math.max(0, pay.amount - (pay.paidAmount || 0));
            totalPayable += remaining;
            openPayableCount++;
        }

        // 4. Monthly Profit/Loss (This Month)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const incomeTransactions = await prisma.transaction.findMany({
            where: {
                type: 'income',
                date: { gte: startOfMonth }
            },
            select: { amount: true }
        });
        const monthlyIncome = incomeTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

        const expenseTransactions = await prisma.transaction.findMany({
            where: {
                type: 'expense',
                date: { gte: startOfMonth }
            },
            select: { amount: true }
        });
        const monthlyExpense = expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
        const netProfit = monthlyIncome - monthlyExpense;

        // 6. Service Stats
        const totalServices = await prisma.service.count();
        const deliveredServices = await prisma.service.count({ where: { status: 'delivered' } });
        const pendingServices = await prisma.service.count({ where: { status: { in: ['pending', 'in-progress'] } } });

        // Service Revenue
        const deliveredServicesData = await prisma.service.findMany({
            where: { status: 'delivered' },
            select: { price: true }
        });
        const serviceRevenue = deliveredServicesData.reduce((sum, s) => sum + (s.price || 0), 0);

        // Unsettled Vendor Cost
        const unsettledServices = await prisma.service.findMany({
            where: {
                status: 'delivered',
                cost: { gt: 0 },
                expenseRecorded: false
            }
        });

        const unsettledVendorCost = unsettledServices.reduce((sum, s) => sum + (s.cost || 0), 0);
        const unsettledVendorCostCount = unsettledServices.length;

        // Recent delivered services — batch-fetch linked receivables/payables (2 queries, not N*2)
        const recentDelivered = await prisma.service.findMany({
            where: { status: 'delivered' },
            include: {
                customer: { select: { name: true } },
                vendor: { select: { name: true } },
            },
            orderBy: { deliveryDate: 'desc' },
            take: 10
        });

        const receivableIds = recentDelivered.flatMap(s => s.receivableId ? [s.receivableId] : []);
        const payableIds = recentDelivered.flatMap(s => s.payableId ? [s.payableId] : []);

        const [linkedReceivables, linkedPayables] = await Promise.all([
            receivableIds.length > 0
                ? prisma.receivable.findMany({ where: { id: { in: receivableIds } }, select: { id: true, amount: true, paidAmount: true } })
                : [],
            payableIds.length > 0
                ? prisma.payable.findMany({ where: { id: { in: payableIds } }, select: { id: true, amount: true, paidAmount: true } })
                : [],
        ]);

        const recMap = new Map(linkedReceivables.map(r => [r.id, r]));
        const payMap = new Map(linkedPayables.map(p => [p.id, p]));

        const agentLedger = recentDelivered.map((row) => {
            const rec = row.receivableId ? recMap.get(row.receivableId) : undefined;
            const pay = row.payableId ? payMap.get(row.payableId) : undefined;

            const receivableAmount = rec ? rec.amount : row.price;
            const receivablePaid = rec ? (rec.paidAmount || 0) : 0;
            const payableAmount = pay ? pay.amount : (row.cost || 0);
            const payablePaid = pay ? (pay.paidAmount || 0) : 0;

            return {
                _id: row.id,
                date: (row.deliveryDate || row.createdAt).toISOString(),
                serviceName: row.name,
                customerName: row.customer?.name || 'Unknown',
                vendorName: row.vendor?.name || 'Unknown',
                customerAmount: row.price,
                customerDue: Math.max(0, receivableAmount - receivablePaid),
                vendorAmount: row.cost || 0,
                vendorDue: Math.max(0, payableAmount - payablePaid),
                profit: row.profit ?? (row.price - (row.cost || 0)),
            };
        });

        return {
            totalBalance,
            totalReceivable,
            totalPayable,
            monthlyIncome,
            monthlyExpense,
            netProfit,
            totalServices,
            deliveredServices,
            pendingServices,
            serviceRevenue,
            openReceivableCount,
            openPayableCount,
            unsettledVendorCost,
            unsettledVendorCostCount,
            agentLedger,
        };
    } catch (error) {
        console.error('Dashboard stats error:', error);
        return {
            totalBalance: 0,
            totalReceivable: 0,
            totalPayable: 0,
            monthlyIncome: 0,
            monthlyExpense: 0,
            netProfit: 0,
            totalServices: 0,
            deliveredServices: 0,
            pendingServices: 0,
            serviceRevenue: 0,
            openReceivableCount: 0,
            openPayableCount: 0,
            unsettledVendorCost: 0,
            unsettledVendorCostCount: 0,
            agentLedger: [],
        };
    }
}

export async function getChartData() {
    try {
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        const transactions = await prisma.transaction.findMany({
            where: { date: { gte: sixMonthsAgo } },
            select: { date: true, amount: true, type: true },
        });

        const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const months: Record<string, { name: string; income: number; expense: number }> = {};

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            months[key] = { name: monthLabels[d.getMonth()], income: 0, expense: 0 };
        }

        for (const t of transactions) {
            const key = `${t.date.getFullYear()}-${t.date.getMonth()}`;
            if (!months[key]) continue;
            if (t.type === 'income') months[key].income += t.amount || 0;
            else if (t.type === 'expense') months[key].expense += t.amount || 0;
        }

        return Object.values(months);
    } catch {
        return [];
    }
}
