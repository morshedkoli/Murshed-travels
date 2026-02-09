'use server';

import dbConnect from '@/lib/db';
import Account from '@/models/Account';
import Receivable from '@/models/Receivable';
import Payable from '@/models/Payable';
import Transaction from '@/models/Transaction';
import Service from '@/models/Service';
import Customer from '@/models/Customer';
import Vendor from '@/models/Vendor';
import { unstable_noStore as noStore } from 'next/cache';

export async function getDashboardStats() {
    noStore();
    await dbConnect();

    // 1. Total Balance (Sum of all accounts)
    // Ensure models are registered (prevent tree-shaking)
    void Customer;
    void Vendor;
    const accounts = await Account.find({});
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    // 2. Total Receivable (Outstanding)
    const receivables = await Receivable.aggregate([
        { $match: { status: { $in: ['unpaid', 'partial'] } } },
        {
            $group: {
                _id: null,
                total: {
                    $sum: {
                        $max: [
                            0,
                            { $subtract: ['$amount', { $ifNull: ['$paidAmount', 0] }] },
                        ],
                    },
                },
                count: { $sum: 1 },
            },
        }
    ]);
    const totalReceivable = receivables[0]?.total || 0;
    const openReceivableCount = receivables[0]?.count || 0;

    // 3. Total Payable (Outstanding)
    const payables = await Payable.aggregate([
        { $match: { status: { $in: ['unpaid', 'partial'] } } },
        {
            $group: {
                _id: null,
                total: {
                    $sum: {
                        $max: [
                            0,
                            { $subtract: ['$amount', { $ifNull: ['$paidAmount', 0] }] },
                        ],
                    },
                },
                count: { $sum: 1 },
            },
        }
    ]);
    const totalPayable = payables[0]?.total || 0;
    const openPayableCount = payables[0]?.count || 0;

    // 4. Monthly Profit/Loss (This Month)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const income = await Transaction.aggregate([
        { $match: { date: { $gte: startOfMonth }, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const expense = await Transaction.aggregate([
        { $match: { date: { $gte: startOfMonth }, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const monthlyIncome = income[0]?.total || 0;
    const monthlyExpense = expense[0]?.total || 0;
    const netProfit = monthlyIncome - monthlyExpense;

    // 6. Service Stats
    const totalServices = await Service.countDocuments();
    const deliveredServices = await Service.countDocuments({ status: 'delivered' });
    const pendingServices = await Service.countDocuments({ status: { $in: ['pending', 'in-progress'] } });

    const serviceRevenueAgg = await Service.aggregate([
        { $match: { status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$price' } } }
    ]);
    const serviceRevenue = serviceRevenueAgg[0]?.total || 0;

    const unsettledVendorCostAgg = await Service.aggregate([
        {
            $match: {
                status: 'delivered',
                cost: { $gt: 0 },
                $or: [{ expenseRecorded: false }, { expenseRecorded: { $exists: false } }],
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$cost' },
                count: { $sum: 1 },
            },
        },
    ]);
    const unsettledVendorCost = unsettledVendorCostAgg[0]?.total || 0;
    const unsettledVendorCostCount = unsettledVendorCostAgg[0]?.count || 0;

    const recentDeliveredServices = await Service.find({ status: 'delivered' })
        .sort({ deliveryDate: -1, createdAt: -1 })
        .limit(10)
        .populate('customerId', 'name')
        .populate('vendorId', 'name')
        .populate('receivableId', 'amount paidAmount')
        .populate('payableId', 'amount paidAmount');

    const agentLedger = recentDeliveredServices.map((row) => {
        const receivableAmount = row.receivableId?.amount ?? row.price;
        const receivablePaid = row.receivableId?.paidAmount ?? 0;
        const payableAmount = row.payableId?.amount ?? row.cost ?? 0;
        const payablePaid = row.payableId?.paidAmount ?? 0;

        return {
            _id: row._id.toString(),
            date: (row.deliveryDate ?? row.createdAt).toISOString(),
            serviceName: row.name,
            customerName: row.customerId?.name ?? 'Unknown',
            vendorName: row.vendorId?.name ?? 'Unknown',
            customerAmount: row.price,
            customerDue: Math.max(0, receivableAmount - receivablePaid),
            vendorAmount: row.cost ?? 0,
            vendorDue: Math.max(0, payableAmount - payablePaid),
            profit: row.profit ?? row.price - (row.cost ?? 0),
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
}

export async function getChartData() {
    await dbConnect();
    // Mock data for initial UI if no transactions, else aggregation
    // For now return empty or simple structure
    return [
        { name: 'Income', value: 0 },
        { name: 'Expense', value: 0 },
    ];
}
