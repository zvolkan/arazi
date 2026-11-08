import ExcelJS from "exceljs";
import { purgeTrash, sql } from "./db";
import { formatDate, formatPhone } from "./format";
import { METHOD_LABEL, recipeNo, type Method } from "./recipe";

/** Kaç günlük otomatik yedek saklanır */
export const BACKUP_KEEP = 30;

// Tüm tabloları tek bir JSON'a toplayan SQL ifadesi
const DATA_SQL = `jsonb_build_object(
  'version', 1,
  'farmers',      COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM farmers t), '[]'::jsonb),
  'fields',       COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM fields t), '[]'::jsonb),
  'visits',       COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM visits t), '[]'::jsonb),
  'recipes',      COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM recipes t), '[]'::jsonb),
  'recipe_items', COALESCE((SELECT jsonb_agg(t ORDER BY t.id) FROM recipe_items t), '[]'::jsonb)
)`;

type Row = Record<string, any>;
export type BackupData = {
  version: number;
  farmers: Row[];
  fields: Row[];
  visits: Row[];
  recipes: Row[];
  recipe_items: Row[];
};

/**
 * Son 20 saatte yedek alınmadıysa yeni yedek alır, eski yedekleri ve
 * 30 günü geçen silinmiş kayıtları temizler. Ana sayfa açıldığında arka planda çalışır.
 */
export async function maybeDailySnapshot(): Promise<boolean> {
  const rows = await sql<{ id: number }>(
    `INSERT INTO backups (data)
     SELECT ${DATA_SQL}
      WHERE NOT EXISTS (SELECT 1 FROM backups WHERE created_at > now() - interval '20 hours')
     RETURNING id`
  );
  if (!rows[0]) return false;
  await sql(
    `DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY created_at DESC LIMIT ${BACKUP_KEEP})`
  );
  await purgeTrash();
  return true;
}

export async function listBackups() {
  return sql<{ id: number; created_at: Date; size: number }>(
    `SELECT id, created_at, octet_length(data::text) AS size FROM backups ORDER BY created_at DESC`
  );
}

export async function getBackup(id: number) {
  const rows = await sql<{ created_at: Date; data: BackupData }>(
    `SELECT created_at, data FROM backups WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function currentData(): Promise<BackupData> {
  const rows = await sql<{ data: BackupData }>(`SELECT ${DATA_SQL} AS data`);
  return rows[0].data;
}

/** "2026-11-08T21:00:00Z" → "09.11.2026 00:00" (Türkiye saati) */
export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Yedeği okunabilir Excel'e çevirir (silinmiş kayıtlar hariç). */
export async function backupWorkbook(data: BackupData, takenAt: Date | string): Promise<ArrayBuffer> {
  const alive = (r: Row) => !r.deleted_at;
  const farmers = new Map(data.farmers.map((f) => [f.id, f]));
  const fields = data.fields.filter(alive);
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const visits = data.visits.filter((v) => alive(v) && fieldById.has(v.field_id));
  const recipes = data.recipes.filter((r) => alive(r) && fieldById.has(r.field_id));
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const items = data.recipe_items.filter((i) => recipeById.has(i.recipe_id));

  const farmerOf = (fieldId: number) => farmers.get(fieldById.get(fieldId)?.farmer_id) ?? {};
  const phone = (p: string) => (p ? formatPhone(p) : "");
  const byName = (a: Row, b: Row) =>
    String(farmerOf(a.field_id ?? a.id).full_name ?? "").localeCompare(
      String(farmerOf(b.field_id ?? b.id).full_name ?? ""),
      "tr"
    );

  const wb = new ExcelJS.Workbook();
  const sheet = (name: string, cols: Partial<ExcelJS.Column>[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols;
    const h = ws.getRow(1);
    h.font = { bold: true, color: { argb: "FFFFFFFF" } };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F6B3A" } };
    return ws;
  };

  // 1) Tarlalar
  const visitStats = new Map<number, { first: string; last: string; count: number }>();
  for (const v of visits) {
    const s = visitStats.get(v.field_id) ?? { first: v.visit_date, last: v.visit_date, count: 0 };
    if (v.visit_date < s.first) s.first = v.visit_date;
    if (v.visit_date > s.last) s.last = v.visit_date;
    s.count++;
    visitStats.set(v.field_id, s);
  }
  const wsF = sheet("Tarlalar", [
    { header: "Çiftçi", key: "name", width: 24 },
    { header: "Telefon", key: "phone", width: 16 },
    { header: "Öncelik", key: "star", width: 9 },
    { header: "Bölge", key: "region", width: 14 },
    { header: "Tarla Adresi", key: "address", width: 36 },
    { header: "Ürün", key: "crop", width: 14 },
    { header: "Dönüm", key: "area", width: 9 },
    { header: "İlk Ziyaret", key: "first", width: 13 },
    { header: "Son Ziyaret", key: "last", width: 13 },
    { header: "Ziyaret Sayısı", key: "count", width: 14 },
  ]);
  for (const f of [...fields].sort(byName)) {
    const fa = farmers.get(f.farmer_id) ?? {};
    const st = visitStats.get(f.id);
    wsF.addRow({
      name: fa.full_name,
      phone: phone(fa.phone),
      star: fa.starred ? "★" : "",
      region: f.region ?? "",
      address: f.address,
      crop: f.crop,
      area: f.area_donum ?? "",
      first: formatDate(st?.first),
      last: formatDate(st?.last),
      count: st?.count ?? 0,
    });
  }

  // 2) Ziyaretler
  const wsV = sheet("Ziyaretler", [
    { header: "Tarih", key: "date", width: 12 },
    { header: "Çiftçi", key: "name", width: 24 },
    { header: "Telefon", key: "phone", width: 16 },
    { header: "Bölge", key: "region", width: 14 },
    { header: "Ürün", key: "crop", width: 14 },
    { header: "Tarla Adresi", key: "address", width: 32 },
    { header: "Not", key: "note", width: 50 },
  ]);
  for (const v of [...visits].sort((a, b) => (a.visit_date < b.visit_date ? 1 : -1))) {
    const f = fieldById.get(v.field_id)!;
    const fa = farmerOf(v.field_id);
    wsV.addRow({
      date: formatDate(v.visit_date),
      name: fa.full_name,
      phone: phone(fa.phone),
      region: f.region ?? "",
      crop: f.crop,
      address: f.address,
      note: v.note,
    });
  }

  // 3) Reçeteler (her ürün bir satır)
  const wsR = sheet("Reçeteler", [
    { header: "Reçete No", key: "no", width: 11 },
    { header: "Tarih", key: "date", width: 12 },
    { header: "Çiftçi", key: "name", width: 22 },
    { header: "Tarla Ürünü", key: "crop", width: 13 },
    { header: "Uygulama", key: "method", width: 11 },
    { header: "Dönüm", key: "area", width: 8 },
    { header: "Dönüme Su (L)", key: "water", width: 13 },
    { header: "Hafta", key: "week", width: 7 },
    { header: "Ürün", key: "product", width: 24 },
    { header: "Miktar (dönüme)", key: "amount", width: 15 },
    { header: "Birim", key: "unit", width: 7 },
    { header: "Açıklama", key: "inote", width: 30 },
    { header: "Genel Açıklama", key: "rnote", width: 36 },
  ]);
  const sortedItems = [...items].sort(
    (a, b) => b.recipe_id - a.recipe_id || a.week - b.week || a.position - b.position
  );
  for (const it of sortedItems) {
    const r = recipeById.get(it.recipe_id)!;
    const f = fieldById.get(r.field_id)!;
    wsR.addRow({
      no: recipeNo(r.id),
      date: formatDate(r.recipe_date),
      name: farmerOf(r.field_id).full_name,
      crop: f.crop,
      method: METHOD_LABEL[r.method as Method] ?? r.method,
      area: r.area_donum ?? "",
      water: r.water_per_donum ?? "",
      week: it.week,
      product: it.product,
      amount: Number(it.amount),
      unit: it.unit,
      inote: it.note ?? "",
      rnote: r.note,
    });
  }

  wb.creator = "Arazi Takip Sistemi";
  wb.created = new Date(takenAt);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
