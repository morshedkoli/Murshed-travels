"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import { navigationItems } from "@/lib/theme";

const titleMap: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/users": "Users",
};

export function Header() {
  const pathname = usePathname();
  const title = titleMap[pathname] ?? "Dashboard";

  return (
    <header className="fixed left-0 right-0 top-0 z-10 border-b border-border bg-card md:left-64">
      <div className="mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        <Button variant="primary">Create Report</Button>
      </div>
      <div className="flex gap-2 border-t border-border px-4 py-2 md:hidden">
        {navigationItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/" || pathname === "/dashboard"
              : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
