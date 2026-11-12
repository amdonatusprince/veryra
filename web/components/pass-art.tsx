"use client";

import { useEffect, useState } from "react";
import { RiCloseLine } from "@remixicon/react";

export function PassArt({
  media,
  seed,
  className,
  alt = "Pass image",
  expandable = false,
}: {
  media?: string | null;
  seed: string;
  className?: string;
  alt?: string;
  expandable?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const showImage = Boolean(media) && !failed;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const frame = showImage ? (
    // Programme artwork is an address chosen by the business.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={media ?? ""}
      alt={expandable ? "" : alt}
      onError={() => setFailed(true)}
      className={`object-cover ${className ?? ""}`}
    />
  ) : (
    <div
      aria-hidden="true"
      className={className}
      style={{ background: tone(seed) }}
    />
  );

  return (
    <>
      {expandable && showImage ? (
        <button
          type="button"
          className="block rounded-2lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          aria-label="View the image"
          onClick={() => setOpen(true)}
        >
          {frame}
        </button>
      ) : (
        frame
      )}
      {open && showImage ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-scrim p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close image"
            onClick={() => setOpen(false)}
          />
          <figure className="relative z-10 max-h-[90vh] max-w-5xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media ?? ""}
              alt={alt}
              className="max-h-[90vh] w-auto max-w-full rounded-3xl object-contain"
            />
            <button
              type="button"
              className="absolute end-3 top-3 inline-flex size-10 items-center justify-center rounded-full bg-background-primary-default text-text-primary"
              aria-label="Close image"
              onClick={() => setOpen(false)}
            >
              <RiCloseLine className="size-5" aria-hidden />
            </button>
          </figure>
        </div>
      ) : null}
    </>
  );
}

function tone(seed: string) {
  const hash = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return hash % 2 === 0
    ? "linear-gradient(145deg, var(--color-accent-800) 0%, var(--color-neutral-925) 72%)"
    : "linear-gradient(145deg, var(--color-accent-600) 0%, var(--color-neutral-925) 74%)";
}
