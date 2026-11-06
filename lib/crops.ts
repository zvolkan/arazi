import { listCrops } from "./db";
import { DEFAULT_CROPS } from "./format";

/** Varsayılan ürünler + daha önce yazılmış ürünler (alfabetik). */
export async function cropOptions(): Promise<string[]> {
  const used = await listCrops();
  return Array.from(new Set([...DEFAULT_CROPS, ...used])).sort((a, b) => a.localeCompare(b, "tr"));
}
