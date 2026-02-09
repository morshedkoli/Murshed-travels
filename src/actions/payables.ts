'use server';

import mongoose from 'mongoose';
import { revalidatePath } from 'next/cache';
import connect from '@/lib/db';
import Account from '@/models/Account';
import Payable from '@/models/Payable';
import Transaction from '@/models/Transaction';
import Vendor from '@/models/Vendor';

type BusinessType = 'travel' | 'isp';

type PayableInput = {
    date: string;
    dueDate: string;
    amount: number;
    businessId: BusinessType;
    vendorId: string;
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

function revalidatePayableViews() {
    revalidatePath('/payable');
    revalidatePath('/vendors');
    revalidatePath('/dashboard');
}

export async function getPayables() {
    await connect();

    const payables = await Payable.find({})
        .sort({ dueDate: 1, createdAt: -1 })
        .populate('vendorId', 'name');

    return payables.map((item) => ({
        _id: item._id.toString(),
        date: item.date.toISOString(),
        dueDate: item.dueDate ? item.dueDate.toISOString() : '',
        amount: item.amount,
        paidAmount: item.paidAmount ?? 0,
        remainingAmount: remainingAmount(item.amount, item.paidAmount ?? 0),
        businessId: (item.businessId as BusinessType) ?? 'travel',
        vendorId: item.vendorId?._id?.toString?.() ?? '',
        vendorName: item.vendorId?.name ?? 'Unknown Vendor',
        status: item.status,
        description: item.description ?? '',
    }));
}

export async function getPayableSettlementHistory(payableId: string) {
    await connect();

    const payments = await Transaction.find({
        referenceId: payableId,
        referenceModel: 'Payable',
        type: 'expense',
        category: 'Payable Settlement',
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

export async function createPayable(data: PayableInput) {
    const session = await mongoose.startSession();
    try {
        await connect();

        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid payable date is required' };

        const dueDate = normalizeDate(data.dueDate);
        if (!dueDate) return { error: 'Valid due date is required' };

        const amount = parsePositiveAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        if (!isValidBusiness(data.businessId)) {
            return { error: 'Business must be travel or isp' };
        }

        const vendorId = normalizeText(data.vendorId);
        if (!vendorId) return { error: 'Vendor is required' };

        let actionError = '';

        await session.withTransaction(async () => {
            const vendor = await Vendor.findById(vendorId).session(session);
            if (!vendor) {
                actionError = 'Selected vendor does not exist';
                await session.abortTransaction();
                return;
            }

            await Payable.create([
                {
                    date,
                    dueDate,
                    amount,
                    paidAmount: 0,
                    vendorId,
                    businessId: data.businessId,
                    status: 'unpaid',
                    description: normalizeText(data.description),
                },
            ], { session });

            await Vendor.findByIdAndUpdate(vendorId, { $inc: { balance: amount } }, { session });
        });

        if (actionError) return { error: actionError };

        revalidatePayableViews();
        return { success: true };
    } catch (error) {
        console.error('Create payable error:', error);
        return { error: 'Failed to create payable' };
    } finally {
        await session.endSession();
    }
}

export async function updatePayable(id: string, data: PayableInput) {
    const session = await mongoose.startSession();
    try {
        await connect();

        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid payable date is required' };

        const dueDate = normalizeDate(data.dueDate);
        if (!dueDate) return { error: 'Valid due date is required' };

        const amount = parsePositiveAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        if (!isValidBusiness(data.businessId)) {
            return { error: 'Business must be travel or isp' };
        }

        const vendorId = normalizeText(data.vendorId);
        if (!vendorId) return { error: 'Vendor is required' };

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
            const payable = await Payable.findById(id).session(session);
            if (!payable) {
                actionError = 'Payable record not found';
                await session.abortTransaction();
                return;
            }

            const vendor = await Vendor.findById(vendorId).session(session);
            if (!vendor) {
                actionError = 'Selected vendor does not exist';
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
                if ((account.balance ?? 0) < paymentAmount) {
                    actionError = 'Insufficient account balance for this settlement';
                    await session.abortTransaction();
                    return;
                }
            }

            const oldVendorId = payable.vendorId.toString();
            const oldAmount = payable.amount;
            const oldPaidAmount = payable.paidAmount ?? 0;
            const oldRemaining = remainingAmount(oldAmount, oldPaidAmount);

            const newPaidAmount = oldPaidAmount + paymentAmount;
            if (newPaidAmount > amount) {
                actionError = 'Payment amount cannot exceed remaining payable';
                await session.abortTransaction();
                return;
            }

            const newRemaining = remainingAmount(amount, newPaidAmount);
            const status = deriveStatus(amount, newPaidAmount);

            if (oldVendorId === vendorId) {
                const delta = newRemaining - oldRemaining;
                if (delta !== 0) {
                    await Vendor.findByIdAndUpdate(vendorId, { $inc: { balance: delta } }, { session });
                }
            } else {
                await Vendor.findByIdAndUpdate(oldVendorId, { $inc: { balance: -oldRemaining } }, { session });
                await Vendor.findByIdAndUpdate(vendorId, { $inc: { balance: newRemaining } }, { session });
            }

            if (paymentAmount > 0 && settlementAccountId) {
                await Transaction.create([
                    {
                        date,
                        amount: paymentAmount,
                        type: 'expense',
                        category: 'Payable Settlement',
                        businessId: data.businessId,
                        accountId: settlementAccountId,
                        vendorId,
                        description: `Settlement against payable #${id}`,
                        referenceId: payable._id,
                        referenceModel: 'Payable',
                    },
                ], { session });

                await Account.findByIdAndUpdate(settlementAccountId, { $inc: { balance: -paymentAmount } }, { session });
            }

            payable.date = date;
            payable.dueDate = dueDate;
            payable.amount = amount;
            payable.paidAmount = newPaidAmount;
            payable.status = status;
            payable.businessId = data.businessId;
            payable.vendorId = vendorId;
            payable.description = normalizeText(data.description);

            await payable.save({ session });
        });

        if (actionError) return { error: actionError };

        revalidatePayableViews();
        return { success: true };
    } catch (error) {
        console.error('Update payable error:', error);
        return { error: 'Failed to update payable' };
    } finally {
        await session.endSession();
    }
}

export async function deletePayable(id: string) {
    const session = await mongoose.startSession();
    try {
        await connect();

        let actionError = '';

        await session.withTransaction(async () => {
            const payable = await Payable.findById(id).session(session);
            if (!payable) {
                actionError = 'Payable record not found';
                await session.abortTransaction();
                return;
            }

            const vendorId = payable.vendorId.toString();
            const outstanding = remainingAmount(payable.amount, payable.paidAmount ?? 0);

            if (outstanding !== 0) {
                await Vendor.findByIdAndUpdate(vendorId, { $inc: { balance: -outstanding } }, { session });
            }

            await Payable.deleteOne({ _id: id }, { session });
        });

        if (actionError) return { error: actionError };

        revalidatePayableViews();
        return { success: true };
    } catch (error) {
        console.error('Delete payable error:', error);
        return { error: 'Failed to delete payable' };
    } finally {
        await session.endSession();
    }
}
