import { LayoutDashboard, Settings, Users } from "lucide-react";

export const navigationItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const statusTheme = {
  active: "success",
  inactive: "danger",
} as const;
