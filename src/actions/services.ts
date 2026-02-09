'use server';

import { revalidatePath } from 'next/cache';
import connect from '@/lib/db';
import Service from '@/models/Service';
import Customer from '@/models/Customer';
import Payable from '@/models/Payable';
import Receivable from '@/models/Receivable';
import Vendor from '@/models/Vendor';

export type ServiceInput = {
    name: string;
    description?: string;
    category: string;
    price: number;
    cost?: number;
    status: 'pending' | 'in-progress' | 'ready' | 'delivered' | 'cancelled';
    customerId: string;
    vendorId: string;
    deliveryDate?: string;
    serviceType: 'visa' | 'air_ticket' | 'medical' | 'taqamul' | 'hotel' | 'package' | 'other';
    visaDetails?: {
        visaType?: string;
        country?: string;
        applicationDate?: string;
        submissionDate?: string;
        approvalDate?: string;
        visaNumber?: string;
        expiryDate?: string;
        entryType?: string;
        duration?: string;
    };
    ticketDetails?: {
        airline?: string;
        flightNumber?: string;
        routeFrom?: string;
        routeTo?: string;
        departureDate?: string;
        arrivalDate?: string;
        flightClass?: string;
        pnr?: string;
        ticketNumber?: string;
        baggageAllowance?: string;
        isRoundTrip?: boolean;
    };
    medicalDetails?: {
        medicalCenter?: string;
        appointmentDate?: string;
        reportDate?: string;
        testResults?: string;
        certificateNumber?: string;
        expiryDate?: string;
    };
    taqamulDetails?: {
        examCenter?: string;
        examDate?: string;
        registrationNumber?: string;
        resultStatus?: string;
        certificateNumber?: string;
        score?: number;
    };
    passengerDetails?: Array<{
        name: string;
        passportNumber?: string;
        dateOfBirth?: string;
        nationality?: string;
    }>;
};

function isValidStatus(value: string): value is 'pending' | 'in-progress' | 'ready' | 'delivered' | 'cancelled' {
    return ['pending', 'in-progress', 'ready', 'delivered', 'cancelled'].includes(value);
}

function normalizeText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}

function parseAmount(value: number) {
    if (!Number.isFinite(value) || value < 0) return null;
    return Number(value);
}

function normalizeDate(value?: string) {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date;
}

function revalidateServiceViews() {
    revalidatePath('/services');
    revalidatePath('/dashboard');
    revalidatePath('/customers');
    revalidatePath('/vendors');
    revalidatePath('/receivable');
    revalidatePath('/payable');
}

function deriveLedgerStatus(amount: number, paidAmount: number) {
    if (paidAmount <= 0) return 'unpaid';
    if (paidAmount >= amount) return 'paid';
    return 'partial';
}

function dueDateFrom(baseDate: Date) {
    const due = new Date(baseDate);
    due.setDate(due.getDate() + 7);
    return due;
}

type IdLike = string | { toString(): string };

type ServiceLedgerRef = {
    name: string;
    price: number;
    cost: number;
    customerId: IdLike;
    vendorId: IdLike;
    receivableId?: IdLike;
    payableId?: IdLike;
    deliveryDate?: Date;
};

async function createLedgersForDeliveredService(service: ServiceLedgerRef, date: Date) {
    if (!service.payableId && service.cost > 0) {
        const payable = await Payable.create({
            date,
            dueDate: dueDateFrom(date),
            amount: service.cost,
            paidAmount: 0,
            status: deriveLedgerStatus(service.cost, 0),
            businessId: 'travel',
            vendorId: service.vendorId,
            description: `Service payable: ${service.name}`,
        });
        service.payableId = payable._id;
        await Vendor.findByIdAndUpdate(service.vendorId, { $inc: { balance: service.cost } });
    }
}

async function ensureServiceReceivable(service: ServiceLedgerRef, date: Date) {
    if (service.receivableId) {
        return;
    }

    const receivable = await Receivable.create({
        date,
        dueDate: dueDateFrom(date),
        amount: service.price,
        paidAmount: 0,
        status: deriveLedgerStatus(service.price, 0),
        businessId: 'travel',
        customerId: service.customerId,
        description: `Service receivable: ${service.name}`,
    });

    service.receivableId = receivable._id;
    await Customer.findByIdAndUpdate(service.customerId, { $inc: { balance: service.price } });
}

async function syncServiceReceivable(service: ServiceLedgerRef, oldCustomerId: string, oldPrice: number) {
    if (!service.receivableId) {
        await ensureServiceReceivable(service, service.deliveryDate ?? new Date());
        return;
    }

    const receivable = await Receivable.findById(service.receivableId);
    if (!receivable) {
        service.receivableId = undefined;
        await ensureServiceReceivable(service, service.deliveryDate ?? new Date());
        return;
    }

    const oldOutstanding = Math.max(0, oldPrice - (receivable.paidAmount ?? 0));
    const nextPaid = Math.min(receivable.paidAmount ?? 0, service.price);
    const newOutstanding = Math.max(0, service.price - nextPaid);

    if (oldCustomerId === service.customerId.toString()) {
        const delta = newOutstanding - oldOutstanding;
        if (delta !== 0) {
            await Customer.findByIdAndUpdate(service.customerId, { $inc: { balance: delta } });
        }
    } else {
        if (oldOutstanding > 0) {
            await Customer.findByIdAndUpdate(oldCustomerId, { $inc: { balance: -oldOutstanding } });
        }
        if (newOutstanding > 0) {
            await Customer.findByIdAndUpdate(service.customerId, { $inc: { balance: newOutstanding } });
        }
    }

    receivable.amount = service.price;
    receivable.paidAmount = nextPaid;
    receivable.customerId = service.customerId;
    receivable.status = deriveLedgerStatus(service.price, nextPaid);
    receivable.description = `Service receivable: ${service.name}`;
    await receivable.save();
}

async function clearPayableForService(service: ServiceLedgerRef) {
    if (service.payableId) {
        const payable = await Payable.findById(service.payableId);
        if (payable) {
            const outstanding = Math.max(0, payable.amount - (payable.paidAmount ?? 0));
            if (outstanding > 0) {
                await Vendor.findByIdAndUpdate(payable.vendorId, { $inc: { balance: -outstanding } });
            }
            await Payable.deleteOne({ _id: payable._id });
        }
        service.payableId = undefined;
    }
}

async function clearLedgersForService(service: ServiceLedgerRef) {
    if (service.receivableId) {
        const receivable = await Receivable.findById(service.receivableId);
        if (receivable) {
            const outstanding = Math.max(0, receivable.amount - (receivable.paidAmount ?? 0));
            if (outstanding > 0) {
                await Customer.findByIdAndUpdate(receivable.customerId, { $inc: { balance: -outstanding } });
            }
            await Receivable.deleteOne({ _id: receivable._id });
        }
        service.receivableId = undefined;
    }

    await clearPayableForService(service);
}

async function updateLedgersForDeliveredService(
    service: ServiceLedgerRef,
    oldVendorId: string,
    oldCost: number
) {
    if (service.cost <= 0) {
        if (service.payableId) {
            const payable = await Payable.findById(service.payableId);
            if (payable) {
                const oldOutstanding = Math.max(0, oldCost - (payable.paidAmount ?? 0));
                if (oldOutstanding > 0) {
                    await Vendor.findByIdAndUpdate(oldVendorId, { $inc: { balance: -oldOutstanding } });
                }
                await Payable.deleteOne({ _id: payable._id });
            }
            service.payableId = undefined;
        }
        return;
    }

    if (!service.payableId) {
        await createLedgersForDeliveredService(service, service.deliveryDate ?? new Date());
        return;
    }

    const payable = await Payable.findById(service.payableId);
    if (!payable) {
        service.payableId = undefined;
        await createLedgersForDeliveredService(service, service.deliveryDate ?? new Date());
        return;
    }

    const oldOutstanding = Math.max(0, oldCost - (payable.paidAmount ?? 0));
    const nextPaid = Math.min(payable.paidAmount ?? 0, service.cost);
    const newOutstanding = Math.max(0, service.cost - nextPaid);

    if (oldVendorId === service.vendorId.toString()) {
        const delta = newOutstanding - oldOutstanding;
        if (delta !== 0) {
            await Vendor.findByIdAndUpdate(service.vendorId, { $inc: { balance: delta } });
        }
    } else {
        if (oldOutstanding > 0) {
            await Vendor.findByIdAndUpdate(oldVendorId, { $inc: { balance: -oldOutstanding } });
        }
        if (newOutstanding > 0) {
            await Vendor.findByIdAndUpdate(service.vendorId, { $inc: { balance: newOutstanding } });
        }
    }

    payable.amount = service.cost;
    payable.paidAmount = nextPaid;
    payable.vendorId = service.vendorId;
    payable.status = deriveLedgerStatus(service.cost, nextPaid);
    await payable.save();
}

export async function getServices() {
    await connect();

const services = await Service.find()
        .sort({ createdAt: -1 })
        .populate('customerId', 'name phone')
        .populate({
            path: 'vendorId',
            select: 'name',
            model: 'Vendor',
            match: { status: { $ne: null } } // Only match valid vendors
        })
        ;

    return services.map((service) => ({
        _id: service._id.toString(),
        name: service.name,
        description: service.description ?? '',
        category: service.category,
        serviceType: service.serviceType,
        price: service.price,
        cost: service.cost ?? 0,
        profit: service.profit ?? 0,
        status: service.status,
        customerId: service.customerId?._id?.toString?.() ?? '',
        customerName: service.customerId?.name ?? '',
        customerPhone: service.customerId?.phone ?? '',
        vendorId: service.vendorId?._id?.toString?.() ?? '',
        vendorName: service.vendorId?.name || 'Unknown Vendor',
        deliveryDate: service.deliveryDate?.toISOString() ?? '',
        createdAt: service.createdAt.toISOString(),
    }));
}

export async function getServicesByCustomer(customerId: string) {
    await connect();

    const services = await Service.find({ customerId })
        .sort({ createdAt: -1 })
        .populate({
            path: 'vendorId',
            select: 'name',
            model: 'Vendor'
        });

    return services.map((service) => ({
        _id: service._id.toString(),
        name: service.name,
        category: service.category,
        serviceType: service.serviceType,
        price: service.price,
        cost: service.cost ?? 0,
        profit: service.profit ?? 0,
        status: service.status,
        vendorId: service.vendorId?._id?.toString?.() ?? '',
        vendorName: service.vendorId?.name || 'Unknown Vendor',
        deliveryDate: service.deliveryDate?.toISOString() ?? '',
        createdAt: service.createdAt.toISOString(),
    }));
}

export async function getServicesByVendor(vendorId: string) {
    await connect();

    const services = await Service.find({ vendorId })
        .sort({ createdAt: -1 })
        .populate('customerId', 'name phone');

    return services.map((service) => ({
        _id: service._id.toString(),
        name: service.name,
        category: service.category,
        serviceType: service.serviceType,
        price: service.price,
        cost: service.cost ?? 0,
        profit: service.profit ?? 0,
        status: service.status,
        customerId: service.customerId?._id?.toString?.() ?? '',
        customerName: service.customerId?.name ?? '',
        customerPhone: service.customerId?.phone ?? '',
        deliveryDate: service.deliveryDate?.toISOString() ?? '',
        createdAt: service.createdAt.toISOString(),
    }));
}

export async function createService(data: ServiceInput) {
    try {
        await connect();

        const name = normalizeText(data.name);
        if (!name) return { error: 'Service name is required' };

        const category = normalizeText(data.category);
        if (!category) return { error: 'Category is required' };

        const price = parseAmount(data.price);
        if (price === null) return { error: 'Price must be 0 or greater' };

        const cost = data.cost !== undefined ? parseAmount(data.cost) ?? 0 : 0;
        const profit = price - cost;

        if (!isValidStatus(data.status)) {
            return { error: 'Invalid status' };
        }

        const customerId = normalizeText(data.customerId);
        if (!customerId) return { error: 'Customer is required' };

        const vendorId = normalizeText(data.vendorId);
        if (!vendorId) return { error: 'Vendor is required' };

        const deliveryDate = normalizeDate(data.deliveryDate);

        // Validate customer exists
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return { error: 'Selected customer does not exist' };
        }

        // Validate vendor exists
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return { error: 'Selected vendor does not exist' };
        }

        // Create service with travel-specific details
        const serviceData: Record<string, unknown> = {
            name,
            description: normalizeText(data.description),
            category,
            serviceType: data.serviceType,
            price,
            cost,
            profit,
            status: data.status,
            customerId,
            vendorId,
            deliveryDate,
        };

        // Add service-specific details based on type
        if (data.serviceType === 'visa' && data.visaDetails) {
            serviceData.visaDetails = {
                visaType: data.visaDetails.visaType,
                country: data.visaDetails.country,
                applicationDate: normalizeDate(data.visaDetails.applicationDate),
                submissionDate: normalizeDate(data.visaDetails.submissionDate),
                approvalDate: normalizeDate(data.visaDetails.approvalDate),
                visaNumber: data.visaDetails.visaNumber,
                expiryDate: normalizeDate(data.visaDetails.expiryDate),
                entryType: data.visaDetails.entryType,
                duration: data.visaDetails.duration,
            };
        }

        if (data.serviceType === 'air_ticket' && data.ticketDetails) {
            serviceData.ticketDetails = {
                airline: data.ticketDetails.airline,
                flightNumber: data.ticketDetails.flightNumber,
                routeFrom: data.ticketDetails.routeFrom,
                routeTo: data.ticketDetails.routeTo,
                departureDate: normalizeDate(data.ticketDetails.departureDate),
                arrivalDate: normalizeDate(data.ticketDetails.arrivalDate),
                flightClass: data.ticketDetails.flightClass,
                pnr: data.ticketDetails.pnr,
                ticketNumber: data.ticketDetails.ticketNumber,
                baggageAllowance: data.ticketDetails.baggageAllowance,
                isRoundTrip: data.ticketDetails.isRoundTrip,
            };
        }

        if (data.serviceType === 'medical' && data.medicalDetails) {
            serviceData.medicalDetails = {
                medicalCenter: data.medicalDetails.medicalCenter,
                appointmentDate: normalizeDate(data.medicalDetails.appointmentDate),
                reportDate: normalizeDate(data.medicalDetails.reportDate),
                testResults: data.medicalDetails.testResults,
                certificateNumber: data.medicalDetails.certificateNumber,
                expiryDate: normalizeDate(data.medicalDetails.expiryDate),
            };
        }

        if (data.serviceType === 'taqamul' && data.taqamulDetails) {
            serviceData.taqamulDetails = {
                examCenter: data.taqamulDetails.examCenter,
                examDate: normalizeDate(data.taqamulDetails.examDate),
                registrationNumber: data.taqamulDetails.registrationNumber,
                resultStatus: data.taqamulDetails.resultStatus,
                certificateNumber: data.taqamulDetails.certificateNumber,
                score: data.taqamulDetails.score,
            };
        }

        if (data.passengerDetails && data.passengerDetails.length > 0) {
            serviceData.passengerDetails = data.passengerDetails.map(p => ({
                name: p.name,
                passportNumber: p.passportNumber,
                dateOfBirth: normalizeDate(p.dateOfBirth),
                nationality: p.nationality,
            }));
        }

        const service = await Service.create(serviceData);

        if (data.status !== 'cancelled') {
            await ensureServiceReceivable(service, deliveryDate ?? new Date());
        }

        if (data.status === 'delivered') {
            await createLedgersForDeliveredService(service, deliveryDate ?? new Date());
        }

        // Update customer stats
        customer.totalServices = (customer.totalServices || 0) + 1;
        await customer.save();

        // Update vendor stats
        vendor.totalServicesProvided = (vendor.totalServicesProvided || 0) + 1;
        await vendor.save();

        await service.save();

        revalidateServiceViews();
        return { success: true, serviceId: service._id.toString() };
    } catch (error) {
        console.error('Create service error:', error);
        return { error: 'Failed to create service record' };
    }
}

export async function updateService(id: string, data: ServiceInput) {
    try {
        await connect();

        const name = normalizeText(data.name);
        if (!name) return { error: 'Service name is required' };

        const category = normalizeText(data.category);
        if (!category) return { error: 'Category is required' };

        const price = parseAmount(data.price);
        if (price === null) return { error: 'Price must be 0 or greater' };

        const cost = data.cost !== undefined ? parseAmount(data.cost) ?? 0 : 0;
        const profit = price - cost;

        if (!isValidStatus(data.status)) {
            return { error: 'Invalid status' };
        }

        const customerId = normalizeText(data.customerId);
        if (!customerId) return { error: 'Customer is required' };

        const vendorId = normalizeText(data.vendorId);
        if (!vendorId) return { error: 'Vendor is required' };

        const deliveryDate = normalizeDate(data.deliveryDate);

        const service = await Service.findById(id);
        if (!service) {
            return { error: 'Service record not found' };
        }

        // Validate customer exists
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return { error: 'Selected customer does not exist' };
        }

        // Validate vendor exists
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return { error: 'Selected vendor does not exist' };
        }

        const oldStatus = service.status;
        const oldPrice = service.price;
        const oldCost = service.cost ?? 0;
        const oldCustomerId = service.customerId.toString();
        const oldVendorId = service.vendorId.toString();

        // Update basic fields
        service.name = name;
        service.description = normalizeText(data.description);
        service.category = category;
        service.serviceType = data.serviceType;
        service.price = price;
        service.cost = cost;
        service.profit = profit;
        service.status = data.status;
        service.customerId = customerId;
        service.vendorId = vendorId;
        service.deliveryDate = deliveryDate;

        // Update service-specific details
        if (data.serviceType === 'visa' && data.visaDetails) {
            service.visaDetails = {
                visaType: data.visaDetails.visaType,
                country: data.visaDetails.country,
                applicationDate: normalizeDate(data.visaDetails.applicationDate),
                submissionDate: normalizeDate(data.visaDetails.submissionDate),
                approvalDate: normalizeDate(data.visaDetails.approvalDate),
                visaNumber: data.visaDetails.visaNumber,
                expiryDate: normalizeDate(data.visaDetails.expiryDate),
                entryType: data.visaDetails.entryType,
                duration: data.visaDetails.duration,
            };
        }

        if (data.serviceType === 'air_ticket' && data.ticketDetails) {
            service.ticketDetails = {
                airline: data.ticketDetails.airline,
                flightNumber: data.ticketDetails.flightNumber,
                routeFrom: data.ticketDetails.routeFrom,
                routeTo: data.ticketDetails.routeTo,
                departureDate: normalizeDate(data.ticketDetails.departureDate),
                arrivalDate: normalizeDate(data.ticketDetails.arrivalDate),
                flightClass: data.ticketDetails.flightClass,
                pnr: data.ticketDetails.pnr,
                ticketNumber: data.ticketDetails.ticketNumber,
                baggageAllowance: data.ticketDetails.baggageAllowance,
                isRoundTrip: data.ticketDetails.isRoundTrip,
            };
        }

        if (data.serviceType === 'medical' && data.medicalDetails) {
            service.medicalDetails = {
                medicalCenter: data.medicalDetails.medicalCenter,
                appointmentDate: normalizeDate(data.medicalDetails.appointmentDate),
                reportDate: normalizeDate(data.medicalDetails.reportDate),
                testResults: data.medicalDetails.testResults,
                certificateNumber: data.medicalDetails.certificateNumber,
                expiryDate: normalizeDate(data.medicalDetails.expiryDate),
            };
        }

        if (data.serviceType === 'taqamul' && data.taqamulDetails) {
            service.taqamulDetails = {
                examCenter: data.taqamulDetails.examCenter,
                examDate: normalizeDate(data.taqamulDetails.examDate),
                registrationNumber: data.taqamulDetails.registrationNumber,
                resultStatus: data.taqamulDetails.resultStatus,
                certificateNumber: data.taqamulDetails.certificateNumber,
                score: data.taqamulDetails.score,
            };
        }

        if (data.passengerDetails) {
            service.passengerDetails = data.passengerDetails.map(p => ({
                name: p.name,
                passportNumber: p.passportNumber,
                dateOfBirth: normalizeDate(p.dateOfBirth),
                nationality: p.nationality,
            }));
        }

        if (data.status === 'cancelled') {
            await clearLedgersForService(service);
        } else {
            if (oldStatus === 'cancelled') {
                await ensureServiceReceivable(service, deliveryDate ?? new Date());
            }

            if (data.status === 'delivered' && oldStatus !== 'delivered') {
                await createLedgersForDeliveredService(service, deliveryDate ?? new Date());
            } else if (data.status !== 'delivered' && oldStatus === 'delivered') {
                await clearPayableForService(service);
            } else if (data.status === 'delivered' && oldStatus === 'delivered') {
                await updateLedgersForDeliveredService(service, oldVendorId, oldCost);
            }

            await syncServiceReceivable(service, oldCustomerId, oldPrice);
        }

        await service.save();

        revalidateServiceViews();
        return { success: true };
    } catch (error) {
        console.error('Update service error:', error);
        return { error: 'Failed to update service record' };
    }
}

export async function deleteService(id: string) {
    try {
        await connect();

        const service = await Service.findById(id);
        if (!service) {
            return { error: 'Service record not found' };
        }

        await clearLedgersForService(service);

        // Update customer stats
        const customer = await Customer.findById(service.customerId);
        if (customer && customer.totalServices > 0) {
            customer.totalServices -= 1;
            await customer.save();
        }

        // Update vendor stats
        const vendor = await Vendor.findById(service.vendorId);
        if (vendor && vendor.totalServicesProvided > 0) {
            vendor.totalServicesProvided -= 1;
            await vendor.save();
        }

        await Service.deleteOne({ _id: id });

        revalidateServiceViews();
        return { success: true };
    } catch (error) {
        console.error('Delete service error:', error);
        return { error: 'Failed to delete service record' };
    }
}

export async function deliverService(id: string, deliveryDate?: string) {
    try {
        await connect();

        const date = normalizeDate(deliveryDate) ?? new Date();

        const service = await Service.findById(id);
        if (!service) {
            return { error: 'Service record not found' };
        }

        if (service.status === 'cancelled') {
            return { error: 'Cannot deliver a cancelled service' };
        }

        service.status = 'delivered';
        service.deliveryDate = date;

        await ensureServiceReceivable(service, date);

        await createLedgersForDeliveredService(service, date);

        await service.save();

        revalidateServiceViews();
        return { success: true };
    } catch (error) {
        console.error('Deliver service error:', error);
        return { error: 'Failed to deliver service' };
    }
}

export async function updateServiceStatus(
    id: string,
    status: 'pending' | 'in-progress' | 'ready' | 'delivered' | 'cancelled',
    options?: { deliveryDate?: string }
) {
    try {
        await connect();

        if (!isValidStatus(status)) {
            return { error: 'Invalid status' };
        }

        const service = await Service.findById(id);
        if (!service) {
            return { error: 'Service record not found' };
        }

        const oldStatus = service.status;
        if (oldStatus === status) {
            return { success: true };
        }

        if (status === 'cancelled') {
            service.status = status;
            await clearLedgersForService(service);
        } else if (status === 'delivered' && oldStatus !== 'delivered') {
            const date = normalizeDate(options?.deliveryDate) ?? service.deliveryDate ?? new Date();

            service.status = 'delivered';
            service.deliveryDate = date;

            await ensureServiceReceivable(service, date);
            await createLedgersForDeliveredService(service, date);
        } else if (status !== 'delivered' && oldStatus === 'delivered') {
            service.status = status;
            await clearPayableForService(service);
        } else {
            service.status = status;
            if (oldStatus === 'cancelled') {
                await ensureServiceReceivable(service, service.deliveryDate ?? new Date());
            }
        }

        await service.save();

        revalidateServiceViews();
        return { success: true };
    } catch (error) {
        console.error('Update service status error:', error);
        return { error: 'Failed to update service status' };
    }
}
