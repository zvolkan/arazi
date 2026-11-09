// Fotoğrafı küçültüp sunucuya yükler; visitId verilirse doğrudan o ziyarete bağlanır.
import { compressPhoto } from "./image";

export async function uploadPhoto(file: File, visitId?: number): Promise<number> {
  const c = await compressPhoto(file);
  const fd = new FormData();
  fd.append("full", c.full, "foto.jpg");
  fd.append("thumb", c.thumb, "kucuk.jpg");
  fd.append("width", String(c.width));
  fd.append("height", String(c.height));
  if (visitId) fd.append("visit_id", String(visitId));
  const res = await fetch("/api/foto", { method: "POST", body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) throw new Error(json.error || "Yüklenemedi");
  return json.id as number;
}
