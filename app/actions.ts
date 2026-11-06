"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { normalizeCrop, normalizeName, phoneKey, todayISO } from "@/lib/format";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function validDate(s: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : todayISO();
}

export type FormState = { error?: string };

// ---------- Tarla ----------

/** Aynı telefon numarası kayıtlıysa o çiftçiyi kullanır, yoksa yeni çiftçi açar. */
async function findOrCreateFarmer(name: string, phone: string): Promise<number> {
  const key = phoneKey(phone);
  if (key.length >= 7) {
    const found = await sql<{ id: number }>(
      `SELECT id FROM farmers WHERE phone_key = $1 ORDER BY id LIMIT 1`,
      [key]
    );
    if (found[0]) return found[0].id;
  }
  const rows = await sql<{ id: number }>(
    `INSERT INTO farmers (full_name, phone, phone_key) VALUES ($1, $2, $3) RETURNING id`,
    [name, phone, key]
  );
  return rows[0].id;
}

export async function createField(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = normalizeName(str(fd, "full_name"));
  const phone = str(fd, "phone");
  const address = str(fd, "address");
  const crop = normalizeCrop(str(fd, "crop"));
  if (!name) return { error: "Çiftçinin adı soyadı gerekli." };

  const farmerId = await findOrCreateFarmer(name, phone);
  const rows = await sql<{ id: number }>(
    `INSERT INTO fields (farmer_id, address, crop) VALUES ($1, $2, $3) RETURNING id`,
    [farmerId, address, crop]
  );
  revalidatePath("/");
  redirect(`/tarla/${rows[0].id}?yeni=1`);
}

export async function updateField(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = Number(str(fd, "id"));
  const name = normalizeName(str(fd, "full_name"));
  const phone = str(fd, "phone");
  const address = str(fd, "address");
  const crop = normalizeCrop(str(fd, "crop"));
  if (!name) return { error: "Çiftçinin adı soyadı gerekli." };

  const rows = await sql<{ farmer_id: number }>(
    `UPDATE fields SET address = $2, crop = $3 WHERE id = $1 RETURNING farmer_id`,
    [id, address, crop]
  );
  if (!rows[0]) redirect("/");
  await sql(
    `UPDATE farmers SET full_name = $2, phone = $3, phone_key = $4 WHERE id = $1`,
    [rows[0].farmer_id, name, phone, phoneKey(phone)]
  );
  revalidatePath("/");
  redirect(`/tarla/${id}`);
}

export async function deleteField(fd: FormData) {
  const id = Number(str(fd, "id"));
  const rows = await sql<{ farmer_id: number }>(
    `DELETE FROM fields WHERE id = $1 RETURNING farmer_id`,
    [id]
  );
  // Başka tarlası kalmayan çiftçiyi de temizle
  if (rows[0]) {
    await sql(
      `DELETE FROM farmers WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM fields WHERE farmer_id = $1)`,
      [rows[0].farmer_id]
    );
  }
  revalidatePath("/");
  redirect("/");
}

// ---------- Ziyaret ----------

/** Listedeki "Bugün gidildi" butonu. Aynı gün ikinci kez basılırsa tekrar kayıt açmaz. */
export async function markVisitedToday(fieldId: number) {
  const today = todayISO();
  await sql(
    `INSERT INTO visits (field_id, visit_date)
     SELECT $1, $2::date
      WHERE EXISTS (SELECT 1 FROM fields WHERE id = $1)
        AND NOT EXISTS (SELECT 1 FROM visits WHERE field_id = $1 AND visit_date = $2::date)`,
    [fieldId, today]
  );
  revalidatePath("/");
  revalidatePath(`/tarla/${fieldId}`);
}

export async function addVisit(_prev: FormState, fd: FormData): Promise<FormState> {
  const fieldId = Number(str(fd, "field_id"));
  const date = validDate(str(fd, "visit_date"));
  const note = str(fd, "note");
  await sql(`INSERT INTO visits (field_id, visit_date, note) VALUES ($1, $2, $3)`, [
    fieldId,
    date,
    note,
  ]);
  revalidatePath("/");
  revalidatePath(`/tarla/${fieldId}`);
  redirect(`/tarla/${fieldId}?kaydedildi=1`);
}

export async function deleteVisit(fd: FormData) {
  const id = Number(str(fd, "id"));
  const fieldId = Number(str(fd, "field_id"));
  await sql(`DELETE FROM visits WHERE id = $1`, [id]);
  revalidatePath("/");
  revalidatePath(`/tarla/${fieldId}`);
}
