import { Card } from "@/components/card";

type MenuPageProps = {
  title: string;
  description: string;
};

export function MenuPage({ title, description }: MenuPageProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Murshed Travels</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">{title}</h1>
        <p className="mt-2 text-sm text-text-muted">{description}</p>
      </section>

      <Card title={`${title} Module`}>
        <p className="text-sm text-text-muted">
          This section is ready and routed from the sidebar. You can now continue with feature-specific
          forms, tables, and actions here.
        </p>
      </Card>
    </div>
  );
}
