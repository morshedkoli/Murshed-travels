'use server';

import { supabase } from '@/lib/supabase';
import { unstable_noStore as noStore } from 'next/cache';

export async function getDashboardStats() {
    noStore();

    try {
        // 1. Total Balance (Sum of all accounts)
        const { data: accounts } = await supabase
            .from('accounts')
            .select('balance');
        const totalBalance = (accounts || []).reduce((sum, acc) => sum + (acc.balance || 0), 0);

        // 2. Total Receivable (Outstanding)
        const { data: receivables } = await supabase
            .from('receivables')
            .select('*')
            .in('status', ['unpaid', 'partial']);
        
        let totalReceivable = 0;
        let openReceivableCount = 0;
        for (const rec of (receivables || [])) {
            const remaining = Math.max(0, rec.amount - (rec.paid_amount || 0));
            totalReceivable += remaining;
            openReceivableCount++;
        }

        // 3. Total Payable (Outstanding)
        const { data: payables } = await supabase
            .from('payables')
            .select('*')
            .in('status', ['unpaid', 'partial']);
        
        let totalPayable = 0;
        let openPayableCount = 0;
        for (const pay of (payables || [])) {
            const remaining = Math.max(0, pay.amount - (pay.paid_amount || 0));
            totalPayable += remaining;
            openPayableCount++;
        }

        // 4. Monthly Profit/Loss (This Month)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: incomeTransactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('type', 'income')
            .gte('date', startOfMonth.toISOString());
        
        const monthlyIncome = (incomeTransactions || []).reduce((sum, t) => sum + (t.amount || 0), 0);

        const { data: expenseTransactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('type', 'expense')
            .gte('date', startOfMonth.toISOString());
        
        const monthlyExpense = (expenseTransactions || []).reduce((sum, t) => sum + (t.amount || 0), 0);
        const netProfit = monthlyIncome - monthlyExpense;

        // 6. Service Stats
        const { count: totalServices } = await supabase
            .from('services')
            .select('*', { count: 'exact', head: true });
        
        const { count: deliveredServices } = await supabase
            .from('services')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'delivered');
        
        const { count: pendingServices } = await supabase
            .from('services')
            .select('*', { count: 'exact', head: true })
            .in('status', ['pending', 'in-progress']);

        // Service Revenue
        const { data: deliveredServicesData } = await supabase
            .from('services')
            .select('price')
            .eq('status', 'delivered');
        const serviceRevenue = (deliveredServicesData || []).reduce((sum, s) => sum + (s.price || 0), 0);

        // Unsettled Vendor Cost
        const { data: unsettledServices } = await supabase
            .from('services')
            .select('*')
            .eq('status', 'delivered')
            .gt('cost', 0)
            .eq('expense_recorded', false);
        
        const unsettledVendorCost = (unsettledServices || []).reduce((sum, s) => sum + (s.cost || 0), 0);
        const unsettledVendorCostCount = unsettledServices?.length || 0;

        // Recent delivered services for agent ledger
        const { data: recentDelivered } = await supabase
            .from('services')
            .select(`
                *,
                customers:customer_id (name),
                vendors:vendor_id (name),
                receivables:receivable_id (amount, paid_amount),
                payables:payable_id (amount, paid_amount)
            `)
            .eq('status', 'delivered')
            .order('delivery_date', { ascending: false })
            .limit(10);

        const agentLedger = (recentDelivered || []).map((row) => {
            const receivableAmount = row.receivables?.amount || row.price;
            const receivablePaid = row.receivables?.paid_amount || 0;
            const payableAmount = row.payables?.amount || row.cost || 0;
            const payablePaid = row.payables?.paid_amount || 0;

            return {
                _id: row.id,
                date: row.delivery_date || row.created_at,
                serviceName: row.name,
                customerName: row.customers?.name || 'Unknown',
                vendorName: row.vendors?.name || 'Unknown',
                customerAmount: row.price,
                customerDue: Math.max(0, receivableAmount - receivablePaid),
                vendorAmount: row.cost || 0,
                vendorDue: Math.max(0, payableAmount - payablePaid),
                profit: row.profit || row.price - (row.cost || 0),
            };
        });

        return {
            totalBalance,
            totalReceivable,
            totalPayable,
            monthlyIncome,
            monthlyExpense,
            netProfit,
            totalServices: totalServices || 0,
            deliveredServices: deliveredServices || 0,
            pendingServices: pendingServices || 0,
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
    // Mock data for initial UI if no transactions, else aggregation
    // For now return empty or simple structure
    return [
        { name: 'Income', value: 0 },
        { name: 'Expense', value: 0 },
    ];
}
