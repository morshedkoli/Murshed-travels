'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export async function getCustomers() {
    try {
        const customers = await prisma.customer.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return customers.map((customer) => ({
            _id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: customer.address,
            passportNumber: customer.passportNumber,
            nationality: customer.nationality,
            balance: customer.balance,
            createdAt: customer.createdAt.toISOString(),
        }));
    } catch (error) {
        console.error('Error fetching customers:', error);
        return [];
    }
}

export async function createCustomer(data: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    passportNumber?: string;
    nationality?: string;
}) {
    try {
        if (!data.name || !data.phone) {
            return { error: 'Name and phone are required' };
        }

        const existing = await prisma.customer.findUnique({
            where: { phone: data.phone }
        });

        if (existing) {
            return { error: 'A customer with this phone already exists' };
        }

        const customer = await prisma.customer.create({
            data: {
                name: data.name,
                phone: data.phone,
                email: data.email || null,
                address: data.address || null,
                passportNumber: data.passportNumber || null,
                nationality: data.nationality || null,
            }
        });

        revalidatePath('/customers');

        return {
            success: true,
            customer: {
                _id: customer.id,
                name: customer.name,
                phone: customer.phone,
            },
        };
    } catch (error) {
        console.error('Create customer error:', error);
        return { error: 'Failed to create customer' };
    }
}

export async function getCustomerById(id: string) {
    try {
        const customer = await prisma.customer.findUnique({
            where: { id }
        });

        if (!customer) return null;

        return {
            _id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: customer.address,
            passportNumber: customer.passportNumber,
            nationality: customer.nationality,
            balance: customer.balance,
            createdAt: customer.createdAt.toISOString(),
        };
    } catch (error) {
        return null;
    }
}

export async function getCustomerLedger(customerId: string) {
    try {
        const [receivablesResult, servicesResult] = await Promise.all([
            prisma.receivable.findMany({
                where: { customerId },
                orderBy: { date: 'desc' }
            }),
            prisma.service.findMany({
                where: { customerId, status: 'delivered' },
                orderBy: { deliveryDate: 'desc' }
            })
        ]);

        const receivableRows = receivablesResult.map((row) => {
            const paidAmount = row.paidAmount ?? 0;
            const dueAmount = Math.max(0, row.amount - paidAmount);
            return {
                _id: row.id,
                date: row.date.toISOString(),
                dueDate: row.dueDate ? row.dueDate.toISOString() : '',
                amount: row.amount,
                paidAmount,
                dueAmount,
                status: row.status,
                description: row.description || '',
            };
        });

        const deliveredRows = servicesResult.map((row) => ({
            _id: row.id,
            name: row.name,
            date: row.deliveryDate ? row.deliveryDate.toISOString() : row.createdAt.toISOString(),
            price: row.price,
            cost: row.cost ?? 0,
            profit: row.profit ?? 0,
        }));

        return {
            receivables: receivableRows,
            deliveredServices: deliveredRows,
            totalBilled: deliveredRows.reduce((sum: number, row: { price: number }) => sum + row.price, 0),
            totalPaid: receivableRows.reduce((sum: number, row: { paidAmount: number }) => sum + row.paidAmount, 0),
            totalDue: receivableRows.reduce((sum: number, row: { dueAmount: number }) => sum + row.dueAmount, 0),
        };
    } catch (error) {
        return { receivables: [], deliveredServices: [], totalBilled: 0, totalPaid: 0, totalDue: 0 };
    }
}

export async function getCustomerTransactionHistory(customerId: string) {
    try {
        const rows = await prisma.transaction.findMany({
            where: { customerId },
            include: { account: true },
            orderBy: { date: 'desc' }
        });

        return rows.map((row) => ({
            _id: row.id,
            date: row.date.toISOString(),
            amount: row.amount,
            type: row.type,
            category: row.category,
            accountName: row.account?.name || 'Unknown Account',
            description: row.description || '',
        }));
    } catch (error) {
        console.error('Error fetching customer transactions:', error);
        return [];
    }
}

function parsePositiveAmount(value: number) {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Number(value);
}

function parseNonNegativeAmount(value?: number) {
    if (value === undefined) return 0;
    if (!Number.isFinite(value) || value < 0) return null;
    return Number(value);
}

function normalizeDate(value?: string) {
    if (!value) return new Date();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

export async function recordCustomerPayment(data: {
    customerId: string;
    accountId: string;
    amount: number;
    discountAmount?: number;
    extraChargeAmount?: number;
    date?: string;
    note?: string;
}) {
    try {
        const amount = parsePositiveAmount(data.amount);
        if (!amount) {
            return { error: 'Payment amount must be greater than 0' };
        }

        const discountAmount = parseNonNegativeAmount(data.discountAmount);
        if (discountAmount === null) {
            return { error: 'Discount amount must be 0 or greater' };
        }

        const extraChargeAmount = parseNonNegativeAmount(data.extraChargeAmount);
        if (extraChargeAmount === null) {
            return { error: 'Extra charge amount must be 0 or greater' };
        }

        const date = normalizeDate(data.date);
        if (!date) {
            return { error: 'Invalid payment date' };
        }

        const customerId = data.customerId?.trim();
        if (!customerId) {
            return { error: 'Customer is required' };
        }

        const accountId = data.accountId?.trim();
        if (!accountId) {
            return { error: 'Settlement account is required' };
        }

        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) {
            return { error: 'Customer not found', appliedTotal: 0, settledAmount: 0, advanceAmount: 0 };
        }

        const account = await prisma.account.findUnique({ where: { id: accountId } });
        if (!account) {
            return { error: 'Settlement account not found', appliedTotal: 0, settledAmount: 0, advanceAmount: 0 };
        }

        const receivables = await prisma.receivable.findMany({
            where: { customerId, status: { not: 'paid' } },
            orderBy: { dueDate: 'asc' }
        });

        const workingReceivables = receivables.map((item) => ({
            ...item,
            amount: item.amount ?? 0,
            paidAmount: item.paidAmount ?? 0,
            status: item.status,
        }));

        let remainingPayment = amount;
        let settledAmount = 0;
        let discountedAmount = 0;
        const transactionsToCreate = [];

        for (const receivable of workingReceivables) {
            if (remainingPayment <= 0) break;
            const dueAmount = Math.max(0, receivable.amount - (receivable.paidAmount ?? 0));
            if (dueAmount <= 0) continue;

            const settled = Math.min(dueAmount, remainingPayment);
            const nextPaid = (receivable.paidAmount ?? 0) + settled;
            const newStatus = nextPaid >= receivable.amount ? 'paid' : 'partial';

            receivable.paidAmount = nextPaid;
            receivable.status = newStatus;

            transactionsToCreate.push({
                date,
                amount: settled,
                type: 'income',
                category: 'Receivable Collection',
                businessId: receivable.businessId || 'travel',
                accountId,
                customerId,
                description: data.note?.trim() || `Customer payment against receivable #${receivable.id}`,
                referenceId: receivable.id,
                referenceModel: 'Receivable',
            });

            remainingPayment -= settled;
            settledAmount += settled;
        }

        let remainingDiscount = discountAmount;
        for (const receivable of workingReceivables) {
            if (remainingDiscount <= 0) break;
            const dueAmount = Math.max(0, receivable.amount - (receivable.paidAmount ?? 0));
            if (dueAmount <= 0) continue;

            const appliedDiscount = Math.min(dueAmount, remainingDiscount);
            receivable.amount = receivable.amount - appliedDiscount;
            const nextDueAmount = Math.max(0, receivable.amount - (receivable.paidAmount ?? 0));
            receivable.status = nextDueAmount <= 0 ? 'paid' : 'partial';

            remainingDiscount -= appliedDiscount;
            discountedAmount += appliedDiscount;
        }

        if (remainingDiscount > 0) {
            return { error: 'Discount amount exceeds total customer due' };
        }

        const advanceAmount = Math.max(0, remainingPayment);

        if (advanceAmount > 0) {
            transactionsToCreate.push({
                date,
                amount: advanceAmount,
                type: 'income',
                category: 'Customer Advance',
                businessId: 'travel',
                accountId,
                customerId,
                description: data.note?.trim() || 'Advance payment received from customer',
            });
        }

        const appliedTotal = settledAmount + advanceAmount;

        // Perform updates in a transaction
        await prisma.$transaction(async (tx) => {
            // Update receivables
            for (const receivable of workingReceivables) {
                await tx.receivable.update({
                    where: { id: receivable.id },
                    data: {
                        amount: receivable.amount,
                        paidAmount: receivable.paidAmount,
                        status: receivable.status,
                    }
                });
            }

            if (extraChargeAmount > 0) {
                const chargeDueDate = new Date(date);
                chargeDueDate.setDate(chargeDueDate.getDate() + 7);
                await tx.receivable.create({
                    data: {
                        businessId: 'travel',
                        customerId,
                        amount: extraChargeAmount,
                        paidAmount: 0,
                        date,
                        dueDate: chargeDueDate,
                        status: 'unpaid',
                        description: data.note?.trim() || 'Extra charge applied during payment',
                    }
                });
            }

            // Create transactions
            if (transactionsToCreate.length > 0) {
                await tx.transaction.createMany({
                    data: transactionsToCreate
                });
            }

            // Update account balance
            await tx.account.update({
                where: { id: accountId },
                data: { balance: { increment: appliedTotal } }
            });

            // Update customer balance
            await tx.customer.update({
                where: { id: customerId },
                data: { balance: { increment: extraChargeAmount - appliedTotal - discountedAmount } }
            });
        });

        const ledger = await getCustomerLedger(data.customerId);

        revalidatePath('/customers');
        revalidatePath(`/customers/${data.customerId}`);
        revalidatePath('/receivable');
        revalidatePath('/dashboard');
        revalidatePath('/services');

        return {
            success: true,
            appliedAmount: appliedTotal,
            settledAmount,
            discountedAmount,
            extraChargeAmount,
            advanceAmount,
            totalDue: ledger.totalDue,
        };
    } catch (error) {
        console.error('Record customer payment error:', error);
        return { error: 'Failed to record customer payment' };
    }
}
