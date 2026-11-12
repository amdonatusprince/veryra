import { readFile } from "fs/promises";
import path from "path";

const types: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new Response("Not found", { status: 404 });
  const dir = path.join(process.cwd(), "data", "media");
  for (const ext of Object.keys(types)) {
    try {
      const bytes = await readFile(path.join(dir, `${id}.${ext}`));
      return new Response(bytes, {
        headers: {
          "content-type": types[ext],
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // Try the next extension. The id is stored with one of them.
    }
  }
  return new Response("Not found", { status: 404 });
}
