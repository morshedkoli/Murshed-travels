'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

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
    try {
        const expenses = await prisma.transaction.findMany({
            where: { type: 'expense' },
            include: {
                account: { select: { name: true } },
                vendor: { select: { name: true } }
            },
            orderBy: { date: 'desc' }
        });

        return expenses.map((expense) => ({
            _id: expense.id,
            date: expense.date.toISOString(),
            amount: expense.amount,
            category: expense.category,
            businessId: expense.businessId || 'travel',
            accountId: expense.accountId || '',
            accountName: expense.account?.name || 'Unknown Account',
            vendorId: expense.vendorId || '',
            vendorName: expense.vendor?.name || '',
            description: expense.description || '',
        }));
    } catch (error) {
        console.error('Error fetching expense entries:', error);
        return [];
    }
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

        await prisma.$transaction(async (tx) => {
            await tx.transaction.create({
                data: {
                    date,
                    amount,
                    type: 'expense',
                    category,
                    businessId: data.businessId,
                    accountId,
                    vendorId: vendorId || null,
                    description: normalizeText(data.description) || null,
                }
            });

            await tx.account.update({
                where: { id: accountId },
                data: { balance: { decrement: amount } }
            });
        });

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

        const oldExpense = await prisma.transaction.findUnique({
            where: { id, type: 'expense' }
        });

        if (!oldExpense) return { error: 'Expense record not found' };

        await prisma.$transaction(async (tx) => {
            const oldAccountId = oldExpense.accountId;
            const oldAmount = oldExpense.amount;

            if (oldAccountId === accountId) {
                const delta = amount - oldAmount;
                if (delta !== 0) {
                    await tx.account.update({
                        where: { id: accountId },
                        data: { balance: { decrement: delta } }
                    });
                }
            } else {
                await tx.account.update({
                    where: { id: oldAccountId },
                    data: { balance: { increment: oldAmount } }
                });
                await tx.account.update({
                    where: { id: accountId },
                    data: { balance: { decrement: amount } }
                });
            }

            await tx.transaction.update({
                where: { id },
                data: {
                    date,
                    amount,
                    category,
                    businessId: data.businessId,
                    accountId,
                    vendorId: vendorId || null,
                    description: normalizeText(data.description) || null,
                }
            });
        });

        revalidateExpenseViews();
        return { success: true };
    } catch (error) {
        console.error('Update expense error:', error);
        return { error: 'Failed to update expense record' };
    }
}

export async function deleteExpense(id: string) {
    try {
        const expense = await prisma.transaction.findUnique({
            where: { id, type: 'expense' }
        });

        if (!expense) return { error: 'Expense record not found' };

        await prisma.$transaction(async (tx) => {
            await tx.account.update({
                where: { id: expense.accountId },
                data: { balance: { increment: expense.amount } }
            });

            await tx.transaction.delete({
                where: { id }
            });
        });

        revalidateExpenseViews();
        return { success: true };
    } catch (error) {
        console.error('Delete expense error:', error);
        return { error: 'Failed to delete expense record' };
    }
}
