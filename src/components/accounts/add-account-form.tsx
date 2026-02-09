'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAccount } from '@/actions/accounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const accountTypes = ['Cash', 'Bank', 'Mobile Banking'] as const;

export function AddAccountForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [accountType, setAccountType] = useState<(typeof accountTypes)[number]>('Cash');
    const [error, setError] = useState('');

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData(event.currentTarget);
        const payload = {
            name: String(formData.get('name') ?? ''),
            type: accountType,
            balance: Number(formData.get('balance') ?? 0),
            bankName: String(formData.get('bankName') ?? '') || undefined,
            accountNumber: String(formData.get('accountNumber') ?? '') || undefined,
        };

        const result = await createAccount(payload);

        if (result.success) {
            router.push('/accounts');
            router.refresh();
            return;
        }

        setError(result.error ?? 'Failed to create account');
        setLoading(false);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="name">Account Name</Label>
                    <Input id="name" name="name" placeholder="e.g. Petty Cash" required />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="type">Account Type</Label>
                    <Select value={accountType} onValueChange={(value) => setAccountType(value as (typeof accountTypes)[number])}>
                        <SelectTrigger id="type" className="w-full rounded-lg bg-card">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            {accountTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                    {type}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {accountType === 'Bank' && (
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="bankName">Bank Name</Label>
                        <Input id="bankName" name="bankName" placeholder="e.g. City Bank" />
                    </div>
                )}

                {(accountType === 'Bank' || accountType === 'Mobile Banking') && (
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="accountNumber">Account Number</Label>
                        <Input id="accountNumber" name="accountNumber" placeholder="e.g. 1234..." />
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="balance">Initial Balance</Label>
                    <Input id="balance" name="balance" type="number" defaultValue="0" required />
                </div>
            </div>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => router.push('/accounts')}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Account'}
                </Button>
            </div>
        </form>
    );
}
