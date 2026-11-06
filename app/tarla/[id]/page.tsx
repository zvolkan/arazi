import Link from "next/link";
import { notFound } from "next/navigation";
import { getField, listVisits, otherFieldsOfFarmer } from "@/lib/db";
import { formatDate, formatPhone, telHref, todayISO } from "@/lib/format";
import { deleteField, deleteVisit } from "@/app/actions";
import { StatusBadge } from "@/components/FieldList";
import { VisitForm } from "@/components/VisitForm";
import { ConfirmButton } from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function FieldPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ yeni?: string; kaydedildi?: string }>;
}) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const field = Number.isInteger(id) ? await getField(id) : null;
  if (!field) notFound();

  const [visits, others] = await Promise.all([
    listVisits(field.id),
    otherFieldsOfFarmer(field.farmer_id, field.id),
  ]);

  return (
    <div className="narrow">
      <Link href="/" className="back">← Listeye dön</Link>

      {sp.yeni && <div className="alert alert-ok">Kayıt eklendi.</div>}
      {sp.kaydedildi && <div className="alert alert-ok">Ziyaret kaydedildi.</div>}

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <h1 className="page-title" style={{ margin: 0 }}>{field.full_name}</h1>
          <StatusBadge f={field} />
        </div>

        <div className="info-grid" style={{ marginTop: 14 }}>
          <div>
            <span>Telefon</span>
            {field.phone ? formatPhone(field.phone) : "—"}
          </div>
          <div>
            <span>Tarla adresi</span>
            <div style={{ whiteSpace: "pre-wrap" }}>{field.address || "—"}</div>
          </div>
          <div>
            <span>Ne tarlası</span>
            {field.crop ? <span className="crop">{field.crop}</span> : "—"}
          </div>
        </div>

        {field.phone && (
          <a href={telHref(field.phone)} className="btn btn-call btn-block" style={{ marginTop: 16 }}>
            📞 {formatPhone(field.phone)} — Ara
          </a>
        )}
      </div>

      <div className="panel">
        <h2>Ziyaret Ekle</h2>
        <VisitForm fieldId={field.id} today={todayISO()} />
      </div>

      <div className="panel">
        <h2>Ziyaret Geçmişi ({visits.length})</h2>
        {visits.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>Bu tarlaya henüz gidilmedi.</p>
        ) : (
          <ul className="visit-list">
            {visits.map((v, i) => (
              <li key={v.id}>
                <div>
                  <div className="date">
                    {formatDate(v.visit_date)}
                    {i === visits.length - 1 && (
                      <span className="badge badge-yes" style={{ marginLeft: 8 }}>İlk ziyaret</span>
                    )}
                  </div>
                  {v.note && <div className="note">{v.note}</div>}
                </div>
                <form action={deleteVisit}>
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="field_id" value={field.id} />
                  <ConfirmButton message={`${formatDate(v.visit_date)} tarihli ziyaret silinsin mi?`} className="btn btn-sm btn-danger">
                    Sil
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {others.length > 0 && (
        <div className="panel">
          <h2>Çiftçinin Diğer Tarlaları</h2>
          <ul className="visit-list">
            {others.map((o) => (
              <li key={o.id}>
                <Link href={`/tarla/${o.id}`} style={{ textDecoration: "none" }}>
                  {o.crop && <span className="crop" style={{ marginRight: 6 }}>{o.crop}</span>}
                  {o.address || "Adres girilmemiş"}
                </Link>
                <span aria-hidden>›</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="actions-row">
        <Link href={`/tarla/${field.id}/duzenle`} className="btn">✎ Düzenle</Link>
        <form action={deleteField} style={{ display: "flex" }}>
          <input type="hidden" name="id" value={field.id} />
          <ConfirmButton message="Bu tarla ve tüm ziyaret kayıtları silinsin mi? Geri alınamaz." className="btn btn-danger btn-block">
            Tarlayı Sil
          </ConfirmButton>
        </form>
      </div>
    </div>
  );
}
