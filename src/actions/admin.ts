'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function getCurrentAdminUser() {
    const session = await getSession();
    const userId = typeof session?.id === 'string' ? session.id : '';
    if (!userId) return null;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, pin: true, role: true, createdAt: true, updatedAt: true }
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
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
    };
}

export async function changeAdminPin(data: {
    currentPin: string;
    newPin: string;
    confirmPin: string;
}) {
    try {
        const user = await getCurrentAdminUser();
        if (!user) return { error: 'Unauthorized' };

        const currentPin = data.currentPin?.trim() || '';
        const newPin = data.newPin?.trim() || '';
        const confirmPin = data.confirmPin?.trim() || '';

        if (!currentPin || !newPin || !confirmPin) {
            return { error: 'All PIN fields are required' };
        }

        if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
            return { error: 'New PIN must be exactly 4 digits' };
        }

        if (newPin !== confirmPin) {
            return { error: 'New PIN and confirm PIN do not match' };
        }

        const isCurrentPinValid = await bcrypt.compare(currentPin, user.pin);
        if (!isCurrentPinValid) {
            return { error: 'Current PIN is incorrect' };
        }

        const isSamePin = await bcrypt.compare(newPin, user.pin);
        if (isSamePin) {
            return { error: 'New PIN must be different from current PIN' };
        }

        const hashedPin = await bcrypt.hash(newPin, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { pin: hashedPin }
        });

        const cookieStore = await cookies();
        cookieStore.delete('session');

        revalidatePath('/profile');
        return { success: true, forceLogout: true };
    } catch (error) {
        console.error('Change admin PIN error:', error);
        return { error: 'Failed to change PIN' };
    }
}
