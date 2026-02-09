'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCustomer } from '@/actions/customers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AddCustomerForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData(event.currentTarget);
        const payload = {
            name: String(formData.get('name') ?? ''),
            phone: String(formData.get('phone') ?? ''),
            email: String(formData.get('email') ?? '') || undefined,
            address: String(formData.get('address') ?? '') || undefined,
            passportNumber: String(formData.get('passportNumber') ?? '') || undefined,
            nationality: String(formData.get('nationality') ?? '') || undefined,
        };

        const result = await createCustomer(payload);

        if (result.success) {
            const customerId = result.customer?._id;
            router.push(customerId ? `/customers/${customerId}` : '/customers');
            router.refresh();
            return;
        }

        setError(result.error ?? 'Failed to create customer');
        setLoading(false);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="name">Customer Name</Label>
                    <Input id="name" name="name" placeholder="e.g. Rahim Enterprise" required />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" placeholder="e.g. 017XXXXXXXX" required />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="e.g. customer@mail.com" />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" name="address" placeholder="e.g. Dhaka, Bangladesh" />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="passportNumber">Passport Number</Label>
                    <Input id="passportNumber" name="passportNumber" placeholder="e.g. A12345678" />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="nationality">Nationality</Label>
                    <Input id="nationality" name="nationality" placeholder="e.g. Bangladeshi" />
                </div>
            </div>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => router.push('/customers')}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Customer'}
                </Button>
            </div>
        </form>
    );
}
