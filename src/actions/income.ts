'use server';

import { revalidatePath } from 'next/cache';
import connect from '@/lib/db';
import Account from '@/models/Account';
import Customer from '@/models/Customer';
import Transaction from '@/models/Transaction';

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
    await connect();

    const incomes = await Transaction.find({ type: 'income' })
        .sort({ date: -1, createdAt: -1 })
        .populate('accountId', 'name')
        .populate({ path: 'customerId', select: 'name', strictPopulate: false });

    return incomes.map((income) => ({
        _id: income._id.toString(),
        date: income.date.toISOString(),
        amount: income.amount,
        category: income.category,
        accountId: income.accountId?._id?.toString?.() ?? '',
        accountName: income.accountId?.name ?? 'Unknown Account',
        customerId: income.customerId?._id?.toString?.() ?? '',
        customerName: income.customerId?.name ?? '',
        description: income.description ?? '',
    }));
}

export async function createIncome(data: IncomeInput) {
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

        const customerId = normalizeText(data.customerId);

        const account = await Account.findById(accountId);
        if (!account) {
            return { error: 'Selected account does not exist' };
        }

        if (customerId) {
            const customer = await Customer.findById(customerId);
            if (!customer) {
                return { error: 'Selected customer does not exist' };
            }
        }

        await Transaction.create({
            date,
            amount,
            type: 'income',
            category,
            businessId: 'travel',
            accountId,
            customerId,
            description: normalizeText(data.description),
        });

        await Account.findByIdAndUpdate(accountId, { $inc: { balance: amount } });

        revalidateIncomeViews();
        return { success: true };
    } catch (error) {
        console.error('Create income error:', error);
        return { error: 'Failed to create income record' };
    }
}

export async function updateIncome(id: string, data: IncomeInput) {
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

        const customerId = normalizeText(data.customerId);

        const income = await Transaction.findOne({ _id: id, type: 'income' });
        if (!income) {
            return { error: 'Income record not found' };
        }

        const account = await Account.findById(accountId);
        if (!account) {
            return { error: 'Selected account does not exist' };
        }

        if (customerId) {
            const customer = await Customer.findById(customerId);
            if (!customer) {
                return { error: 'Selected customer does not exist' };
            }
        }

        const oldAccountId = income.accountId.toString();
        const oldAmount = income.amount;

        if (oldAccountId === accountId) {
            const delta = amount - oldAmount;
            if (delta !== 0) {
                await Account.findByIdAndUpdate(accountId, { $inc: { balance: delta } });
            }
        } else {
            await Account.findByIdAndUpdate(oldAccountId, { $inc: { balance: -oldAmount } });
            await Account.findByIdAndUpdate(accountId, { $inc: { balance: amount } });
        }

        income.date = date;
        income.amount = amount;
        income.category = category;
        income.businessId = 'travel';
        income.accountId = accountId;
        income.customerId = customerId;
        income.description = normalizeText(data.description);

        await income.save();

        revalidateIncomeViews();
        return { success: true };
    } catch (error) {
        console.error('Update income error:', error);
        return { error: 'Failed to update income record' };
    }
}

export async function deleteIncome(id: string) {
    try {
        await connect();

        const income = await Transaction.findOne({ _id: id, type: 'income' });
        if (!income) {
            return { error: 'Income record not found' };
        }

        await Account.findByIdAndUpdate(income.accountId, { $inc: { balance: -income.amount } });
        await Transaction.deleteOne({ _id: id });

        revalidateIncomeViews();
        return { success: true };
    } catch (error) {
        console.error('Delete income error:', error);
        return { error: 'Failed to delete income record' };
    }
}
