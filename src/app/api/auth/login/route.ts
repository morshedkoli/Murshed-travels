import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { encrypt, getPasswordFingerprint } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { pin } = body;

        if (!pin || typeof pin !== 'string' || pin.length !== 4) {
            return NextResponse.json({ error: 'Invalid 4-digit PIN provided' }, { status: 400 });
        }

        let user = await prisma.user.findFirst();

        if (!user) {
            // First time setup - register the admin with the provided PIN
            const hashedPin = await bcrypt.hash(pin, 10);
            user = await prisma.user.create({
                data: {
                    pin: hashedPin,
                    role: 'admin',
                },
            });
        } else {
            // Validate against existing PIN
            const isMatch = await bcrypt.compare(pin, user.pin);
            if (!isMatch) {
                return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
            }
        }

        const session = await encrypt({
            id: user.id,
            role: user.role,
            pwdv: getPasswordFingerprint(user.pin),
        });
        
        const cookieStore = await cookies();
        cookieStore.set('session', session, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
            path: '/',
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Login error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        }, { status: 500 });
    }
}
