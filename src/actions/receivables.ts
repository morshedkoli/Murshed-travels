'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';

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
    const { data: receivables, error } = await supabase
        .from('receivables')
        .select(`
            *,
            customers:customer_id (name)
        `)
        .order('due_date', { ascending: true });

    if (error) {
        console.error('Error fetching receivables:', error);
        return [];
    }

    return (receivables || []).map((item) => ({
        _id: item.id,
        date: item.date,
        dueDate: item.due_date || '',
        amount: item.amount,
        paidAmount: item.paid_amount || 0,
        remainingAmount: remainingAmount(item.amount, item.paid_amount || 0),
        businessId: (item.business_id as BusinessType) || 'travel',
        customerId: item.customer_id || '',
        customerName: item.customers?.name || 'Unknown Customer',
        status: item.status,
        description: item.description || '',
    }));
}

export async function getReceivableSettlementHistory(receivableId: string) {
    const { data: payments, error } = await supabase
        .from('transactions')
        .select(`
            *,
            accounts:account_id (name)
        `)
        .eq('reference_id', receivableId)
        .eq('reference_model', 'Receivable')
        .eq('type', 'income')
        .eq('category', 'Receivable Collection')
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching receivable settlement history:', error);
        return [];
    }

    return (payments || []).map((item) => ({
        _id: item.id,
        date: item.date,
        amount: item.amount,
        accountName: item.accounts?.name || 'Unknown Account',
        description: item.description || '',
    }));
}

export async function createReceivable(data: ReceivableInput) {
    try {
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

        // Verify customer exists
        const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single();

        if (!customer) {
            return { error: 'Selected customer does not exist' };
        }

        // Create receivable
        const { error: receivableError } = await supabase
            .from('receivables')
            .insert({
                date: date.toISOString(),
                due_date: dueDate.toISOString(),
                amount,
                paid_amount: 0,
                customer_id: customerId,
                business_id: data.businessId,
                status: 'unpaid',
                description: normalizeText(data.description) || null,
            });

        if (receivableError) {
            console.error('Create receivable error:', receivableError);
            return { error: 'Failed to create receivable' };
        }

        // Update customer balance
        await supabase
            .from('customers')
            .update({ balance: customer.balance + amount })
            .eq('id', customerId);

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

        // Fetch existing receivable
        const { data: receivable } = await supabase
            .from('receivables')
            .select('*')
            .eq('id', id)
            .single();

        if (!receivable) {
            return { error: 'Receivable record not found' };
        }

        // Verify customer exists
        const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single();

        if (!customer) {
            return { error: 'Selected customer does not exist' };
        }

        // Verify settlement account if payment is being made
        if (paymentAmount > 0 && settlementAccountId) {
            const { data: account } = await supabase
                .from('accounts')
                .select('*')
                .eq('id', settlementAccountId)
                .single();

            if (!account) {
                return { error: 'Selected settlement account does not exist' };
            }
        }

        const oldCustomerId = receivable.customer_id;
        const oldAmount = receivable.amount;
        const oldPaidAmount = receivable.paid_amount || 0;
        const oldRemaining = remainingAmount(oldAmount, oldPaidAmount);

        const newPaidAmount = oldPaidAmount + paymentAmount;
        if (newPaidAmount > amount) {
            return { error: 'Payment amount cannot exceed remaining receivable' };
        }

        const newRemaining = remainingAmount(amount, newPaidAmount);
        const status = deriveStatus(amount, newPaidAmount);

        // Handle customer balance updates
        if (oldCustomerId === customerId) {
            const delta = newRemaining - oldRemaining;
            if (delta !== 0) {
                await supabase
                    .from('customers')
                    .update({ balance: customer.balance + delta })
                    .eq('id', customerId);
            }
        } else {
            // Restore old customer balance
            const { data: oldCustomer } = await supabase
                .from('customers')
                .select('*')
                .eq('id', oldCustomerId)
                .single();

            if (oldCustomer) {
                await supabase
                    .from('customers')
                    .update({ balance: oldCustomer.balance - oldRemaining })
                    .eq('id', oldCustomerId);
            }

            // Update new customer balance
            await supabase
                .from('customers')
                .update({ balance: customer.balance + newRemaining })
                .eq('id', customerId);
        }

        // Record payment transaction if applicable
        if (paymentAmount > 0 && settlementAccountId) {
            await supabase
                .from('transactions')
                .insert({
                    date: date.toISOString(),
                    amount: paymentAmount,
                    type: 'income',
                    category: 'Receivable Collection',
                    business_id: data.businessId,
                    account_id: settlementAccountId,
                    customer_id: customerId,
                    description: `Settlement against receivable #${id}`,
                    reference_id: id,
                    reference_model: 'Receivable',
                });

            // Update account balance
            const { data: account } = await supabase
                .from('accounts')
                .select('*')
                .eq('id', settlementAccountId)
                .single();

            if (account) {
                await supabase
                    .from('accounts')
                    .update({ balance: account.balance + paymentAmount })
                    .eq('id', settlementAccountId);
            }
        }

        // Update receivable
        const { error } = await supabase
            .from('receivables')
            .update({
                date: date.toISOString(),
                due_date: dueDate.toISOString(),
                amount,
                paid_amount: newPaidAmount,
                status,
                business_id: data.businessId,
                customer_id: customerId,
                description: normalizeText(data.description) || null,
            })
            .eq('id', id);

        if (error) {
            console.error('Update receivable error:', error);
            return { error: 'Failed to update receivable' };
        }

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

        // Fetch receivable
        const { data: receivable } = await supabase
            .from('receivables')
            .select('*')
            .eq('id', receivableId)
            .single();

        if (!receivable) {
            return { error: 'Receivable record not found' };
        }

        // Fetch account
        const { data: account } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', settlementAccountId)
            .single();

        if (!account) {
            return { error: 'Selected settlement account does not exist' };
        }

        // Fetch customer
        const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('id', receivable.customer_id)
            .single();

        if (!customer) {
            return { error: 'Customer record not found' };
        }

        const adjustedAmount = (receivable.amount || 0) + extraChargeAmount - discountAmount;
        if (adjustedAmount < 0) {
            return { error: 'Discount cannot make receivable total negative' };
        }

        const currentRemaining = remainingAmount(adjustedAmount, receivable.paid_amount || 0);
        if (currentRemaining <= 0) {
            return { error: 'This receivable is already fully paid' };
        }

        if (amount > currentRemaining) {
            return { error: 'Payment amount cannot exceed remaining due' };
        }

        const nextPaidAmount = (receivable.paid_amount || 0) + amount;
        const status = deriveStatus(adjustedAmount, nextPaidAmount);

        // Update receivable
        await supabase
            .from('receivables')
            .update({
                amount: adjustedAmount,
                paid_amount: nextPaidAmount,
                status,
            })
            .eq('id', receivableId);

        // Create transaction
        await supabase
            .from('transactions')
            .insert({
                date: date.toISOString(),
                amount,
                type: 'income',
                category: 'Receivable Collection',
                business_id: receivable.business_id || 'travel',
                account_id: settlementAccountId,
                customer_id: receivable.customer_id,
                description: normalizeText(data.note) || `Settlement against receivable #${receivableId}`,
                reference_id: receivableId,
                reference_model: 'Receivable',
            });

        // Update account balance
        await supabase
            .from('accounts')
            .update({ balance: account.balance + amount })
            .eq('id', settlementAccountId);

        // Update customer balance
        await supabase
            .from('customers')
            .update({ balance: customer.balance - amount - discountAmount + extraChargeAmount })
            .eq('id', receivable.customer_id);

        const remaining = remainingAmount(adjustedAmount, nextPaidAmount);

        revalidateReceivableViews();
        if (receivable.customer_id) {
            revalidatePath(`/customers/${receivable.customer_id}`);
        }

        return {
            success: true,
            remaining,
        };
    } catch (error) {
        console.error('Collect receivable payment error:', error);
        return { error: 'Failed to collect receivable payment' };
    }
}

export async function deleteReceivable(id: string) {
    try {
        // Fetch existing receivable
        const { data: receivable } = await supabase
            .from('receivables')
            .select('*')
            .eq('id', id)
            .single();

        if (!receivable) {
            return { error: 'Receivable record not found' };
        }

        const customerId = receivable.customer_id;
        const outstanding = remainingAmount(receivable.amount, receivable.paid_amount || 0);

        // Update customer balance
        if (outstanding !== 0) {
            const { data: customer } = await supabase
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();

            if (customer) {
                await supabase
                    .from('customers')
                    .update({ balance: customer.balance - outstanding })
                    .eq('id', customerId);
            }
        }

        // Delete receivable
        const { error } = await supabase
            .from('receivables')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Delete receivable error:', error);
            return { error: 'Failed to delete receivable' };
        }

        revalidateReceivableViews();
        return { success: true };
    } catch (error) {
        console.error('Delete receivable error:', error);
        return { error: 'Failed to delete receivable' };
    }
}
