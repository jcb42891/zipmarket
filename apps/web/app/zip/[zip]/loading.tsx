export default function ZipDashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <section className="h-28 animate-pulse rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]" />
      <section className="h-[28rem] animate-pulse rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-elevated)]" />
      <section className="h-40 animate-pulse rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]" />
    </div>
  );
}
