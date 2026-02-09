import { getCustomers } from '@/actions/customers';
import { getServices } from '@/actions/services';
import { getVendors } from '@/actions/vendors';
import { ServiceManager } from '@/components/services/service-manager';

type ServicesPageProps = {
    searchParams?: { customerId?: string; vendorId?: string; create?: string } | Promise<{ customerId?: string; vendorId?: string; create?: string }>;
};

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
    const params = (await Promise.resolve(searchParams)) ?? {};
    const [services, customers, vendors] = await Promise.all([
        getServices(),
        getCustomers(),
        getVendors(),
    ]);

    return (
        <ServiceManager
            services={services}
            customers={customers.map((customer) => ({ _id: customer._id, name: customer.name }))}
            vendors={vendors.map((vendor) => ({ _id: vendor._id, name: vendor.name, serviceTemplates: vendor.serviceTemplates ?? [] }))}
            initialCustomerId={params.customerId}
            initialVendorId={params.vendorId}
            autoOpenCreate={params.create === '1'}
        />
    );
}
