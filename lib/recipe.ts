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

/**
 * Reçete bölümleri sırasıyla: 1. hafta, (1-2 arası ara sulama), 2. hafta, (2-3 arası ara sulama), 3. hafta.
 * Ara sulamalar isteğe bağlıdır; veritabanında hafta numarası 12 ve 23 olarak saklanır.
 */
export const SLOTS = [1, 12, 2, 23, 3] as const;
export const isBetween = (slot: number) => slot > 3;
/** Ara sulamanın arasında olduğu haftalar: 12 → [1, 2] */
export const betweenWeeks = (slot: number) => [Math.floor(slot / 10), slot % 10] as const;
/** "2. Hafta" / "Ara sulama (1–2. hafta arası)" */
export function slotLabel(slot: number) {
  if (!isBetween(slot)) return `${slot}. Hafta`;
  const [a, b] = betweenWeeks(slot);
  return `Ara sulama (${a}–${b}. hafta arası)`;
}
/** Sıralama için bölüm sırası */
export const slotOrder = (slot: number) => {
  const i = (SLOTS as readonly number[]).indexOf(slot);
  return i < 0 ? 99 : i;
};

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
  /** Yapraktan: ilacın hazırlandığı varil (L); yapraktan miktarları bu varile göre. Boşsa dönüme göre. */
  barrel_liters: number | null;
  items: RecipeItem[];
};

/** Reçete şablonu: tarlaya ve tarihe bağlı değil, isimle saklanır */
export type RecipeTemplate = {
  id: number;
  name: string;
  note: string;
  water_per_donum: number | null;
  barrel_liters: number | null;
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
  items: Pick<RecipeItem, "product" | "amount" | "unit" | "method">[],
  /** Çarpan: tek sayı (dönüm) ya da uygulamaya göre ayrı (sulama: dönüm, yapraktan: varil sayısı) */
  factor: number | Record<Method, number> | null = 1
): Total[] {
  const kOf = (m: Method) => {
    const v = typeof factor === "number" || factor == null ? factor : factor[m];
    return v && v > 0 ? v : 1;
  };
  const map = new Map<string, Total>();
  for (const it of items) {
    const k = kOf(it.method);
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


/** Yapraktan miktarlarının girildiği su: varil girildiyse varil, yoksa dönüme su (yani dönüme göre) */
export function doseWater(water: number | null | undefined, barrel: number | null | undefined): number {
  return barrel && barrel > 0 ? barrel : waterOrDefault(water);
}

export type Basis = {
  /** Girilen miktarlar bununla çarpılınca toplam çıkar: sulama × dönüm, yapraktan × varil sayısı */
  factor: Record<Method, number>;
  /** "4 dönüm" */
  areaLabel: string;
  /** Yapraktan varsa bir uygulamada kullanılacak toplam su: "600 L" */
  waterLabel?: string;
  /** Varil girildiyse bir uygulamadaki varil sayısı: "3 varil" */
  barrelLabel?: string;
  /** Eksik bilgi varsa uyarı */
  warning?: string;
};

/**
 * Sulama: miktar dönüme girilir → toplam = miktar × dönüm.
 * Yapraktan: miktar varile girilir → toplam = miktar × (dönüme su × dönüm ÷ varil).
 * Varil girilmezse varil = dönüme su sayılır, yani yapraktan da dönüme göre olur.
 */
export function totalsBasis(area: number | null, water: number | null, barrel: number | null, hasFoliar: boolean): Basis {
  const a = area && area > 0 ? area : 1;
  const w = waterOrDefault(water);
  const v = doseWater(water, barrel);
  const totalWater = w * a;
  const hasBarrel = !!(barrel && barrel > 0);
  return {
    factor: { sulama: a, yapraktan: totalWater / v },
    areaLabel: `${formatAmount(a)} dönüm`,
    waterLabel: hasFoliar ? `${formatAmount(totalWater)} L` : undefined,
    barrelLabel: hasFoliar && hasBarrel ? `${formatAmount(totalWater / v)} varil` : undefined,
    warning: area && area > 0 ? undefined : "Dönüm girilmediği için toplam 1 dönüme göre.",
  };
}
