'use client';

import { Bell, Menu, Search, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';

type TopbarProps = {
    onMenuClick?: () => void;
};

const pageTitles: Record<string, string> = {
    'dashboard': 'Dashboard',
    'accounts': 'Accounts',
    'customers': 'Customers',
    'vendors': 'Vendors',
    'services': 'Services',
    'income': 'Income',
    'expense': 'Expense',
    'receivable': 'Receivable',
    'payable': 'Payable',
    'employees': 'Employees',
    'salary': 'Salary',
    'reports': 'Reports',
    'advance-payments': 'Advance Payments',
};

export function Topbar({ onMenuClick }: TopbarProps) {
    const pathname = usePathname();

    const getTitle = () => {
        if (!pathname) return 'Dashboard';
        const segment = pathname.split('/')[1];
        return pageTitles[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    };

    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
            {/* Left Section */}
            <div className="flex items-center gap-3">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 lg:hidden" 
                    onClick={onMenuClick}
                >
                    <Menu className="h-4 w-4" />
                </Button>
                
                <h1 className="text-base font-semibold text-foreground">{getTitle()}</h1>
            </div>

            {/* Right Section */}
            <div className="ml-auto flex items-center gap-1">
                {/* Search Button */}
                <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                >
                    <Search className="h-4 w-4" />
                </Button>

                {/* Notifications */}
                <Button 
                    variant="ghost" 
                    size="icon"
                    className="relative h-8 w-8 text-muted-foreground"
                >
                    <Bell className="h-4 w-4" />
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
                </Button>

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* User */}
                <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                >
                    <User className="h-4 w-4" />
                </Button>
            </div>
        </header>
    );
}
