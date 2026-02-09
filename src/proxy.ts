import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/auth';

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

    // If user is logged in and trying to access login, redirect to dashboard
    if (session && path.startsWith('/login')) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
