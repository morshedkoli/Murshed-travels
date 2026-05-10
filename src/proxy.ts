import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

export async function proxy(request: NextRequest) {
    const session = await getSession();

    const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/api/auth');

    if (!session && !isAuthRoute) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    if (session && request.nextUrl.pathname.startsWith('/login')) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/auth (API routes used for authentication)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, apple-icon, icon (favicon files)
         */
        '/((?!_next/static|_next/image|favicon.ico|apple-icon|icon).*)',
    ],
};
