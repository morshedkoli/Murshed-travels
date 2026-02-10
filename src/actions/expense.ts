'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';

type ExpenseInput = {
    date: string;
    amount: number;
    category: string;
    businessId: 'travel' | 'isp';
    accountId: string;
    vendorId?: string;
    description?: string;
};

function normalizeDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function normalizeText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}

function parseAmount(value: number) {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Number(value);
}

function revalidateExpenseViews() {
    revalidatePath('/expense');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
}

export async function getExpenseEntries() {
    const { data: expenses, error } = await supabase
        .from('transactions')
        .select(`
            *,
            accounts:account_id (name),
            vendors:vendor_id (name)
        `)
        .eq('type', 'expense')
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching expense entries:', error);
        return [];
    }

    return (expenses || []).map((expense) => ({
        _id: expense.id,
        date: expense.date,
        amount: expense.amount,
        category: expense.category,
        businessId: expense.business_id || 'travel',
        accountId: expense.account_id || '',
        accountName: expense.accounts?.name || 'Unknown Account',
        vendorId: expense.vendor_id || '',
        vendorName: expense.vendors?.name || '',
        description: expense.description || '',
    }));
}

export async function createExpense(data: ExpenseInput) {
    try {
        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid date is required' };

        const amount = parseAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        const category = normalizeText(data.category);
        if (!category) return { error: 'Category is required' };

        const accountId = normalizeText(data.accountId);
        if (!accountId) return { error: 'Account is required' };

        const vendorId = normalizeText(data.vendorId);

        // Verify account exists
        const { data: account } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (!account) {
            return { error: 'Selected account does not exist' };
        }

        // Verify vendor if provided
        if (vendorId) {
            const { data: vendor } = await supabase
                .from('vendors')
                .select('id')
                .eq('id', vendorId)
                .single();

            if (!vendor) {
                return { error: 'Selected vendor does not exist' };
            }
        }

        // Create transaction
        const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
                date: date.toISOString(),
                amount,
                type: 'expense',
                category,
                business_id: data.businessId,
                account_id: accountId,
                vendor_id: vendorId || null,
                description: normalizeText(data.description) || null,
            });

        if (transactionError) {
            console.error('Create transaction error:', transactionError);
            return { error: 'Failed to create expense record' };
        }

        // Update account balance
        await supabase
            .from('accounts')
            .update({ balance: account.balance - amount })
            .eq('id', accountId);

        revalidateExpenseViews();
        return { success: true };
    } catch (error) {
        console.error('Create expense error:', error);
        return { error: 'Failed to create expense record' };
    }
}

export async function updateExpense(id: string, data: ExpenseInput) {
    try {
        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid date is required' };

        const amount = parseAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        const category = normalizeText(data.category);
        if (!category) return { error: 'Category is required' };

        const accountId = normalizeText(data.accountId);
        if (!accountId) return { error: 'Account is required' };

        const vendorId = normalizeText(data.vendorId);

        // Fetch existing expense
        const { data: expense } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .eq('type', 'expense')
            .single();

        if (!expense) {
            return { error: 'Expense record not found' };
        }

        // Verify account exists
        const { data: account } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (!account) {
            return { error: 'Selected account does not exist' };
        }

        // Verify vendor if provided
        if (vendorId) {
            const { data: vendor } = await supabase
                .from('vendors')
                .select('id')
                .eq('id', vendorId)
                .single();

            if (!vendor) {
                return { error: 'Selected vendor does not exist' };
            }
        }

        const oldAccountId = expense.account_id;
        const oldAmount = expense.amount;

        // Handle account balance updates
        if (oldAccountId === accountId) {
            const delta = amount - oldAmount;
            if (delta !== 0) {
                await supabase
                    .from('accounts')
                    .update({ balance: account.balance - delta })
                    .eq('id', accountId);
            }
        } else {
            // Restore old account balance
            const { data: oldAccount } = await supabase
                .from('accounts')
                .select('*')
                .eq('id', oldAccountId)
                .single();

            if (oldAccount) {
                await supabase
                    .from('accounts')
                    .update({ balance: oldAccount.balance + oldAmount })
                    .eq('id', oldAccountId);
            }

            // Update new account balance
            await supabase
                .from('accounts')
                .update({ balance: account.balance - amount })
                .eq('id', accountId);
        }

        // Update transaction
        const { error } = await supabase
            .from('transactions')
            .update({
                date: date.toISOString(),
                amount,
                category,
                business_id: data.businessId,
                account_id: accountId,
                vendor_id: vendorId || null,
                description: normalizeText(data.description) || null,
            })
            .eq('id', id);

        if (error) {
            console.error('Update transaction error:', error);
            return { error: 'Failed to update expense record' };
        }

        revalidateExpenseViews();
        return { success: true };
    } catch (error) {
        console.error('Update expense error:', error);
        return { error: 'Failed to update expense record' };
    }
}

export async function deleteExpense(id: string) {
    try {
        // Fetch existing expense
        const { data: expense } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .eq('type', 'expense')
            .single();

        if (!expense) {
            return { error: 'Expense record not found' };
        }

        // Update account balance
        const { data: account } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', expense.account_id)
            .single();

        if (account) {
            await supabase
                .from('accounts')
                .update({ balance: account.balance + expense.amount })
                .eq('id', expense.account_id);
        }

        // Delete transaction
        await supabase
            .from('transactions')
            .delete()
            .eq('id', id);

        revalidateExpenseViews();
        return { success: true };
    } catch (error) {
        console.error('Delete expense error:', error);
        return { error: 'Failed to delete expense record' };
    }
}
