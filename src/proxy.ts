import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt, getPasswordFingerprint } from './lib/auth';

async function getCurrentPasswordFingerprint(userId: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return null;

    const url = `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=password&limit=1`;
    const response = await fetch(url, {
        headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            Accept: 'application/json',
        },
        cache: 'no-store',
    });

    if (!response.ok) return null;
    const rows = (await response.json()) as Array<{ password?: string }>;
    const hash = rows[0]?.password;
    if (!hash) return null;
    return getPasswordFingerprint(hash);
}

export async function proxy(request: NextRequest) {
    const currentUser = request.cookies.get('session')?.value;
    const path = request.nextUrl.pathname;

    // Define public paths
    if (path.startsWith('/login') || path.startsWith('/_next') || path.startsWith('/static')) {
        return NextResponse.next();
    }

    // Decrypt the session from the cookie
    const session = currentUser ? await decrypt(currentUser) : null;

    // If no session or invalid, redirect to login
    if (!session) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    const sessionUserId = typeof session.id === 'string' ? session.id : '';
    const sessionPasswordFingerprint = typeof session.pwdv === 'string' ? session.pwdv : '';
    if (!sessionUserId || !sessionPasswordFingerprint) {
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('session');
        return response;
    }

    const currentPasswordFingerprint = await getCurrentPasswordFingerprint(sessionUserId);
    if (!currentPasswordFingerprint || currentPasswordFingerprint !== sessionPasswordFingerprint) {
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('session');
        return response;
    }

    // If user is logged in and trying to access login, redirect to dashboard
    if (session && path.startsWith('/login')) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
