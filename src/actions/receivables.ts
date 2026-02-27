'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

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
    try {
        const receivables = await prisma.receivable.findMany({
            include: { customer: { select: { name: true } } },
            orderBy: { dueDate: 'asc' }
        });

        return receivables.map((item) => ({
            _id: item.id,
            date: item.date.toISOString(),
            dueDate: item.dueDate ? item.dueDate.toISOString() : '',
            amount: item.amount,
            paidAmount: item.paidAmount || 0,
            remainingAmount: remainingAmount(item.amount, item.paidAmount || 0),
            businessId: (item.businessId as BusinessType) || 'travel',
            customerId: item.customerId || '',
            customerName: item.customer?.name || 'Unknown Customer',
            status: item.status,
            description: item.description || '',
        }));
    } catch (error) {
        console.error('Error fetching receivables:', error);
        return [];
    }
}

export async function getReceivableSettlementHistory(receivableId: string) {
    try {
        const payments = await prisma.transaction.findMany({
            where: {
                referenceId: receivableId,
                referenceModel: 'Receivable',
                type: 'income',
                category: 'Receivable Collection'
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
        console.error('Error fetching receivable settlement history:', error);
        return [];
    }
}

export async function createReceivable(data: ReceivableInput) {
    try {
        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid receivable date is required' };

        const dueDate = normalizeDate(data.dueDate);
        if (!dueDate) return { error: 'Valid due date is required' };

        const amount = parsePositiveAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        const customerId = normalizeText(data.customerId);
        if (!customerId) return { error: 'Customer is required' };

        await prisma.$transaction(async (tx) => {
            await tx.receivable.create({
                data: {
                    date,
                    dueDate,
                    amount,
                    paidAmount: 0,
                    customerId,
                    businessId: data.businessId,
                    status: 'unpaid',
                    description: normalizeText(data.description) || null,
                }
            });

            await tx.customer.update({
                where: { id: customerId },
                data: { balance: { increment: amount } }
            });
        });

        revalidateReceivableViews();
        return { success: true };
    } catch (error) {
        console.error('Create receivable error:', error);
        return { error: 'Failed to create receivable' };
    }
}

export async function updateReceivable(id: string, data: ReceivableInput) {
    try {
        const date = normalizeDate(data.date);
        if (!date) return { error: 'Valid receivable date is required' };

        const dueDate = normalizeDate(data.dueDate);
        if (!dueDate) return { error: 'Valid due date is required' };

        const amount = parsePositiveAmount(data.amount);
        if (!amount) return { error: 'Amount must be greater than 0' };

        const customerId = normalizeText(data.customerId);
        if (!customerId) return { error: 'Customer is required' };

        const paymentAmount = parseNonNegative(data.paymentAmount);
        if (paymentAmount === null) return { error: 'Payment amount must be zero or positive' };

        const settlementAccountId = normalizeText(data.settlementAccountId);
        if (paymentAmount > 0 && !settlementAccountId) {
            return { error: 'Settlement account is required when recording payment' };
        }

        const receivable = await prisma.receivable.findUnique({ where: { id } });
        if (!receivable) return { error: 'Receivable record not found' };

        await prisma.$transaction(async (tx) => {
            const oldCustomerId = receivable.customerId;
            const oldAmount = receivable.amount;
            const oldPaidAmount = receivable.paidAmount || 0;
            const oldRemaining = remainingAmount(oldAmount, oldPaidAmount);

            const newPaidAmount = oldPaidAmount + paymentAmount;

            const newRemaining = remainingAmount(amount, newPaidAmount);
            const status = deriveStatus(amount, newPaidAmount);

            if (oldCustomerId === customerId) {
                const delta = newRemaining - oldRemaining;
                if (delta !== 0) {
                    await tx.customer.update({
                        where: { id: customerId },
                        data: { balance: { increment: delta } }
                    });
                }
            } else {
                await tx.customer.update({
                    where: { id: oldCustomerId },
                    data: { balance: { decrement: oldRemaining } }
                });
                await tx.customer.update({
                    where: { id: customerId },
                    data: { balance: { increment: newRemaining } }
                });
            }

            if (paymentAmount > 0 && settlementAccountId) {
                await tx.transaction.create({
                    data: {
                        date,
                        amount: paymentAmount,
                        type: 'income',
                        category: 'Receivable Collection',
                        businessId: data.businessId,
                        accountId: settlementAccountId,
                        customerId,
                        description: `Settlement against receivable #${id}`,
                        referenceId: id,
                        referenceModel: 'Receivable',
                    }
                });

                await tx.account.update({
                    where: { id: settlementAccountId },
                    data: { balance: { increment: paymentAmount } }
                });
            }

            await tx.receivable.update({
                where: { id },
                data: {
                    date,
                    dueDate,
                    amount,
                    paidAmount: newPaidAmount,
                    status,
                    businessId: data.businessId,
                    customerId,
                    description: normalizeText(data.description) || null,
                }
            });
        });

        revalidateReceivableViews();
        return { success: true };
    } catch (error) {
        console.error('Update receivable error:', error);
        return { error: 'Failed to update receivable' };
    }
}

export async function collectReceivablePayment(data: {
    receivableId: string;
    amount: number;
    discountAmount?: number;
    extraChargeAmount?: number;
    settlementAccountId: string;
    date?: string;
    note?: string;
}) {
    try {
        const receivableId = normalizeText(data.receivableId);
        if (!receivableId) return { error: 'Receivable is required' };

        const amount = parsePositiveAmount(data.amount);
        if (!amount) return { error: 'Payment amount must be greater than 0' };

        const discountAmount = parseNonNegative(data.discountAmount);
        if (discountAmount === null) return { error: 'Discount amount must be 0 or greater' };

        const extraChargeAmount = parseNonNegative(data.extraChargeAmount);
        if (extraChargeAmount === null) return { error: 'Extra charge amount must be 0 or greater' };

        const settlementAccountId = normalizeText(data.settlementAccountId);
        if (!settlementAccountId) return { error: 'Settlement account is required' };

        const date = data.date ? normalizeDate(data.date) : new Date();
        if (!date) return { error: 'Valid payment date is required' };

        const receivable = await prisma.receivable.findUnique({ where: { id: receivableId } });
        if (!receivable) return { error: 'Receivable record not found' };

        await prisma.$transaction(async (tx) => {
            const adjustedAmount = (receivable.amount || 0) + extraChargeAmount - discountAmount;
            if (adjustedAmount < 0) throw new Error('Discount cannot make receivable total negative');

            const currentRemaining = remainingAmount(adjustedAmount, receivable.paidAmount || 0);
            if (currentRemaining <= 0) throw new Error('This receivable is already fully paid');

            const nextPaidAmount = (receivable.paidAmount || 0) + amount;
            const status = deriveStatus(adjustedAmount, nextPaidAmount);

            await tx.receivable.update({
                where: { id: receivableId },
                data: {
                    amount: adjustedAmount,
                    paidAmount: nextPaidAmount,
                    status,
                }
            });

            await tx.transaction.create({
                data: {
                    date,
                    amount,
                    type: 'income',
                    category: 'Receivable Collection',
                    businessId: receivable.businessId || 'travel',
                    accountId: settlementAccountId,
                    customerId: receivable.customerId,
                    description: normalizeText(data.note) || `Settlement against receivable #${receivableId}`,
                    referenceId: receivableId,
                    referenceModel: 'Receivable',
                }
            });

            await tx.account.update({
                where: { id: settlementAccountId },
                data: { balance: { increment: amount } }
            });

            await tx.customer.update({
                where: { id: receivable.customerId },
                data: { balance: { increment: extraChargeAmount - amount - discountAmount } }
            });
        });

        revalidateReceivableViews();
        revalidatePath(`/customers/${receivable.customerId}`);

        return { success: true };
    } catch (error) {
        console.error('Collect receivable payment error:', error);
        return { error: 'Failed to collect receivable payment' };
    }
}

export async function deleteReceivable(id: string) {
    try {
        const receivable = await prisma.receivable.findUnique({ where: { id } });
        if (!receivable) return { error: 'Receivable record not found' };

        const outstanding = remainingAmount(receivable.amount, receivable.paidAmount || 0);

        await prisma.$transaction(async (tx) => {
            if (outstanding !== 0) {
                await tx.customer.update({
                    where: { id: receivable.customerId },
                    data: { balance: { decrement: outstanding } }
                });
            }

            await tx.receivable.delete({ where: { id } });
        });

        revalidateReceivableViews();
        return { success: true };
    } catch (error) {
        console.error('Delete receivable error:', error);
        return { error: 'Failed to delete receivable' };
    }
}
