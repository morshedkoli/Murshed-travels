import { redirect } from 'next/navigation';
import { getAdminProfile } from '@/actions/admin';
import { AdminProfileManager } from '@/components/admin/admin-profile-manager';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
    const profile = await getAdminProfile();
    if (!profile) {
        redirect('/login');
    }

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Admin Profile</h2>
                <p className="text-sm text-muted-foreground">
                    Manage your admin account details and password security.
                </p>
            </div>

            <AdminProfileManager
                profile={{
                    email: profile.email,
                    role: profile.role,
                    createdAt: profile.createdAt,
                    updatedAt: profile.updatedAt,
                }}
            />
        </div>
    );
}
