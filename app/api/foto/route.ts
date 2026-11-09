import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** Küçültülmüş fotoğrafı kaydeder; ziyaret kaydedilince ziyarete bağlanır. */
export async function POST(req: Request) {
  const fd = await req.formData();
  const full = fd.get("full");
  const thumb = fd.get("thumb");
  if (!(full instanceof Blob) || !(thumb instanceof Blob)) {
    return Response.json({ error: "Fotoğraf eksik" }, { status: 400 });
  }
  if (full.size > 3_000_000 || thumb.size > 400_000) {
    return Response.json({ error: "Fotoğraf çok büyük" }, { status: 413 });
  }
  const fullBuf = Buffer.from(await full.arrayBuffer());
  const thumbBuf = Buffer.from(await thumb.arrayBuffer());
  if (!isJpeg(fullBuf) || !isJpeg(thumbBuf)) {
    return Response.json({ error: "Geçersiz fotoğraf" }, { status: 400 });
  }
  const w = Number(fd.get("width")) || null;
  const h = Number(fd.get("height")) || null;
  const rows = await sql<{ id: number }>(
    `INSERT INTO visit_photos (data, thumb, width, height) VALUES ($1, $2, $3, $4) RETURNING id`,
    [fullBuf, thumbBuf, w, h]
  );
  return Response.json({ id: rows[0].id });
}
