import Link from "next/link";
import { listTrash, TRASH_DAYS } from "@/lib/db";
import { restoreItem } from "@/app/actions";

export const dynamic = "force-dynamic";

const KIND_LABEL = { tarla: "Tarla", ziyaret: "Ziyaret", recete: "Reçete" } as const;

function daysLeft(deletedAt: string | Date): number {
  const ms = new Date(deletedAt).getTime() + TRASH_DAYS * 86_400_000 - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default async function TrashPage() {
  const items = await listTrash();
  return (
    <div className="narrow">
      <Link href="/" className="back">← Listeye dön</Link>
      <h1 className="page-title">Silinenler</h1>
      <p className="subtle">
        Silinen kayıtlar {TRASH_DAYS} gün burada durur, sonra kalıcı olarak silinir.
        Bir tarla geri alınınca ziyaretleri ve reçeteleri de geri gelir.
      </p>

      {items.length === 0 ? (
        <div className="empty">Silinmiş kayıt yok.</div>
      ) : (
        <div className="panel">
          <ul className="visit-list">
            {items.map((it) => (
              <li key={`${it.kind}-${it.id}`}>
                <div>
                  <div className="date">
                    <span className="crop" style={{ marginRight: 6 }}>{KIND_LABEL[it.kind]}</span>
                    {it.full_name}
                  </div>
                  {it.detail && <div className="note">{it.detail}</div>}
                  <div className="note" style={{ fontSize: 13 }}>{daysLeft(it.deleted_at)} gün sonra kalıcı silinecek</div>
                </div>
                <form action={restoreItem} style={{ alignSelf: "center" }}>
                  <input type="hidden" name="kind" value={it.kind} />
                  <input type="hidden" name="id" value={it.id} />
                  <button type="submit" className="btn btn-sm">↺ Geri al</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
