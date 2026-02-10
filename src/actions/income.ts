'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';

type IncomeInput = {
    date: string;
    amount: number;
    category: string;
    accountId: string;
    customerId?: string;
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

function revalidateIncomeViews() {
    revalidatePath('/income');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
}

export async function getIncomeEntries() {
    const { data: incomes, error } = await supabase
        .from('transactions')
        .select(`
            *,
            accounts:account_id (name),
            customers:customer_id (name)
        `)
        .eq('type', 'income')
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching income entries:', error);
        return [];
    }

    return (incomes || []).map((income) => ({
        _id: income.id,
        date: income.date,
        amount: income.amount,
        category: income.category,
        accountId: income.account_id || '',
        accountName: income.accounts?.name || 'Unknown Account',
        customerId: income.customer_id || '',
        customerName: income.customers?.name || '',
        description: income.description || '',
    }));
}

export async function createIncome(data: IncomeInput) {
    try {
        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid date is required' };

        const amount = parseAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        const category = normalizeText(data.category);
        if (!category) return { error: 'Category is required' };

        const accountId = normalizeText(data.accountId);
        if (!accountId) return { error: 'Account is required' };

        const customerId = normalizeText(data.customerId);

        // Verify account exists
        const { data: account } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (!account) {
            return { error: 'Selected account does not exist' };
        }

        // Verify customer if provided
        if (customerId) {
            const { data: customer } = await supabase
                .from('customers')
                .select('id')
                .eq('id', customerId)
                .single();

            if (!customer) {
                return { error: 'Selected customer does not exist' };
            }
        }

        // Create transaction
        const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
                date: date.toISOString(),
                amount,
                type: 'income',
                category,
                business_id: 'travel',
                account_id: accountId,
                customer_id: customerId || null,
                description: normalizeText(data.description) || null,
            });

        if (transactionError) {
            console.error('Create transaction error:', transactionError);
            return { error: 'Failed to create income record' };
        }

        // Update account balance
        await supabase
            .from('accounts')
            .update({ balance: account.balance + amount })
            .eq('id', accountId);

        revalidateIncomeViews();
        return { success: true };
    } catch (error) {
        console.error('Create income error:', error);
        return { error: 'Failed to create income record' };
    }
}

export async function updateIncome(id: string, data: IncomeInput) {
    try {
        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid date is required' };

        const amount = parseAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        const category = normalizeText(data.category);
        if (!category) return { error: 'Category is required' };

        const accountId = normalizeText(data.accountId);
        if (!accountId) return { error: 'Account is required' };

        const customerId = normalizeText(data.customerId);

        // Fetch existing income
        const { data: income } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .eq('type', 'income')
            .single();

        if (!income) {
            return { error: 'Income record not found' };
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

        // Verify customer if provided
        if (customerId) {
            const { data: customer } = await supabase
                .from('customers')
                .select('id')
                .eq('id', customerId)
                .single();

            if (!customer) {
                return { error: 'Selected customer does not exist' };
            }
        }

        const oldAccountId = income.account_id;
        const oldAmount = income.amount;

        // Handle account balance updates
        if (oldAccountId === accountId) {
            const delta = amount - oldAmount;
            if (delta !== 0) {
                await supabase
                    .from('accounts')
                    .update({ balance: account.balance + delta })
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
                    .update({ balance: oldAccount.balance - oldAmount })
                    .eq('id', oldAccountId);
            }

            // Update new account balance
            await supabase
                .from('accounts')
                .update({ balance: account.balance + amount })
                .eq('id', accountId);
        }

        // Update transaction
        const { error } = await supabase
            .from('transactions')
            .update({
                date: date.toISOString(),
                amount,
                category,
                business_id: 'travel',
                account_id: accountId,
                customer_id: customerId || null,
                description: normalizeText(data.description) || null,
            })
            .eq('id', id);

        if (error) {
            console.error('Update transaction error:', error);
            return { error: 'Failed to update income record' };
        }

        revalidateIncomeViews();
        return { success: true };
    } catch (error) {
        console.error('Update income error:', error);
        return { error: 'Failed to update income record' };
    }
}

export async function deleteIncome(id: string) {
    try {
        // Fetch existing income
        const { data: income } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .eq('type', 'income')
            .single();

        if (!income) {
            return { error: 'Income record not found' };
        }

        // Update account balance
        const { data: account } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', income.account_id)
            .single();

        if (account) {
            await supabase
                .from('accounts')
                .update({ balance: account.balance - income.amount })
                .eq('id', income.account_id);
        }

        // Delete transaction
        await supabase
            .from('transactions')
            .delete()
            .eq('id', id);

        revalidateIncomeViews();
        return { success: true };
    } catch (error) {
        console.error('Delete income error:', error);
        return { error: 'Failed to delete income record' };
    }
}
