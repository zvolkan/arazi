import { Pool, types } from "pg";
import { DEFAULT_PRODUCTS, type Recipe, type RecipeItem } from "./recipe";

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
  crop: string;
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
};

// ---------- Sorgular ----------

const FIELD_SELECT = `
  SELECT f.id, f.farmer_id, fa.full_name, fa.phone, f.address, f.crop,
         MIN(v.visit_date) AS first_visit,
         MAX(v.visit_date) AS last_visit,
         COUNT(v.id)::int  AS visit_count,
         COALESCE((SELECT v2.note FROM visits v2
                    WHERE v2.field_id = f.id AND v2.note <> ''
                    ORDER BY v2.visit_date DESC, v2.id DESC LIMIT 1), '') AS last_note
    FROM fields f
    JOIN farmers fa ON fa.id = f.farmer_id
    LEFT JOIN visits v ON v.field_id = f.id
`;

export async function listFields(): Promise<FieldRow[]> {
  return sql<FieldRow>(`${FIELD_SELECT} GROUP BY f.id, fa.id ORDER BY f.id DESC`);
}

export async function getField(id: number): Promise<FieldRow | null> {
  const rows = await sql<FieldRow>(
    `${FIELD_SELECT} WHERE f.id = $1 GROUP BY f.id, fa.id`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listVisits(fieldId: number): Promise<Visit[]> {
  return sql<Visit>(
    `SELECT id, field_id, visit_date, note FROM visits
      WHERE field_id = $1 ORDER BY visit_date DESC, id DESC`,
    [fieldId]
  );
}

export async function otherFieldsOfFarmer(farmerId: number, exceptFieldId: number) {
  return sql<{ id: number; address: string; crop: string }>(
    `SELECT id, address, crop FROM fields
      WHERE farmer_id = $1 AND id <> $2 ORDER BY id`,
    [farmerId, exceptFieldId]
  );
}

export async function listCrops(): Promise<string[]> {
  const rows = await sql<{ crop: string }>(
    `SELECT DISTINCT crop FROM fields WHERE crop <> ''`
  );
  return rows.map((r) => r.crop);
}

// ---------- Reçeteler ----------

export async function listRecipes(fieldId: number) {
  return sql<{ id: number; recipe_date: string; method: Recipe["method"]; item_count: number }>(
    `SELECT r.id, r.recipe_date, r.method, COUNT(i.id)::int AS item_count
       FROM recipes r LEFT JOIN recipe_items i ON i.recipe_id = r.id
      WHERE r.field_id = $1
      GROUP BY r.id ORDER BY r.recipe_date DESC, r.id DESC`,
    [fieldId]
  );
}

export async function getRecipe(id: number): Promise<Recipe | null> {
  const rows = await sql<Omit<Recipe, "items">>(
    `SELECT id, field_id, recipe_date, method, note FROM recipes WHERE id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const items = await sql<RecipeItem>(
    `SELECT week, product, amount, unit, note FROM recipe_items
      WHERE recipe_id = $1 ORDER BY week, position, id`,
    [id]
  );
  return { ...rows[0], items };
}

/** Ürün önerileri: varsayılanlar + daha önce reçetede yazılmış ürünler */
export async function productOptions(): Promise<string[]> {
  const rows = await sql<{ product: string }>(`SELECT DISTINCT product FROM recipe_items`);
  const seen = new Map<string, string>();
  for (const p of [...DEFAULT_PRODUCTS, ...rows.map((r) => r.product)]) {
    const k = p.toLocaleLowerCase("tr-TR");
    if (!seen.has(k)) seen.set(k, p);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "tr"));
}
