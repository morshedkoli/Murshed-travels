import { getCustomers } from '@/actions/customers';
import { getServices } from '@/actions/services';
import { getVendors } from '@/actions/vendors';
import { ServiceManager } from '@/components/services/service-manager';

type ServicesPageProps = {
    searchParams?: { customerId?: string; vendorId?: string; create?: string } | Promise<{ customerId?: string; vendorId?: string; create?: string }>;
};

const SERVICE_TYPES = ['visa', 'air_ticket', 'medical', 'taqamul', 'hotel', 'package', 'other'] as const;
const SERVICE_STATUSES = ['pending', 'in-progress', 'ready', 'delivered', 'cancelled'] as const;
type ServiceType = (typeof SERVICE_TYPES)[number];
type ServiceStatus = (typeof SERVICE_STATUSES)[number];

function toServiceType(value: string): ServiceType {
    return SERVICE_TYPES.includes(value as ServiceType) ? (value as ServiceType) : 'other';
}

function toServiceStatus(value: string): ServiceStatus {
    return SERVICE_STATUSES.includes(value as ServiceStatus) ? (value as ServiceStatus) : 'pending';
}

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
    const params = (await Promise.resolve(searchParams)) ?? {};
    const [services, customers, vendors] = await Promise.all([
        getServices(),
        getCustomers(),
        getVendors(),
    ]);

    return (
        <ServiceManager
            services={services.map((service) => ({
                ...service,
                serviceType: toServiceType(service.serviceType),
                status: toServiceStatus(service.status),
            }))}
            customers={customers.map((customer) => ({ _id: customer._id, name: customer.name }))}
            vendors={vendors.map((vendor) => ({
                _id: vendor._id,
                name: vendor.name,
                serviceTemplates: (vendor.serviceTemplates ?? []).map((template) => ({
                    ...template,
                    serviceType: toServiceType(template.serviceType),
                })),
            }))}
            initialCustomerId={params.customerId}
            initialVendorId={params.vendorId}
            autoOpenCreate={params.create === '1'}
        />
    );
}
