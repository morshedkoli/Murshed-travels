'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createVendor } from '@/actions/vendors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AddVendorForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [serviceCategory, setServiceCategory] = useState('visa');

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData(event.currentTarget);
        const payload = {
            name: String(formData.get('name') ?? ''),
            phone: String(formData.get('phone') ?? '') || undefined,
            serviceCategory,
        };

        const result = await createVendor(payload);

        if (result.success) {
            const vendorId = result.vendor?._id;
            router.push(vendorId ? `/vendors/${vendorId}` : '/vendors');
            router.refresh();
            return;
        }

        setError(result.error ?? 'Failed to create vendor');
        setLoading(false);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="name">Vendor Name</Label>
                    <Input id="name" name="name" placeholder="e.g. ABC Supplier" required />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" placeholder="e.g. 017XXXXXXXX" />
                </div>

                <div className="space-y-2 md:col-span-2">
                    <Label>Primary Service Category</Label>
                    <Select value={serviceCategory} onValueChange={setServiceCategory}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select service category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="visa">Visa</SelectItem>
                            <SelectItem value="air_ticket">Air Ticket</SelectItem>
                            <SelectItem value="medical">Medical</SelectItem>
                            <SelectItem value="taqamul">Taqamul</SelectItem>
                            <SelectItem value="hotel">Hotel</SelectItem>
                            <SelectItem value="transport">Transport</SelectItem>
                            <SelectItem value="package">Package</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => router.push('/vendors')}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Vendor'}
                </Button>
            </div>
        </form>
    );
}
