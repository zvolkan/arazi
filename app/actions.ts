"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { productOptions, sql } from "@/lib/db";
import { normalizeCrop, normalizeName, phoneKey, todayISO } from "@/lib/format";
import { UNITS, waterOrDefault, type Method, type RecipeItem } from "@/lib/recipe";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function validDate(s: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : todayISO();
}

export type FormState = { error?: string };

/** "" → null, "2,5" → 2.5, geçersiz → "hata" */
function parseArea(s: string): number | null | "hata" {
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return n > 0 && n < 100000 ? n : "hata";
}

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
  const area = parseArea(str(fd, "area_donum"));
  if (!name) return { error: "Çiftçinin adı soyadı gerekli." };
  if (area === "hata") return { error: "Dönüm sayı olmalı (örn. 4 veya 2,5)." };

  const farmerId = await findOrCreateFarmer(name, phone);
  const rows = await sql<{ id: number }>(
    `INSERT INTO fields (farmer_id, address, crop, area_donum) VALUES ($1, $2, $3, $4) RETURNING id`,
    [farmerId, address, crop, area]
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
  const area = parseArea(str(fd, "area_donum"));
  if (!name) return { error: "Çiftçinin adı soyadı gerekli." };
  if (area === "hata") return { error: "Dönüm sayı olmalı (örn. 4 veya 2,5)." };

  const rows = await sql<{ farmer_id: number }>(
    `UPDATE fields SET address = $2, crop = $3, area_donum = $4 WHERE id = $1 RETURNING farmer_id`,
    [id, address, crop, area]
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

// ---------- Reçete ----------

type RecipePayload = {
  id?: number;
  field_id: number;
  recipe_date: string;
  method: Method;
  note: string;
  area_donum: number | null;
  water_per_donum: number | null;
  items: RecipeItem[];
};

function cleanRecipe(raw: unknown): RecipePayload | string {
  const r = raw as Partial<RecipePayload>;
  if (!r || typeof r !== "object") return "Geçersiz veri.";
  if (r.method !== "sulama" && r.method !== "yapraktan") return "Sulama veya Yapraktan seçin.";
  const items = (Array.isArray(r.items) ? r.items : [])
    .map((it) => ({
      week: Number(it.week),
      product: String(it.product ?? "").trim().replace(/\s+/g, " "),
      amount: Number(it.amount),
      unit: it.unit,
      note: String(it.note ?? "").trim(),
    }))
    .filter((it) => it.product);
  for (const it of items) {
    if (![1, 2, 3].includes(it.week)) return "Geçersiz hafta.";
    if (!(it.amount > 0)) return `"${it.product}" için miktar girin.`;
    if (!UNITS.includes(it.unit as (typeof UNITS)[number])) return "Geçersiz birim.";
  }
  if (items.length === 0) return "En az bir ürün girin.";
  return {
    id: r.id ? Number(r.id) : undefined,
    field_id: Number(r.field_id),
    recipe_date: validDate(String(r.recipe_date ?? "")),
    method: r.method,
    note: String(r.note ?? "").trim(),
    area_donum: Number(r.area_donum) > 0 ? Number(r.area_donum) : null,
    water_per_donum: r.method === "yapraktan" ? waterOrDefault(Number(r.water_per_donum)) : null,
    items: items as RecipeItem[],
  };
}

export async function saveRecipe(_prev: FormState, fd: FormData): Promise<FormState> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(fd.get("payload") ?? ""));
  } catch {
    return { error: "Geçersiz veri." };
  }
  const r = cleanRecipe(parsed);
  if (typeof r === "string") return { error: r };

  // Bilinen bir ürün farklı büyük/küçük harfle yazıldıysa kayıtlı yazımını kullan ("cloud" → "Cloud")
  const known = new Map((await productOptions()).map((p) => [p.toLocaleLowerCase("tr-TR"), p]));
  for (const it of r.items) it.product = known.get(it.product.toLocaleLowerCase("tr-TR")) ?? it.product;

  let id = r.id;
  if (id) {
    const upd = await sql<{ id: number }>(
      `UPDATE recipes SET recipe_date = $2, method = $3, note = $4, area_donum = $5, water_per_donum = $6 WHERE id = $1 RETURNING id`,
      [id, r.recipe_date, r.method, r.note, r.area_donum, r.water_per_donum]
    );
    if (!upd[0]) return { error: "Reçete bulunamadı." };
    await sql(`DELETE FROM recipe_items WHERE recipe_id = $1`, [id]);
  } else {
    const ins = await sql<{ id: number }>(
      `INSERT INTO recipes (field_id, recipe_date, method, note, area_donum, water_per_donum)
       SELECT $1, $2, $3, $4, $5, $6 WHERE EXISTS (SELECT 1 FROM fields WHERE id = $1)
       RETURNING id`,
      [r.field_id, r.recipe_date, r.method, r.note, r.area_donum, r.water_per_donum]
    );
    if (!ins[0]) return { error: "Tarla bulunamadı." };
    id = ins[0].id;
  }

  const values: unknown[] = [];
  const tuples = r.items.map((it, i) => {
    values.push(id, it.week, i, it.product, it.amount, it.unit, it.note);
    const b = i * 7;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`;
  });
  await sql(
    `INSERT INTO recipe_items (recipe_id, week, position, product, amount, unit, note) VALUES ${tuples.join(", ")}`,
    values
  );
  revalidatePath(`/tarla/${r.field_id}`);
  redirect(`/recete/${id}?kaydedildi=1`);
}

export async function deleteRecipe(fd: FormData) {
  const id = Number(str(fd, "id"));
  const rows = await sql<{ field_id: number }>(
    `DELETE FROM recipes WHERE id = $1 RETURNING field_id`,
    [id]
  );
  const fieldId = rows[0]?.field_id;
  if (fieldId) revalidatePath(`/tarla/${fieldId}`);
  redirect(fieldId ? `/tarla/${fieldId}` : "/");
}
