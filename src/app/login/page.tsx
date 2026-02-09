import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
    return (
        <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgb(var(--primary-rgb)/0.10),transparent_45%),radial-gradient(circle_at_80%_90%,rgb(var(--secondary-rgb)/0.10),transparent_45%)]" />
            <div className="relative w-full max-w-md">
                <LoginForm />
            </div>
        </div>
    );
}
