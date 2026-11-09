// Formların telefonda taslak olarak saklanması (internet giderse yazılanlar kaybolmasın)

const PREFIX = "taslak:";

export type Draft<T> = { data: T; savedAt: number };

export function loadDraft<T>(key: string): Draft<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Draft<T>) : null;
  } catch {
    return null;
  }
}

export function saveDraft<T>(key: string, data: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    /* depolama dolu ya da kapalı: sessizce geç */
  }
}

/** Anahtar "*" ile biterse o önekle başlayan tüm taslakları siler */
export function clearDraft(key: string) {
  try {
    if (key.endsWith("*")) {
      const p = PREFIX + key.slice(0, -1);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith(p)) localStorage.removeItem(k);
      }
    } else {
      localStorage.removeItem(PREFIX + key);
    }
  } catch {}
}

export function draftTime(ts: number): string {
  return new Date(ts).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** İnternet hatası mı? (sunucuya hiç ulaşılamadı) */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const m = String((e as Error)?.message ?? e);
  return e instanceof TypeError || /fetch|network|load failed|internet/i.test(m);
}

export const OFFLINE_MSG =
  "İnternet bağlantısı yok. Yazdıklarınız telefonda taslak olarak saklandı; bağlantı gelince tekrar Kaydet'e basın.";
