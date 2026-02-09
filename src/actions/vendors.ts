'use server';

import mongoose from 'mongoose';
import { revalidatePath } from 'next/cache';
import connect from '@/lib/db';
import Account from '@/models/Account';
import Payable from '@/models/Payable';
import Service from '@/models/Service';
import Transaction from '@/models/Transaction';
import Vendor from '@/models/Vendor';

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
    _id?: unknown;
    name?: string;
    serviceType?: string;
    category?: string;
    defaultPrice?: number;
    defaultCost?: number;
};

function toTemplatePayload(template: VendorTemplateLike) {
    const normalizedName = template.name ?? '';
    return {
        _id: template._id ? String(template._id) : '',
        name: normalizedName,
        serviceType: template.serviceType ?? 'other',
        category: template.category ?? normalizedName,
        defaultPrice: template.defaultPrice ?? 0,
        defaultCost: template.defaultCost ?? 0,
    };
}

export async function getVendors() {
    await connect();
    const vendors = await Vendor.find({}).sort({ createdAt: -1 });

    return vendors.map((vendor) => ({
        _id: vendor._id.toString(),
        name: vendor.name,
        phone: vendor.phone,
        serviceType: vendorCategoryLabels[(vendor.serviceCategories?.[0] as VendorCategory) ?? 'other'],
        serviceTemplates: (vendor.serviceTemplates ?? []).map(toTemplatePayload),
        balance: vendor.balance,
        createdAt: vendor.createdAt.toISOString(),
    }));
}

export async function createVendor(data: {
    name: string;
    phone?: string;
    serviceCategory?: string;
}) {
    try {
        await connect();

        const name = normalizeText(data.name);
        if (!name) {
            return { error: 'Vendor name is required' };
        }

        if (!isVendorCategory(data.serviceCategory)) {
            return { error: 'Service category is required' };
        }

        const vendor = await Vendor.create({
            name,
            phone: normalizeText(data.phone),
            serviceCategories: [data.serviceCategory],
        });

        revalidatePath('/vendors');

        return {
            success: true,
            vendor: {
                _id: vendor._id.toString(),
                name: vendor.name,
            },
        };
    } catch (error) {
        console.error('Create vendor error:', error);
        return { error: 'Failed to create vendor' };
    }
}

export async function getVendorById(id: string) {
    await connect();
    const vendor = await Vendor.findById(id);

    if (!vendor) {
        return null;
    }

    const serviceCategories = (vendor.serviceCategories ?? []) as VendorCategory[];
    const templates = (vendor.serviceTemplates ?? []).map(toTemplatePayload);

    return {
        _id: vendor._id.toString(),
        name: vendor.name,
        phone: vendor.phone,
        email: vendor.email,
        serviceCategories,
        serviceCategoryLabels: serviceCategories.map((category) => vendorCategoryLabels[category] ?? category),
        status: vendor.status,
        rating: vendor.rating,
        notes: vendor.notes,
        balance: vendor.balance,
        totalServicesProvided: vendor.totalServicesProvided,
        serviceTemplates: templates,
        createdAt: vendor.createdAt.toISOString(),
    };
}

export async function addVendorServiceTemplate(vendorId: string, data: {
    name: string;
    defaultPrice: number;
    defaultCost: number;
}) {
    try {
        await connect();

        const name = normalizeText(data.name);
        if (!name) {
            return { error: 'Service name is required' };
        }

        const defaultPrice = parseMoney(data.defaultPrice);
        const defaultCost = parseMoney(data.defaultCost);
        if (defaultPrice === null || defaultCost === null) {
            return { error: 'Price and cost must be 0 or greater' };
        }

        // First, ensure the vendor exists and serviceTemplates field is initialized
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return { error: 'Vendor not found' };
        }

        // Initialize serviceTemplates if it doesn't exist
        if (!vendor.serviceTemplates || !Array.isArray(vendor.serviceTemplates)) {
            vendor.serviceTemplates = [];
            await vendor.save();
        }

        const normalizedName = name.toLowerCase();
        
        // Re-fetch vendor to ensure we have latest data
        const currentVendor = await Vendor.findById(vendorId);
        if (!currentVendor) {
            return { error: 'Vendor not found after initialization' };
        }

        const existingIndex = (currentVendor.serviceTemplates ?? []).findIndex(
            (item: VendorTemplateLike) => (item.name ?? '').toLowerCase() === normalizedName
        );

        let updated = false;

        if (existingIndex >= 0) {
            // Update existing template using arrayFilters
            const result = await Vendor.findOneAndUpdate(
                { _id: vendorId },
                {
                    $set: {
                        [`serviceTemplates.${existingIndex}.defaultPrice`]: defaultPrice,
                        [`serviceTemplates.${existingIndex}.defaultCost`]: defaultCost,
                    },
                },
                { new: true, runValidators: true }
            );
            updated = !!result;
        } else {
            // Add new template
            const result = await Vendor.findOneAndUpdate(
                { _id: vendorId },
                {
                    $addToSet: {
                        serviceTemplates: {
                            name,
                            serviceType: 'other',
                            category: name,
                            defaultPrice,
                            defaultCost,
                        },
                    },
                },
                { new: true, runValidators: true }
            );
            updated = !!result;
        }

        if (!updated) {
            return { error: 'Failed to update vendor' };
        }

        // Re-fetch to get updated data
        const persistedVendor = await Vendor.findById(vendorId);

        if (!persistedVendor) {
            return { error: 'Failed to persist vendor service template' };
        }

        revalidatePath('/vendors');
        revalidatePath(`/vendors/${vendorId}`);
        revalidatePath('/services');

        return {
            success: true,
            updated: existingIndex >= 0,
            serviceTemplates: (persistedVendor.serviceTemplates ?? []).map(toTemplatePayload),
        };
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
        await connect();

        const name = normalizeText(data.name);
        if (!name) {
            return { error: 'Service name is required' };
        }

        const defaultPrice = parseMoney(data.defaultPrice);
        const defaultCost = parseMoney(data.defaultCost);
        if (defaultPrice === null || defaultCost === null) {
            return { error: 'Price and cost must be 0 or greater' };
        }

        const currentVendor = await Vendor.findById(vendorId);
        if (!currentVendor) {
            return { error: 'Vendor not found' };
        }

        const existingIndex = (currentVendor.serviceTemplates ?? []).findIndex(
            (item: VendorTemplateLike) => (item.name ?? '').toLowerCase() === name.toLowerCase()
        );

        if (existingIndex < 0) {
            return { error: 'Vendor listed service not found' };
        }

        const updatedVendor = await Vendor.findOneAndUpdate(
            { _id: vendorId },
            {
                $set: {
                    [`serviceTemplates.${existingIndex}.defaultPrice`]: defaultPrice,
                    [`serviceTemplates.${existingIndex}.defaultCost`]: defaultCost,
                },
            },
            { new: true, runValidators: true }
        );

        if (!updatedVendor) {
            return { error: 'Failed to update vendor listed service price' };
        }

        revalidatePath('/vendors');
        revalidatePath(`/vendors/${vendorId}`);
        revalidatePath('/services');

        return {
            success: true,
            serviceTemplates: (updatedVendor.serviceTemplates ?? []).map(toTemplatePayload),
        };
    } catch (error) {
        console.error('Update vendor service template price error:', error);
        return { error: 'Failed to update vendor listed service price' };
    }
}

export async function deleteVendorServiceTemplate(vendorId: string, templateName: string) {
    try {
        await connect();

        const name = normalizeText(templateName);
        if (!name) {
            return { error: 'Service name is required' };
        }

        const currentVendor = await Vendor.findById(vendorId);
        if (!currentVendor) {
            return { error: 'Vendor not found' };
        }

        const existingCount = (currentVendor.serviceTemplates ?? []).length;
        const filteredTemplates = (currentVendor.serviceTemplates ?? []).filter(
            (item: VendorTemplateLike) => (item.name ?? '').toLowerCase() !== name.toLowerCase()
        );

        if (filteredTemplates.length === existingCount) {
            return { error: 'Vendor listed service not found' };
        }

        currentVendor.serviceTemplates = filteredTemplates;
        await currentVendor.save();

        revalidatePath('/vendors');
        revalidatePath(`/vendors/${vendorId}`);
        revalidatePath('/services');

        return {
            success: true,
            serviceTemplates: (currentVendor.serviceTemplates ?? []).map(toTemplatePayload),
        };
    } catch (error) {
        console.error('Delete vendor service template error:', error);
        return { error: 'Failed to delete vendor listed service' };
    }
}

export async function getVendorLedger(vendorId: string) {
    await connect();

    const [payables, deliveredServices] = await Promise.all([
        Payable.find({ vendorId }).sort({ date: -1, createdAt: -1 }),
        Service.find({ vendorId, status: 'delivered' }).sort({ deliveryDate: -1, createdAt: -1 }),
    ]);

    const payableRows = payables.map((row) => {
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
        payables: payableRows,
        deliveredServices: deliveredRows,
        totalServiceValue: deliveredRows.reduce((sum, row) => sum + row.price, 0),
        totalVendorCost: deliveredRows.reduce((sum, row) => sum + row.cost, 0),
        totalPaid: payableRows.reduce((sum, row) => sum + row.paidAmount, 0),
        totalDue: payableRows.reduce((sum, row) => sum + row.dueAmount, 0),
    };
}

export async function getVendorTransactionHistory(vendorId: string) {
    await connect();

    const rows = await Transaction.find({ vendorId })
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

export async function recordVendorBillPayment(data: {
    vendorId: string;
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

        const vendorId = normalizeText(data.vendorId);
        if (!vendorId) {
            return { error: 'Vendor is required' };
        }

        const accountId = normalizeText(data.accountId);
        if (!accountId) {
            return { error: 'Settlement account is required' };
        }

        const runPayment = async (activeSession?: mongoose.ClientSession) => {
            const vendorQuery = Vendor.findById(vendorId);
            if (activeSession) vendorQuery.session(activeSession);
            const vendor = await vendorQuery;
            if (!vendor) {
                return { error: 'Vendor not found', appliedAmount: 0 };
            }

            const accountQuery = Account.findById(accountId);
            if (activeSession) accountQuery.session(activeSession);
            const account = await accountQuery;
            if (!account) {
                return { error: 'Settlement account not found', appliedAmount: 0 };
            }

            if ((account.balance ?? 0) < amount) {
                return { error: 'Insufficient account balance for this payment', appliedAmount: 0 };
            }

            const payablesQuery = Payable.find({ vendorId, status: { $ne: 'paid' } }).sort({ dueDate: 1, date: 1, createdAt: 1 });
            if (activeSession) payablesQuery.session(activeSession);
            const payables = await payablesQuery;

            const totalDue = payables.reduce((sum, item) => sum + Math.max(0, item.amount - (item.paidAmount ?? 0)), 0);
            if (totalDue <= 0) {
                return { error: 'No due payable entries found for this vendor', appliedAmount: 0 };
            }

            if (amount > totalDue) {
                return { error: `Payment exceeds total due (${totalDue.toFixed(2)})`, appliedAmount: 0 };
            }

            let remainingPayment = amount;
            let appliedAmount = 0;

            for (const payable of payables) {
                if (remainingPayment <= 0) break;
                const dueAmount = Math.max(0, payable.amount - (payable.paidAmount ?? 0));
                if (dueAmount <= 0) continue;

                const settled = Math.min(dueAmount, remainingPayment);
                const nextPaid = (payable.paidAmount ?? 0) + settled;

                payable.paidAmount = nextPaid;
                payable.status = nextPaid >= payable.amount ? 'paid' : 'partial';
                if (activeSession) {
                    await payable.save({ session: activeSession });
                } else {
                    await payable.save();
                }

                const txPayload = {
                    date,
                    amount: settled,
                    type: 'expense' as const,
                    category: 'Payable Settlement',
                    businessId: payable.businessId ?? 'travel',
                    accountId,
                    vendorId,
                    description: data.note?.trim() || `Vendor bill payment against payable #${payable._id.toString()}`,
                    referenceId: payable._id,
                    referenceModel: 'Payable',
                };

                if (activeSession) {
                    await Transaction.create([txPayload], { session: activeSession });
                } else {
                    await Transaction.create(txPayload);
                }

                remainingPayment -= settled;
                appliedAmount += settled;
            }

            if (appliedAmount <= 0) {
                return { error: 'Could not apply payment to payable entries', appliedAmount: 0 };
            }

            if (activeSession) {
                await Account.findByIdAndUpdate(accountId, { $inc: { balance: -appliedAmount } }, { session: activeSession });
                await Vendor.findByIdAndUpdate(vendorId, { $inc: { balance: -appliedAmount } }, { session: activeSession });
            } else {
                await Account.findByIdAndUpdate(accountId, { $inc: { balance: -appliedAmount } });
                await Vendor.findByIdAndUpdate(vendorId, { $inc: { balance: -appliedAmount } });
            }

            return { appliedAmount };
        };

        let appliedAmount = 0;

        try {
            await session.withTransaction(async () => {
                const result = await runPayment(session);
                if (result.error) {
                    throw new Error(result.error);
                }
                appliedAmount = result.appliedAmount;
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : '';
            const txUnsupported = message.includes('Transaction numbers are only allowed on a replica set member or mongos');
            if (!txUnsupported) {
                return { error: message || 'Failed to record vendor payment' };
            }

            const fallback = await runPayment();
            if (fallback.error) {
                return { error: fallback.error };
            }
            appliedAmount = fallback.appliedAmount;
        }

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
    } finally {
        await session.endSession();
    }
}
