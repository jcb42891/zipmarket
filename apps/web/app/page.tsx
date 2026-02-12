import { ZipSearchForm } from "../components/zip-search-form";

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-6 rounded-[var(--radius-hero)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-elevated)] lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
        <div>
          <p className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            New Jersey ZIP dashboard
          </p>
          <h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-5xl">
            Market signals for every NJ ZIP code.
          </h1>
          <p className="mt-4 max-w-xl text-base text-[var(--text-muted)] sm:text-lg">
            Enter a ZIP code to open the dashboard shell and core state flows:
            supported data, unsupported NJ suggestions, and validation feedback.
          </p>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-soft)]">
          <ZipSearchForm helperText="Format must be 5 digits, for example 07001." />
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {["Supported ZIP", "Unsupported NJ ZIP", "Non-NJ or invalid ZIP"].map(
          (state) => (
            <article
              key={state}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]"
            >
              <h2 className="font-[var(--font-display)] text-lg font-semibold tracking-tight">
                {state}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Route behavior is fully wired with M4 API contracts and tested
                state mapping.
              </p>
            </article>
          )
        )}
      </section>
      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <h2 className="font-[var(--font-display)] text-xl font-semibold tracking-tight">
          Data scope note
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          ZipMarket provides historical closed-sales trends, not a real-time
          listings feed.
        </p>
      </section>
    </div>
  );
}
