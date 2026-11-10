"use client";

import { useEffect, useRef, useState } from "react";
import { parseColor } from "react-aria-components";
import type { Color } from "react-aria-components";
import { ColorPicker } from "@/components/base/color-picker/color-picker";
import { FileUpload } from "@/components/base/file-upload/file-upload";
import { inputClass } from "@/components/ui";
import { storeImageUrl, storeProcessedFile } from "@/lib/artwork";
import { cx } from "@/utils/cx";

function brandColor(value: string) {
  try {
    return parseColor(value);
  } catch {
    return parseColor("#1f4a3a");
  }
}

export type ArtworkMode = "default" | "upload" | "url";

const modes: { id: ArtworkMode; label: string; detail: string }[] = [
  {
    id: "default",
    label: "Default",
    detail: "We draw the pass from the brand color.",
  },
  {
    id: "upload",
    label: "Upload",
    detail: "Use a JPEG, PNG, or WebP from this device.",
  },
  {
    id: "url",
    label: "Image address",
    detail: "Use an image URL from the web.",
  },
];

export function ArtworkField({
  color,
  onColor,
  mode,
  onMode,
  storedUrl,
  onStoredUrl,
  onSource,
}: {
  color: string;
  onColor: (color: string) => void;
  mode: ArtworkMode;
  onMode: (mode: ArtworkMode) => void;
  storedUrl: string;
  onStoredUrl: (url: string) => void;
  onSource: (url: string) => void;
}) {
  const [source, setSource] = useState("");
  const [readyFor, setReadyFor] = useState("");
  const [attempted, setAttempted] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<Color>(() => brandColor(color));
  const sent = useRef(color);

  useEffect(() => {
    if (color.toLowerCase() === sent.current.toLowerCase()) return;
    setPicked(brandColor(color));
    sent.current = color;
  }, [color]);

  async function keep(work: () => Promise<string>) {
    setPending(true);
    setError("");
    try {
      onStoredUrl(await work());
    } catch (caught) {
      onStoredUrl("");
      setError(
        caught instanceof Error ? caught.message : "Could not use that image.",
      );
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (mode !== "url") return;
    const trimmed = source.trim();
    if (!trimmed || trimmed === readyFor || trimmed === attempted) return;
    let cancel = false;
    const timer = setTimeout(() => {
      void (async () => {
        setPending(true);
        setError("");
        try {
          const url = await storeImageUrl(trimmed);
          if (cancel) return;
          setReadyFor(trimmed);
          onStoredUrl(url);
        } catch (caught) {
          if (cancel) return;
          setAttempted(trimmed);
          onStoredUrl("");
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not use that image.",
          );
        } finally {
          if (!cancel) setPending(false);
        }
      })();
    }, 500);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [attempted, mode, onStoredUrl, readyFor, source]);

  return (
    <fieldset className="space-y-3">
      <legend className="text-body-medium text-text-primary">Pass image</legend>
      <div
        className="grid gap-2 sm:grid-cols-3"
        role="radiogroup"
        aria-label="Pass image"
      >
        {modes.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={mode === item.id}
            onClick={() => onMode(item.id)}
            className={cx(
              "rounded-none border-2 px-3 py-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
              mode === item.id
                ? "border-accent-600 bg-accent-50"
                : "border-border-button-default bg-background-primary-default",
            )}
          >
            <span className="block text-body-medium text-text-primary">
              {item.label}
            </span>
            <span className="mt-1 block text-caption-1-regular text-text-secondary">
              {item.detail}
            </span>
          </button>
        ))}
      </div>
      {mode === "default" ? (
        <div
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              event.target instanceof HTMLInputElement
            ) {
              event.preventDefault();
            }
          }}
        >
          <ColorPicker
            aria-label="Brand color"
            value={picked}
            onChange={(next) => {
              const hex = next.toString("hex");
              sent.current = hex;
              setPicked(next);
              onColor(hex);
            }}
          />
        </div>
      ) : null}
      {mode === "upload" ? (
        <FileUpload
          allowedExtensions={["jpg", "jpeg", "png", "webp"]}
          onUploadComplete={(file) => {
            void keep(() => storeProcessedFile(file));
          }}
        />
      ) : null}
      {mode === "url" ? (
        <input
          value={source}
          onChange={(event) => {
            const next = event.target.value;
            setSource(next);
            onSource(next);
            if (next.trim() !== readyFor) onStoredUrl("");
          }}
          placeholder="https://example.com/pass.jpg"
          inputMode="url"
          autoComplete="off"
          aria-label="Image address"
          className={inputClass}
        />
      ) : null}
      {pending ? (
        <p className="text-caption-1-regular text-text-secondary">
          Processing the image.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-body-regular text-text-error-primary">
          {error}
        </p>
      ) : null}
      {storedUrl && mode !== "default" ? (
        // The stored copy is the image the member will see.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={storedUrl}
          alt="Pass preview"
          className="h-28 w-44 rounded-2lg object-cover"
        />
      ) : null}
    </fieldset>
  );
}
