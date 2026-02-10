'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';

type VendorCategory = 'visa' | 'air_ticket' | 'medical' | 'taqamul' | 'hotel' | 'transport' | 'package' | 'other';

const vendorCategoryLabels: Record<VendorCategory, string> = {
    visa: 'Visa',
    air_ticket: 'Air Ticket',
    medical: 'Medical',
    taqamul: 'Taqamul',
    hotel: 'Hotel',
    transport: 'Transport',
    package: 'Package',
    other: 'Other',
};

function normalizeText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}

function isVendorCategory(value?: string): value is VendorCategory {
    return value === 'visa' || value === 'air_ticket' || value === 'medical' || value === 'taqamul' || value === 'hotel' || value === 'transport' || value === 'package' || value === 'other';
}

function parseMoney(value: number) {
    if (!Number.isFinite(value) || value < 0) return null;
    return Number(value);
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

type VendorTemplateLike = {
    id?: string;
    name?: string;
    service_type?: string;
    category?: string;
    default_price?: number;
    default_cost?: number;
};

function toTemplatePayload(template: VendorTemplateLike) {
    const normalizedName = template.name ?? '';
    return {
        _id: template.id || '',
        name: normalizedName,
        serviceType: template.service_type || 'other',
        category: template.category || normalizedName,
        defaultPrice: template.default_price ?? 0,
        defaultCost: template.default_cost ?? 0,
    };
}

export async function getVendors() {
    const { data: vendors, error } = await supabase
        .from('vendors')
        .select(`
            *,
            vendor_service_categories(category)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching vendors:', error);
        return [];
    }

    return (vendors || []).map((vendor) => ({
        _id: vendor.id,
        name: vendor.name,
        phone: vendor.phone,
        serviceType: vendorCategoryLabels[(vendor.vendor_service_categories?.[0]?.category as VendorCategory) || 'other'],
        serviceTemplates: [], // Will be fetched separately
        balance: vendor.balance,
        createdAt: vendor.created_at,
    }));
}

export async function createVendor(data: {
    name: string;
    phone?: string;
    serviceCategory?: string;
}) {
    try {
        const name = normalizeText(data.name);
        if (!name) {
            return { error: 'Vendor name is required' };
        }

        if (!isVendorCategory(data.serviceCategory)) {
            return { error: 'Service category is required' };
        }

        const { data: vendor, error } = await supabase
            .from('vendors')
            .insert({
                name,
                phone: normalizeText(data.phone) || null,
            })
            .select()
            .single();

        if (error) {
            console.error('Create vendor error:', error);
            return { error: 'Failed to create vendor' };
        }

        // Add service category
        await supabase
            .from('vendor_service_categories')
            .insert({
                vendor_id: vendor.id,
                category: data.serviceCategory,
            });

        revalidatePath('/vendors');

        return {
            success: true,
            vendor: {
                _id: vendor.id,
                name: vendor.name,
            },
        };
    } catch (error) {
        console.error('Create vendor error:', error);
        return { error: 'Failed to create vendor' };
    }
}

export async function getVendorById(id: string) {
    const { data: vendor, error } = await supabase
        .from('vendors')
        .select(`
            *,
            vendor_service_categories(category),
            vendor_service_templates(*)
        `)
        .eq('id', id)
        .single();

    if (error || !vendor) {
        return null;
    }

    const serviceCategories = (vendor.vendor_service_categories || []).map(
        (cat: { category: string }) => cat.category as VendorCategory
    );
    const templates = (vendor.vendor_service_templates || []).map(toTemplatePayload);

    return {
        _id: vendor.id,
        name: vendor.name,
        phone: vendor.phone,
        email: vendor.email,
        serviceCategories,
        serviceCategoryLabels: serviceCategories.map((category: VendorCategory) => vendorCategoryLabels[category] || category),
        status: vendor.status,
        rating: vendor.rating,
        notes: vendor.notes,
        balance: vendor.balance,
        totalServicesProvided: vendor.total_services_provided,
        serviceTemplates: templates,
        createdAt: vendor.created_at,
    };
}

export async function addVendorServiceTemplate(vendorId: string, data: {
    name: string;
    defaultPrice: number;
    defaultCost: number;
}) {
    try {
        const name = normalizeText(data.name);
        if (!name) {
            return { error: 'Service name is required' };
        }

        const defaultPrice = parseMoney(data.defaultPrice);
        const defaultCost = parseMoney(data.defaultCost);
        if (defaultPrice === null || defaultCost === null) {
            return { error: 'Price and cost must be 0 or greater' };
        }

        // Check if template exists
        const { data: existing } = await supabase
            .from('vendor_service_templates')
            .select('*')
            .eq('vendor_id', vendorId)
            .ilike('name', name)
            .single();

        if (existing) {
            // Update existing
            const { error } = await supabase
                .from('vendor_service_templates')
                .update({
                    default_price: defaultPrice,
                    default_cost: defaultCost,
                })
                .eq('id', existing.id);

            if (error) {
                console.error('Update vendor service template error:', error);
                return { error: 'Failed to update vendor service template' };
            }

            revalidatePath('/vendors');
            revalidatePath(`/vendors/${vendorId}`);
            revalidatePath('/services');

            return {
                success: true,
                updated: true,
            };
        } else {
            // Create new
            const { error } = await supabase
                .from('vendor_service_templates')
                .insert({
                    vendor_id: vendorId,
                    name,
                    service_type: 'other',
                    category: name,
                    default_price: defaultPrice,
                    default_cost: defaultCost,
                });

            if (error) {
                console.error('Add vendor service template error:', error);
                return { error: 'Failed to add vendor service template' };
            }

            revalidatePath('/vendors');
            revalidatePath(`/vendors/${vendorId}`);
            revalidatePath('/services');

            return {
                success: true,
                updated: false,
            };
        }
    } catch (error) {
        console.error('Add vendor service template error:', error);
        return { error: 'Failed to add vendor service template' };
    }
}

export async function updateVendorServiceTemplatePrice(vendorId: string, data: {
    name: string;
    defaultPrice: number;
    defaultCost: number;
}) {
    try {
        const name = normalizeText(data.name);
        if (!name) {
            return { error: 'Service name is required' };
        }

        const defaultPrice = parseMoney(data.defaultPrice);
        const defaultCost = parseMoney(data.defaultCost);
        if (defaultPrice === null || defaultCost === null) {
            return { error: 'Price and cost must be 0 or greater' };
        }

        const { data: template } = await supabase
            .from('vendor_service_templates')
            .select('*')
            .eq('vendor_id', vendorId)
            .ilike('name', name)
            .single();

        if (!template) {
            return { error: 'Vendor listed service not found' };
        }

        const { error } = await supabase
            .from('vendor_service_templates')
            .update({
                default_price: defaultPrice,
                default_cost: defaultCost,
            })
            .eq('id', template.id);

        if (error) {
            console.error('Update vendor service template price error:', error);
            return { error: 'Failed to update vendor listed service price' };
        }

        revalidatePath('/vendors');
        revalidatePath(`/vendors/${vendorId}`);
        revalidatePath('/services');

        return { success: true };
    } catch (error) {
        console.error('Update vendor service template price error:', error);
        return { error: 'Failed to update vendor listed service price' };
    }
}

export async function deleteVendorServiceTemplate(vendorId: string, templateName: string) {
    try {
        const name = normalizeText(templateName);
        if (!name) {
            return { error: 'Service name is required' };
        }

        const { data: template } = await supabase
            .from('vendor_service_templates')
            .select('*')
            .eq('vendor_id', vendorId)
            .ilike('name', name)
            .single();

        if (!template) {
            return { error: 'Vendor listed service not found' };
        }

        const { error } = await supabase
            .from('vendor_service_templates')
            .delete()
            .eq('id', template.id);

        if (error) {
            console.error('Delete vendor service template error:', error);
            return { error: 'Failed to delete vendor listed service' };
        }

        revalidatePath('/vendors');
        revalidatePath(`/vendors/${vendorId}`);
        revalidatePath('/services');

        return { success: true };
    } catch (error) {
        console.error('Delete vendor service template error:', error);
        return { error: 'Failed to delete vendor listed service' };
    }
}

export async function getVendorLedger(vendorId: string) {
    const [payablesResult, servicesResult] = await Promise.all([
        supabase
            .from('payables')
            .select('*')
            .eq('vendor_id', vendorId)
            .order('date', { ascending: false }),
        supabase
            .from('services')
            .select('*')
            .eq('vendor_id', vendorId)
            .eq('status', 'delivered')
            .order('delivery_date', { ascending: false }),
    ]);

    const payables = payablesResult.data || [];
    const deliveredServices = servicesResult.data || [];

    const payableRows = payables.map((row) => {
        const paidAmount = row.paid_amount ?? 0;
        const dueAmount = Math.max(0, row.amount - paidAmount);
        return {
            _id: row.id,
            date: row.date,
            dueDate: row.due_date || '',
            amount: row.amount,
            paidAmount,
            dueAmount,
            status: row.status,
            description: row.description || '',
        };
    });

    const deliveredRows = deliveredServices.map((row) => ({
        _id: row.id,
        name: row.name,
        date: row.delivery_date || row.created_at,
        price: row.price,
        cost: row.cost ?? 0,
        profit: row.profit ?? 0,
    }));

    return {
        payables: payableRows,
        deliveredServices: deliveredRows,
        totalServiceValue: deliveredRows.reduce((sum: number, row: { price: number }) => sum + row.price, 0),
        totalVendorCost: deliveredRows.reduce((sum: number, row: { cost: number }) => sum + row.cost, 0),
        totalPaid: payableRows.reduce((sum: number, row: { paidAmount: number }) => sum + row.paidAmount, 0),
        totalDue: payableRows.reduce((sum: number, row: { dueAmount: number }) => sum + row.dueAmount, 0),
    };
}

export async function getVendorTransactionHistory(vendorId: string) {
    const { data: rows, error } = await supabase
        .from('transactions')
        .select(`
            *,
            accounts:account_id (name)
        `)
        .eq('vendor_id', vendorId)
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching vendor transactions:', error);
        return [];
    }

    return (rows || []).map((row) => ({
        _id: row.id,
        date: row.date,
        amount: row.amount,
        type: row.type,
        category: row.category,
        accountName: row.accounts?.name || 'Unknown Account',
        description: row.description || '',
    }));
}

export async function recordVendorBillPayment(data: {
    vendorId: string;
    accountId: string;
    amount: number;
    date?: string;
    note?: string;
}) {
    try {
        const amount = parsePositiveAmount(data.amount);
        if (!amount) {
            return { error: 'Payment amount must be greater than 0' };
        }

        const date = normalizeDate(data.date);
        if (!date) {
            return { error: 'Invalid payment date' };
        }

        const vendorId = normalizeText(data.vendorId);
        if (!vendorId) {
            return { error: 'Vendor is required' };
        }

        const accountId = normalizeText(data.accountId);
        if (!accountId) {
            return { error: 'Settlement account is required' };
        }

        // Fetch vendor
        const { data: vendor } = await supabase
            .from('vendors')
            .select('*')
            .eq('id', vendorId)
            .single();

        if (!vendor) {
            return { error: 'Vendor not found', appliedAmount: 0 };
        }

        // Fetch account
        const { data: account } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (!account) {
            return { error: 'Settlement account not found', appliedAmount: 0 };
        }

        if ((account.balance ?? 0) < amount) {
            return { error: 'Insufficient account balance for this payment', appliedAmount: 0 };
        }

        // Fetch unpaid payables
        const { data: payables } = await supabase
            .from('payables')
            .select('*')
            .eq('vendor_id', vendorId)
            .neq('status', 'paid')
            .order('due_date', { ascending: true });

        const totalDue = (payables || []).reduce((sum: number, item: { amount: number; paid_amount?: number }) => 
            sum + Math.max(0, item.amount - (item.paid_amount || 0)), 0);

        if (totalDue <= 0) {
            return { error: 'No due payable entries found for this vendor', appliedAmount: 0 };
        }

        if (amount > totalDue) {
            return { error: `Payment exceeds total due (${totalDue.toFixed(2)})`, appliedAmount: 0 };
        }

        let remainingPayment = amount;
        let appliedAmount = 0;
        const transactions = [];
        const payableUpdates = [];

        for (const payable of (payables || [])) {
            if (remainingPayment <= 0) break;
            const dueAmount = Math.max(0, payable.amount - (payable.paid_amount ?? 0));
            if (dueAmount <= 0) continue;

            const settled = Math.min(dueAmount, remainingPayment);
            const nextPaid = (payable.paid_amount ?? 0) + settled;
            const newStatus = nextPaid >= payable.amount ? 'paid' : 'partial';

            payableUpdates.push({
                id: payable.id,
                paid_amount: nextPaid,
                status: newStatus,
            });

            transactions.push({
                date: date.toISOString(),
                amount: settled,
                type: 'expense',
                category: 'Payable Settlement',
                business_id: payable.business_id || 'travel',
                account_id: accountId,
                vendor_id: vendorId,
                description: data.note?.trim() || `Vendor bill payment against payable #${payable.id}`,
                reference_id: payable.id,
                reference_model: 'Payable',
            });

            remainingPayment -= settled;
            appliedAmount += settled;
        }

        if (appliedAmount <= 0) {
            return { error: 'Could not apply payment to payable entries', appliedAmount: 0 };
        }

        // Update payables
        for (const update of payableUpdates) {
            await supabase
                .from('payables')
                .update({
                    paid_amount: update.paid_amount,
                    status: update.status,
                })
                .eq('id', update.id);
        }

        // Create transactions
        if (transactions.length > 0) {
            await supabase
                .from('transactions')
                .insert(transactions);
        }

        // Update account balance
        await supabase
            .from('accounts')
            .update({ balance: account.balance - appliedAmount })
            .eq('id', accountId);

        // Update vendor balance
        await supabase
            .from('vendors')
            .update({ balance: vendor.balance - appliedAmount })
            .eq('id', vendorId);

        const ledger = await getVendorLedger(vendorId);

        revalidatePath('/vendors');
        revalidatePath(`/vendors/${vendorId}`);
        revalidatePath('/payable');
        revalidatePath('/accounts');
        revalidatePath('/dashboard');

        return {
            success: true,
            appliedAmount,
            totalDue: ledger.totalDue,
        };
    } catch (error) {
        console.error('Record vendor bill payment error:', error);
        return { error: 'Failed to record vendor bill payment' };
    }
}
