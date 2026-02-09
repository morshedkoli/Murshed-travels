'use server';

import Account from '@/models/Account';
import connect from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getAccounts() {
    await connect();
    const accounts = await Account.find({}).sort({ createdAt: -1 });
    // Convert to plain object to avoid hydration issues with dates/objectIds
    return accounts.map(acc => ({
        _id: acc._id.toString(),
        name: acc.name,
        type: acc.type,
        balance: acc.balance,
        bankName: acc.bankName,
        accountNumber: acc.accountNumber,
        createdAt: acc.createdAt.toISOString(),
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
        await connect();

        // Basic validation
        if (!data.name || !data.type) {
            return { error: 'Name and Type are required' };
        }

        const newAccount = await Account.create(data);

        revalidatePath('/accounts');
        revalidatePath('/dashboard'); // Balance updates might reflect on dashboard

        return {
            success: true,
            account: {
                _id: newAccount._id.toString(),
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
