import { ThemeToggle } from "../components/theme-toggle";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-elevated)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-tight">ZipMarket</h1>
            <ThemeToggle />
          </div>
          <p className="max-w-2xl text-base text-[var(--text-muted)]">
            M0 scaffold is live. Theme tokens, provider wiring, and mode toggle
            are ready for the dashboard implementation milestones.
          </p>
        </header>
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="mb-2 text-xl font-semibold">Next up</h2>
          <p className="text-[var(--text-muted)]">
            ZIP search flow, API integration, and metric visualizations will be
            added in M4-M6.
          </p>
        </section>
      </div>
    </main>
  );
}

