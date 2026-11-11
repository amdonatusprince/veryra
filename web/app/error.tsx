"use client";

import { Button } from "@/components/base/buttons/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-3xl border border-border-button-default bg-background-primary-default p-6">
      <h1 className="text-title-1-regular text-text-primary">
        This page hit an error
      </h1>
      <p className="mt-2 text-body-regular text-text-secondary">
        This page could not be read from the contract. Try again.
      </p>
      <Button type="button" onClick={reset} className="mt-4">
        Try again
      </Button>
    </div>
  );
}
