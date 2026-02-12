import Link from "next/link";

import { ThemeToggle } from "./theme-toggle";

export function GlobalChrome() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-muted)] bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-baseline gap-2 rounded-full px-3 py-1 transition-colors hover:bg-[var(--surface-raised)]"
        >
          <span className="font-[var(--font-display)] text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            ZipMarket
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            NJ Housing
          </span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
