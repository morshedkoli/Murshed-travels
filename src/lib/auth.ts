import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.JWT_SECRET || 'dev-only-insecure-jwt-secret';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET must be set and at least 32 characters in production.');
}

const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: JWTPayload) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h') // Session duration
        .sign(key);
}

export async function decrypt(input: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(input, key, {
            algorithms: ['HS256'],
        });
        return payload;
    } catch {
        return null;
    }
}

export async function getSession() {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return null;
    return await decrypt(session);
}

export async function updateSession() {
    // Extend session if needed
    const session = await getSession();
    if (!session) return;

    // Refresh logic could go here
    // For now, simple valid check
}

export function getPasswordFingerprint(passwordHash: string) {
    return passwordHash.slice(-16);
}
