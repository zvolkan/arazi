import { Pool, types } from "pg";
import { type Recipe, type RecipeItem, type RecipeTemplate } from "./recipe";
import { CATALOG } from "./catalog";

// DATE kolonlarını JS Date yerine "YYYY-MM-DD" metni olarak al (saat dilimi kaymasını önler)
types.setTypeParser(1082, (v) => v);
// NUMERIC kolonlarını sayı olarak al
types.setTypeParser(1700, (v) => parseFloat(v));

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

declare global {
  // eslint-disable-next-line no-var
  var _atsPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var _atsSchema: Promise<void> | undefined;
}

function getPool(): Pool {
  if (!connectionString) {
    throw new Error(
      "Veritabanı bağlantısı bulunamadı. DATABASE_URL ortam değişkenini ayarlayın."
    );
  }
  if (!global._atsPool) {
    global._atsPool = new Pool({ connectionString, max: 5 });
  }
  return global._atsPool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS farmers (
  id         SERIAL PRIMARY KEY,
  full_name  TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  phone_key  TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS farmers_phone_key_idx ON farmers (phone_key);

CREATE TABLE IF NOT EXISTS fields (
  id         SERIAL PRIMARY KEY,
  farmer_id  INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  address    TEXT NOT NULL DEFAULT '',
  crop       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fields_farmer_idx ON fields (farmer_id);

CREATE TABLE IF NOT EXISTS visits (
  id         SERIAL PRIMARY KEY,
  field_id   INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS visits_field_idx ON visits (field_id);

CREATE TABLE IF NOT EXISTS recipes (
  id          SERIAL PRIMARY KEY,
  field_id    INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  recipe_date DATE NOT NULL,
  method      TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recipes_field_idx ON recipes (field_id);

CREATE TABLE IF NOT EXISTS recipe_items (
  id        SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  week      SMALLINT NOT NULL,
  position  SMALLINT NOT NULL DEFAULT 0,
  product   TEXT NOT NULL,
  amount    NUMERIC NOT NULL,
  unit      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS recipe_items_recipe_idx ON recipe_items (recipe_id);
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';
ALTER TABLE fields ADD COLUMN IF NOT EXISTS area_donum NUMERIC;
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS area_donum NUMERIC;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS water_per_donum NUMERIC;

-- Silinenler: kayıtlar 30 gün boyunca geri alınabilir
ALTER TABLE fields  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE visits  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Bölge
ALTER TABLE fields ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT '';

-- Sulama ve yapraktan aynı reçetede: uygulama şekli ürün satırında
ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS method TEXT;
UPDATE recipe_items i SET method = r.method FROM recipes r
 WHERE i.recipe_id = r.id AND i.method IS NULL AND r.method IN ('sulama', 'yapraktan');

-- Reçete şablonları
CREATE TABLE IF NOT EXISTS recipe_templates (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  note            TEXT NOT NULL DEFAULT '',
  water_per_donum NUMERIC,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS recipe_template_items (
  id          SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES recipe_templates(id) ON DELETE CASCADE,
  week        SMALLINT NOT NULL,
  method      TEXT NOT NULL,
  position    SMALLINT NOT NULL DEFAULT 0,
  product     TEXT NOT NULL,
  amount      NUMERIC NOT NULL,
  unit        TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS recipe_template_items_tpl_idx ON recipe_template_items (template_id);

-- Ziyaret fotoğrafları (küçültülmüş JPEG). visit_id boşsa henüz kaydedilmemiş yüklemedir.
CREATE TABLE IF NOT EXISTS visit_photos (
  id         SERIAL PRIMARY KEY,
  visit_id   INTEGER REFERENCES visits(id) ON DELETE CASCADE,
  data       BYTEA NOT NULL,
  thumb      BYTEA NOT NULL,
  width      INTEGER,
  height     INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS visit_photos_visit_idx ON visit_photos (visit_id);

-- Günlük otomatik yedekler (tüm tabloların kopyası)
CREATE TABLE IF NOT EXISTS backups (
  id         SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data       JSONB NOT NULL
);
`;

/** Tablolar yoksa ilk istekte kendiliğinden oluşturulur. */
async function ensureSchema() {
  if (!global._atsSchema) {
    global._atsSchema = getPool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((e) => {
        global._atsSchema = undefined;
        throw e;
      });
  }
  return global._atsSchema;
}

export async function sql<T = any>(text: string, params: unknown[] = []) {
  await ensureSchema();
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

// ---------- Tipler ----------

export type FieldRow = {
  id: number;
  farmer_id: number;
  full_name: string;
  phone: string;
  address: string;
  region: string;
  crop: string;
  area_donum: number | null;
  starred: boolean;
  first_visit: string | null;
  last_visit: string | null;
  visit_count: number;
  last_note: string;
};

export type Visit = {
  id: number;
  field_id: number;
  visit_date: string;
  note: string;
  photo_ids: number[];
};

// ---------- Sorgular ----------

const FIELD_SELECT = `
  SELECT f.id, f.farmer_id, fa.full_name, fa.phone, f.address, f.region, f.crop, f.area_donum, fa.starred,
         MIN(v.visit_date) AS first_visit,
         MAX(v.visit_date) AS last_visit,
         COUNT(v.id)::int  AS visit_count,
         COALESCE((SELECT v2.note FROM visits v2
                    WHERE v2.field_id = f.id AND v2.note <> '' AND v2.deleted_at IS NULL
                    ORDER BY v2.visit_date DESC, v2.id DESC LIMIT 1), '') AS last_note
    FROM fields f
    JOIN farmers fa ON fa.id = f.farmer_id
    LEFT JOIN visits v ON v.field_id = f.id AND v.deleted_at IS NULL
`;

export async function listFields(): Promise<FieldRow[]> {
  return sql<FieldRow>(`${FIELD_SELECT} WHERE f.deleted_at IS NULL GROUP BY f.id, fa.id ORDER BY f.id DESC`);
}

export async function getField(id: number): Promise<FieldRow | null> {
  const rows = await sql<FieldRow>(
    `${FIELD_SELECT} WHERE f.id = $1 AND f.deleted_at IS NULL GROUP BY f.id, fa.id`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listVisits(fieldId: number): Promise<Visit[]> {
  return sql<Visit>(
    `SELECT v.id, v.field_id, v.visit_date, v.note,
            COALESCE((SELECT array_agg(p.id ORDER BY p.id) FROM visit_photos p WHERE p.visit_id = v.id), '{}') AS photo_ids
       FROM visits v
      WHERE v.field_id = $1 AND v.deleted_at IS NULL ORDER BY v.visit_date DESC, v.id DESC`,
    [fieldId]
  );
}

export async function otherFieldsOfFarmer(farmerId: number, exceptFieldId: number) {
  return sql<{ id: number; address: string; crop: string }>(
    `SELECT id, address, crop FROM fields
      WHERE farmer_id = $1 AND id <> $2 AND deleted_at IS NULL ORDER BY id`,
    [farmerId, exceptFieldId]
  );
}

export async function listCrops(): Promise<string[]> {
  const rows = await sql<{ crop: string }>(
    `SELECT DISTINCT crop FROM fields WHERE crop <> '' AND deleted_at IS NULL`
  );
  return rows.map((r) => r.crop);
}

// ---------- Reçeteler ----------

export async function listRecipes(fieldId: number) {
  return sql<{ id: number; recipe_date: string; method: Recipe["method"]; item_count: number }>(
    `SELECT r.id, r.recipe_date, r.method, COUNT(i.id)::int AS item_count
       FROM recipes r LEFT JOIN recipe_items i ON i.recipe_id = r.id
      WHERE r.field_id = $1 AND r.deleted_at IS NULL
      GROUP BY r.id ORDER BY r.recipe_date DESC, r.id DESC`,
    [fieldId]
  );
}

export async function getRecipe(id: number): Promise<Recipe | null> {
  const rows = await sql<Omit<Recipe, "items">>(
    `SELECT id, field_id, recipe_date, method, note, area_donum, water_per_donum FROM recipes WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) return null;
  const items = await sql<RecipeItem>(
    `SELECT week, COALESCE(method, 'sulama') AS method, product, amount, unit, note FROM recipe_items
      WHERE recipe_id = $1
      ORDER BY week, CASE WHEN method = 'yapraktan' THEN 1 ELSE 0 END, position, id`,
    [id]
  );
  return { ...rows[0], items };
}

/** Ürün önerileri: ürün listesi (GTS) + daha önce reçetede yazılmış ürünler */
export async function productOptions(): Promise<string[]> {
  const rows = await sql<{ product: string }>(`SELECT DISTINCT product FROM recipe_items`);
  const seen = new Map<string, string>();
  for (const p of [...CATALOG.map((c) => c.name), ...rows.map((r) => r.product)]) {
    const k = p.toLocaleLowerCase("tr-TR");
    if (!seen.has(k)) seen.set(k, p);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "tr"));
}

// ---------- Bölge ----------

export async function listRegions(): Promise<string[]> {
  const rows = await sql<{ region: string }>(
    `SELECT DISTINCT region FROM fields WHERE region <> '' AND deleted_at IS NULL`
  );
  return rows.map((r) => r.region).sort((a, b) => a.localeCompare(b, "tr"));
}

// ---------- Silinenler ----------

export const TRASH_DAYS = 30;

export type TrashItem = {
  kind: "tarla" | "ziyaret" | "recete";
  id: number;
  field_id: number;
  full_name: string;
  detail: string;
  deleted_at: string;
};

/** Son 30 günde silinenler (tarlası silinmiş ziyaret/reçeteler tarlayla birlikte geri gelir) */
export async function listTrash(): Promise<TrashItem[]> {
  return sql<TrashItem>(
    `SELECT 'tarla' AS kind, f.id, f.id AS field_id, fa.full_name,
            concat_ws(' · ', NULLIF(f.crop, ''), NULLIF(f.region, ''), NULLIF(f.address, '')) AS detail,
            f.deleted_at
       FROM fields f JOIN farmers fa ON fa.id = f.farmer_id
      WHERE f.deleted_at IS NOT NULL
     UNION ALL
     SELECT 'ziyaret', v.id, f.id, fa.full_name,
            concat_ws(' · ', to_char(v.visit_date, 'DD.MM.YYYY'), NULLIF(f.crop, ''), NULLIF(v.note, '')),
            v.deleted_at
       FROM visits v JOIN fields f ON f.id = v.field_id JOIN farmers fa ON fa.id = f.farmer_id
      WHERE v.deleted_at IS NOT NULL AND f.deleted_at IS NULL
     UNION ALL
     SELECT 'recete', r.id, f.id, fa.full_name,
            concat_ws(' · ', 'No ' || lpad(r.id::text, 6, '0'), to_char(r.recipe_date, 'DD.MM.YYYY'), NULLIF(f.crop, '')),
            r.deleted_at
       FROM recipes r JOIN fields f ON f.id = r.field_id JOIN farmers fa ON fa.id = f.farmer_id
      WHERE r.deleted_at IS NOT NULL AND f.deleted_at IS NULL
     ORDER BY deleted_at DESC`
  );
}

/** 30 günü geçen silinmiş kayıtları kalıcı olarak temizler. */
export async function purgeTrash() {
  const cutoff = `now() - interval '${TRASH_DAYS} days'`;
  await sql(`DELETE FROM visits  WHERE deleted_at < ${cutoff}`);
  await sql(`DELETE FROM recipes WHERE deleted_at < ${cutoff}`);
  await sql(`DELETE FROM fields  WHERE deleted_at < ${cutoff}`);
  await sql(`DELETE FROM farmers fa WHERE NOT EXISTS (SELECT 1 FROM fields f WHERE f.farmer_id = fa.id)`);
  // Yüklenip ziyarete bağlanmamış (kaydedilmeden vazgeçilmiş) fotoğraflar
  await sql(`DELETE FROM visit_photos WHERE visit_id IS NULL AND created_at < now() - interval '1 day'`);
}

// ---------- Reçete şablonları ----------

const TEMPLATE_SELECT = `
  SELECT t.id, t.name, t.note, t.water_per_donum,
         COALESCE((SELECT json_agg(json_build_object(
                     'week', i.week, 'method', i.method, 'product', i.product,
                     'amount', i.amount, 'unit', i.unit, 'note', i.note)
                   ORDER BY i.week, CASE WHEN i.method = 'yapraktan' THEN 1 ELSE 0 END, i.position, i.id)
                   FROM recipe_template_items i WHERE i.template_id = t.id), '[]') AS items
    FROM recipe_templates t`;

export async function listTemplates(): Promise<RecipeTemplate[]> {
  const rows = await sql<RecipeTemplate>(`${TEMPLATE_SELECT} ORDER BY t.name`);
  return rows.map((t) => ({ ...t, items: t.items.map((i) => ({ ...i, amount: Number(i.amount) })) }));
}

export async function getTemplate(id: number): Promise<RecipeTemplate | null> {
  const rows = await sql<RecipeTemplate>(`${TEMPLATE_SELECT} WHERE t.id = $1`, [id]);
  const t = rows[0];
  return t ? { ...t, items: t.items.map((i) => ({ ...i, amount: Number(i.amount) })) } : null;
}

/** Son yazılan reçeteler (tüm tarlalar) */
export async function listRecentRecipes(limit = 30) {
  return sql<{
    id: number;
    recipe_date: string;
    method: Recipe["method"];
    field_id: number;
    full_name: string;
    crop: string;
    item_count: number;
  }>(
    `SELECT r.id, r.recipe_date, r.method, f.id AS field_id, fa.full_name, f.crop,
            (SELECT COUNT(*)::int FROM recipe_items i WHERE i.recipe_id = r.id) AS item_count
       FROM recipes r JOIN fields f ON f.id = r.field_id JOIN farmers fa ON fa.id = f.farmer_id
      WHERE r.deleted_at IS NULL AND f.deleted_at IS NULL
      ORDER BY r.recipe_date DESC, r.id DESC LIMIT $1`,
    [limit]
  );
}

// ---------- Fotoğraflar ----------

export async function getPhoto(id: number, kind: "data" | "thumb") {
  const rows = await sql<{ img: Buffer }>(
    `SELECT ${kind === "thumb" ? "thumb" : "data"} AS img FROM visit_photos WHERE id = $1`,
    [id]
  );
  return rows[0]?.img ?? null;
}

// ---------- Çiftçiler ----------

export type FarmerOption = { id: number; full_name: string; phone: string; field_count: number };

/** Yeni kayıtta öneri için kayıtlı çiftçiler (en az bir tarlası olanlar) */
export async function listFarmers(): Promise<FarmerOption[]> {
  return sql<FarmerOption>(
    `SELECT fa.id, fa.full_name, fa.phone, COUNT(f.id)::int AS field_count
       FROM farmers fa JOIN fields f ON f.farmer_id = fa.id AND f.deleted_at IS NULL
      GROUP BY fa.id ORDER BY fa.full_name`
  );
}
