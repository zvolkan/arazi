import { getPhoto } from "@/lib/db";

export const dynamic = "force-dynamic";

/** /api/foto/5 → büyük fotoğraf, /api/foto/5?k=kucuk → küçük resim */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const kind = new URL(req.url).searchParams.get("k") === "kucuk" ? "thumb" : "data";
  const img = Number.isInteger(id) ? await getPhoto(id, kind) : null;
  if (!img) return new Response("Bulunamadı", { status: 404 });
  return new Response(new Uint8Array(img), {
    headers: {
      "Content-Type": "image/jpeg",
      // Fotoğraflar değişmez
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
