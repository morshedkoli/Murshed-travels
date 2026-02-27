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

        // Recent delivered services for agent ledger
        const recentDelivered = await prisma.service.findMany({
            where: { status: 'delivered' },
            include: {
                customer: { select: { name: true } },
                vendor: { select: { name: true } }
            },
            orderBy: { deliveryDate: 'desc' },
            take: 10
        });

        const agentLedger = await Promise.all(recentDelivered.map(async (row) => {
            let receivableAmount = row.price;
            let receivablePaid = 0;
            if (row.receivableId) {
                const rec = await prisma.receivable.findUnique({ where: { id: row.receivableId } });
                if (rec) {
                    receivableAmount = rec.amount;
                    receivablePaid = rec.paidAmount;
                }
            }

            let payableAmount = row.cost;
            let payablePaid = 0;
            if (row.payableId) {
                const pay = await prisma.payable.findUnique({ where: { id: row.payableId } });
                if (pay) {
                    payableAmount = pay.amount;
                    payablePaid = pay.paidAmount;
                }
            }

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
                profit: row.profit || row.price - (row.cost || 0),
            };
        }));

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
    return [
        { name: 'Income', value: 0 },
        { name: 'Expense', value: 0 },
    ];
}
