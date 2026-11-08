import { backupWorkbook, currentData, getBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

function isoDay(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(d);
}

/** /api/yedek → şu anki verilerin tam yedeği, /api/yedek?id=5 → otomatik yedek */
export async function GET(req: Request) {
  const idParam = new URL(req.url).searchParams.get("id");
  let data, takenAt: Date;
  if (idParam) {
    const b = await getBackup(Number(idParam));
    if (!b) return new Response("Yedek bulunamadı", { status: 404 });
    data = b.data;
    takenAt = new Date(b.created_at);
  } else {
    data = await currentData();
    takenAt = new Date();
  }
  const buf = await backupWorkbook(data, takenAt);
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="arazi-takip-yedek-${isoDay(takenAt)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
