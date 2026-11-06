import ExcelJS from "exceljs";
import { listFields } from "@/lib/db";
import { STATUS_LABEL, fieldStatus, formatDate, formatPhone, todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = todayISO();
  const order = { gidilmedi: 0, tekrar: 1, gidildi: 2 } as const;
  const fields = (await listFields())
    .map((f) => ({ ...f, ...fieldStatus(f, today) }))
    .sort((a, b) => order[a.status] - order[b.status] || a.full_name.localeCompare(b.full_name, "tr"));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Tarlalar", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Çiftçi", key: "name", width: 24 },
    { header: "Telefon", key: "phone", width: 16 },
    { header: "Tarla Adresi", key: "address", width: 40 },
    { header: "Ürün", key: "crop", width: 14 },
    { header: "Dönüm", key: "area", width: 9 },
    { header: "Durum", key: "status", width: 18 },
    { header: "İlk Ziyaret", key: "first", width: 13 },
    { header: "Son Ziyaret", key: "last", width: 13 },
    { header: "Ziyaret Sayısı", key: "count", width: 14 },
    { header: "Son Not", key: "note", width: 50 },
  ];
  for (const f of fields) {
    ws.addRow({
      name: f.full_name,
      phone: f.phone ? formatPhone(f.phone) : "",
      address: f.address,
      crop: f.crop,
      area: f.area_donum ?? "",
      status: STATUS_LABEL[f.status],
      first: formatDate(f.first_visit),
      last: formatDate(f.last_visit),
      count: f.visit_count,
      note: f.last_note,
    });
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F6B3A" } };
  ws.autoFilter = { from: "A1", to: "J1" };
  ws.getColumn("address").alignment = { wrapText: true, vertical: "top" };
  ws.getColumn("note").alignment = { wrapText: true, vertical: "top" };

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arazi-takip-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
