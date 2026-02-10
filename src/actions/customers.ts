'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';

export async function getCustomers() {
    const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching customers:', error);
        return [];
    }

    return customers.map((customer) => ({
        _id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        passportNumber: customer.passport_number,
        nationality: customer.nationality,
        balance: customer.balance,
        createdAt: customer.created_at,
    }));
}

export async function createCustomer(data: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    passportNumber?: string;
    nationality?: string;
}) {
    try {
        if (!data.name || !data.phone) {
            return { error: 'Name and phone are required' };
        }

        // Check for existing customer
        const { data: existing } = await supabase
            .from('customers')
            .select('id')
            .eq('phone', data.phone)
            .single();

        if (existing) {
            return { error: 'A customer with this phone already exists' };
        }

        const { data: customer, error } = await supabase
            .from('customers')
            .insert({
                name: data.name,
                phone: data.phone,
                email: data.email || null,
                address: data.address || null,
                passport_number: data.passportNumber || null,
                nationality: data.nationality || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Create customer error:', error);
            return { error: 'Failed to create customer' };
        }

        revalidatePath('/customers');

        return {
            success: true,
            customer: {
                _id: customer.id,
                name: customer.name,
                phone: customer.phone,
            },
        };
    } catch (error) {
        console.error('Create customer error:', error);
        return { error: 'Failed to create customer' };
    }
}

export async function getCustomerById(id: string) {
    const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !customer) return null;

    return {
        _id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        passportNumber: customer.passport_number,
        nationality: customer.nationality,
        balance: customer.balance,
        createdAt: customer.created_at,
    };
}

export async function getCustomerLedger(customerId: string) {
    const [receivablesResult, servicesResult] = await Promise.all([
        supabase
            .from('receivables')
            .select('*')
            .eq('customer_id', customerId)
            .order('date', { ascending: false }),
        supabase
            .from('services')
            .select('*')
            .eq('customer_id', customerId)
            .eq('status', 'delivered')
            .order('delivery_date', { ascending: false }),
    ]);

    const receivables = receivablesResult.data || [];
    const deliveredServices = servicesResult.data || [];

    const receivableRows = receivables.map((row) => {
        const paidAmount = row.paid_amount ?? 0;
        const dueAmount = Math.max(0, row.amount - paidAmount);
        return {
            _id: row.id,
            date: row.date,
            dueDate: row.due_date || '',
            amount: row.amount,
            paidAmount,
            dueAmount,
            status: row.status,
            description: row.description || '',
        };
    });

    const deliveredRows = deliveredServices.map((row) => ({
        _id: row.id,
        name: row.name,
        date: row.delivery_date || row.created_at,
        price: row.price,
        cost: row.cost ?? 0,
        profit: row.profit ?? 0,
    }));

    return {
        receivables: receivableRows,
        deliveredServices: deliveredRows,
        totalBilled: deliveredRows.reduce((sum: number, row: { price: number }) => sum + row.price, 0),
        totalPaid: receivableRows.reduce((sum: number, row: { paidAmount: number }) => sum + row.paidAmount, 0),
        totalDue: receivableRows.reduce((sum: number, row: { dueAmount: number }) => sum + row.dueAmount, 0),
    };
}

export async function getCustomerTransactionHistory(customerId: string) {
    const { data: rows, error } = await supabase
        .from('transactions')
        .select(`
            *,
            accounts:account_id (name)
        `)
        .eq('customer_id', customerId)
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching customer transactions:', error);
        return [];
    }

    return (rows || []).map((row) => ({
        _id: row.id,
        date: row.date,
        amount: row.amount,
        type: row.type,
        category: row.category,
        accountName: row.accounts?.name || 'Unknown Account',
        description: row.description || '',
    }));
}

function parsePositiveAmount(value: number) {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Number(value);
}

function normalizeDate(value?: string) {
    if (!value) return new Date();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

export async function recordCustomerPayment(data: {
    customerId: string;
    accountId: string;
    amount: number;
    date?: string;
    note?: string;
}) {
    try {
        const amount = parsePositiveAmount(data.amount);
        if (!amount) {
            return { error: 'Payment amount must be greater than 0' };
        }

        const date = normalizeDate(data.date);
        if (!date) {
            return { error: 'Invalid payment date' };
        }

        const customerId = data.customerId?.trim();
        if (!customerId) {
            return { error: 'Customer is required' };
        }

        const accountId = data.accountId?.trim();
        if (!accountId) {
            return { error: 'Settlement account is required' };
        }

        // Fetch customer
        const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single();

        if (!customer) {
            return { error: 'Customer not found', appliedTotal: 0, settledAmount: 0, advanceAmount: 0 };
        }

        // Fetch account
        const { data: account } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (!account) {
            return { error: 'Settlement account not found', appliedTotal: 0, settledAmount: 0, advanceAmount: 0 };
        }

        // Fetch unpaid receivables
        const { data: receivables } = await supabase
            .from('receivables')
            .select('*')
            .eq('customer_id', customerId)
            .neq('status', 'paid')
            .order('due_date', { ascending: true });

        let remainingPayment = amount;
        let settledAmount = 0;
        const transactions = [];
        const receivableUpdates = [];

        for (const receivable of (receivables || [])) {
            if (remainingPayment <= 0) break;
            const dueAmount = Math.max(0, receivable.amount - (receivable.paid_amount ?? 0));
            if (dueAmount <= 0) continue;

            const settled = Math.min(dueAmount, remainingPayment);
            const nextPaid = (receivable.paid_amount ?? 0) + settled;
            const newStatus = nextPaid >= receivable.amount ? 'paid' : 'partial';

            receivableUpdates.push({
                id: receivable.id,
                paid_amount: nextPaid,
                status: newStatus,
            });

            transactions.push({
                date: date.toISOString(),
                amount: settled,
                type: 'income',
                category: 'Receivable Collection',
                business_id: receivable.business_id || 'travel',
                account_id: accountId,
                customer_id: customerId,
                description: data.note?.trim() || `Customer payment against receivable #${receivable.id}`,
                reference_id: receivable.id,
                reference_model: 'Receivable',
            });

            remainingPayment -= settled;
            settledAmount += settled;
        }

        const advanceAmount = Math.max(0, remainingPayment);

        if (advanceAmount > 0) {
            transactions.push({
                date: date.toISOString(),
                amount: advanceAmount,
                type: 'income',
                category: 'Customer Advance',
                business_id: 'travel',
                account_id: accountId,
                customer_id: customerId,
                description: data.note?.trim() || 'Advance payment received from customer',
            });
        }

        const appliedTotal = settledAmount + advanceAmount;

        // Update receivables
        for (const update of receivableUpdates) {
            await supabase
                .from('receivables')
                .update({
                    paid_amount: update.paid_amount,
                    status: update.status,
                })
                .eq('id', update.id);
        }

        // Create transactions
        if (transactions.length > 0) {
            await supabase
                .from('transactions')
                .insert(transactions);
        }

        // Update account balance
        await supabase
            .from('accounts')
            .update({ balance: account.balance + appliedTotal })
            .eq('id', accountId);

        // Update customer balance
        await supabase
            .from('customers')
            .update({ balance: customer.balance - appliedTotal })
            .eq('id', customerId);

        const ledger = await getCustomerLedger(data.customerId);

        revalidatePath('/customers');
        revalidatePath(`/customers/${data.customerId}`);
        revalidatePath('/receivable');
        revalidatePath('/dashboard');
        revalidatePath('/services');

        return {
            success: true,
            appliedAmount: appliedTotal,
            settledAmount,
            advanceAmount,
            totalDue: ledger.totalDue,
        };
    } catch (error) {
        console.error('Record customer payment error:', error);
        return { error: 'Failed to record customer payment' };
    }
}
