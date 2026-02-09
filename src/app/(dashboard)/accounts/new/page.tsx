import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { AddAccountForm } from '@/components/accounts/add-account-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewAccountPage() {
    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Add Account</h2>
                    <p className="text-sm text-muted-foreground">Create a new financial account to track your assets and balances.</p>
                </div>
                <Link
                    href="/accounts"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Back to Accounts
                </Link>
            </div>

            <Card className="border-border/70">
                <CardHeader>
                    <CardTitle>Account Details</CardTitle>
                    <CardDescription>Fill in the required fields and save the account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <AddAccountForm />
                </CardContent>
            </Card>
        </div>
    );
}
