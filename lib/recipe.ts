// Reçete ile ilgili, hem sunucuda hem tarayıcıda kullanılabilen yardımcılar

export type Method = "sulama" | "yapraktan";

export const METHODS: Method[] = ["sulama", "yapraktan"];

export const METHOD_LABEL: Record<Method, string> = {
  sulama: "Sulama",
  yapraktan: "Yapraktan",
};

/** Reçetenin genel türü: içindeki ürünlere göre */
export type RecipeKind = Method | "karma";

export const KIND_LABEL: Record<RecipeKind, string> = {
  sulama: "Sulama",
  yapraktan: "Yapraktan",
  karma: "Sulama + Yapraktan",
};

export function recipeKind(items: Pick<RecipeItem, "method">[]): RecipeKind {
  const s = new Set(items.map((i) => i.method));
  if (s.size > 1) return "karma";
  return s.has("yapraktan") ? "yapraktan" : "sulama";
}

export const UNITS = ["L", "ml", "kg", "g"] as const;
export type Unit = (typeof UNITS)[number];

export const WEEKS = [1, 2, 3] as const;

export type RecipeItem = {
  week: number;
  /** Bu ürün sulamayla mı yapraktan mı verilecek */
  method: Method;
  product: string;
  amount: number;
  unit: Unit;
  note: string;
};

export type Recipe = {
  id: number;
  field_id: number;
  recipe_date: string;
  method: RecipeKind;
  note: string;
  /** Reçete yazıldığı andaki dönüm (miktarlar dönüme göre girilir) */
  area_donum: number | null;
  /** Yapraktan: dönüme verilecek su (L) */
  water_per_donum: number | null;
  items: RecipeItem[];
};

/** Reçete şablonu: tarlaya ve tarihe bağlı değil, isimle saklanır */
export type RecipeTemplate = {
  id: number;
  name: string;
  note: string;
  water_per_donum: number | null;
  items: RecipeItem[];
};

/** Reçete numarası: 000012 */
export function recipeNo(id: number): string {
  return String(id).padStart(6, "0");
}

/** 2.5 → "2,5" */
export function formatAmount(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

/** "2,5" / "2.5" → 2.5 ; geçersizse NaN */
export function parseAmount(s: string): number {
  // Türkçe yazım: "2,5" → 2.5 · "2.5" → 2.5 · "2.000" → 2000 · "1.500,5" → 1500.5 · "0.250" → 0.25
  let t = s.trim().replace(/\s/g, "");
  if (!t) return NaN;
  if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", ".");
  return Number(t);
}

export type Total = { product: string; amount: number; unit: "L" | "kg" };

/**
 * Ürün bazında toplam ihtiyaç. ml → L, g → kg çevrilir.
 * "cloud" ve "Cloud " aynı ürün sayılır. Miktarlar dönüm başına girildiği için dönümle çarpılır.
 */
export function computeTotals(
  items: Pick<RecipeItem, "product" | "amount" | "unit">[],
  area: number | null = 1
): Total[] {
  const k = area && area > 0 ? area : 1;
  const map = new Map<string, Total>();
  for (const it of items) {
    const name = it.product.trim().replace(/\s+/g, " ");
    if (!name || !(it.amount > 0)) continue;
    const isVolume = it.unit === "L" || it.unit === "ml";
    const unit: Total["unit"] = isVolume ? "L" : "kg";
    const amount = (it.unit === "ml" || it.unit === "g" ? it.amount / 1000 : it.amount) * k;
    const key = `${name.toLocaleLowerCase("tr-TR")}|${unit}`;
    const cur = map.get(key);
    if (cur) cur.amount += amount;
    else map.set(key, { product: name, amount, unit });
  }
  return Array.from(map.values()).sort((a, b) => a.product.localeCompare(b.product, "tr"));
}


/** Yapraktanda dönüme su girilmezse kullanılan değer (L) */
export const DEFAULT_WATER_PER_DONUM = 150;

/** Yapraktan için geçerli dönüme su: girilmediyse 100 L */
export function waterOrDefault(water: number | null | undefined): number {
  return water && water > 0 ? water : DEFAULT_WATER_PER_DONUM;
}


export type Basis = {
  /** Dönüme girilen miktarlar bununla çarpılınca toplam çıkar */
  factor: number;
  /** "4 dönüm" */
  areaLabel: string;
  /** Yapraktan varsa bir uygulamada kullanılacak toplam su: "400 L" */
  waterLabel?: string;
  /** Eksik bilgi varsa uyarı */
  warning?: string;
};

/** Miktarlar her iki uygulamada da dönüme girilir; toplam = miktar × dönüm. */
export function totalsBasis(area: number | null, water: number | null, hasFoliar: boolean): Basis {
  const a = area && area > 0 ? area : 1;
  return {
    factor: a,
    areaLabel: `${formatAmount(a)} dönüm`,
    waterLabel: hasFoliar ? `${formatAmount(waterOrDefault(water) * a)} L` : undefined,
    warning: area && area > 0 ? undefined : "Dönüm girilmediği için toplam 1 dönüme göre.",
  };
}
