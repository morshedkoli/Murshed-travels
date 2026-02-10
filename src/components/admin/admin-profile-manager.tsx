'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { changeAdminPassword, updateAdminProfile } from '@/actions/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';

type AdminProfileManagerProps = {
    profile: {
        email: string;
        role: string;
        createdAt: string;
        updatedAt: string;
    };
};

export function AdminProfileManager({ profile }: AdminProfileManagerProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [email, setEmail] = useState(profile.email);
    const [isProfileSaving, setIsProfileSaving] = useState(false);
    const [isPasswordSaving, setIsPasswordSaving] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsProfileSaving(true);

        const result = await updateAdminProfile({ email });
        if (result.success) {
            toast({
                title: 'Profile updated',
                description: 'Your admin profile was updated successfully.',
                variant: 'success',
            });
        } else {
            toast({
                title: 'Update failed',
                description: result.error || 'Could not update profile.',
                variant: 'error',
            });
        }

        setIsProfileSaving(false);
    }

    async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsPasswordSaving(true);

        const result = await changeAdminPassword({
            currentPassword,
            newPassword,
            confirmPassword,
        });

        if (result.success) {
            toast({
                title: 'Password changed',
                description: 'Password updated. Please sign in again.',
                variant: 'success',
            });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

            if (result.forceLogout) {
                router.push('/login');
                router.refresh();
                return;
            }
        } else {
            toast({
                title: 'Password update failed',
                description: result.error || 'Could not change password.',
                variant: 'error',
            });
        }

        setIsPasswordSaving(false);
    }

    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border-border/70">
                <CardHeader>
                    <CardTitle>Admin Profile</CardTitle>
                    <CardDescription>Update your account email and review profile information.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 text-sm md:grid-cols-2">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
                                <p className="font-medium capitalize text-foreground">{profile.role}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                                <p className="font-medium text-foreground">{new Date(profile.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" disabled={isProfileSaving}>
                                {isProfileSaving ? 'Saving...' : 'Save Profile'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className="border-border/70">
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Use a strong password you do not use anywhere else.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Current Password</Label>
                            <div className="relative">
                                <Input
                                    id="currentPassword"
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(event) => setCurrentPassword(event.target.value)}
                                    required
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                                >
                                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    required
                                    minLength={6}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    onClick={() => setShowNewPassword((prev) => !prev)}
                                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                                >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    required
                                    minLength={6}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" disabled={isPasswordSaving}>
                                {isPasswordSaving ? 'Updating...' : 'Update Password'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
