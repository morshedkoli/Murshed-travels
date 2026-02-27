'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, password: true, role: true, createdAt: true, updatedAt: true }
        });
        return user;
    } catch (error) {
        return null;
    }
}

export async function getAdminProfile() {
    const user = await getCurrentAdminUser();
    if (!user) return null;

    return {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
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
            const existingUser = await prisma.user.findUnique({
                where: { email }
            });

            if (existingUser && existingUser.id !== user.id) {
                return { error: 'This email is already used by another account' };
            }
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { email }
        });

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
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        const cookieStore = await cookies();
        cookieStore.delete('session');

        revalidatePath('/profile');
        return { success: true, forceLogout: true };
    } catch (error) {
        console.error('Change admin password error:', error);
        return { error: 'Failed to change password' };
    }
}
