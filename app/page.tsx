import Link from "next/link";
import { after } from "next/server";
import { listFields } from "@/lib/db";
import { FieldList } from "@/components/FieldList";
import { todayISO } from "@/lib/format";
import { maybeDailySnapshot } from "@/lib/backup";
import { WarmOffline } from "@/components/OfflineSupport";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ silindi?: string }> }) {
  const sp = await searchParams;
  const fields = await listFields();
  // Günde bir kez otomatik yedek (sayfa açılışını yavaşlatmadan, arka planda)
  after(() => maybeDailySnapshot().catch((e) => console.error("Yedek alınamadı:", e)));
  return (
    <>
      {sp.silindi && (
        <div className="alert alert-ok">
          Tarla silindi. 30 gün içinde <Link href="/silinenler">Silinenler</Link>'den geri alabilirsiniz.
        </div>
      )}
      <FieldList fields={fields} today={todayISO()} />
      <WarmOffline fieldIds={fields.map((f) => f.id)} />
      <nav className="footer-links">
        <Link href="/silinenler">🗑 Silinenler</Link>
        <Link href="/yedekler">💾 Yedekler</Link>
      </nav>
    </>
  );
}
