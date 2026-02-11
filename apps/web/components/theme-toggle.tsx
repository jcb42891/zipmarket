"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const modes = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="rounded-full border border-[var(--border)] px-3 py-1 text-sm text-[var(--text-muted)]"
      >
        Theme
      </button>
    );
  }

  const currentIndex = modes.indexOf((theme as (typeof modes)[number]) ?? "system");
  const nextMode = modes[(currentIndex + 1) % modes.length];

  return (
    <button
      type="button"
      onClick={() => setTheme(nextMode)}
      className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-sm font-semibold text-[var(--text-primary)]"
      aria-label={`Switch theme to ${nextMode}`}
    >
      Theme: {theme ?? "system"}
    </button>
  );
}

