'use server';

import { revalidatePath } from 'next/cache';
import connect from '@/lib/db';
import Account from '@/models/Account';
import Transaction from '@/models/Transaction';
import Vendor from '@/models/Vendor';

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
    await connect();

    const expenses = await Transaction.find({ type: 'expense' })
        .sort({ date: -1, createdAt: -1 })
        .populate('accountId', 'name')
        .populate({ path: 'vendorId', select: 'name', strictPopulate: false });

    return expenses.map((expense) => ({
        _id: expense._id.toString(),
        date: expense.date.toISOString(),
        amount: expense.amount,
        category: expense.category,
        businessId: expense.businessId ?? 'travel',
        accountId: expense.accountId?._id?.toString?.() ?? '',
        accountName: expense.accountId?.name ?? 'Unknown Account',
        vendorId: expense.vendorId?._id?.toString?.() ?? '',
        vendorName: expense.vendorId?.name ?? '',
        description: expense.description ?? '',
    }));
}

export async function createExpense(data: ExpenseInput) {
    try {
        await connect();

        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid date is required' };

        const amount = parseAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        const category = normalizeText(data.category);
        if (!category) return { error: 'Category is required' };

        const accountId = normalizeText(data.accountId);
        if (!accountId) return { error: 'Account is required' };

        const vendorId = normalizeText(data.vendorId);

        const account = await Account.findById(accountId);
        if (!account) {
            return { error: 'Selected account does not exist' };
        }

        if (vendorId) {
            const vendor = await Vendor.findById(vendorId);
            if (!vendor) {
                return { error: 'Selected vendor does not exist' };
            }
        }

        await Transaction.create({
            date,
            amount,
            type: 'expense',
            category,
            businessId: data.businessId,
            accountId,
            vendorId,
            description: normalizeText(data.description),
        });

        await Account.findByIdAndUpdate(accountId, { $inc: { balance: -amount } });

        revalidateExpenseViews();
        return { success: true };
    } catch (error) {
        console.error('Create expense error:', error);
        return { error: 'Failed to create expense record' };
    }
}

export async function updateExpense(id: string, data: ExpenseInput) {
    try {
        await connect();

        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid date is required' };

        const amount = parseAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        const category = normalizeText(data.category);
        if (!category) return { error: 'Category is required' };

        const accountId = normalizeText(data.accountId);
        if (!accountId) return { error: 'Account is required' };

        const vendorId = normalizeText(data.vendorId);

        const expense = await Transaction.findOne({ _id: id, type: 'expense' });
        if (!expense) {
            return { error: 'Expense record not found' };
        }

        const account = await Account.findById(accountId);
        if (!account) {
            return { error: 'Selected account does not exist' };
        }

        if (vendorId) {
            const vendor = await Vendor.findById(vendorId);
            if (!vendor) {
                return { error: 'Selected vendor does not exist' };
            }
        }

        const oldAccountId = expense.accountId.toString();
        const oldAmount = expense.amount;

        if (oldAccountId === accountId) {
            const delta = amount - oldAmount;
            if (delta !== 0) {
                await Account.findByIdAndUpdate(accountId, { $inc: { balance: -delta } });
            }
        } else {
            await Account.findByIdAndUpdate(oldAccountId, { $inc: { balance: oldAmount } });
            await Account.findByIdAndUpdate(accountId, { $inc: { balance: -amount } });
        }

        expense.date = date;
        expense.amount = amount;
        expense.category = category;
        expense.businessId = data.businessId;
        expense.accountId = accountId;
        expense.vendorId = vendorId;
        expense.description = normalizeText(data.description);

        await expense.save();

        revalidateExpenseViews();
        return { success: true };
    } catch (error) {
        console.error('Update expense error:', error);
        return { error: 'Failed to update expense record' };
    }
}

export async function deleteExpense(id: string) {
    try {
        await connect();

        const expense = await Transaction.findOne({ _id: id, type: 'expense' });
        if (!expense) {
            return { error: 'Expense record not found' };
        }

        await Account.findByIdAndUpdate(expense.accountId, { $inc: { balance: expense.amount } });
        await Transaction.deleteOne({ _id: id });

        revalidateExpenseViews();
        return { success: true };
    } catch (error) {
        console.error('Delete expense error:', error);
        return { error: 'Failed to delete expense record' };
    }
}
