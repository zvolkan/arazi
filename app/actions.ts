"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { productOptions, sql } from "@/lib/db";
import { normalizeCrop, normalizeName, phoneKey, todayISO } from "@/lib/format";
import { UNITS, recipeKind, waterOrDefault, type RecipeItem, type RecipeKind } from "@/lib/recipe";

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
  const region = normalizeName(str(fd, "region"));
  const crop = normalizeCrop(str(fd, "crop"));
  const area = parseArea(str(fd, "area_donum"));
  if (!name) return { error: "Çiftçinin adı soyadı gerekli." };
  if (area === "hata") return { error: "Dönüm sayı olmalı (örn. 4 veya 2,5)." };

  // Formda kayıtlı bir çiftçi seçildiyse tarla ona eklenir
  const chosen = Number(str(fd, "farmer_id")) || 0;
  let farmerId = 0;
  if (chosen) {
    const found = await sql<{ id: number }>(`SELECT id FROM farmers WHERE id = $1`, [chosen]);
    farmerId = found[0]?.id ?? 0;
  }
  if (!farmerId) farmerId = await findOrCreateFarmer(name, phone);
  const rows = await sql<{ id: number }>(
    `INSERT INTO fields (farmer_id, address, crop, area_donum, region) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [farmerId, address, crop, area, region]
  );
  revalidatePath("/");
  redirect(`/tarla/${rows[0].id}?yeni=1`);
}

export async function updateField(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = Number(str(fd, "id"));
  const name = normalizeName(str(fd, "full_name"));
  const phone = str(fd, "phone");
  const address = str(fd, "address");
  const region = normalizeName(str(fd, "region"));
  const crop = normalizeCrop(str(fd, "crop"));
  const area = parseArea(str(fd, "area_donum"));
  if (!name) return { error: "Çiftçinin adı soyadı gerekli." };
  if (area === "hata") return { error: "Dönüm sayı olmalı (örn. 4 veya 2,5)." };

  const rows = await sql<{ farmer_id: number }>(
    `UPDATE fields SET address = $2, crop = $3, area_donum = $4, region = $5 WHERE id = $1 AND deleted_at IS NULL RETURNING farmer_id`,
    [id, address, crop, area, region]
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
  // Kalıcı silinmez: 30 gün Silinenler'de durur
  await sql(`UPDATE fields SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, [id]);
  revalidatePath("/");
  redirect("/?silindi=1");
}

// ---------- Ziyaret ----------

/** Listedeki "Bugün gidildi" butonu. Aynı gün ikinci kez basılırsa tekrar kayıt açmaz. */
export async function markVisitedToday(fieldId: number) {
  const today = todayISO();
  await sql(
    `INSERT INTO visits (field_id, visit_date)
     SELECT $1, $2::date
      WHERE EXISTS (SELECT 1 FROM fields WHERE id = $1 AND deleted_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM visits WHERE field_id = $1 AND visit_date = $2::date AND deleted_at IS NULL)`,
    [fieldId, today]
  );
  revalidatePath("/");
  revalidatePath(`/tarla/${fieldId}`);
}

export async function addVisit(_prev: FormState, fd: FormData): Promise<FormState> {
  const fieldId = Number(str(fd, "field_id"));
  const date = validDate(str(fd, "visit_date"));
  const note = str(fd, "note");
  let photoIds: number[] = [];
  try {
    photoIds = (JSON.parse(str(fd, "photo_ids") || "[]") as unknown[]).map(Number).filter(Number.isInteger);
  } catch {}
  const rows = await sql<{ id: number }>(
    `INSERT INTO visits (field_id, visit_date, note) VALUES ($1, $2, $3) RETURNING id`,
    [fieldId, date, note]
  );
  if (photoIds.length) {
    await sql(`UPDATE visit_photos SET visit_id = $1 WHERE id = ANY($2::int[]) AND visit_id IS NULL`, [
      rows[0].id,
      photoIds,
    ]);
  }
  revalidatePath("/");
  revalidatePath(`/tarla/${fieldId}`);
  redirect(`/tarla/${fieldId}?kaydedildi=1`);
}

export async function deleteVisit(fd: FormData) {
  const id = Number(str(fd, "id"));
  const fieldId = Number(str(fd, "field_id"));
  await sql(`UPDATE visits SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, [id]);
  revalidatePath("/");
  revalidatePath(`/tarla/${fieldId}`);
}

// ---------- Reçete ----------

type RecipePayload = {
  id?: number;
  field_id: number;
  recipe_date: string;
  method: RecipeKind;
  note: string;
  area_donum: number | null;
  water_per_donum: number | null;
  items: RecipeItem[];
};

/** Reçete/şablon ürün satırlarını temizler ve doğrular */
function cleanItems(raw: unknown): RecipeItem[] | string {
  const items = (Array.isArray(raw) ? (raw as Partial<RecipeItem>[]) : [])
    .map((it) => ({
      week: Number(it.week),
      method: it.method,
      product: String(it.product ?? "").trim().replace(/\s+/g, " "),
      amount: Number(it.amount),
      unit: it.unit,
      note: String(it.note ?? "").trim(),
    }))
    .filter((it) => it.product);
  for (const it of items) {
    if (![1, 2, 3].includes(it.week)) return "Geçersiz hafta.";
    if (it.method !== "sulama" && it.method !== "yapraktan") return "Geçersiz uygulama şekli.";
    if (!(it.amount > 0)) return `"${it.product}" için miktar girin.`;
    if (!UNITS.includes(it.unit as (typeof UNITS)[number])) return "Geçersiz birim.";
  }
  if (items.length === 0) return "En az bir ürün girin.";
  return items as RecipeItem[];
}

/** Bilinen bir ürün farklı büyük/küçük harfle yazıldıysa kayıtlı yazımını kullan ("cloud" → "Cloud") */
async function canonicalProducts(items: RecipeItem[]) {
  const known = new Map((await productOptions()).map((p) => [p.toLocaleLowerCase("tr-TR"), p]));
  for (const it of items) it.product = known.get(it.product.toLocaleLowerCase("tr-TR")) ?? it.product;
}

/** Ürün satırlarını tabloya yazar (recipe_items / recipe_template_items) */
async function insertItems(table: "recipe_items" | "recipe_template_items", fk: string, id: number, items: RecipeItem[]) {
  const values: unknown[] = [];
  const tuples = items.map((it, i) => {
    values.push(id, it.week, i, it.product, it.amount, it.unit, it.note, it.method);
    const b = i * 8;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8})`;
  });
  await sql(
    `INSERT INTO ${table} (${fk}, week, position, product, amount, unit, note, method) VALUES ${tuples.join(", ")}`,
    values
  );
}

function cleanRecipe(raw: unknown): RecipePayload | string {
  const r = raw as Partial<RecipePayload>;
  if (!r || typeof r !== "object") return "Geçersiz veri.";
  const items = cleanItems(r.items);
  if (typeof items === "string") return items;
  const kind = recipeKind(items);
  const hasFoliar = items.some((it) => it.method === "yapraktan");
  return {
    id: r.id ? Number(r.id) : undefined,
    field_id: Number(r.field_id),
    recipe_date: validDate(String(r.recipe_date ?? "")),
    method: kind,
    note: String(r.note ?? "").trim(),
    area_donum: Number(r.area_donum) > 0 ? Number(r.area_donum) : null,
    water_per_donum: hasFoliar ? waterOrDefault(Number(r.water_per_donum)) : null,
    items,
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

  await canonicalProducts(r.items);

  let id = r.id;
  const isNew = !id;
  if (id) {
    const upd = await sql<{ id: number }>(
      `UPDATE recipes SET recipe_date = $2, method = $3, note = $4, area_donum = $5, water_per_donum = $6 WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id, r.recipe_date, r.method, r.note, r.area_donum, r.water_per_donum]
    );
    if (!upd[0]) return { error: "Reçete bulunamadı." };
    await sql(`DELETE FROM recipe_items WHERE recipe_id = $1`, [id]);
  } else {
    const ins = await sql<{ id: number }>(
      `INSERT INTO recipes (field_id, recipe_date, method, note, area_donum, water_per_donum)
       SELECT $1, $2, $3, $4, $5, $6 WHERE EXISTS (SELECT 1 FROM fields WHERE id = $1 AND deleted_at IS NULL)
       RETURNING id`,
      [r.field_id, r.recipe_date, r.method, r.note, r.area_donum, r.water_per_donum]
    );
    if (!ins[0]) return { error: "Tarla bulunamadı." };
    id = ins[0].id;
  }

  await insertItems("recipe_items", "recipe_id", id!, r.items);

  // Reçete yazıldıysa tarlaya gidilmiştir: o tarihte ziyaret yoksa ekle (ileri tarihli reçetede ekleme)
  if (isNew && r.recipe_date <= todayISO()) {
    await sql(
      `INSERT INTO visits (field_id, visit_date, note)
       SELECT $1, $2::date, $3
        WHERE NOT EXISTS (SELECT 1 FROM visits WHERE field_id = $1 AND visit_date = $2::date AND deleted_at IS NULL)`,
      [r.field_id, r.recipe_date, `Reçete No ${String(id).padStart(6, "0")} yazıldı`]
    );
  }
  revalidatePath("/");
  revalidatePath(`/tarla/${r.field_id}`);
  redirect(`/recete/${id}?kaydedildi=1`);
}

export async function deleteRecipe(fd: FormData) {
  const id = Number(str(fd, "id"));
  const rows = await sql<{ field_id: number }>(
    `UPDATE recipes SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING field_id`,
    [id]
  );
  const fieldId = rows[0]?.field_id;
  if (fieldId) revalidatePath(`/tarla/${fieldId}`);
  redirect(fieldId ? `/tarla/${fieldId}` : "/");
}

// ---------- Öncelik (yıldız) ----------

/** Tarlanın çiftçisini öncelikli yapar / kaldırır (çiftçinin tüm tarlaları etkilenir). */
export async function toggleStar(fieldId: number) {
  await sql(
    `UPDATE farmers SET starred = NOT starred
      WHERE id = (SELECT farmer_id FROM fields WHERE id = $1)`,
    [fieldId]
  );
  revalidatePath("/");
  revalidatePath(`/tarla/${fieldId}`);
}

// ---------- Silinenler ----------

const TRASH_TABLE = { tarla: "fields", ziyaret: "visits", recete: "recipes" } as const;

export async function restoreItem(fd: FormData) {
  const kind = str(fd, "kind") as keyof typeof TRASH_TABLE;
  const id = Number(str(fd, "id"));
  const table = TRASH_TABLE[kind];
  if (!table || !Number.isInteger(id)) return;
  await sql(`UPDATE ${table} SET deleted_at = NULL WHERE id = $1`, [id]);
  revalidatePath("/");
  revalidatePath("/silinenler");
  revalidatePath("/tarla/[id]", "page");
}

// ---------- Reçete şablonları ----------

export async function saveTemplate(_prev: FormState, fd: FormData): Promise<FormState> {
  let raw: { id?: number; name?: string; note?: string; water_per_donum?: number; items?: unknown };
  try {
    raw = JSON.parse(String(fd.get("payload") ?? ""));
  } catch {
    return { error: "Geçersiz veri." };
  }
  const name = String(raw.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Şablona bir ad verin (örn. Muz – Kış sulama)." };
  const items = cleanItems(raw.items);
  if (typeof items === "string") return { error: items };
  await canonicalProducts(items);
  const hasFoliar = items.some((it) => it.method === "yapraktan");
  const water = hasFoliar ? waterOrDefault(Number(raw.water_per_donum)) : null;
  const note = String(raw.note ?? "").trim();

  let id = raw.id ? Number(raw.id) : 0;
  if (id) {
    const upd = await sql<{ id: number }>(
      `UPDATE recipe_templates SET name = $2, note = $3, water_per_donum = $4, updated_at = now() WHERE id = $1 RETURNING id`,
      [id, name, note, water]
    );
    if (!upd[0]) return { error: "Şablon bulunamadı." };
    await sql(`DELETE FROM recipe_template_items WHERE template_id = $1`, [id]);
  } else {
    const ins = await sql<{ id: number }>(
      `INSERT INTO recipe_templates (name, note, water_per_donum) VALUES ($1, $2, $3) RETURNING id`,
      [name, note, water]
    );
    id = ins[0].id;
  }
  await insertItems("recipe_template_items", "template_id", id, items);
  revalidatePath("/receteler");
  redirect("/receteler?sablon=kaydedildi");
}

export async function deleteTemplate(fd: FormData) {
  await sql(`DELETE FROM recipe_templates WHERE id = $1`, [Number(str(fd, "id"))]);
  revalidatePath("/receteler");
  redirect("/receteler");
}

/** Var olan bir reçeteyi isim vererek şablon olarak kaydeder */
export async function saveRecipeAsTemplate(recipeId: number, name: string): Promise<{ error?: string; id?: number }> {
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) return { error: "Şablon adı boş olamaz." };
  const rows = await sql<{ id: number }>(
    `INSERT INTO recipe_templates (name, note, water_per_donum)
     SELECT $2, note, water_per_donum FROM recipes WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [recipeId, n]
  );
  if (!rows[0]) return { error: "Reçete bulunamadı." };
  await sql(
    `INSERT INTO recipe_template_items (template_id, week, method, position, product, amount, unit, note)
     SELECT $1, week, COALESCE(method, 'sulama'), position, product, amount, unit, note
       FROM recipe_items WHERE recipe_id = $2`,
    [rows[0].id, recipeId]
  );
  revalidatePath("/receteler");
  return { id: rows[0].id };
}

// ---------- Fotoğraf ----------

export async function deletePhoto(photoId: number, fieldId: number) {
  await sql(`DELETE FROM visit_photos WHERE id = $1`, [photoId]);
  revalidatePath(`/tarla/${fieldId}`);
}
