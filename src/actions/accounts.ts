'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getAccounts() {
    try {
        const accounts = await prisma.account.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return accounts.map(acc => ({
            _id: acc.id,
            name: acc.name,
            type: acc.type,
            balance: acc.balance,
            bankName: acc.bankName,
            accountNumber: acc.accountNumber,
            createdAt: acc.createdAt.toISOString(),
        }));
    } catch (error) {
        console.error('Error fetching accounts:', error);
        return [];
    }
}

export async function createAccount(data: {
    name: string;
    type: string;
    balance: number;
    bankName?: string;
    accountNumber?: string;
}) {
    try {
        if (!data.name || !data.type) {
            return { error: 'Name and Type are required' };
        }

        const newAccount = await prisma.account.create({
            data: {
                name: data.name,
                type: data.type,
                balance: data.balance || 0,
                bankName: data.bankName || null,
                accountNumber: data.accountNumber || null,
            }
        });

        revalidatePath('/accounts');
        revalidatePath('/dashboard');

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
