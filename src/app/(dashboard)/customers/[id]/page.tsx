import { notFound } from 'next/navigation';
import { getAccounts } from '@/actions/accounts';
import { getCustomerById, getCustomerLedger, getCustomerTransactionHistory } from '@/actions/customers';
import { getServicesByCustomer } from '@/actions/services';
import { CustomerProfileView } from '@/components/customers/customer-profile-view';

type CustomerProfilePageProps = {
    params: Promise<{ id: string }>;
};

const SERVICE_STATUSES = ['pending', 'in-progress', 'ready', 'delivered', 'cancelled'] as const;
type ServiceStatus = (typeof SERVICE_STATUSES)[number];

function toServiceStatus(status: string): ServiceStatus {
    return SERVICE_STATUSES.includes(status as ServiceStatus) ? (status as ServiceStatus) : 'pending';
}

function toTransactionType(type: string): 'income' | 'expense' {
    return type === 'expense' ? 'expense' : 'income';
}

export default async function CustomerProfilePage({ params }: CustomerProfilePageProps) {
    const { id } = await params;
    const [customer, services, ledger, accounts, transactions] = await Promise.all([
        getCustomerById(id),
        getServicesByCustomer(id),
        getCustomerLedger(id),
        getAccounts(),
        getCustomerTransactionHistory(id),
    ]);

    if (!customer) {
        notFound();
    }

    return (
        <CustomerProfileView
            customer={customer}
            services={services.map((service) => ({
                ...service,
                status: toServiceStatus(service.status),
            }))}
            ledger={ledger}
            accounts={accounts.map((account) => ({ _id: account._id, name: account.name }))}
            transactions={transactions.map((transaction) => ({
                ...transaction,
                type: toTransactionType(transaction.type),
            }))}
        />
    );
}
