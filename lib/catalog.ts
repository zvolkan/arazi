// Ürün listesi (GTS stok Excel'inden üretilir: scripts/gts-urun-listesi.py)
import data from "./urunler.json";

export type Pack = { size: number; type: string };
export type CatalogProduct = { name: string; unit: "L" | "kg"; packs: Pack[] };

export const CATALOG = data as CatalogProduct[];

/** Karşılaştırma anahtarı: küçük harf, boşluk ve noktalama yok ("Bayokim Cloud 7-7-7 +ME" → "bayokimcloud777me") */
export function searchKey(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]/g, "");
}

const byKey = new Map(CATALOG.map((p) => [p.name.toLocaleLowerCase("tr-TR").trim(), p]));

/** Tam adıyla (büyük/küçük harf fark etmez) listedeki ürün */
export function findProduct(name: string): CatalogProduct | undefined {
  return byKey.get(name.toLocaleLowerCase("tr-TR").trim().replace(/\s+/g, " "));
}

/** Yazılan metni içeren ürünler; önce ürün listesindekiler, sonra elle yazılmış eskiler. */
export function searchProducts(query: string, extra: string[] = [], limit = 8): string[] {
  const q = searchKey(query);
  if (!q) return [];
  const names = new Map<string, { name: string; listed: boolean }>();
  for (const p of CATALOG) names.set(p.name.toLocaleLowerCase("tr-TR"), { name: p.name, listed: true });
  for (const n of extra) {
    const k = n.toLocaleLowerCase("tr-TR");
    if (!names.has(k)) names.set(k, { name: n, listed: false });
  }
  const scored: { name: string; score: number }[] = [];
  for (const { name, listed } of names.values()) {
    const k = searchKey(name);
    const i = k.indexOf(q);
    if (i < 0) continue;
    // kelime başında eşleşme daha önde
    const wordStart = name
      .toLocaleLowerCase("tr-TR")
      .split(/[\s\-+()/]+/)
      .some((w) => searchKey(w).startsWith(q));
    scored.push({ name, score: (listed ? 0 : 10_000) + (i === 0 ? 0 : wordStart ? 1 : 2) * 1000 + k.length });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, "tr"))
    .slice(0, limit)
    .map((s) => s.name);
}

/** Bu ürünün listedeki birimiyle uyumlu mu? (L↔ml, kg↔g) */
export function sameDimension(catalogUnit: "L" | "kg", unit: string): boolean {
  return catalogUnit === "L" ? unit === "L" || unit === "ml" : unit === "kg" || unit === "g";
}

export type PackCount = { size: number; type: string; unit: "L" | "kg"; count: number };

/**
 * Toplam miktarı karşılayan en uygun paket birleşimi:
 * önce en az artan (fazla), eşitse en az paket. Örn. 12 kg Tracer → 1 × 8 kg + 1 × 4 kg.
 */
export function packCounts(product: string, total: number, totalUnit: "L" | "kg"): PackCount[] {
  const p = findProduct(product);
  if (!p || p.unit !== totalUnit || !(total > 0) || p.packs.length === 0) return [];
  const packs = [...p.packs].sort((a, b) => b.size - a.size).slice(0, 4);
  const EPS = 1e-9;
  let best: { counts: number[]; waste: number; n: number } | null = null;
  const counts = new Array(packs.length).fill(0);
  const walk = (i: number, sum: number, n: number) => {
    if (sum >= total - EPS) {
      const waste = sum - total;
      if (!best || waste < best.waste - EPS || (Math.abs(waste - best.waste) <= EPS && n < best.n)) {
        best = { counts: [...counts], waste, n };
      }
      return;
    }
    if (i >= packs.length) return;
    const max = Math.ceil((total - sum) / packs[i].size - EPS);
    for (let c = max; c >= 0; c--) {
      counts[i] = c;
      walk(i + 1, sum + c * packs[i].size, n + c);
    }
    counts[i] = 0;
  };
  walk(0, 0, 0);
  const chosen = best as { counts: number[] } | null;
  if (!chosen) return [];
  return packs
    .map((pk, i) => ({ size: pk.size, type: pk.type, unit: p.unit, count: chosen.counts[i] }))
    .filter((x) => x.count > 0);
}

/** "1 × 8 kg kova + 1 × 4 kg kova" */
export function formatPacks(list: PackCount[]): string {
  return list
    .map((pc) => `${pc.count} × ${pc.size.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${pc.unit} ${pc.type}`)
    .join(" + ");
}
