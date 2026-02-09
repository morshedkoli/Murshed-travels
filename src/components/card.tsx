import { cn } from "@/lib/utils";

type CardProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function Card({ title, children, className }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl bg-card px-5 py-4 shadow-[0_10px_24px_-18px_rgb(var(--primary-rgb)/0.55)] ring-1 ring-border/70",
        className
      )}
    >
      <h3 className="mb-3 text-[13px] font-semibold tracking-[0.02em] text-text-muted">{title}</h3>
      <div>{children}</div>
    </section>
  );
}
