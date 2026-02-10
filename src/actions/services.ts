'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';

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

export async function getServices() {
    const { data: services, error } = await supabase
        .from('services')
        .select(`
            *,
            customers:customer_id (name, phone),
            vendors:vendor_id (name)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching services:', error);
        return [];
    }

    return (services || []).map((service) => ({
        _id: service.id,
        name: service.name,
        description: service.description || '',
        category: service.category,
        serviceType: service.service_type,
        price: service.price,
        cost: service.cost || 0,
        profit: service.profit || 0,
        status: service.status,
        customerId: service.customer_id || '',
        customerName: service.customers?.name || '',
        customerPhone: service.customers?.phone || '',
        vendorId: service.vendor_id || '',
        vendorName: service.vendors?.name || 'Unknown Vendor',
        deliveryDate: service.delivery_date || '',
        createdAt: service.created_at,
    }));
}

export async function getServicesByCustomer(customerId: string) {
    const { data: services, error } = await supabase
        .from('services')
        .select(`
            *,
            vendors:vendor_id (name)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching services by customer:', error);
        return [];
    }

    return (services || []).map((service) => ({
        _id: service.id,
        name: service.name,
        category: service.category,
        serviceType: service.service_type,
        price: service.price,
        cost: service.cost || 0,
        profit: service.profit || 0,
        status: service.status,
        vendorId: service.vendor_id || '',
        vendorName: service.vendors?.name || 'Unknown Vendor',
        deliveryDate: service.delivery_date || '',
        createdAt: service.created_at,
    }));
}

export async function getServicesByVendor(vendorId: string) {
    const { data: services, error } = await supabase
        .from('services')
        .select(`
            *,
            customers:customer_id (name, phone)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching services by vendor:', error);
        return [];
    }

    return (services || []).map((service) => ({
        _id: service.id,
        name: service.name,
        category: service.category,
        serviceType: service.service_type,
        price: service.price,
        cost: service.cost || 0,
        profit: service.profit || 0,
        status: service.status,
        customerId: service.customer_id || '',
        customerName: service.customers?.name || '',
        customerPhone: service.customers?.phone || '',
        deliveryDate: service.delivery_date || '',
        createdAt: service.created_at,
    }));
}

export async function createService(data: ServiceInput) {
    try {
        const name = normalizeText(data.name);
        if (!name) return { error: 'Service name is required' };

        const category = normalizeText(data.category);
        if (!category) return { error: 'Category is required' };

        const price = parseAmount(data.price);
        if (price === null) return { error: 'Price must be 0 or greater' };

        const cost = data.cost !== undefined ? parseAmount(data.cost) || 0 : 0;
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
        const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single();

        if (!customer) {
            return { error: 'Selected customer does not exist' };
        }

        // Validate vendor exists
        const { data: vendor } = await supabase
            .from('vendors')
            .select('*')
            .eq('id', vendorId)
            .single();

        if (!vendor) {
            return { error: 'Selected vendor does not exist' };
        }

        // Create service data
        const serviceData: Record<string, unknown> = {
            name,
            description: normalizeText(data.description) || null,
            category,
            service_type: data.serviceType,
            price,
            cost,
            profit,
            status: data.status,
            customer_id: customerId,
            vendor_id: vendorId,
            delivery_date: deliveryDate?.toISOString() || null,
        };

        // Add visa details
        if (data.serviceType === 'visa' && data.visaDetails) {
            serviceData.visa_type = data.visaDetails.visaType || null;
            serviceData.visa_country = data.visaDetails.country || null;
            serviceData.visa_application_date = data.visaDetails.applicationDate || null;
            serviceData.visa_submission_date = data.visaDetails.submissionDate || null;
            serviceData.visa_approval_date = data.visaDetails.approvalDate || null;
            serviceData.visa_number = data.visaDetails.visaNumber || null;
            serviceData.visa_expiry_date = data.visaDetails.expiryDate || null;
            serviceData.visa_entry_type = data.visaDetails.entryType || null;
            serviceData.visa_duration = data.visaDetails.duration || null;
        }

        // Add ticket details
        if (data.serviceType === 'air_ticket' && data.ticketDetails) {
            serviceData.ticket_airline = data.ticketDetails.airline || null;
            serviceData.ticket_flight_number = data.ticketDetails.flightNumber || null;
            serviceData.ticket_route_from = data.ticketDetails.routeFrom || null;
            serviceData.ticket_route_to = data.ticketDetails.routeTo || null;
            serviceData.ticket_departure_date = data.ticketDetails.departureDate || null;
            serviceData.ticket_arrival_date = data.ticketDetails.arrivalDate || null;
            serviceData.ticket_flight_class = data.ticketDetails.flightClass || null;
            serviceData.ticket_pnr = data.ticketDetails.pnr || null;
            serviceData.ticket_number = data.ticketDetails.ticketNumber || null;
            serviceData.ticket_baggage_allowance = data.ticketDetails.baggageAllowance || null;
            serviceData.ticket_is_round_trip = data.ticketDetails.isRoundTrip || false;
        }

        // Add medical details
        if (data.serviceType === 'medical' && data.medicalDetails) {
            serviceData.medical_center = data.medicalDetails.medicalCenter || null;
            serviceData.medical_appointment_date = data.medicalDetails.appointmentDate || null;
            serviceData.medical_report_date = data.medicalDetails.reportDate || null;
            serviceData.medical_test_results = data.medicalDetails.testResults || null;
            serviceData.medical_certificate_number = data.medicalDetails.certificateNumber || null;
            serviceData.medical_expiry_date = data.medicalDetails.expiryDate || null;
        }

        // Add taqamul details
        if (data.serviceType === 'taqamul' && data.taqamulDetails) {
            serviceData.taqamul_exam_center = data.taqamulDetails.examCenter || null;
            serviceData.taqamul_exam_date = data.taqamulDetails.examDate || null;
            serviceData.taqamul_registration_number = data.taqamulDetails.registrationNumber || null;
            serviceData.taqamul_result_status = data.taqamulDetails.resultStatus || null;
            serviceData.taqamul_certificate_number = data.taqamulDetails.certificateNumber || null;
            serviceData.taqamul_score = data.taqamulDetails.score || null;
        }

        // Create service
        const { data: service, error: serviceError } = await supabase
            .from('services')
            .insert(serviceData)
            .select()
            .single();

        if (serviceError || !service) {
            console.error('Create service error:', serviceError);
            return { error: 'Failed to create service record' };
        }

        // Create receivable if not cancelled
        if (data.status !== 'cancelled') {
            const dueDate = dueDateFrom(deliveryDate || new Date());
            
            const { data: receivable } = await supabase
                .from('receivables')
                .insert({
                    date: new Date().toISOString(),
                    due_date: dueDate.toISOString(),
                    amount: price,
                    paid_amount: 0,
                    status: 'unpaid',
                    business_id: 'travel',
                    customer_id: customerId,
                    description: `Service receivable: ${name}`,
                })
                .select()
                .single();

            if (receivable) {
                await supabase
                    .from('services')
                    .update({ receivable_id: receivable.id })
                    .eq('id', service.id);

                // Update customer balance
                await supabase
                    .from('customers')
                    .update({ balance: customer.balance + price })
                    .eq('id', customerId);
            }
        }

        // Create payable if delivered
        if (data.status === 'delivered' && cost > 0) {
            const dueDate = dueDateFrom(deliveryDate || new Date());
            
            const { data: payable } = await supabase
                .from('payables')
                .insert({
                    date: new Date().toISOString(),
                    due_date: dueDate.toISOString(),
                    amount: cost,
                    paid_amount: 0,
                    status: 'unpaid',
                    business_id: 'travel',
                    vendor_id: vendorId,
                    description: `Service payable: ${name}`,
                })
                .select()
                .single();

            if (payable) {
                await supabase
                    .from('services')
                    .update({ payable_id: payable.id })
                    .eq('id', service.id);

                // Update vendor balance
                await supabase
                    .from('vendors')
                    .update({ balance: vendor.balance + cost })
                    .eq('id', vendorId);
            }
        }

        // Add passenger details if provided
        if (data.passengerDetails && data.passengerDetails.length > 0) {
            const passengerData = data.passengerDetails.map(p => ({
                service_id: service.id,
                name: p.name,
                passport_number: p.passportNumber || null,
                date_of_birth: p.dateOfBirth || null,
                nationality: p.nationality || null,
            }));

            await supabase
                .from('service_passengers')
                .insert(passengerData);
        }

        // Update customer stats
        await supabase
            .from('customers')
            .update({ total_services: customer.total_services + 1 })
            .eq('id', customerId);

        // Update vendor stats
        await supabase
            .from('vendors')
            .update({ total_services_provided: vendor.total_services_provided + 1 })
            .eq('id', vendorId);

        revalidateServiceViews();
        return { success: true, serviceId: service.id };
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

        const price = parseAmount(data.price);
        if (price === null) return { error: 'Price must be 0 or greater' };

        const cost = data.cost !== undefined ? parseAmount(data.cost) || 0 : 0;
        const profit = price - cost;

        if (!isValidStatus(data.status)) {
            return { error: 'Invalid status' };
        }

        const customerId = normalizeText(data.customerId);
        if (!customerId) return { error: 'Customer is required' };

        const vendorId = normalizeText(data.vendorId);
        if (!vendorId) return { error: 'Vendor is required' };

        const deliveryDate = normalizeDate(data.deliveryDate);

        // Fetch existing service
        const { data: service } = await supabase
            .from('services')
            .select('*')
            .eq('id', id)
            .single();

        if (!service) {
            return { error: 'Service record not found' };
        }

        const oldStatus = service.status;
        const oldPrice = service.price;
        const oldCost = service.cost || 0;
        const oldCustomerId = service.customer_id;
        const oldVendorId = service.vendor_id;

        // Update service data
        const serviceData: Record<string, unknown> = {
            name,
            description: normalizeText(data.description) || null,
            category,
            service_type: data.serviceType,
            price,
            cost,
            profit,
            status: data.status,
            customer_id: customerId,
            vendor_id: vendorId,
            delivery_date: deliveryDate?.toISOString() || null,
        };

        // Update visa details
        if (data.serviceType === 'visa' && data.visaDetails) {
            serviceData.visa_type = data.visaDetails.visaType || null;
            serviceData.visa_country = data.visaDetails.country || null;
            serviceData.visa_application_date = data.visaDetails.applicationDate || null;
            serviceData.visa_submission_date = data.visaDetails.submissionDate || null;
            serviceData.visa_approval_date = data.visaDetails.approvalDate || null;
            serviceData.visa_number = data.visaDetails.visaNumber || null;
            serviceData.visa_expiry_date = data.visaDetails.expiryDate || null;
            serviceData.visa_entry_type = data.visaDetails.entryType || null;
            serviceData.visa_duration = data.visaDetails.duration || null;
        }

        // Update ticket details
        if (data.serviceType === 'air_ticket' && data.ticketDetails) {
            serviceData.ticket_airline = data.ticketDetails.airline || null;
            serviceData.ticket_flight_number = data.ticketDetails.flightNumber || null;
            serviceData.ticket_route_from = data.ticketDetails.routeFrom || null;
            serviceData.ticket_route_to = data.ticketDetails.routeTo || null;
            serviceData.ticket_departure_date = data.ticketDetails.departureDate || null;
            serviceData.ticket_arrival_date = data.ticketDetails.arrivalDate || null;
            serviceData.ticket_flight_class = data.ticketDetails.flightClass || null;
            serviceData.ticket_pnr = data.ticketDetails.pnr || null;
            serviceData.ticket_number = data.ticketDetails.ticketNumber || null;
            serviceData.ticket_baggage_allowance = data.ticketDetails.baggageAllowance || null;
            serviceData.ticket_is_round_trip = data.ticketDetails.isRoundTrip || false;
        }

        // Update medical details
        if (data.serviceType === 'medical' && data.medicalDetails) {
            serviceData.medical_center = data.medicalDetails.medicalCenter || null;
            serviceData.medical_appointment_date = data.medicalDetails.appointmentDate || null;
            serviceData.medical_report_date = data.medicalDetails.reportDate || null;
            serviceData.medical_test_results = data.medicalDetails.testResults || null;
            serviceData.medical_certificate_number = data.medicalDetails.certificateNumber || null;
            serviceData.medical_expiry_date = data.medicalDetails.expiryDate || null;
        }

        // Update taqamul details
        if (data.serviceType === 'taqamul' && data.taqamulDetails) {
            serviceData.taqamul_exam_center = data.taqamulDetails.examCenter || null;
            serviceData.taqamul_exam_date = data.taqamulDetails.examDate || null;
            serviceData.taqamul_registration_number = data.taqamulDetails.registrationNumber || null;
            serviceData.taqamul_result_status = data.taqamulDetails.resultStatus || null;
            serviceData.taqamul_certificate_number = data.taqamulDetails.certificateNumber || null;
            serviceData.taqamul_score = data.taqamulDetails.score || null;
        }

        // Update service
        await supabase
            .from('services')
            .update(serviceData)
            .eq('id', id);

        // Handle status changes and ledgers
        // This is simplified - full implementation would handle all status transitions
        if (data.status === 'cancelled') {
            // Clear ledgers for cancelled service
            if (service.receivable_id) {
                await supabase.from('receivables').delete().eq('id', service.receivable_id);
            }
            if (service.payable_id) {
                await supabase.from('payables').delete().eq('id', service.payable_id);
            }
        }

        // Update passenger details if provided
        if (data.passengerDetails) {
            // Delete existing passengers
            await supabase
                .from('service_passengers')
                .delete()
                .eq('service_id', id);

            // Insert new passengers
            if (data.passengerDetails.length > 0) {
                const passengerData = data.passengerDetails.map(p => ({
                    service_id: id,
                    name: p.name,
                    passport_number: p.passportNumber || null,
                    date_of_birth: p.dateOfBirth || null,
                    nationality: p.nationality || null,
                }));

                await supabase
                    .from('service_passengers')
                    .insert(passengerData);
            }
        }

        revalidateServiceViews();
        return { success: true };
    } catch (error) {
        console.error('Update service error:', error);
        return { error: 'Failed to update service record' };
    }
}

export async function deleteService(id: string) {
    try {
        // Fetch existing service
        const { data: service } = await supabase
            .from('services')
            .select('*')
            .eq('id', id)
            .single();

        if (!service) {
            return { error: 'Service record not found' };
        }

        // Clear ledgers
        if (service.receivable_id) {
            const { data: receivable } = await supabase
                .from('receivables')
                .select('*')
                .eq('id', service.receivable_id)
                .single();

            if (receivable) {
                const outstanding = Math.max(0, receivable.amount - (receivable.paid_amount || 0));
                if (outstanding > 0) {
                    const { data: customer } = await supabase
                        .from('customers')
                        .select('*')
                        .eq('id', receivable.customer_id)
                        .single();

                    if (customer) {
                        await supabase
                            .from('customers')
                            .update({ balance: customer.balance - outstanding })
                            .eq('id', receivable.customer_id);
                    }
                }
                await supabase.from('receivables').delete().eq('id', service.receivable_id);
            }
        }

        if (service.payable_id) {
            const { data: payable } = await supabase
                .from('payables')
                .select('*')
                .eq('id', service.payable_id)
                .single();

            if (payable) {
                const outstanding = Math.max(0, payable.amount - (payable.paid_amount || 0));
                if (outstanding > 0) {
                    const { data: vendor } = await supabase
                        .from('vendors')
                        .select('*')
                        .eq('id', payable.vendor_id)
                        .single();

                    if (vendor) {
                        await supabase
                            .from('vendors')
                            .update({ balance: vendor.balance - outstanding })
                            .eq('id', payable.vendor_id);
                    }
                }
                await supabase.from('payables').delete().eq('id', service.payable_id);
            }
        }

        // Update customer stats
        if (service.customer_id) {
            const { data: customer } = await supabase
                .from('customers')
                .select('*')
                .eq('id', service.customer_id)
                .single();

            if (customer && customer.total_services > 0) {
                await supabase
                    .from('customers')
                    .update({ total_services: customer.total_services - 1 })
                    .eq('id', service.customer_id);
            }
        }

        // Update vendor stats
        if (service.vendor_id) {
            const { data: vendor } = await supabase
                .from('vendors')
                .select('*')
                .eq('id', service.vendor_id)
                .single();

            if (vendor && vendor.total_services_provided > 0) {
                await supabase
                    .from('vendors')
                    .update({ total_services_provided: vendor.total_services_provided - 1 })
                    .eq('id', service.vendor_id);
            }
        }

        // Delete service passengers
        await supabase
            .from('service_passengers')
            .delete()
            .eq('service_id', id);

        // Delete service documents
        await supabase
            .from('service_documents')
            .delete()
            .eq('service_id', id);

        // Delete service status history
        await supabase
            .from('service_status_history')
            .delete()
            .eq('service_id', id);

        // Delete service
        await supabase
            .from('services')
            .delete()
            .eq('id', id);

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

        const { data: service } = await supabase
            .from('services')
            .select('*')
            .eq('id', id)
            .single();

        if (!service) {
            return { error: 'Service record not found' };
        }

        if (service.status === 'cancelled') {
            return { error: 'Cannot deliver a cancelled service' };
        }

        // Update service status
        await supabase
            .from('services')
            .update({
                status: 'delivered',
                delivery_date: date.toISOString(),
            })
            .eq('id', id);

        // Create payable if cost > 0
        if (service.cost > 0 && !service.payable_id) {
            const dueDate = dueDateFrom(date);
            
            const { data: payable } = await supabase
                .from('payables')
                .insert({
                    date: date.toISOString(),
                    due_date: dueDate.toISOString(),
                    amount: service.cost,
                    paid_amount: 0,
                    status: 'unpaid',
                    business_id: 'travel',
                    vendor_id: service.vendor_id,
                    description: `Service payable: ${service.name}`,
                })
                .select()
                .single();

            if (payable) {
                await supabase
                    .from('services')
                    .update({ payable_id: payable.id })
                    .eq('id', id);

                // Update vendor balance
                const { data: vendor } = await supabase
                    .from('vendors')
                    .select('*')
                    .eq('id', service.vendor_id)
                    .single();

                if (vendor) {
                    await supabase
                        .from('vendors')
                        .update({ balance: vendor.balance + service.cost })
                        .eq('id', service.vendor_id);
                }
            }
        }

        // Create or update receivable
        if (!service.receivable_id) {
            const dueDate = dueDateFrom(date);
            
            const { data: receivable } = await supabase
                .from('receivables')
                .insert({
                    date: date.toISOString(),
                    due_date: dueDate.toISOString(),
                    amount: service.price,
                    paid_amount: 0,
                    status: 'unpaid',
                    business_id: 'travel',
                    customer_id: service.customer_id,
                    description: `Service receivable: ${service.name}`,
                })
                .select()
                .single();

            if (receivable) {
                await supabase
                    .from('services')
                    .update({ receivable_id: receivable.id })
                    .eq('id', id);

                // Update customer balance
                const { data: customer } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('id', service.customer_id)
                    .single();

                if (customer) {
                    await supabase
                        .from('customers')
                        .update({ balance: customer.balance + service.price })
                        .eq('id', service.customer_id);
                }
            }
        }

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
        if (!isValidStatus(status)) {
            return { error: 'Invalid status' };
        }

        const { data: service } = await supabase
            .from('services')
            .select('*')
            .eq('id', id)
            .single();

        if (!service) {
            return { error: 'Service record not found' };
        }

        const oldStatus = service.status;
        if (oldStatus === status) {
            return { success: true };
        }

        if (status === 'cancelled') {
            // Clear ledgers for cancelled service
            if (service.receivable_id) {
                await supabase.from('receivables').delete().eq('id', service.receivable_id);
            }
            if (service.payable_id) {
                await supabase.from('payables').delete().eq('id', service.payable_id);
            }

            await supabase
                .from('services')
                .update({ 
                    status,
                    receivable_id: null,
                    payable_id: null,
                })
                .eq('id', id);
        } else if (status === 'delivered' && oldStatus !== 'delivered') {
            const date = normalizeDate(options?.deliveryDate) || new Date();

            await supabase
                .from('services')
                .update({
                    status,
                    delivery_date: date.toISOString(),
                })
                .eq('id', id);

            // Create ledgers for delivered service
            if (!service.receivable_id) {
                const dueDate = dueDateFrom(date);
                
                const { data: receivable } = await supabase
                    .from('receivables')
                    .insert({
                        date: date.toISOString(),
                        due_date: dueDate.toISOString(),
                        amount: service.price,
                        paid_amount: 0,
                        status: 'unpaid',
                        business_id: 'travel',
                        customer_id: service.customer_id,
                        description: `Service receivable: ${service.name}`,
                    })
                    .select()
                    .single();

                if (receivable) {
                    await supabase
                        .from('services')
                        .update({ receivable_id: receivable.id })
                        .eq('id', id);

                    const { data: customer } = await supabase
                        .from('customers')
                        .select('*')
                        .eq('id', service.customer_id)
                        .single();

                    if (customer) {
                        await supabase
                            .from('customers')
                            .update({ balance: customer.balance + service.price })
                            .eq('id', service.customer_id);
                    }
                }
            }

            if (service.cost > 0 && !service.payable_id) {
                const dueDate = dueDateFrom(date);
                
                const { data: payable } = await supabase
                    .from('payables')
                    .insert({
                        date: date.toISOString(),
                        due_date: dueDate.toISOString(),
                        amount: service.cost,
                        paid_amount: 0,
                        status: 'unpaid',
                        business_id: 'travel',
                        vendor_id: service.vendor_id,
                        description: `Service payable: ${service.name}`,
                    })
                    .select()
                    .single();

                if (payable) {
                    await supabase
                        .from('services')
                        .update({ payable_id: payable.id })
                        .eq('id', id);

                    const { data: vendor } = await supabase
                        .from('vendors')
                        .select('*')
                        .eq('id', service.vendor_id)
                        .single();

                    if (vendor) {
                        await supabase
                            .from('vendors')
                            .update({ balance: vendor.balance + service.cost })
                            .eq('id', service.vendor_id);
                    }
                }
            }
        } else if (status !== 'delivered' && oldStatus === 'delivered') {
            // Clear payable when moving from delivered
            if (service.payable_id) {
                await supabase.from('payables').delete().eq('id', service.payable_id);
                await supabase
                    .from('services')
                    .update({ payable_id: null })
                    .eq('id', id);
            }

            await supabase
                .from('services')
                .update({ status })
                .eq('id', id);
        } else {
            await supabase
                .from('services')
                .update({ status })
                .eq('id', id);
        }

        revalidateServiceViews();
        return { success: true };
    } catch (error) {
        console.error('Update service status error:', error);
        return { error: 'Failed to update service status' };
    }
}
