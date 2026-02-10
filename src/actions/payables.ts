'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';

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
    const { data: payables, error } = await supabase
        .from('payables')
        .select(`
            *,
            vendors:vendor_id (name)
        `)
        .order('due_date', { ascending: true });

    if (error) {
        console.error('Error fetching payables:', error);
        return [];
    }

    return (payables || []).map((item) => ({
        _id: item.id,
        date: item.date,
        dueDate: item.due_date || '',
        amount: item.amount,
        paidAmount: item.paid_amount || 0,
        remainingAmount: remainingAmount(item.amount, item.paid_amount || 0),
        businessId: (item.business_id as BusinessType) || 'travel',
        vendorId: item.vendor_id || '',
        vendorName: item.vendors?.name || 'Unknown Vendor',
        status: item.status,
        description: item.description || '',
    }));
}

export async function getPayableSettlementHistory(payableId: string) {
    const { data: payments, error } = await supabase
        .from('transactions')
        .select(`
            *,
            accounts:account_id (name)
        `)
        .eq('reference_id', payableId)
        .eq('reference_model', 'Payable')
        .eq('type', 'expense')
        .eq('category', 'Payable Settlement')
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching payable settlement history:', error);
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

export async function createPayable(data: PayableInput) {
    try {
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

        // Verify vendor exists
        const { data: vendor } = await supabase
            .from('vendors')
            .select('*')
            .eq('id', vendorId)
            .single();

        if (!vendor) {
            return { error: 'Selected vendor does not exist' };
        }

        // Create payable
        const { error: payableError } = await supabase
            .from('payables')
            .insert({
                date: date.toISOString(),
                due_date: dueDate.toISOString(),
                amount,
                paid_amount: 0,
                vendor_id: vendorId,
                business_id: data.businessId,
                status: 'unpaid',
                description: normalizeText(data.description) || null,
            });

        if (payableError) {
            console.error('Create payable error:', payableError);
            return { error: 'Failed to create payable' };
        }

        // Update vendor balance
        await supabase
            .from('vendors')
            .update({ balance: vendor.balance + amount })
            .eq('id', vendorId);

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

        // Fetch existing payable
        const { data: payable } = await supabase
            .from('payables')
            .select('*')
            .eq('id', id)
            .single();

        if (!payable) {
            return { error: 'Payable record not found' };
        }

        // Verify vendor exists
        const { data: vendor } = await supabase
            .from('vendors')
            .select('*')
            .eq('id', vendorId)
            .single();

        if (!vendor) {
            return { error: 'Selected vendor does not exist' };
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

            if ((account.balance || 0) < paymentAmount) {
                return { error: 'Insufficient account balance for this settlement' };
            }
        }

        const oldVendorId = payable.vendor_id;
        const oldAmount = payable.amount;
        const oldPaidAmount = payable.paid_amount || 0;
        const oldRemaining = remainingAmount(oldAmount, oldPaidAmount);

        const newPaidAmount = oldPaidAmount + paymentAmount;
        if (newPaidAmount > amount) {
            return { error: 'Payment amount cannot exceed remaining payable' };
        }

        const newRemaining = remainingAmount(amount, newPaidAmount);
        const status = deriveStatus(amount, newPaidAmount);

        // Handle vendor balance updates
        if (oldVendorId === vendorId) {
            const delta = newRemaining - oldRemaining;
            if (delta !== 0) {
                await supabase
                    .from('vendors')
                    .update({ balance: vendor.balance + delta })
                    .eq('id', vendorId);
            }
        } else {
            // Restore old vendor balance
            const { data: oldVendor } = await supabase
                .from('vendors')
                .select('*')
                .eq('id', oldVendorId)
                .single();

            if (oldVendor) {
                await supabase
                    .from('vendors')
                    .update({ balance: oldVendor.balance - oldRemaining })
                    .eq('id', oldVendorId);
            }

            // Update new vendor balance
            await supabase
                .from('vendors')
                .update({ balance: vendor.balance + newRemaining })
                .eq('id', vendorId);
        }

        // Record payment transaction if applicable
        if (paymentAmount > 0 && settlementAccountId) {
            await supabase
                .from('transactions')
                .insert({
                    date: date.toISOString(),
                    amount: paymentAmount,
                    type: 'expense',
                    category: 'Payable Settlement',
                    business_id: data.businessId,
                    account_id: settlementAccountId,
                    vendor_id: vendorId,
                    description: `Settlement against payable #${id}`,
                    reference_id: id,
                    reference_model: 'Payable',
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
                    .update({ balance: account.balance - paymentAmount })
                    .eq('id', settlementAccountId);
            }
        }

        // Update payable
        const { error } = await supabase
            .from('payables')
            .update({
                date: date.toISOString(),
                due_date: dueDate.toISOString(),
                amount,
                paid_amount: newPaidAmount,
                status,
                business_id: data.businessId,
                vendor_id: vendorId,
                description: normalizeText(data.description) || null,
            })
            .eq('id', id);

        if (error) {
            console.error('Update payable error:', error);
            return { error: 'Failed to update payable' };
        }

        revalidatePayableViews();
        return { success: true };
    } catch (error) {
        console.error('Update payable error:', error);
        return { error: 'Failed to update payable' };
    }
}

export async function deletePayable(id: string) {
    try {
        // Fetch existing payable
        const { data: payable } = await supabase
            .from('payables')
            .select('*')
            .eq('id', id)
            .single();

        if (!payable) {
            return { error: 'Payable record not found' };
        }

        const vendorId = payable.vendor_id;
        const outstanding = remainingAmount(payable.amount, payable.paid_amount || 0);

        // Update vendor balance
        if (outstanding !== 0) {
            const { data: vendor } = await supabase
                .from('vendors')
                .select('*')
                .eq('id', vendorId)
                .single();

            if (vendor) {
                await supabase
                    .from('vendors')
                    .update({ balance: vendor.balance - outstanding })
                    .eq('id', vendorId);
            }
        }

        // Delete payable
        const { error } = await supabase
            .from('payables')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Delete payable error:', error);
            return { error: 'Failed to delete payable' };
        }

        revalidatePayableViews();
        return { success: true };
    } catch (error) {
        console.error('Delete payable error:', error);
        return { error: 'Failed to delete payable' };
    }
}
