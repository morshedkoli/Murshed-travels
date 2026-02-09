export default function DashboardLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-36 rounded-3xl border border-border/70 bg-card/70" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-28 rounded-2xl border border-border/70 bg-card/70" />
        ))}
      </div>
      <div className="h-96 rounded-3xl border border-border/70 bg-card/70" />
      <div className="h-80 rounded-3xl border border-border/70 bg-card/70" />
    </div>
  );
}
