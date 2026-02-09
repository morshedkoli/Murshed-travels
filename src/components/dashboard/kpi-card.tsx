import { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type KpiCardProps = {
    title: string;
    value: string;
    description: string;
    icon: LucideIcon;
    tone?: 'default' | 'positive' | 'warning' | 'danger';
};

const toneClasses: Record<NonNullable<KpiCardProps['tone']>, string> = {
    default: 'text-primary bg-primary/10 ring-primary/25',
    positive: 'text-success bg-success/10 ring-success/25',
    warning: 'text-secondary bg-secondary/10 ring-secondary/25',
    danger: 'text-danger bg-danger/10 ring-danger/25',
};

export function KpiCard({ title, value, description, icon: Icon, tone = 'default' }: KpiCardProps) {
    return (
        <Card className="gap-0 border-secondary bg-card shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-text-muted">{title}</CardTitle>
                    <div className={`rounded-lg p-2 ring-1 ${toneClasses[tone]}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-semibold tracking-tight text-text-primary">{value}</div>
                <CardDescription className="mt-2 text-xs text-text-muted">{description}</CardDescription>
            </CardContent>
        </Card>
    );
}
