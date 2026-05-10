'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { changeAdminPin } from '@/actions/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';

type AdminProfileManagerProps = {
    profile: {
        role: string;
        createdAt: string;
        updatedAt: string;
    };
};

export function AdminProfileManager({ profile }: AdminProfileManagerProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [isPinSaving, setIsPinSaving] = useState(false);
    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [showCurrentPin, setShowCurrentPin] = useState(false);
    const [showNewPin, setShowNewPin] = useState(false);
    const [showConfirmPin, setShowConfirmPin] = useState(false);

    async function handlePinSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsPinSaving(true);

        const result = await changeAdminPin({
            currentPin,
            newPin,
            confirmPin,
        });

        if (result.success) {
            toast({
                title: 'PIN changed',
                description: 'PIN updated. Please sign in again.',
                variant: 'success',
            });
            setCurrentPin('');
            setNewPin('');
            setConfirmPin('');

            if (result.forceLogout) {
                router.push('/login');
                router.refresh();
                return;
            }
        } else {
            toast({
                title: 'PIN update failed',
                description: result.error || 'Could not change PIN.',
                variant: 'error',
            });
        }

        setIsPinSaving(false);
    }

    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border-border/70">
                <CardHeader>
                    <CardTitle>Admin Profile</CardTitle>
                    <CardDescription>Review your account information.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
                        <div className="mb-2">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Account Type</p>
                            <p className="font-medium text-lg capitalize text-foreground">{profile.role}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                            <p className="font-medium text-foreground">{new Date(profile.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Updated</p>
                            <p className="font-medium text-foreground">{new Date(profile.updatedAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border/70">
                <CardHeader>
                    <CardTitle>Change Security PIN</CardTitle>
                    <CardDescription>Update your 4-digit security PIN used for logging in.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePinSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="currentPin">Current PIN</Label>
                            <div className="relative">
                                <Input
                                    id="currentPin"
                                    type={showCurrentPin ? 'text' : 'password'}
                                    value={currentPin}
                                    onChange={(event) => {
                                        const val = event.target.value.replace(/[^0-9]/g, '');
                                        if (val.length <= 4) setCurrentPin(val);
                                    }}
                                    required
                                    className="pr-10 tracking-widest font-mono"
                                    maxLength={4}
                                    inputMode="numeric"
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    onClick={() => setShowCurrentPin((prev) => !prev)}
                                >
                                    {showCurrentPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="newPin">New PIN</Label>
                            <div className="relative">
                                <Input
                                    id="newPin"
                                    type={showNewPin ? 'text' : 'password'}
                                    value={newPin}
                                    onChange={(event) => {
                                        const val = event.target.value.replace(/[^0-9]/g, '');
                                        if (val.length <= 4) setNewPin(val);
                                    }}
                                    required
                                    className="pr-10 tracking-widest font-mono"
                                    maxLength={4}
                                    inputMode="numeric"
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    onClick={() => setShowNewPin((prev) => !prev)}
                                >
                                    {showNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPin">Confirm New PIN</Label>
                            <div className="relative">
                                <Input
                                    id="confirmPin"
                                    type={showConfirmPin ? 'text' : 'password'}
                                    value={confirmPin}
                                    onChange={(event) => {
                                        const val = event.target.value.replace(/[^0-9]/g, '');
                                        if (val.length <= 4) setConfirmPin(val);
                                    }}
                                    required
                                    className="pr-10 tracking-widest font-mono"
                                    maxLength={4}
                                    inputMode="numeric"
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    onClick={() => setShowConfirmPin((prev) => !prev)}
                                >
                                    {showConfirmPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={isPinSaving || newPin.length !== 4 || confirmPin.length !== 4}>
                                {isPinSaving ? 'Updating...' : 'Update PIN'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
