'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export type ServiceInput = {
    name: string;
    description?: string;
    category: string;
    price: number;
    discountAmount?: number;
    extraChargeAmount?: number;
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

function dueDateFrom(baseDate: Date) {
    const due = new Date(baseDate);
    due.setDate(due.getDate() + 7);
    return due;
}

export async function getServices() {
    try {
        const services = await prisma.service.findMany({
            include: {
                customer: { select: { name: true, phone: true } },
                vendor: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return services.map((service) => ({
            _id: service.id,
            name: service.name,
            description: service.description || '',
            category: service.category,
            serviceType: service.serviceType,
            price: service.price,
            cost: service.cost || 0,
            profit: service.profit || 0,
            status: service.status,
            customerId: service.customerId || '',
            customerName: service.customer?.name || '',
            customerPhone: service.customer?.phone || '',
            vendorId: service.vendorId || '',
            vendorName: service.vendor?.name || 'Unknown Vendor',
            deliveryDate: service.deliveryDate ? service.deliveryDate.toISOString() : '',
            createdAt: service.createdAt.toISOString(),
        }));
    } catch (error) {
        console.error('Error fetching services:', error);
        return [];
    }
}

export async function getServicesByCustomer(customerId: string) {
    try {
        const services = await prisma.service.findMany({
            where: { customerId },
            include: { vendor: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });

        return services.map((service) => ({
            _id: service.id,
            name: service.name,
            category: service.category,
            serviceType: service.serviceType,
            price: service.price,
            cost: service.cost || 0,
            profit: service.profit || 0,
            status: service.status,
            vendorId: service.vendorId || '',
            vendorName: service.vendor?.name || 'Unknown Vendor',
            deliveryDate: service.deliveryDate ? service.deliveryDate.toISOString() : '',
            createdAt: service.createdAt.toISOString(),
        }));
    } catch (error) {
        console.error('Error fetching services by customer:', error);
        return [];
    }
}

export async function getServicesByVendor(vendorId: string) {
    try {
        const services = await prisma.service.findMany({
            where: { vendorId },
            include: { customer: { select: { name: true, phone: true } } },
            orderBy: { createdAt: 'desc' }
        });

        return services.map((service) => ({
            _id: service.id,
            name: service.name,
            category: service.category,
            serviceType: service.serviceType,
            price: service.price,
            cost: service.cost || 0,
            profit: service.profit || 0,
            status: service.status,
            customerId: service.customerId || '',
            customerName: service.customer?.name || '',
            customerPhone: service.customer?.phone || '',
            deliveryDate: service.deliveryDate ? service.deliveryDate.toISOString() : '',
            createdAt: service.createdAt.toISOString(),
        }));
    } catch (error) {
        console.error('Error fetching services by vendor:', error);
        return [];
    }
}

export async function createService(data: ServiceInput) {
    try {
        const name = normalizeText(data.name);
        if (!name) return { error: 'Service name is required' };

        const category = normalizeText(data.category);
        if (!category) return { error: 'Category is required' };

        const basePrice = parseAmount(data.price);
        if (basePrice === null) return { error: 'Price must be 0 or greater' };

        const discountAmount = data.discountAmount !== undefined ? parseAmount(data.discountAmount) : 0;
        if (discountAmount === null) return { error: 'Discount must be 0 or greater' };

        const extraChargeAmount = data.extraChargeAmount !== undefined ? parseAmount(data.extraChargeAmount) : 0;
        if (extraChargeAmount === null) return { error: 'Extra charge must be 0 or greater' };

        const price = basePrice - discountAmount + extraChargeAmount;
        if (price < 0) return { error: 'Final price cannot be negative' };

        const cost = data.cost !== undefined ? parseAmount(data.cost) || 0 : 0;
        const profit = price - cost;

        if (!isValidStatus(data.status)) return { error: 'Invalid status' };

        const customerId = normalizeText(data.customerId);
        if (!customerId) return { error: 'Customer is required' };

        const vendorId = normalizeText(data.vendorId);
        if (!vendorId) return { error: 'Vendor is required' };

        const deliveryDate = normalizeDate(data.deliveryDate);

        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) return { error: 'Selected customer does not exist' };

        const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
        if (!vendor) return { error: 'Selected vendor does not exist' };

        const adjustmentTags: string[] = [];
        if (discountAmount > 0) adjustmentTags.push(`Discount: ${discountAmount}`);
        if (extraChargeAmount > 0) adjustmentTags.push(`Extra charge: ${extraChargeAmount}`);
        const descriptionText = normalizeText(data.description);
        const mergedDescription = adjustmentTags.length > 0
            ? `${descriptionText ? `${descriptionText} | ` : ''}${adjustmentTags.join(' | ')}`
            : descriptionText;

        const serviceData: any = {
            name,
            description: mergedDescription || null,
            category,
            serviceType: data.serviceType,
            price,
            cost,
            profit,
            status: data.status,
            customerId,
            vendorId,
            deliveryDate,
            expenseRecorded: false
        };

        if (data.serviceType === 'visa' && data.visaDetails) {
            serviceData.visaType = data.visaDetails.visaType || null;
            serviceData.visaCountry = data.visaDetails.country || null;
            serviceData.visaApplicationDate = normalizeDate(data.visaDetails.applicationDate) || null;
            serviceData.visaSubmissionDate = normalizeDate(data.visaDetails.submissionDate) || null;
            serviceData.visaApprovalDate = normalizeDate(data.visaDetails.approvalDate) || null;
            serviceData.visaNumber = data.visaDetails.visaNumber || null;
            serviceData.visaExpiryDate = normalizeDate(data.visaDetails.expiryDate) || null;
            serviceData.visaEntryType = data.visaDetails.entryType || null;
            serviceData.visaDuration = data.visaDetails.duration || null;
        }

        if (data.serviceType === 'air_ticket' && data.ticketDetails) {
            serviceData.ticketAirline = data.ticketDetails.airline || null;
            serviceData.ticketFlightNumber = data.ticketDetails.flightNumber || null;
            serviceData.ticketRouteFrom = data.ticketDetails.routeFrom || null;
            serviceData.ticketRouteTo = data.ticketDetails.routeTo || null;
            serviceData.ticketDepartureDate = normalizeDate(data.ticketDetails.departureDate) || null;
            serviceData.ticketArrivalDate = normalizeDate(data.ticketDetails.arrivalDate) || null;
            serviceData.ticketFlightClass = data.ticketDetails.flightClass || null;
            serviceData.ticketPnr = data.ticketDetails.pnr || null;
            serviceData.ticketNumber = data.ticketDetails.ticketNumber || null;
            serviceData.ticketBaggageAllowance = data.ticketDetails.baggageAllowance || null;
            serviceData.ticketIsRoundTrip = data.ticketDetails.isRoundTrip || false;
        }

        if (data.serviceType === 'medical' && data.medicalDetails) {
            serviceData.medicalCenter = data.medicalDetails.medicalCenter || null;
            serviceData.medicalAppointmentDate = normalizeDate(data.medicalDetails.appointmentDate) || null;
            serviceData.medicalReportDate = normalizeDate(data.medicalDetails.reportDate) || null;
            serviceData.medicalTestResults = data.medicalDetails.testResults || null;
            serviceData.medicalCertificateNumber = data.medicalDetails.certificateNumber || null;
            serviceData.medicalExpiryDate = normalizeDate(data.medicalDetails.expiryDate) || null;
        }

        if (data.serviceType === 'taqamul' && data.taqamulDetails) {
            serviceData.taqamulExamCenter = data.taqamulDetails.examCenter || null;
            serviceData.taqamulExamDate = normalizeDate(data.taqamulDetails.examDate) || null;
            serviceData.taqamulRegistrationNumber = data.taqamulDetails.registrationNumber || null;
            serviceData.taqamulResultStatus = data.taqamulDetails.resultStatus || null;
            serviceData.taqamulCertificateNumber = data.taqamulDetails.certificateNumber || null;
            serviceData.taqamulScore = data.taqamulDetails.score || null;
        }

        let serviceId = '';

        await prisma.$transaction(async (tx) => {
            const service = await tx.service.create({ data: serviceData });
            serviceId = service.id;

            if (data.status !== 'cancelled') {
                const dueDate = dueDateFrom(deliveryDate || new Date());
                const receivable = await tx.receivable.create({
                    data: {
                        date: new Date(),
                        dueDate,
                        amount: price,
                        paidAmount: 0,
                        status: 'unpaid',
                        businessId: 'travel',
                        customerId,
                        description: `Service receivable: ${name}`,
                    }
                });

                await tx.service.update({
                    where: { id: service.id },
                    data: { receivableId: receivable.id }
                });

                await tx.customer.update({
                    where: { id: customerId },
                    data: { balance: { increment: price }, totalServices: { increment: 1 } }
                });
            } else {
                await tx.customer.update({
                    where: { id: customerId },
                    data: { totalServices: { increment: 1 } }
                });
            }

            if (data.status === 'delivered' && cost > 0) {
                const dueDate = dueDateFrom(deliveryDate || new Date());
                const payable = await tx.payable.create({
                    data: {
                        date: new Date(),
                        dueDate: dueDate,
                        amount: cost,
                        paidAmount: 0,
                        status: 'unpaid',
                        businessId: 'travel',
                        vendorId,
                        description: `Service payable: ${name}`,
                    }
                });

                await tx.service.update({
                    where: { id: service.id },
                    data: { payableId: payable.id }
                });

                await tx.vendor.update({
                    where: { id: vendorId },
                    data: { balance: { increment: cost }, totalServicesProvided: { increment: 1 } }
                });
            } else {
                await tx.vendor.update({
                    where: { id: vendorId },
                    data: { totalServicesProvided: { increment: 1 } }
                });
            }

            if (data.passengerDetails && data.passengerDetails.length > 0) {
                const passengerData = data.passengerDetails.map(p => ({
                    serviceId: service.id,
                    name: p.name,
                    passportNumber: p.passportNumber || null,
                    dateOfBirth: normalizeDate(p.dateOfBirth) || null,
                    nationality: p.nationality || null,
                }));
                await tx.servicePassenger.createMany({ data: passengerData });
            }
        });

        revalidateServiceViews();
        return { success: true, serviceId };
    } catch (error) {
        console.error('Create service error:', error);
        return { error: 'Failed to create service record' };
    }
}

export async function updateService(id: string, data: ServiceInput) {
    try {
        const name = normalizeText(data.name);
        if (!name) return { error: 'Service name is required' };

        const category = normalizeText(data.category);
        if (!category) return { error: 'Category is required' };

        const basePrice = parseAmount(data.price);
        if (basePrice === null) return { error: 'Price must be 0 or greater' };

        const discountAmount = data.discountAmount !== undefined ? parseAmount(data.discountAmount) : 0;
        if (discountAmount === null) return { error: 'Discount must be 0 or greater' };

        const extraChargeAmount = data.extraChargeAmount !== undefined ? parseAmount(data.extraChargeAmount) : 0;
        if (extraChargeAmount === null) return { error: 'Extra charge must be 0 or greater' };

        const price = basePrice - discountAmount + extraChargeAmount;
        if (price < 0) return { error: 'Final price cannot be negative' };

        const cost = data.cost !== undefined ? parseAmount(data.cost) || 0 : 0;
        const profit = price - cost;

        if (!isValidStatus(data.status)) return { error: 'Invalid status' };

        const customerId = normalizeText(data.customerId);
        if (!customerId) return { error: 'Customer is required' };

        const vendorId = normalizeText(data.vendorId);
        if (!vendorId) return { error: 'Vendor is required' };

        const deliveryDate = normalizeDate(data.deliveryDate);

        const service = await prisma.service.findUnique({ where: { id } });
        if (!service) return { error: 'Service record not found' };

        const adjustmentTags: string[] = [];
        if (discountAmount > 0) adjustmentTags.push(`Discount: ${discountAmount}`);
        if (extraChargeAmount > 0) adjustmentTags.push(`Extra charge: ${extraChargeAmount}`);
        const descriptionText = normalizeText(data.description);
        const mergedDescription = adjustmentTags.length > 0
            ? `${descriptionText ? `${descriptionText} | ` : ''}${adjustmentTags.join(' | ')}`
            : descriptionText;

        const serviceData: any = {
            name,
            description: mergedDescription || null,
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

        if (data.serviceType === 'visa' && data.visaDetails) {
            serviceData.visaType = data.visaDetails.visaType || null;
            serviceData.visaCountry = data.visaDetails.country || null;
            serviceData.visaApplicationDate = normalizeDate(data.visaDetails.applicationDate) || null;
            serviceData.visaSubmissionDate = normalizeDate(data.visaDetails.submissionDate) || null;
            serviceData.visaApprovalDate = normalizeDate(data.visaDetails.approvalDate) || null;
            serviceData.visaNumber = data.visaDetails.visaNumber || null;
            serviceData.visaExpiryDate = normalizeDate(data.visaDetails.expiryDate) || null;
            serviceData.visaEntryType = data.visaDetails.entryType || null;
            serviceData.visaDuration = data.visaDetails.duration || null;
        }

        if (data.serviceType === 'air_ticket' && data.ticketDetails) {
            serviceData.ticketAirline = data.ticketDetails.airline || null;
            serviceData.ticketFlightNumber = data.ticketDetails.flightNumber || null;
            serviceData.ticketRouteFrom = data.ticketDetails.routeFrom || null;
            serviceData.ticketRouteTo = data.ticketDetails.routeTo || null;
            serviceData.ticketDepartureDate = normalizeDate(data.ticketDetails.departureDate) || null;
            serviceData.ticketArrivalDate = normalizeDate(data.ticketDetails.arrivalDate) || null;
            serviceData.ticketFlightClass = data.ticketDetails.flightClass || null;
            serviceData.ticketPnr = data.ticketDetails.pnr || null;
            serviceData.ticketNumber = data.ticketDetails.ticketNumber || null;
            serviceData.ticketBaggageAllowance = data.ticketDetails.baggageAllowance || null;
            serviceData.ticketIsRoundTrip = data.ticketDetails.isRoundTrip || false;
        }

        if (data.serviceType === 'medical' && data.medicalDetails) {
            serviceData.medicalCenter = data.medicalDetails.medicalCenter || null;
            serviceData.medicalAppointmentDate = normalizeDate(data.medicalDetails.appointmentDate) || null;
            serviceData.medicalReportDate = normalizeDate(data.medicalDetails.reportDate) || null;
            serviceData.medicalTestResults = data.medicalDetails.testResults || null;
            serviceData.medicalCertificateNumber = data.medicalDetails.certificateNumber || null;
            serviceData.medicalExpiryDate = normalizeDate(data.medicalDetails.expiryDate) || null;
        }

        if (data.serviceType === 'taqamul' && data.taqamulDetails) {
            serviceData.taqamulExamCenter = data.taqamulDetails.examCenter || null;
            serviceData.taqamulExamDate = normalizeDate(data.taqamulDetails.examDate) || null;
            serviceData.taqamulRegistrationNumber = data.taqamulDetails.registrationNumber || null;
            serviceData.taqamulResultStatus = data.taqamulDetails.resultStatus || null;
            serviceData.taqamulCertificateNumber = data.taqamulDetails.certificateNumber || null;
            serviceData.taqamulScore = data.taqamulDetails.score || null;
        }

        await prisma.$transaction(async (tx) => {
            await tx.service.update({
                where: { id },
                data: serviceData
            });

            if (data.status === 'cancelled') {
                if (service.receivableId) {
                    await tx.receivable.delete({ where: { id: service.receivableId } });
                }
                if (service.payableId) {
                    await tx.payable.delete({ where: { id: service.payableId } });
                }
            }

            if (data.passengerDetails) {
                await tx.servicePassenger.deleteMany({ where: { serviceId: id } });
                if (data.passengerDetails.length > 0) {
                    const passengerData = data.passengerDetails.map(p => ({
                        serviceId: id,
                        name: p.name,
                        passportNumber: p.passportNumber || null,
                        dateOfBirth: normalizeDate(p.dateOfBirth) || null,
                        nationality: p.nationality || null,
                    }));
                    await tx.servicePassenger.createMany({ data: passengerData });
                }
            }
        });

        revalidateServiceViews();
        return { success: true };
    } catch (error) {
        console.error('Update service error:', error);
        return { error: 'Failed to update service record' };
    }
}

export async function deleteService(id: string) {
    try {
        const service = await prisma.service.findUnique({ where: { id } });
        if (!service) return { error: 'Service record not found' };

        await prisma.$transaction(async (tx) => {
            if (service.receivableId) {
                const receivable = await tx.receivable.findUnique({ where: { id: service.receivableId } });
                if (receivable) {
                    const outstanding = Math.max(0, receivable.amount - (receivable.paidAmount || 0));
                    if (outstanding > 0) {
                        await tx.customer.update({
                            where: { id: receivable.customerId },
                            data: { balance: { decrement: outstanding } }
                        });
                    }
                    await tx.receivable.delete({ where: { id: service.receivableId } });
                }
            }

            if (service.payableId) {
                const payable = await tx.payable.findUnique({ where: { id: service.payableId } });
                if (payable) {
                    const outstanding = Math.max(0, payable.amount - (payable.paidAmount || 0));
                    if (outstanding > 0) {
                        await tx.vendor.update({
                            where: { id: payable.vendorId },
                            data: { balance: { decrement: outstanding } }
                        });
                    }
                    await tx.payable.delete({ where: { id: service.payableId } });
                }
            }

            if (service.customerId) {
                const customer = await tx.customer.findUnique({ where: { id: service.customerId } });
                if (customer && customer.totalServices > 0) {
                    await tx.customer.update({
                        where: { id: service.customerId },
                        data: { totalServices: { decrement: 1 } }
                    });
                }
            }

            if (service.vendorId) {
                const vendor = await tx.vendor.findUnique({ where: { id: service.vendorId } });
                if (vendor && vendor.totalServicesProvided > 0) {
                    await tx.vendor.update({
                        where: { id: service.vendorId },
                        data: { totalServicesProvided: { decrement: 1 } }
                    });
                }
            }

            await tx.service.delete({ where: { id } });
        });

        revalidateServiceViews();
        return { success: true };
    } catch (error) {
        console.error('Delete service error:', error);
        return { error: 'Failed to delete service record' };
    }
}

export async function deliverService(id: string, deliveryDate?: string) {
    try {
        const date = normalizeDate(deliveryDate) || new Date();

        const service = await prisma.service.findUnique({ where: { id } });
        if (!service) return { error: 'Service record not found' };
        if (service.status === 'cancelled') return { error: 'Cannot deliver a cancelled service' };

        await prisma.$transaction(async (tx) => {
            await tx.service.update({
                where: { id },
                data: {
                    status: 'delivered',
                    deliveryDate: date,
                }
            });

            if (service.cost > 0 && !service.payableId) {
                const dueDate = dueDateFrom(date);
                const payable = await tx.payable.create({
                    data: {
                        date,
                        dueDate,
                        amount: service.cost,
                        paidAmount: 0,
                        status: 'unpaid',
                        businessId: 'travel',
                        vendorId: service.vendorId,
                        description: `Service payable: ${service.name}`,
                    }
                });

                await tx.service.update({
                    where: { id },
                    data: { payableId: payable.id }
                });

                await tx.vendor.update({
                    where: { id: service.vendorId },
                    data: { balance: { increment: service.cost } }
                });
            }

            if (!service.receivableId) {
                const dueDate = dueDateFrom(date);
                const receivable = await tx.receivable.create({
                    data: {
                        date,
                        dueDate,
                        amount: service.price,
                        paidAmount: 0,
                        status: 'unpaid',
                        businessId: 'travel',
                        customerId: service.customerId,
                        description: `Service receivable: ${service.name}`,
                    }
                });

                await tx.service.update({
                    where: { id },
                    data: { receivableId: receivable.id }
                });

                await tx.customer.update({
                    where: { id: service.customerId },
                    data: { balance: { increment: service.price } }
                });
            }
        });

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
        if (!isValidStatus(status)) return { error: 'Invalid status' };

        const service = await prisma.service.findUnique({ where: { id } });
        if (!service) return { error: 'Service record not found' };

        const oldStatus = service.status;
        if (oldStatus === status) return { success: true };

        await prisma.$transaction(async (tx) => {
            if (status === 'cancelled') {
                if (service.receivableId) {
                    await tx.receivable.delete({ where: { id: service.receivableId } });
                }
                if (service.payableId) {
                    await tx.payable.delete({ where: { id: service.payableId } });
                }

                await tx.service.update({
                    where: { id },
                    data: {
                        status,
                        receivableId: null,
                        payableId: null,
                    }
                });
            } else if (status === 'delivered' && oldStatus !== 'delivered') {
                const date = normalizeDate(options?.deliveryDate) || new Date();

                await tx.service.update({
                    where: { id },
                    data: {
                        status,
                        deliveryDate: date,
                    }
                });

                if (!service.receivableId) {
                    const dueDate = dueDateFrom(date);
                    const receivable = await tx.receivable.create({
                        data: {
                            date,
                            dueDate,
                            amount: service.price,
                            paidAmount: 0,
                            status: 'unpaid',
                            businessId: 'travel',
                            customerId: service.customerId,
                            description: `Service receivable: ${service.name}`,
                        }
                    });

                    await tx.service.update({
                        where: { id },
                        data: { receivableId: receivable.id }
                    });

                    await tx.customer.update({
                        where: { id: service.customerId },
                        data: { balance: { increment: service.price } }
                    });
                }

                if (service.cost > 0 && !service.payableId) {
                    const dueDate = dueDateFrom(date);
                    const payable = await tx.payable.create({
                        data: {
                            date,
                            dueDate,
                            amount: service.cost,
                            paidAmount: 0,
                            status: 'unpaid',
                            businessId: 'travel',
                            vendorId: service.vendorId,
                            description: `Service payable: ${service.name}`,
                        }
                    });

                    await tx.service.update({
                        where: { id },
                        data: { payableId: payable.id }
                    });

                    await tx.vendor.update({
                        where: { id: service.vendorId },
                        data: { balance: { increment: service.cost } }
                    });
                }
            } else if (status !== 'delivered' && oldStatus === 'delivered') {
                if (service.payableId) {
                    await tx.payable.delete({ where: { id: service.payableId } });
                    await tx.service.update({
                        where: { id },
                        data: { payableId: null }
                    });
                }

                await tx.service.update({
                    where: { id },
                    data: { status }
                });
            } else {
                await tx.service.update({
                    where: { id },
                    data: { status }
                });
            }
        });

        revalidateServiceViews();
        return { success: true };
    } catch (error) {
        console.error('Update service status error:', error);
        return { error: 'Failed to update service status' };
    }
}
