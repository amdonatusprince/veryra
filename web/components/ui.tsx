"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { panicText } from "@/lib/chain";

export const inputClass =
  "min-h-12 w-full rounded-2lg bg-background-tertiary-default px-4 text-body-regular text-text-primary outline-none ring-2 ring-inset ring-transparent placeholder:text-text-tertiary focus:ring-border-button-active disabled:cursor-not-allowed disabled:bg-input-disabled-background disabled:text-input-disabled-text";

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
        className="rounded-2lg bg-background-tertiary-error px-3 py-2 text-body-regular text-text-error-primary"
      >
        {error}
      </p>
    );
  }
  if (status) {
    return (
      <p
        role="status"
        className="rounded-2lg border border-border-button-default bg-background-primary-default px-3 py-2 text-body-regular text-text-primary"
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

export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border-button-default bg-background-primary-default p-4 md:p-6">
      <h2 className="text-title-1-regular text-text-primary">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-border-button-default bg-background-primary-default p-4">
      <p className="text-body-regular text-text-secondary">{label}</p>
      <p className="mt-2 text-display-4-regular tabular-nums text-text-primary">
        {value}
      </p>
    </div>
  );
}
