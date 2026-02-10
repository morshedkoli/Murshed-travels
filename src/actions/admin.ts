'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
}

function normalizeText(value?: string) {
    const normalized = value?.trim();
    return normalized ? normalized : '';
}

async function getCurrentAdminUser() {
    const session = await getSession();
    const userId = typeof session?.id === 'string' ? session.id : '';
    if (!userId) return null;

    const { data: user, error } = await supabase
        .from('users')
        .select('id, email, password, role, created_at, updated_at')
        .eq('id', userId)
        .single();

    if (error || !user) return null;
    return user;
}

export async function getAdminProfile() {
    const user = await getCurrentAdminUser();
    if (!user) return null;

    return {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
    };
}

export async function updateAdminProfile(data: { email: string }) {
    try {
        const user = await getCurrentAdminUser();
        if (!user) return { error: 'Unauthorized' };

        const email = normalizeEmail(data.email);
        if (!email) return { error: 'Email is required' };

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) return { error: 'Please enter a valid email address' };

        if (email !== user.email) {
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .neq('id', user.id)
                .single();

            if (existingUser) {
                return { error: 'This email is already used by another account' };
            }
        }

        const { error } = await supabase
            .from('users')
            .update({ email })
            .eq('id', user.id);

        if (error) {
            console.error('Update admin profile error:', error);
            return { error: 'Failed to update profile' };
        }

        revalidatePath('/profile');
        return { success: true };
    } catch (error) {
        console.error('Update admin profile error:', error);
        return { error: 'Failed to update profile' };
    }
}

export async function changeAdminPassword(data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}) {
    try {
        const user = await getCurrentAdminUser();
        if (!user) return { error: 'Unauthorized' };

        const currentPassword = normalizeText(data.currentPassword);
        const newPassword = normalizeText(data.newPassword);
        const confirmPassword = normalizeText(data.confirmPassword);

        if (!currentPassword || !newPassword || !confirmPassword) {
            return { error: 'All password fields are required' };
        }

        if (newPassword.length < 6) {
            return { error: 'New password must be at least 6 characters' };
        }

        if (newPassword !== confirmPassword) {
            return { error: 'New password and confirm password do not match' };
        }

        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return { error: 'Current password is incorrect' };
        }

        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return { error: 'New password must be different from current password' };
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const { error } = await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('id', user.id);

        if (error) {
            console.error('Change admin password error:', error);
            return { error: 'Failed to change password' };
        }

        const cookieStore = await cookies();
        cookieStore.delete('session');

        revalidatePath('/profile');
        return { success: true, forceLogout: true };
    } catch (error) {
        console.error('Change admin password error:', error);
        return { error: 'Failed to change password' };
    }
}
