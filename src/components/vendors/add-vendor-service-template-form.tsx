'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { addVendorServiceTemplate } from '@/actions/vendors';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';

type AddVendorServiceTemplateFormProps = {
    vendorId: string;
    onSaved?: (
        templates: Array<{ name: string; serviceType: string; category: string; defaultPrice: number; defaultCost: number }>,
        meta: { updated: boolean }
    ) => void;
};

export function AddVendorServiceTemplateForm({ vendorId, onSaved }: AddVendorServiceTemplateFormProps) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');
        const form = event.currentTarget;

        const formData = new FormData(form);
        const result = await addVendorServiceTemplate(vendorId, {
            name: String(formData.get('name') ?? ''),
            defaultPrice: Number(formData.get('defaultPrice') ?? 0),
            defaultCost: Number(formData.get('defaultCost') ?? 0),
        });

        if ('error' in result) {
            setError(result.error ?? 'Failed to add vendor service');
            toast({
                title: 'Error',
                description: result.error ?? 'Failed to add service',
                variant: 'error',
            });
            setLoading(false);
            return;
        }

        form.reset();
        setOpen(false);
        setLoading(false);
        toast({
            title: result.updated ? 'Service Updated' : 'Service Added',
            description: result.updated ? 'The vendor service has been updated.' : 'The vendor service has been added successfully.',
            variant: 'success',
        });

        if (onSaved) {
            onSaved([], { updated: Boolean(result.updated) });
        }

        // Force a full page reload to get fresh data from server
        window.location.href = window.location.href;
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Vendor Listed Service
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle>Add Vendor Listed Service</DialogTitle>
                    <DialogDescription>Define service name with default price and cost.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="template-name">Service Name</Label>
                        <Input id="template-name" name="name" placeholder="e.g. Saudi Employment Visa" required />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="template-price">Default Price</Label>
                            <Input id="template-price" name="defaultPrice" type="number" min="0" step="0.01" required />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="template-cost">Default Cost</Label>
                            <Input id="template-cost" name="defaultCost" type="number" min="0" step="0.01" required />
                        </div>
                    </div>

                    {error && <p className="text-xs font-medium text-destructive">{error}</p>}

                    <div className="flex justify-end">
                        <Button type="submit" size="sm" disabled={loading}>{loading ? 'Saving...' : 'Save Service'}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
