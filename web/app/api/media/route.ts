import { mkdir, writeFile } from "fs/promises";
import path from "path";

const maxBytes = 8 * 1024 * 1024;
const types: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function mediaDir() {
  return path.join(process.cwd(), "data", "media");
}

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json()) as { url?: string };
    const source = body.url?.trim() ?? "";
    if (
      !/^https:\/\/\S+$/.test(source) &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/\S*$/.test(source)
    ) {
      return new Response("Use an https image address.", { status: 400 });
    }
    const incoming = await fetch(source, {
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    if (!incoming.ok)
      return new Response("That image address did not load.", { status: 400 });
    const mime =
      incoming.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    const ext = types[mime];
    if (!ext)
      return new Response("That address is not a JPEG, PNG, WebP, or GIF.", {
        status: 400,
      });
    const bytes = new Uint8Array(await incoming.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > maxBytes)
      return new Response("That image is empty or larger than 8 MB.", {
        status: 400,
      });
    return store(bytes, ext);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File))
    return new Response("Choose an image.", { status: 400 });
  if (file.type !== "image/jpeg")
    return new Response("The processed image must be a JPEG.", { status: 400 });
  if (file.size === 0 || file.size > maxBytes)
    return new Response("That image is empty or larger than 8 MB.", {
      status: 400,
    });
  return store(new Uint8Array(await file.arrayBuffer()), "jpg");
}

async function store(bytes: Uint8Array, ext: string) {
  const id = crypto.randomUUID();
  const dir = mediaDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${id}.${ext}`), bytes);
  return Response.json({ url: `/api/media/${id}` });
}
