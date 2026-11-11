"use client";

import { Button } from "@/components/base/buttons/button";
import { useNear } from "@/lib/near";
import { useEffect, useId, useRef } from "react";

const wallets = [
  { id: "near", label: "NEAR wallets" },
  { id: "evm", label: "EVM wallets" },
  { id: "wallet", label: "More wallets" },
] as const;

export function SignInDialog() {
  const { dialogOpen, closeDialog, signIn, error, pending } = useNear();
  const titleId = useId();
  const passkeyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!dialogOpen) return;
    passkeyRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, closeDialog]);

  if (!dialogOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-3 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close sign in"
        onClick={closeDialog}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-3xl border border-border-button-default bg-background-primary-default p-5"
      >
        <h2 id={titleId} className="text-title-1-regular text-text-primary">
          Sign in
        </h2>
        <p className="mt-2 text-body-regular text-text-secondary">
          A passkey uses Touch ID or Face ID. NEAR and EVM wallets sign the
          transaction on testnet. The contract call is the same either way.
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-2lg bg-background-tertiary-error px-3 py-2 text-body-regular text-text-error-primary"
          >
            {error}
          </p>
        ) : null}
        <button
          ref={passkeyRef}
          type="button"
          disabled={pending}
          className="mt-5 flex w-full items-center gap-3 rounded-2lg border border-border-button-default bg-background-secondary-default px-4 py-4 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void signIn("passkey")}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="text-headline-medium text-text-primary">
                Passkey
              </span>
              <span className="rounded-full bg-button-primary px-2 py-0.5 text-caption-1-semibold text-text-white">
                Recommended
              </span>
            </span>
            <span className="mt-1 block text-body-regular text-text-secondary">
              Touch ID, Face ID, or a device passcode.
            </span>
          </span>
        </button>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {wallets.map((wallet) => (
            <Button
              key={wallet.id}
              type="button"
              variant="secondary"
              disabled={pending}
              className="min-h-16 w-full"
              onClick={() => void signIn(wallet.id)}
            >
              {wallet.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
