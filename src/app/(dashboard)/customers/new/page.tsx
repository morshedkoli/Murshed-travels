import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { AddCustomerForm } from '@/components/customers/add-customer-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewCustomerPage() {
    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Add Customer</h2>
                    <p className="text-sm text-muted-foreground">Create a customer record to track receivables and contact details.</p>
                </div>
                <Link
                    href="/customers"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Back to Customers
                </Link>
            </div>

            <Card className="border-border/70">
                <CardHeader>
                    <CardTitle>Customer Details</CardTitle>
                    <CardDescription>Fill in required details and save.</CardDescription>
                </CardHeader>
                <CardContent>
                    <AddCustomerForm />
                </CardContent>
            </Card>
        </div>
    );
}
