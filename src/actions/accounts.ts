'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function getAccounts() {
    const { data: accounts, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching accounts:', error);
        return [];
    }

    return accounts.map(acc => ({
        _id: acc.id,
        name: acc.name,
        type: acc.type,
        balance: acc.balance,
        bankName: acc.bank_name,
        accountNumber: acc.account_number,
        createdAt: acc.created_at,
    }));
}

export async function createAccount(data: {
    name: string;
    type: string;
    balance: number;
    bankName?: string;
    accountNumber?: string;
}) {
    try {
        // Basic validation
        if (!data.name || !data.type) {
            return { error: 'Name and Type are required' };
        }

        const { data: newAccount, error } = await supabase
            .from('accounts')
            .insert({
                name: data.name,
                type: data.type,
                balance: data.balance || 0,
                bank_name: data.bankName || null,
                account_number: data.accountNumber || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Create account error:', error);
            return { error: 'Failed to create account' };
        }

        revalidatePath('/accounts');
        revalidatePath('/dashboard'); // Balance updates might reflect on dashboard

        return {
            success: true,
            account: {
                _id: newAccount.id,
                name: newAccount.name,
                type: newAccount.type,
                balance: newAccount.balance,
            }
        };
    } catch (error) {
        console.error('Create account error:', error);
        return { error: 'Failed to create account' };
    }
}
