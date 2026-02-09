'use client';

import { useEffect, useRef, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

type AdminShellProps = {
    children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const edgeTouchStartX = useRef<number | null>(null);
    const edgeTouchStartY = useRef<number | null>(null);

    useEffect(() => {
        function handleEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setIsSidebarOpen(false);
            }
        }

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, []);

    function handleSidebarTouchStart(event: React.TouchEvent<HTMLDivElement>) {
        const touch = event.touches[0];
        touchStartX.current = touch.clientX;
        touchStartY.current = touch.clientY;
    }

    function handleSidebarTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
        if (!isSidebarOpen || touchStartX.current === null || touchStartY.current === null) {
            return;
        }

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - touchStartX.current;
        const deltaY = touch.clientY - touchStartY.current;

        const isLeftSwipe = deltaX < -60;
        const isMostlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

        if (isLeftSwipe && isMostlyHorizontal) {
            setIsSidebarOpen(false);
        }

        touchStartX.current = null;
        touchStartY.current = null;
    }

    function handleEdgeTouchStart(event: React.TouchEvent<HTMLDivElement>) {
        if (isSidebarOpen || window.innerWidth >= 1024) {
            return;
        }

        const touch = event.touches[0];
        if (touch.clientX > 24) {
            edgeTouchStartX.current = null;
            edgeTouchStartY.current = null;
            return;
        }

        edgeTouchStartX.current = touch.clientX;
        edgeTouchStartY.current = touch.clientY;
    }

    function handleEdgeTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
        if (
            isSidebarOpen ||
            window.innerWidth >= 1024 ||
            edgeTouchStartX.current === null ||
            edgeTouchStartY.current === null
        ) {
            return;
        }

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - edgeTouchStartX.current;
        const deltaY = touch.clientY - edgeTouchStartY.current;

        const isRightSwipe = deltaX > 60;
        const isMostlyHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

        if (isRightSwipe && isMostlyHorizontal) {
            setIsSidebarOpen(true);
        }

        edgeTouchStartX.current = null;
        edgeTouchStartY.current = null;
    }

    return (
        <div
            className="min-h-screen bg-background"
            onTouchStart={handleEdgeTouchStart}
            onTouchEnd={handleEdgeTouchEnd}
        >
            <div className="flex h-screen overflow-hidden">
                {/* Mobile Sidebar Overlay */}
                <div
                    className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden ${
                        isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                    }`}
                    onClick={() => setIsSidebarOpen(false)}
                />

                {/* Sidebar - Fixed on all screen sizes */}
                <div
                    className={`fixed inset-y-0 left-0 z-50 touch-pan-y transform transition-transform duration-200 lg:translate-x-0 ${
                        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
                    onTouchStart={handleSidebarTouchStart}
                    onTouchEnd={handleSidebarTouchEnd}
                >
                    <Sidebar onNavigate={() => setIsSidebarOpen(false)} />
                </div>

                {/* Main Content - Scrollable area */}
                <div className="flex min-w-0 flex-1 flex-col lg:ml-64 overflow-hidden">
                    <Topbar onMenuClick={() => setIsSidebarOpen((prev) => !prev)} />
                    <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                        <div className="mx-auto w-full min-w-0 max-w-7xl">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
