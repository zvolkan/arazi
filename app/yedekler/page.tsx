import Link from "next/link";
import { BACKUP_KEEP, formatDateTime, listBackups } from "@/lib/backup";

export const dynamic = "force-dynamic";

export default async function BackupsPage() {
  const backups = await listBackups();
  return (
    <div className="narrow">
      <Link href="/" className="back">← Listeye dön</Link>
      <h1 className="page-title">Yedekler</h1>

      <div className="panel">
        <h2>Şimdi yedek indir</h2>
        <p style={{ margin: "0 0 12px", color: "var(--muted)" }}>
          Tüm tarlalar, ziyaretler ve reçeteler tek Excel dosyasında. Ayda bir indirip bilgisayara
          veya Google Drive'a kaydetmeniz önerilir.
        </p>
        <a href="/api/yedek" className="btn btn-primary btn-block">⬇ Tam Yedeği İndir (Excel)</a>
      </div>

      <div className="panel">
        <h2>Otomatik yedekler</h2>
        <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: 14 }}>
          Sistem her gün kendiliğinden yedek alır, son {BACKUP_KEEP} günü saklar.
        </p>
        {backups.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>Henüz otomatik yedek yok. Ana sayfa açılınca alınır.</p>
        ) : (
          <ul className="visit-list">
            {backups.map((b) => (
              <li key={b.id}>
                <div>
                  <div className="date">{formatDateTime(b.created_at)}</div>
                  <div className="note" style={{ fontSize: 13 }}>{Math.max(1, Math.round(b.size / 1024))} KB</div>
                </div>
                <a href={`/api/yedek?id=${b.id}`} className="btn btn-sm" style={{ alignSelf: "center" }}>⬇ İndir</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
