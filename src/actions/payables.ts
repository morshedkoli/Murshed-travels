'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

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
    try {
        const payables = await prisma.payable.findMany({
            include: { vendor: { select: { name: true } } },
            orderBy: { dueDate: 'asc' }
        });

        return payables.map((item) => ({
            _id: item.id,
            date: item.date.toISOString(),
            dueDate: item.dueDate ? item.dueDate.toISOString() : '',
            amount: item.amount,
            paidAmount: item.paidAmount || 0,
            remainingAmount: remainingAmount(item.amount, item.paidAmount || 0),
            businessId: (item.businessId as BusinessType) || 'travel',
            vendorId: item.vendorId || '',
            vendorName: item.vendor?.name || 'Unknown Vendor',
            status: item.status,
            description: item.description || '',
        }));
    } catch (error) {
        console.error('Error fetching payables:', error);
        return [];
    }
}

export async function getPayableSettlementHistory(payableId: string) {
    try {
        const payments = await prisma.transaction.findMany({
            where: {
                referenceId: payableId,
                referenceModel: 'Payable',
                type: 'expense',
                category: 'Payable Settlement'
            },
            include: { account: { select: { name: true } } },
            orderBy: { date: 'desc' }
        });

        return payments.map((item) => ({
            _id: item.id,
            date: item.date.toISOString(),
            amount: item.amount,
            accountName: item.account?.name || 'Unknown Account',
            description: item.description || '',
        }));
    } catch (error) {
        console.error('Error fetching payable settlement history:', error);
        return [];
    }
}

export async function createPayable(data: PayableInput) {
    try {
        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid payable date is required' };

        const dueDate = normalizeDate(data.dueDate);
        if (!dueDate) return { error: 'Valid due date is required' };

        const amount = parsePositiveAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        const vendorId = normalizeText(data.vendorId);
        if (!vendorId) return { error: 'Vendor is required' };

        await prisma.$transaction(async (tx) => {
            await tx.payable.create({
                data: {
                    date,
                    dueDate,
                    amount,
                    paidAmount: 0,
                    vendorId,
                    businessId: data.businessId,
                    status: 'unpaid',
                    description: normalizeText(data.description) || null,
                }
            });

            await tx.vendor.update({
                where: { id: vendorId },
                data: { balance: { increment: amount } }
            });
        });

        revalidatePayableViews();
        return { success: true };
    } catch (error) {
        console.error('Create payable error:', error);
        return { error: 'Failed to create payable' };
    }
}

export async function updatePayable(id: string, data: PayableInput) {
    try {
        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid payable date is required' };

        const dueDate = normalizeDate(data.dueDate);
        if (!dueDate) return { error: 'Valid due date is required' };

        const amount = parsePositiveAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        const vendorId = normalizeText(data.vendorId);
        if (!vendorId) return { error: 'Vendor is required' };

        const paymentAmount = parseNonNegative(data.paymentAmount);
        if (paymentAmount === null) return { error: 'Payment amount must be zero or positive' };

        const settlementAccountId = normalizeText(data.settlementAccountId);
        if (paymentAmount > 0 && !settlementAccountId) {
            return { error: 'Settlement account is required when recording payment' };
        }

        const payable = await prisma.payable.findUnique({ where: { id } });
        if (!payable) return { error: 'Payable record not found' };

        await prisma.$transaction(async (tx) => {
            const oldVendorId = payable.vendorId;
            const oldAmount = payable.amount;
            const oldPaidAmount = payable.paidAmount || 0;
            const oldRemaining = remainingAmount(oldAmount, oldPaidAmount);

            const newPaidAmount = oldPaidAmount + paymentAmount;

            const newRemaining = remainingAmount(amount, newPaidAmount);
            const status = deriveStatus(amount, newPaidAmount);

            if (oldVendorId === vendorId) {
                const delta = newRemaining - oldRemaining;
                if (delta !== 0) {
                    await tx.vendor.update({
                        where: { id: vendorId },
                        data: { balance: { increment: delta } }
                    });
                }
            } else {
                await tx.vendor.update({
                    where: { id: oldVendorId },
                    data: { balance: { decrement: oldRemaining } }
                });
                await tx.vendor.update({
                    where: { id: vendorId },
                    data: { balance: { increment: newRemaining } }
                });
            }

            if (paymentAmount > 0 && settlementAccountId) {
                await tx.transaction.create({
                    data: {
                        date,
                        amount: paymentAmount,
                        type: 'expense',
                        category: 'Payable Settlement',
                        businessId: data.businessId,
                        accountId: settlementAccountId,
                        vendorId,
                        description: `Settlement against payable #${id}`,
                        referenceId: id,
                        referenceModel: 'Payable',
                    }
                });

                await tx.account.update({
                    where: { id: settlementAccountId },
                    data: { balance: { decrement: paymentAmount } }
                });
            }

            await tx.payable.update({
                where: { id },
                data: {
                    date,
                    dueDate,
                    amount,
                    paidAmount: newPaidAmount,
                    status,
                    businessId: data.businessId,
                    vendorId,
                    description: normalizeText(data.description) || null,
                }
            });
        });

        revalidatePayableViews();
        return { success: true };
    } catch (error) {
        console.error('Update payable error:', error);
        return { error: 'Failed to update payable' };
    }
}

export async function deletePayable(id: string) {
    try {
        const payable = await prisma.payable.findUnique({ where: { id } });
        if (!payable) return { error: 'Payable record not found' };

        const outstanding = remainingAmount(payable.amount, payable.paidAmount || 0);

        await prisma.$transaction(async (tx) => {
            if (outstanding !== 0) {
                await tx.vendor.update({
                    where: { id: payable.vendorId },
                    data: { balance: { decrement: outstanding } }
                });
            }

            await tx.payable.delete({ where: { id } });
        });

        revalidatePayableViews();
        return { success: true };
    } catch (error) {
        console.error('Delete payable error:', error);
        return { error: 'Failed to delete payable' };
    }
}
