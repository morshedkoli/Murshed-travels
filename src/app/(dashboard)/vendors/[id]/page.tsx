import { notFound } from 'next/navigation';
import { getAccounts } from '@/actions/accounts';
import { getServicesByVendor } from '@/actions/services';
import { getVendorById, getVendorLedger, getVendorTransactionHistory } from '@/actions/vendors';
import { VendorProfileView } from '@/components/vendors/vendor-profile-view';

type VendorProfilePageProps = {
    params: Promise<{ id: string }>;
};

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
            services={services}
            ledger={ledger}
            accounts={accounts.map((account) => ({ _id: account._id, name: account.name }))}
            transactions={transactions}
        />
    );
}
