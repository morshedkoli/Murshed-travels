import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "danger";

interface BadgeProps {
  label: string;
  variant: BadgeVariant;
}

const badgeStyles: Record<BadgeVariant, string> = {
  success: "bg-success/15 text-success",
  danger: "bg-danger/15 text-danger",
};

export function Badge({ label, variant }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        badgeStyles[variant]
      )}
    >
      {label}
    </span>
  );
}
