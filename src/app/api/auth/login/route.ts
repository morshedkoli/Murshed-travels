import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { encrypt, getPasswordFingerprint } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body;

        // Fetch user from Supabase
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Create session
        const session = await encrypt({
            id: user.id,
            email: user.email,
            role: user.role,
            pwdv: getPasswordFingerprint(user.password),
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
