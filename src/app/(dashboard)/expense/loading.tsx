export default function ExpenseLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-28 rounded-2xl border border-border/70 bg-card/70" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-24 rounded-2xl border border-border/70 bg-card/70" />
        <div className="h-24 rounded-2xl border border-border/70 bg-card/70" />
      </div>
      <div className="h-[420px] rounded-2xl border border-border/70 bg-card/70" />
    </div>
  );
}
