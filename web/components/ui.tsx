"use client";

import type { FormEvent, ReactNode } from "react";
import { cx } from "@/utils/cx";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { panicText } from "@/lib/chain";

export const inputClass =
  "min-h-12 w-full rounded-none border-2 border-text-primary bg-background-primary-default px-4 text-body-regular text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-600 disabled:cursor-not-allowed disabled:bg-accent-50 disabled:text-text-tertiary";

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-body-medium text-text-primary">
        {label}
      </label>
      {children}
      {hint ? (
        <p
          id={`${id}-hint`}
          className="text-caption-1-regular text-text-secondary"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Notice({
  error,
  status,
}: {
  error: string | null;
  status: string | null;
}) {
  if (error) {
    return (
      <p
        role="alert"
        className="border-s-[3px] border-text-primary bg-accent-50 px-4 py-3 text-body-regular text-text-primary"
      >
        {error}
      </p>
    );
  }
  if (status) {
    return (
      <p
        role="status"
        className="border-2 border-text-primary bg-background-primary-default px-4 py-3 text-body-regular text-text-primary"
      >
        {status}
      </p>
    );
  }
  return null;
}

export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  async function act(
    work: () => Promise<unknown>,
    ok: string,
    event?: FormEvent,
  ) {
    event?.preventDefault();
    setPending(true);
    setError(null);
    try {
      await work();
      setStatus(ok);
      toast.push(ok, "ok");
    } catch (caught) {
      setStatus(null);
      const text =
        caught instanceof Error
          ? caught.message
          : "Something went wrong. Try again.";
      const message = panicText(text) || text;
      setError(message);
      toast.push(message, "err");
    } finally {
      setPending(false);
    }
  }

  return { error, status, pending, act };
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex min-h-48 items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className="size-8 shrink-0 animate-spin rounded-full border-2 border-text-primary border-t-accent-400 motion-reduce:animate-none"
      />
      <span className="text-body-regular text-text-secondary">{label}</span>
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="border-b border-text-primary pb-8">
      <p className="flex items-center gap-2.5 text-[15px] font-semibold text-text-primary">
        <span
          aria-hidden
          className="size-3 shrink-0 border-2 border-text-primary bg-accent-400"
        />
        {eyebrow}
      </p>
      <h1 className="mt-5 max-w-4xl text-[clamp(2.75rem,5vw,4rem)] leading-[1.02] font-extrabold tracking-[-0.035em] text-text-primary">
        {title}
      </h1>
      <div className="mt-5 max-w-[58ch] text-[17px] leading-relaxed text-text-secondary">
        {children}
      </div>
    </header>
  );
}

export function SectionNav<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap gap-x-6 border-b border-text-primary"
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={cx(
              "border-b-2 py-3 text-[15px] font-medium",
              selected
                ? "border-accent-400 text-text-primary"
                : "border-transparent text-text-secondary",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </nav>
  );
}

export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-2 border-text-primary bg-background-primary-default">
      <h2 className="border-b border-text-primary px-6 py-4 text-[22px] leading-none font-bold tracking-[-0.025em] text-text-primary">
        {title}
      </h2>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t-[6px] border-t-accent-400 border-r-2 border-b-2 border-l-2 border-text-primary bg-background-primary-default px-4 py-5">
      <p className="text-[13px] font-semibold text-text-secondary">{label}</p>
      <p className="mt-2 text-[28px] leading-none font-extrabold tracking-[-0.035em] text-text-primary tabular-nums">
        {value}
      </p>
    </div>
  );
}
