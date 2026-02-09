'use server';

import mongoose from 'mongoose';
import { revalidatePath } from 'next/cache';
import connect from '@/lib/db';
import Account from '@/models/Account';
import Customer from '@/models/Customer';
import Receivable from '@/models/Receivable';
import Transaction from '@/models/Transaction';

type BusinessType = 'travel' | 'isp';

type ReceivableInput = {
    date: string;
    dueDate: string;
    amount: number;
    businessId: BusinessType;
    customerId: string;
    description?: string;
    paymentAmount?: number;
    settlementAccountId?: string;
};

function isValidBusiness(value: string): value is BusinessType {
    return value === 'travel' || value === 'isp';
}

function normalizeDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function normalizeText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}

function parsePositiveAmount(value: number) {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Number(value);
}

function parseNonNegative(value?: number) {
    if (value === undefined) return 0;
    if (!Number.isFinite(value) || value < 0) return null;
    return Number(value);
}

function deriveStatus(amount: number, paidAmount: number) {
    if (paidAmount <= 0) return 'unpaid' as const;
    if (paidAmount >= amount) return 'paid' as const;
    return 'partial' as const;
}

function remainingAmount(amount: number, paidAmount: number) {
    return Math.max(0, amount - paidAmount);
}

function revalidateReceivableViews() {
    revalidatePath('/receivable');
    revalidatePath('/customers');
    revalidatePath('/dashboard');
}

export async function getReceivables() {
    await connect();

    const receivables = await Receivable.find({})
        .sort({ dueDate: 1, createdAt: -1 })
        .populate('customerId', 'name');

    return receivables.map((item) => ({
        _id: item._id.toString(),
        date: item.date.toISOString(),
        dueDate: item.dueDate ? item.dueDate.toISOString() : '',
        amount: item.amount,
        paidAmount: item.paidAmount ?? 0,
        remainingAmount: remainingAmount(item.amount, item.paidAmount ?? 0),
        businessId: (item.businessId as BusinessType) ?? 'travel',
        customerId: item.customerId?._id?.toString?.() ?? '',
        customerName: item.customerId?.name ?? 'Unknown Customer',
        status: item.status,
        description: item.description ?? '',
    }));
}

export async function getReceivableSettlementHistory(receivableId: string) {
    await connect();

    const payments = await Transaction.find({
        referenceId: receivableId,
        referenceModel: 'Receivable',
        type: 'income',
        category: 'Receivable Collection',
    })
        .sort({ date: -1, createdAt: -1 })
        .populate('accountId', 'name');

    return payments.map((item) => ({
        _id: item._id.toString(),
        date: item.date.toISOString(),
        amount: item.amount,
        accountName: item.accountId?.name ?? 'Unknown Account',
        description: item.description ?? '',
    }));
}

export async function createReceivable(data: ReceivableInput) {
    const session = await mongoose.startSession();
    try {
        await connect();

        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid receivable date is required' };

        const dueDate = normalizeDate(data.dueDate);
        if (!dueDate) return { error: 'Valid due date is required' };

        const amount = parsePositiveAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        if (!isValidBusiness(data.businessId)) {
            return { error: 'Business must be travel or isp' };
        }

        const customerId = normalizeText(data.customerId);
        if (!customerId) return { error: 'Customer is required' };

        let customerError = '';

        await session.withTransaction(async () => {
            const customer = await Customer.findById(customerId).session(session);
            if (!customer) {
                customerError = 'Selected customer does not exist';
                await session.abortTransaction();
                return;
            }

            await Receivable.create([
                {
                    date,
                    dueDate,
                    amount,
                    paidAmount: 0,
                    customerId,
                    businessId: data.businessId,
                    status: 'unpaid',
                    description: normalizeText(data.description),
                },
            ], { session });

            await Customer.findByIdAndUpdate(customerId, { $inc: { balance: amount } }, { session });
        });

        if (customerError) return { error: customerError };

        revalidateReceivableViews();
        return { success: true };
    } catch (error) {
        console.error('Create receivable error:', error);
        return { error: 'Failed to create receivable' };
    } finally {
        await session.endSession();
    }
}

export async function updateReceivable(id: string, data: ReceivableInput) {
    const session = await mongoose.startSession();
    try {
        await connect();

        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid receivable date is required' };

        const dueDate = normalizeDate(data.dueDate);
        if (!dueDate) return { error: 'Valid due date is required' };

        const amount = parsePositiveAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        if (!isValidBusiness(data.businessId)) {
            return { error: 'Business must be travel or isp' };
        }

        const customerId = normalizeText(data.customerId);
        if (!customerId) return { error: 'Customer is required' };

        const paymentAmount = parseNonNegative(data.paymentAmount);
        if (paymentAmount === null) {
            return { error: 'Payment amount must be zero or positive' };
        }

        const settlementAccountId = normalizeText(data.settlementAccountId);
        if (paymentAmount > 0 && !settlementAccountId) {
            return { error: 'Settlement account is required when recording payment' };
        }

        let actionError = '';

        await session.withTransaction(async () => {
            const receivable = await Receivable.findById(id).session(session);
            if (!receivable) {
                actionError = 'Receivable record not found';
                await session.abortTransaction();
                return;
            }

            const customer = await Customer.findById(customerId).session(session);
            if (!customer) {
                actionError = 'Selected customer does not exist';
                await session.abortTransaction();
                return;
            }

            if (paymentAmount > 0 && settlementAccountId) {
                const account = await Account.findById(settlementAccountId).session(session);
                if (!account) {
                    actionError = 'Selected settlement account does not exist';
                    await session.abortTransaction();
                    return;
                }
            }

            const oldCustomerId = receivable.customerId.toString();
            const oldAmount = receivable.amount;
            const oldPaidAmount = receivable.paidAmount ?? 0;
            const oldRemaining = remainingAmount(oldAmount, oldPaidAmount);

            const newPaidAmount = oldPaidAmount + paymentAmount;
            if (newPaidAmount > amount) {
                actionError = 'Payment amount cannot exceed remaining receivable';
                await session.abortTransaction();
                return;
            }

            const newRemaining = remainingAmount(amount, newPaidAmount);
            const status = deriveStatus(amount, newPaidAmount);

            if (oldCustomerId === customerId) {
                const delta = newRemaining - oldRemaining;
                if (delta !== 0) {
                    await Customer.findByIdAndUpdate(customerId, { $inc: { balance: delta } }, { session });
                }
            } else {
                await Customer.findByIdAndUpdate(oldCustomerId, { $inc: { balance: -oldRemaining } }, { session });
                await Customer.findByIdAndUpdate(customerId, { $inc: { balance: newRemaining } }, { session });
            }

            if (paymentAmount > 0 && settlementAccountId) {
                await Transaction.create([
                    {
                        date,
                        amount: paymentAmount,
                        type: 'income',
                        category: 'Receivable Collection',
                        businessId: data.businessId,
                        accountId: settlementAccountId,
                        customerId,
                        description: `Settlement against receivable #${id}`,
                        referenceId: receivable._id,
                        referenceModel: 'Receivable',
                    },
                ], { session });

                await Account.findByIdAndUpdate(settlementAccountId, { $inc: { balance: paymentAmount } }, { session });
            }

            receivable.date = date;
            receivable.dueDate = dueDate;
            receivable.amount = amount;
            receivable.paidAmount = newPaidAmount;
            receivable.status = status;
            receivable.businessId = data.businessId;
            receivable.customerId = customerId;
            receivable.description = normalizeText(data.description);

            await receivable.save({ session });
        });

        if (actionError) return { error: actionError };

        revalidateReceivableViews();
        return { success: true };
    } catch (error) {
        console.error('Update receivable error:', error);
        return { error: 'Failed to update receivable' };
    } finally {
        await session.endSession();
    }
}

export async function collectReceivablePayment(data: {
    receivableId: string;
    amount: number;
    settlementAccountId: string;
    date?: string;
    note?: string;
}) {
    const session = await mongoose.startSession();
    try {
        await connect();

        const receivableId = normalizeText(data.receivableId);
        if (!receivableId) return { error: 'Receivable is required' };

        const amount = parsePositiveAmount(data.amount);
        if (!amount) return { error: 'Payment amount must be greater than 0' };

        const settlementAccountId = normalizeText(data.settlementAccountId);
        if (!settlementAccountId) return { error: 'Settlement account is required' };

        const date = data.date ? normalizeDate(data.date) : new Date();
        if (!date) return { error: 'Valid payment date is required' };

        let actionError = '';
        let remaining = 0;
        let customerIdForPath = '';

        await session.withTransaction(async () => {
            const receivable = await Receivable.findById(receivableId).session(session);
            if (!receivable) {
                actionError = 'Receivable record not found';
                await session.abortTransaction();
                return;
            }

            const account = await Account.findById(settlementAccountId).session(session);
            if (!account) {
                actionError = 'Selected settlement account does not exist';
                await session.abortTransaction();
                return;
            }

            const customer = await Customer.findById(receivable.customerId).session(session);
            if (!customer) {
                actionError = 'Customer record not found';
                await session.abortTransaction();
                return;
            }

            const currentRemaining = remainingAmount(receivable.amount, receivable.paidAmount ?? 0);
            if (currentRemaining <= 0) {
                actionError = 'This receivable is already fully paid';
                await session.abortTransaction();
                return;
            }

            if (amount > currentRemaining) {
                actionError = 'Payment amount cannot exceed remaining due';
                await session.abortTransaction();
                return;
            }

            const nextPaidAmount = (receivable.paidAmount ?? 0) + amount;
            receivable.paidAmount = nextPaidAmount;
            receivable.status = deriveStatus(receivable.amount, nextPaidAmount);
            await receivable.save({ session });

            await Transaction.create([
                {
                    date,
                    amount,
                    type: 'income',
                    category: 'Receivable Collection',
                    businessId: receivable.businessId,
                    accountId: settlementAccountId,
                    customerId: receivable.customerId,
                    description: normalizeText(data.note) || `Settlement against receivable #${receivableId}`,
                    referenceId: receivable._id,
                    referenceModel: 'Receivable',
                },
            ], { session });

            await Account.findByIdAndUpdate(settlementAccountId, { $inc: { balance: amount } }, { session });
            await Customer.findByIdAndUpdate(receivable.customerId, { $inc: { balance: -amount } }, { session });

            remaining = remainingAmount(receivable.amount, nextPaidAmount);
            customerIdForPath = receivable.customerId.toString();
        });

        if (actionError) return { error: actionError };

        revalidateReceivableViews();
        if (customerIdForPath) {
            revalidatePath(`/customers/${customerIdForPath}`);
        }

        return {
            success: true,
            remaining,
        };
    } catch (error) {
        console.error('Collect receivable payment error:', error);
        return { error: 'Failed to collect receivable payment' };
    } finally {
        await session.endSession();
    }
}

export async function deleteReceivable(id: string) {
    const session = await mongoose.startSession();
    try {
        await connect();

        let actionError = '';

        await session.withTransaction(async () => {
            const receivable = await Receivable.findById(id).session(session);
            if (!receivable) {
                actionError = 'Receivable record not found';
                await session.abortTransaction();
                return;
            }

            const customerId = receivable.customerId.toString();
            const outstanding = remainingAmount(receivable.amount, receivable.paidAmount ?? 0);

            if (outstanding !== 0) {
                await Customer.findByIdAndUpdate(customerId, { $inc: { balance: -outstanding } }, { session });
            }

            await Receivable.deleteOne({ _id: id }, { session });
        });

        if (actionError) return { error: actionError };

        revalidateReceivableViews();
        return { success: true };
    } catch (error) {
        console.error('Delete receivable error:', error);
        return { error: 'Failed to delete receivable' };
    } finally {
        await session.endSession();
    }
}
