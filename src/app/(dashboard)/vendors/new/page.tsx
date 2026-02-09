import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { AddVendorForm } from '@/components/vendors/add-vendor-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewVendorPage() {
    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Add Vendor</h2>
                    <p className="text-sm text-muted-foreground">Create a vendor record to track payable balances and service info.</p>
                </div>
                <Link
                    href="/vendors"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Back to Vendors
                </Link>
            </div>

            <Card className="border-border/70">
                <CardHeader>
                    <CardTitle>Vendor Details</CardTitle>
                    <CardDescription>Fill in the fields and save your vendor.</CardDescription>
                </CardHeader>
                <CardContent>
                    <AddVendorForm />
                </CardContent>
            </Card>
        </div>
    );
}
