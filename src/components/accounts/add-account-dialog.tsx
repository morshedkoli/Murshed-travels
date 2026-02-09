'use strict';
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { createAccount } from '@/actions/accounts';

export function AddAccountDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [accountType, setAccountType] = useState('Cash');

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);

        const formData = new FormData(event.currentTarget);
        const data = {
            name: formData.get('name') as string,
            type: accountType,
            balance: Number(formData.get('balance')),
            bankName: formData.get('bankName') as string || undefined,
            accountNumber: formData.get('accountNumber') as string || undefined,
        };

        const result = await createAccount(data);

        if (result.success) {
            setOpen(false);
            // Optionally toast success
            console.log('Account created');
        } else {
            console.error(result.error);
            // Optionally toast error
        }
        setLoading(false);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Account
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Account</DialogTitle>
                    <DialogDescription>
                        Create a new financial account to track your assets.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="e.g. Petty Cash"
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="type" className="text-right">
                                Type
                            </Label>
                            <Select
                                value={accountType}
                                onValueChange={setAccountType}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                    <SelectItem value="Bank">Bank</SelectItem>
                                    <SelectItem value="Mobile Banking">Mobile Banking</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {accountType === 'Bank' && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="bankName" className="text-right">
                                    Bank Name
                                </Label>
                                <Input
                                    id="bankName"
                                    name="bankName"
                                    placeholder="e.g. City Bank"
                                    className="col-span-3"
                                />
                            </div>
                        )}

                        {(accountType === 'Bank' || accountType === 'Mobile Banking') && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="accountNumber" className="text-right">
                                    Account No
                                </Label>
                                <Input
                                    id="accountNumber"
                                    name="accountNumber"
                                    placeholder="e.g. 1234..."
                                    className="col-span-3"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="balance" className="text-right">
                                Initial Balance
                            </Label>
                            <Input
                                id="balance"
                                name="balance"
                                type="number"
                                defaultValue="0"
                                className="col-span-3"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Account'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
