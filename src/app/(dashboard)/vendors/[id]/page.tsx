import { notFound } from 'next/navigation';
import { getAccounts } from '@/actions/accounts';
import { getServicesByVendor } from '@/actions/services';
import { getVendorById, getVendorLedger, getVendorTransactionHistory } from '@/actions/vendors';
import { VendorProfileView } from '@/components/vendors/vendor-profile-view';

type VendorProfilePageProps = {
    params: Promise<{ id: string }>;
};

const SERVICE_STATUSES = ['pending', 'in-progress', 'ready', 'delivered', 'cancelled'] as const;
type ServiceStatus = (typeof SERVICE_STATUSES)[number];

function toServiceStatus(value: string): ServiceStatus {
    return SERVICE_STATUSES.includes(value as ServiceStatus) ? (value as ServiceStatus) : 'pending';
}

function toTransactionType(type: string): 'income' | 'expense' {
    return type === 'income' ? 'income' : 'expense';
}

function toPayableStatus(status: string): 'unpaid' | 'partial' | 'paid' {
    if (status === 'partial') return 'partial';
    if (status === 'paid') return 'paid';
    return 'unpaid';
}

export default async function VendorProfilePage({ params }: VendorProfilePageProps) {
    const { id } = await params;
    const [vendor, services, ledger, accounts, transactions] = await Promise.all([
        getVendorById(id),
        getServicesByVendor(id),
        getVendorLedger(id),
        getAccounts(),
        getVendorTransactionHistory(id),
    ]);

    if (!vendor) {
        notFound();
    }

    return (
        <VendorProfileView
            key={`${vendor._id}-${vendor.serviceTemplates.length}`}
            vendor={vendor}
            services={services.map((service) => ({
                ...service,
                status: toServiceStatus(service.status),
            }))}
            ledger={{
                ...ledger,
                payables: ledger.payables.map((payable) => ({
                    ...payable,
                    status: toPayableStatus(payable.status),
                })),
            }}
            accounts={accounts.map((account) => ({ _id: account._id, name: account.name }))}
            transactions={transactions.map((transaction) => ({
                ...transaction,
                type: toTransactionType(transaction.type),
            }))}
        />
    );
}
