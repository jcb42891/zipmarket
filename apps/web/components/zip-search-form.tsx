"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";

import {
  buildZipPath,
  normalizeLocationInput,
  resolveLocationToZip,
  validateLocationSubmission
} from "../lib/ui/zip-search";

interface ZipSearchFormProps {
  initialZip?: string;
  submitLabel?: string;
  helperText?: string;
  size?: "landing" | "compact";
}

export function ZipSearchForm({
  initialZip = "",
  submitLabel = "View dashboard",
  helperText,
  size = "landing"
}: ZipSearchFormProps) {
  const router = useRouter();
  const fieldId = useId();
  const [locationValue, setLocationValue] = useState(normalizeLocationInput(initialZip));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLocationValue(normalizeLocationInput(initialZip));
    setErrorMessage(null);
    setIsSubmitting(false);
  }, [initialZip]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submission = validateLocationSubmission(locationValue);
    if (!submission.ok) {
      setLocationValue(submission.query);
      setErrorMessage(submission.error);
      return;
    }

    if (submission.kind === "zip") {
      setErrorMessage(null);
      setLocationValue(submission.zip);
      router.push(buildZipPath(submission.zip));
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const resolution = await resolveLocationToZip(submission.query);
    setIsSubmitting(false);

    if (!resolution.ok) {
      setErrorMessage(resolution.error);
      return;
    }

    setErrorMessage(null);
    setLocationValue(resolution.zip);
    router.push(buildZipPath(resolution.zip));
  }

  const compact = size === "compact";

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
      <label
        htmlFor={fieldId}
        className={`font-[var(--font-display)] font-semibold tracking-tight text-[var(--text-primary)] ${
          compact ? "text-sm" : "text-base"
        }`}
      >
        Enter NJ ZIP or town
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={fieldId}
          name="location"
          autoComplete="off"
          maxLength={80}
          value={locationValue}
          onChange={(event) => {
            setLocationValue(event.target.value);
            setErrorMessage(null);
          }}
          placeholder="07001 or Morristown"
          className={`w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent)_30%,transparent)] ${
            compact ? "h-11 text-base" : "h-12 text-lg"
          }`}
          aria-invalid={errorMessage ? "true" : "false"}
          aria-describedby={errorMessage ? `${fieldId}-error` : undefined}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className={`shrink-0 rounded-[var(--radius-md)] bg-[var(--accent)] px-5 font-semibold text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent)_40%,transparent)] ${
            compact ? "h-11 text-sm" : "h-12 text-base"
          } disabled:cursor-not-allowed disabled:opacity-70`}
        >
          {isSubmitting ? "Resolving..." : submitLabel}
        </button>
      </div>
      {errorMessage ? (
        <p id={`${fieldId}-error`} role="alert" className="text-sm text-[var(--danger)]">
          {errorMessage}
        </p>
      ) : helperText ? (
        <p className="text-sm text-[var(--text-muted)]">{helperText}</p>
      ) : null}
    </form>
  );
}
