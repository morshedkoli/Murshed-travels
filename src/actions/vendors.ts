'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

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
    serviceType?: string;
    category?: string;
    defaultPrice?: number;
    defaultCost?: number;
};

function toTemplatePayload(template: VendorTemplateLike) {
    const normalizedName = template.name ?? '';
    return {
        _id: template.id || '',
        name: normalizedName,
        serviceType: template.serviceType || 'other',
        category: template.category || normalizedName,
        defaultPrice: template.defaultPrice ?? 0,
        defaultCost: template.defaultCost ?? 0,
    };
}

export async function getVendors() {
    try {
        const vendors = await prisma.vendor.findMany({
            include: {
                serviceCategories: true,
                serviceTemplates: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return vendors.map((vendor) => ({
            _id: vendor.id,
            name: vendor.name,
            phone: vendor.phone,
            serviceType: vendorCategoryLabels[(vendor.serviceCategories?.[0]?.category as VendorCategory) || 'other'],
            serviceTemplates: (vendor.serviceTemplates || []).map(toTemplatePayload),
            balance: vendor.balance,
            createdAt: vendor.createdAt.toISOString(),
        }));
    } catch (error) {
        console.error('Error fetching vendors:', error);
        return [];
    }
}

export async function createVendor(data: {
    name: string;
    phone?: string;
    serviceCategory?: string;
}) {
    try {
        const name = normalizeText(data.name);
        if (!name) return { error: 'Vendor name is required' };

        if (!isVendorCategory(data.serviceCategory)) return { error: 'Service category is required' };

        const vendor = await prisma.vendor.create({
            data: {
                name,
                phone: normalizeText(data.phone) || null,
                serviceCategories: {
                    create: { category: data.serviceCategory }
                }
            }
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
    try {
        const vendor = await prisma.vendor.findUnique({
            where: { id },
            include: {
                serviceCategories: true,
                serviceTemplates: true
            }
        });

        if (!vendor) return null;

        const serviceCategories = (vendor.serviceCategories || []).map(
            (cat) => cat.category as VendorCategory
        );
        const templates = (vendor.serviceTemplates || []).map(toTemplatePayload);

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
            totalServicesProvided: vendor.totalServicesProvided,
            serviceTemplates: templates,
            createdAt: vendor.createdAt.toISOString(),
        };
    } catch (error) {
        return null;
    }
}

export async function addVendorServiceTemplate(vendorId: string, data: {
    name: string;
    defaultPrice: number;
    defaultCost: number;
}) {
    try {
        const name = normalizeText(data.name);
        if (!name) return { error: 'Service name is required' };

        const defaultPrice = parseMoney(data.defaultPrice);
        const defaultCost = parseMoney(data.defaultCost);
        if (defaultPrice === null || defaultCost === null) return { error: 'Price and cost must be 0 or greater' };

        const existing = await prisma.vendorServiceTemplate.findFirst({
            where: {
                vendorId,
                name: { equals: name, mode: 'insensitive' }
            }
        });

        if (existing) {
            await prisma.vendorServiceTemplate.update({
                where: { id: existing.id },
                data: {
                    defaultPrice,
                    defaultCost,
                }
            });

            revalidatePath('/vendors');
            revalidatePath(`/vendors/${vendorId}`);
            revalidatePath('/services');

            return { success: true, updated: true };
        } else {
            await prisma.vendorServiceTemplate.create({
                data: {
                    vendorId,
                    name,
                    serviceType: 'other',
                    category: name,
                    defaultPrice,
                    defaultCost,
                }
            });

            revalidatePath('/vendors');
            revalidatePath(`/vendors/${vendorId}`);
            revalidatePath('/services');

            return { success: true, updated: false };
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
        if (!name) return { error: 'Service name is required' };

        const defaultPrice = parseMoney(data.defaultPrice);
        const defaultCost = parseMoney(data.defaultCost);
        if (defaultPrice === null || defaultCost === null) return { error: 'Price and cost must be 0 or greater' };

        const template = await prisma.vendorServiceTemplate.findFirst({
            where: {
                vendorId,
                name: { equals: name, mode: 'insensitive' }
            }
        });

        if (!template) return { error: 'Vendor listed service not found' };

        await prisma.vendorServiceTemplate.update({
            where: { id: template.id },
            data: {
                defaultPrice,
                defaultCost,
            }
        });

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
        if (!name) return { error: 'Service name is required' };

        const template = await prisma.vendorServiceTemplate.findFirst({
            where: {
                vendorId,
                name: { equals: name, mode: 'insensitive' }
            }
        });

        if (!template) return { error: 'Vendor listed service not found' };

        await prisma.vendorServiceTemplate.delete({
            where: { id: template.id }
        });

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
    try {
        const [payables, deliveredServices] = await Promise.all([
            prisma.payable.findMany({
                where: { vendorId },
                orderBy: { date: 'desc' }
            }),
            prisma.service.findMany({
                where: { vendorId, status: 'delivered' },
                orderBy: { deliveryDate: 'desc' }
            }),
        ]);

        const payableRows = payables.map((row) => {
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

        const deliveredRows = deliveredServices.map((row) => ({
            _id: row.id,
            name: row.name,
            date: row.deliveryDate ? row.deliveryDate.toISOString() : row.createdAt.toISOString(),
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
    } catch (error) {
        return { payables: [], deliveredServices: [], totalServiceValue: 0, totalVendorCost: 0, totalPaid: 0, totalDue: 0 };
    }
}

export async function getVendorTransactionHistory(vendorId: string) {
    try {
        const rows = await prisma.transaction.findMany({
            where: { vendorId },
            include: { account: { select: { name: true } } },
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
        console.error('Error fetching vendor transactions:', error);
        return [];
    }
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
        if (!amount) return { error: 'Payment amount must be greater than 0' };

        const date = normalizeDate(data.date);
        if (!date) return { error: 'Invalid payment date' };

        const vendorId = normalizeText(data.vendorId);
        if (!vendorId) return { error: 'Vendor is required' };

        const accountId = normalizeText(data.accountId);
        if (!accountId) return { error: 'Settlement account is required' };

        const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
        if (!vendor) return { error: 'Vendor not found', appliedAmount: 0 };

        const account = await prisma.account.findUnique({ where: { id: accountId } });
        if (!account) return { error: 'Settlement account not found', appliedAmount: 0 };

        if ((account.balance ?? 0) < amount) {
            return { error: 'Insufficient account balance for this payment', appliedAmount: 0 };
        }

        const payables = await prisma.payable.findMany({
            where: { vendorId, status: { not: 'paid' } },
            orderBy: { dueDate: 'asc' }
        });

        const totalDue = payables.reduce((sum, item) => sum + Math.max(0, item.amount - (item.paidAmount || 0)), 0);

        if (totalDue <= 0) return { error: 'No due payable entries found for this vendor', appliedAmount: 0 };
        if (amount > totalDue) return { error: `Payment exceeds total due (${totalDue.toFixed(2)})`, appliedAmount: 0 };

        let remainingPayment = amount;
        let appliedAmount = 0;
        const transactionsToCreate: any[] = [];
        const payableUpdates: any[] = [];

        for (const payable of payables) {
            if (remainingPayment <= 0) break;
            const dueAmount = Math.max(0, payable.amount - (payable.paidAmount ?? 0));
            if (dueAmount <= 0) continue;

            const settled = Math.min(dueAmount, remainingPayment);
            const nextPaid = (payable.paidAmount ?? 0) + settled;
            const newStatus = nextPaid >= payable.amount ? 'paid' : 'partial';

            payableUpdates.push({
                id: payable.id,
                paidAmount: nextPaid,
                status: newStatus,
            });

            transactionsToCreate.push({
                date,
                amount: settled,
                type: 'expense',
                category: 'Payable Settlement',
                businessId: payable.businessId || 'travel',
                accountId,
                vendorId,
                description: data.note?.trim() || `Vendor bill payment against payable #${payable.id}`,
                referenceId: payable.id,
                referenceModel: 'Payable',
            });

            remainingPayment -= settled;
            appliedAmount += settled;
        }

        if (appliedAmount <= 0) {
            return { error: 'Could not apply payment to payable entries', appliedAmount: 0 };
        }

        await prisma.$transaction(async (tx) => {
            for (const update of payableUpdates) {
                await tx.payable.update({
                    where: { id: update.id },
                    data: {
                        paidAmount: update.paidAmount,
                        status: update.status,
                    }
                });
            }

            if (transactionsToCreate.length > 0) {
                await tx.transaction.createMany({
                    data: transactionsToCreate
                });
            }

            await tx.account.update({
                where: { id: accountId },
                data: { balance: { decrement: appliedAmount } }
            });

            await tx.vendor.update({
                where: { id: vendorId },
                data: { balance: { decrement: appliedAmount } }
            });
        });

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
