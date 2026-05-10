'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

export function LoginForm() {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (pin.length !== 4) {
            setError('PIN must be exactly 4 digits');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin }),
            });

            if (res.ok) {
                router.refresh();
                router.push('/dashboard');
            } else {
                const data = await res.json();
                setError(data.error || 'Login failed');
            }
        } catch {
            setError('Something went wrong');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Card className="w-full max-w-sm border-border/25 bg-card shadow-lg mx-auto">
            <CardHeader className="space-y-1 text-center">
                <div className="mx-auto mb-2 w-fit rounded-full border border-border/30 bg-primary/10 p-3">
                    <Lock className="h-6 w-6 text-primary" />
                </div>
                <div className="mx-auto">
                    <BrandLogo compact />
                </div>
                <CardTitle className="sr-only">Murshed Travels</CardTitle>
                <p className="text-sm text-text-muted">Enter your 4-digit PIN to continue</p>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2 text-center">
                        <Input
                            type="password"
                            placeholder="••••"
                            label="Security PIN"
                            value={pin}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                if (val.length <= 4) setPin(val);
                            }}
                            className="text-center text-2xl tracking-[1em] font-mono mx-auto max-w-[200px]"
                            maxLength={4}
                            inputMode="numeric"
                            autoComplete="off"
                            required
                        />
                    </div>
                    {error && <p className="text-center text-sm font-medium text-danger">{error}</p>}
                    <Button type="submit" className="w-full" isLoading={isLoading} disabled={pin.length !== 4}>
                        Sign In
                    </Button>
                </form>
            </CardContent>
            <CardFooter className="justify-center border-t border-border/25 pt-4">
                <p className="text-xs text-text-muted">Protected Access Only</p>
            </CardFooter>
        </Card>
    );
}
