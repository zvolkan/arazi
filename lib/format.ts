/** Türkiye saatine göre bugünün tarihi: YYYY-MM-DD */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "2026-11-06" → "06.11.2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Telefonu karşılaştırma için son 10 haneye indirger (0 ve +90 önekleri fark etmez). */
export function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** "5321234567" → "0532 123 45 67" (tanınmayan biçimler olduğu gibi kalır) */
export function formatPhone(phone: string): string {
  const key = phoneKey(phone);
  if (key.length === 10) {
    return `0${key.slice(0, 3)} ${key.slice(3, 6)} ${key.slice(6, 8)} ${key.slice(8)}`;
  }
  return phone.trim();
}

/** Arama bağlantısı: tel:+905321234567 */
export function telHref(phone: string): string {
  const key = phoneKey(phone);
  if (key.length === 10) return `tel:+90${key}`;
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Türkçe karakterlere duyarlı küçük harf (arama için). */
export function trLower(s: string): string {
  return s.toLocaleLowerCase("tr-TR");
}

/** "  muz " → "Muz" — ürün adlarını tutarlı tutar. */
export function normalizeCrop(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t.charAt(0).toLocaleUpperCase("tr-TR") + t.slice(1).toLocaleLowerCase("tr-TR");
}

/** Ad soyad: her kelimenin ilk harfi büyük. */
export function normalizeName(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1).toLocaleLowerCase("tr-TR"))
    .join(" ");
}

export const DEFAULT_CROPS = [
  "Muz",
  "Çilek",
  "Avokado",
  "Domates",
  "Biber",
  "Salatalık",
  "Patlıcan",
  "Karpuz",
  "Kavun",
  "Yer fıstığı",
  "Narenciye",
  "Zeytin",
];

/** Son ziyaretten bu kadar gün geçince "Tekrar gidilmeli" olur. */
export const REVISIT_DAYS = 21;

export type Status = "gidilmedi" | "tekrar" | "gidildi";

/** İki "YYYY-MM-DD" tarih arasındaki gün farkı. */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);
}

export function fieldStatus(
  f: { visit_count: number; last_visit: string | null },
  today: string
): { status: Status; days: number | null } {
  if (f.visit_count === 0 || !f.last_visit) return { status: "gidilmedi", days: null };
  const days = daysBetween(f.last_visit, today);
  return { status: days >= REVISIT_DAYS ? "tekrar" : "gidildi", days };
}

export const STATUS_LABEL: Record<Status, string> = {
  gidilmedi: "Gidilmedi",
  tekrar: "3 haftayı geçti",
  gidildi: "Gidildi",
};
