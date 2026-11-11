export function artworkSrc(item: {
  name: string;
  symbol?: string;
  color?: string | null;
  media?: string | null;
}) {
  if (item.media) return item.media;
  if (!item.color) return null;
  const params = new URLSearchParams({
    name: item.name,
    symbol: item.symbol || "VEYRA",
    color: item.color.replace("#", ""),
  });
  return `/api/pass?${params.toString()}`;
}

export function passImage(name: string, symbol: string, color: string) {
  const params = new URLSearchParams({
    name,
    symbol,
    color: color.replace("#", ""),
  });
  return `${window.location.origin}/api/pass?${params.toString()}`;
}

function hosted(path: string) {
  const url = new URL(path, window.location.origin);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol === "https:" || local) return url.toString();
  throw new Error(
    "Open Veyra at localhost so this image address can be stored.",
  );
}

async function flattenImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const max = 1200;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read that image.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.86),
  );
  if (!blob) throw new Error("Could not process that image.");
  return blob;
}

async function readStored(response: Response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Could not store that image.");
  }
  const data = (await response.json()) as { url?: string };
  if (!data.url) throw new Error("Could not store that image.");
  return hosted(data.url);
}

export async function storeProcessedFile(file: File) {
  const blob = await flattenImage(file);
  const body = new FormData();
  body.set("file", new File([blob], "pass.jpg", { type: "image/jpeg" }));
  return readStored(await fetch("/api/media", { method: "POST", body }));
}

export async function storeImageUrl(source: string) {
  const trimmed = source.trim();
  if (
    !/^https:\/\/\S+$/.test(trimmed) &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/\S*$/.test(trimmed)
  ) {
    throw new Error("Use an https image address.");
  }
  return readStored(
    await fetch("/api/media", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    }),
  );
}
