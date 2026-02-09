'use server';

import mongoose from 'mongoose';
import { revalidatePath } from 'next/cache';
import Account from '@/models/Account';
import connect from '@/lib/db';
import Customer from '@/models/Customer';
import Receivable from '@/models/Receivable';
import Service from '@/models/Service';
import Transaction from '@/models/Transaction';

export async function getCustomers() {
    await connect();
    const customers = await Customer.find({}).sort({ createdAt: -1 });

    return customers.map((customer) => ({
        _id: customer._id.toString(),
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        passportNumber: customer.passportNumber,
        nationality: customer.nationality,
        balance: customer.balance,
        createdAt: customer.createdAt.toISOString(),
    }));
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
        await connect();

        if (!data.name || !data.phone) {
            return { error: 'Name and phone are required' };
        }

        const existing = await Customer.findOne({ phone: data.phone });
        if (existing) {
            return { error: 'A customer with this phone already exists' };
        }

        const customer = await Customer.create({
            name: data.name,
            phone: data.phone,
            email: data.email,
            address: data.address,
            passportNumber: data.passportNumber,
            nationality: data.nationality,
        });

        revalidatePath('/customers');

        return {
            success: true,
            customer: {
                _id: customer._id.toString(),
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
    await connect();
    const customer = await Customer.findById(id);

    if (!customer) return null;

    return {
        _id: customer._id.toString(),
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        passportNumber: customer.passportNumber,
        nationality: customer.nationality,
        balance: customer.balance,
        createdAt: customer.createdAt.toISOString(),
    };
}

export async function getCustomerLedger(customerId: string) {
    await connect();

    const [receivables, deliveredServices] = await Promise.all([
        Receivable.find({ customerId }).sort({ date: -1, createdAt: -1 }),
        Service.find({ customerId, status: 'delivered' }).sort({ deliveryDate: -1, createdAt: -1 }),
    ]);

    const receivableRows = receivables.map((row) => {
        const paidAmount = row.paidAmount ?? 0;
        const dueAmount = Math.max(0, row.amount - paidAmount);
        return {
            _id: row._id.toString(),
            date: row.date.toISOString(),
            dueDate: row.dueDate?.toISOString() ?? '',
            amount: row.amount,
            paidAmount,
            dueAmount,
            status: row.status,
            description: row.description ?? '',
        };
    });

    const deliveredRows = deliveredServices.map((row) => ({
        _id: row._id.toString(),
        name: row.name,
        date: row.deliveryDate?.toISOString() ?? row.createdAt.toISOString(),
        price: row.price,
        cost: row.cost ?? 0,
        profit: row.profit ?? 0,
    }));

    return {
        receivables: receivableRows,
        deliveredServices: deliveredRows,
        totalBilled: deliveredRows.reduce((sum, row) => sum + row.price, 0),
        totalPaid: receivableRows.reduce((sum, row) => sum + row.paidAmount, 0),
        totalDue: receivableRows.reduce((sum, row) => sum + row.dueAmount, 0),
    };
}

export async function getCustomerTransactionHistory(customerId: string) {
    await connect();

    const rows = await Transaction.find({ customerId })
        .sort({ date: -1, createdAt: -1 })
        .populate('accountId', 'name');

    return rows.map((row) => ({
        _id: row._id.toString(),
        date: row.date.toISOString(),
        amount: row.amount,
        type: row.type,
        category: row.category,
        accountName: row.accountId?.name ?? 'Unknown Account',
        description: row.description ?? '',
    }));
}

function parsePositiveAmount(value: number) {
    if (!Number.isFinite(value) || value <= 0) return null;
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
    date?: string;
    note?: string;
}) {
    const session = await mongoose.startSession();
    try {
        await connect();

        const amount = parsePositiveAmount(data.amount);
        if (!amount) {
            return { error: 'Payment amount must be greater than 0' };
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

        const runPayment = async (activeSession?: mongoose.ClientSession) => {
            const customerQuery = Customer.findById(customerId);
            if (activeSession) customerQuery.session(activeSession);
            const customer = await customerQuery;
            if (!customer) {
                return { error: 'Customer not found', appliedTotal: 0, settledAmount: 0, advanceAmount: 0 };
            }

            const accountQuery = Account.findById(accountId);
            if (activeSession) accountQuery.session(activeSession);
            const account = await accountQuery;
            if (!account) {
                return { error: 'Settlement account not found', appliedTotal: 0, settledAmount: 0, advanceAmount: 0 };
            }

            const receivableQuery = Receivable.find({ customerId, status: { $ne: 'paid' } }).sort({ dueDate: 1, date: 1, createdAt: 1 });
            if (activeSession) receivableQuery.session(activeSession);
            const receivables = await receivableQuery;

            let remainingPayment = amount;
            let settledAmount = 0;

            for (const receivable of receivables) {
                if (remainingPayment <= 0) break;
                const dueAmount = Math.max(0, receivable.amount - (receivable.paidAmount ?? 0));
                if (dueAmount <= 0) continue;

                const settled = Math.min(dueAmount, remainingPayment);
                const nextPaid = (receivable.paidAmount ?? 0) + settled;

                receivable.paidAmount = nextPaid;
                receivable.status = nextPaid >= receivable.amount ? 'paid' : 'partial';
                if (activeSession) {
                    await receivable.save({ session: activeSession });
                } else {
                    await receivable.save();
                }

                const txnPayload = {
                    date,
                    amount: settled,
                    type: 'income' as const,
                    category: 'Receivable Collection',
                    businessId: receivable.businessId ?? 'travel',
                    accountId,
                    customerId,
                    description: data.note?.trim() || `Customer payment against receivable #${receivable._id.toString()}`,
                    referenceId: receivable._id,
                    referenceModel: 'Receivable',
                };

                if (activeSession) {
                    await Transaction.create([txnPayload], { session: activeSession });
                } else {
                    await Transaction.create(txnPayload);
                }

                remainingPayment -= settled;
                settledAmount += settled;
            }

            const advanceAmount = Math.max(0, remainingPayment);

            if (advanceAmount > 0) {
                const advanceTxnPayload = {
                    date,
                    amount: advanceAmount,
                    type: 'income' as const,
                    category: 'Customer Advance',
                    businessId: 'travel',
                    accountId,
                    customerId,
                    description: data.note?.trim() || 'Advance payment received from customer',
                };

                if (activeSession) {
                    await Transaction.create([advanceTxnPayload], { session: activeSession });
                } else {
                    await Transaction.create(advanceTxnPayload);
                }
            }

            const appliedTotal = settledAmount + advanceAmount;

            if (activeSession) {
                await Account.findByIdAndUpdate(accountId, { $inc: { balance: appliedTotal } }, { session: activeSession });
                await Customer.findByIdAndUpdate(customerId, { $inc: { balance: -appliedTotal } }, { session: activeSession });
            } else {
                await Account.findByIdAndUpdate(accountId, { $inc: { balance: appliedTotal } });
                await Customer.findByIdAndUpdate(customerId, { $inc: { balance: -appliedTotal } });
            }

            return { appliedTotal, settledAmount, advanceAmount };
        };

        let appliedTotal = 0;
        let settledAmount = 0;
        let advanceAmount = 0;

        try {
            await session.withTransaction(async () => {
                const result = await runPayment(session);
                if (result.error) {
                    throw new Error(result.error);
                }
                appliedTotal = result.appliedTotal;
                settledAmount = result.settledAmount;
                advanceAmount = result.advanceAmount;
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : '';
            const transactionsUnsupported = message.includes('Transaction numbers are only allowed on a replica set member or mongos');

            if (!transactionsUnsupported) {
                return { error: message || 'Failed to record customer payment' };
            }

            const fallbackResult = await runPayment();
            if (fallbackResult.error) {
                return { error: fallbackResult.error };
            }
            appliedTotal = fallbackResult.appliedTotal;
            settledAmount = fallbackResult.settledAmount;
            advanceAmount = fallbackResult.advanceAmount;
        }

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
            advanceAmount,
            totalDue: ledger.totalDue,
        };
    } catch (error) {
        console.error('Record customer payment error:', error);
        return { error: 'Failed to record customer payment' };
    } finally {
        await session.endSession();
    }
}
