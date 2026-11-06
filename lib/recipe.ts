// Reçete ile ilgili, hem sunucuda hem tarayıcıda kullanılabilen yardımcılar

export type Method = "sulama" | "yapraktan";

export const METHOD_LABEL: Record<Method, string> = {
  sulama: "Sulama",
  yapraktan: "Yapraktan",
};

export const UNITS = ["L", "ml", "kg", "g"] as const;
export type Unit = (typeof UNITS)[number];

export const WEEKS = [1, 2, 3] as const;

export type RecipeItem = {
  week: number;
  product: string;
  amount: number;
  unit: Unit;
  note: string;
};

export type Recipe = {
  id: number;
  field_id: number;
  recipe_date: string;
  method: Method;
  note: string;
  /** Reçete yazıldığı andaki dönüm (miktarlar dönüme göre girilir) */
  area_donum: number | null;
  /** Yapraktan: dönüme verilecek su (L) */
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
  const t = s.trim().replace(",", ".");
  if (!t) return NaN;
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

/** Öneri listesindeki başlangıç ürünleri; kullanılan ürünler zamanla eklenir. */
export const DEFAULT_PRODUCTS = [
  "Bayokim Baroute",
  "Bayokim Phoska",
  "Bayokim Potassio",
  "Bayokim Tracer 6-30-0+ME",
  "Cloud",
  "Fulactiv",
];

/** Miktarlar her iki uygulamada da dönüme girilir */
export const AMOUNT_BASIS: Record<Method, string> = {
  sulama: "dönüme",
  yapraktan: "dönüme",
};

/**
 * Yapraktan: dönüme doz, dönüme verilen suda çözülür.
 * Depoda karıştırma oranı = doz × 100 / dönüme su  (100 L suya düşen miktar)
 */
export function per100L(amountPerDonum: number, waterPerDonum: number | null): number | null {
  if (!waterPerDonum || waterPerDonum <= 0 || !(amountPerDonum > 0)) return null;
  return (amountPerDonum * 100) / waterPerDonum;
}

export type Basis = {
  /** Dönüm/100 L başına miktarlar bununla çarpılınca toplam çıkar */
  factor: number;
  /** "4 dönüm" · "4 dönüm · 200 L su" */
  label: string;
  /** Eksik bilgi varsa uyarı */
  warning?: string;
};

export function totalsBasis(method: Method, area: number | null, water: number | null): Basis {
  const a = area && area > 0 ? area : null;
  const w = water && water > 0 ? water : null;
  if (method === "sulama") {
    if (!a) return { factor: 1, label: "1 dönüm", warning: "Dönüm girilmediği için toplam 1 dönüme göre." };
    return { factor: a, label: `${formatAmount(a)} dönüm` };
  }
  // yapraktan: ürün toplamı yine dönümle çarpılır; su ayrıca hesaplanır
  const warnings = [
    !a ? "Dönüm girilmediği için toplam 1 dönüme göre." : "",
    !w ? "Dönüme su miktarı girilmedi; 100 L suya düşen miktar hesaplanamaz." : "",
  ].filter(Boolean);
  const area1 = a ?? 1;
  return {
    factor: area1,
    label: w
      ? `${formatAmount(area1)} dönüm · ${formatAmount(w * area1)} L su`
      : `${formatAmount(area1)} dönüm`,
    warning: warnings.length ? warnings.join(" ") : undefined,
  };
}
