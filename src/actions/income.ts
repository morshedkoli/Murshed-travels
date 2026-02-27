'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

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
    try {
        const incomes = await prisma.transaction.findMany({
            where: { type: 'income' },
            include: {
                account: { select: { name: true } },
                customer: { select: { name: true } }
            },
            orderBy: { date: 'desc' }
        });

        return incomes.map((income) => ({
            _id: income.id,
            date: income.date.toISOString(),
            amount: income.amount,
            category: income.category,
            accountId: income.accountId || '',
            accountName: income.account?.name || 'Unknown Account',
            customerId: income.customerId || '',
            customerName: income.customer?.name || '',
            description: income.description || '',
        }));
    } catch (error) {
        console.error('Error fetching income entries:', error);
        return [];
    }
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

        await prisma.$transaction(async (tx) => {
            await tx.transaction.create({
                data: {
                    date,
                    amount,
                    type: 'income',
                    category,
                    businessId: 'travel',
                    accountId,
                    customerId: customerId || null,
                    description: normalizeText(data.description) || null,
                }
            });

            await tx.account.update({
                where: { id: accountId },
                data: { balance: { increment: amount } }
            });
        });

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

        const oldIncome = await prisma.transaction.findUnique({
            where: { id, type: 'income' }
        });

        if (!oldIncome) return { error: 'Income record not found' };

        await prisma.$transaction(async (tx) => {
            const oldAccountId = oldIncome.accountId;
            const oldAmount = oldIncome.amount;

            if (oldAccountId === accountId) {
                const delta = amount - oldAmount;
                if (delta !== 0) {
                    await tx.account.update({
                        where: { id: accountId },
                        data: { balance: { increment: delta } }
                    });
                }
            } else {
                await tx.account.update({
                    where: { id: oldAccountId },
                    data: { balance: { decrement: oldAmount } }
                });
                await tx.account.update({
                    where: { id: accountId },
                    data: { balance: { increment: amount } }
                });
            }

            await tx.transaction.update({
                where: { id },
                data: {
                    date,
                    amount,
                    category,
                    businessId: 'travel',
                    accountId,
                    customerId: customerId || null,
                    description: normalizeText(data.description) || null,
                }
            });
        });

        revalidateIncomeViews();
        return { success: true };
    } catch (error) {
        console.error('Update income error:', error);
        return { error: 'Failed to update income record' };
    }
}

export async function deleteIncome(id: string) {
    try {
        const income = await prisma.transaction.findUnique({
            where: { id, type: 'income' }
        });

        if (!income) return { error: 'Income record not found' };

        await prisma.$transaction(async (tx) => {
            await tx.account.update({
                where: { id: income.accountId },
                data: { balance: { decrement: income.amount } }
            });

            await tx.transaction.delete({
                where: { id }
            });
        });

        revalidateIncomeViews();
        return { success: true };
    } catch (error) {
        console.error('Delete income error:', error);
        return { error: 'Failed to delete income record' };
    }
}
