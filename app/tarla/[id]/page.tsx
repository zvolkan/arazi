import Link from "next/link";
import { notFound } from "next/navigation";
import { getField, listRecipes, listVisits, otherFieldsOfFarmer } from "@/lib/db";
import { KIND_LABEL, recipeNo, type RecipeKind } from "@/lib/recipe";
import { formatDate, formatPhone, telHref, todayISO } from "@/lib/format";
import { deleteField, deleteVisit } from "@/app/actions";
import { StatusBadge } from "@/components/FieldList";
import { StarButton } from "@/components/StarButton";
import { VisitForm } from "@/components/VisitForm";
import { VisitPhotos } from "@/components/VisitPhotos";
import { ClearDraft } from "@/components/ClearDraft";
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

  const [visits, others, recipes] = await Promise.all([
    listVisits(field.id),
    otherFieldsOfFarmer(field.farmer_id, field.id),
    listRecipes(field.id),
  ]);

  return (
    <div className="narrow">
      <Link href="/" className="back">← Listeye dön</Link>

      {sp.yeni && <div className="alert alert-ok">Kayıt eklendi.</div>}
      {sp.kaydedildi && <div className="alert alert-ok">Ziyaret kaydedildi.</div>}
      {sp.kaydedildi && <ClearDraft keys={[`ziyaret:${field.id}`]} />}

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <h1 className="page-title name-cell" style={{ margin: 0 }}>
            <StarButton fieldId={field.id} starred={field.starred} size="lg" />
            {field.full_name}
          </h1>
          <StatusBadge f={field} today={todayISO()} />
        </div>

        <div className="info-grid" style={{ marginTop: 14 }}>
          <div>
            <span>Telefon</span>
            {field.phone ? formatPhone(field.phone) : "—"}
          </div>
          <div>
            <span>Bölge</span>
            {field.region || "—"}
          </div>
          <div>
            <span>Tarla adresi</span>
            <div style={{ whiteSpace: "pre-wrap" }}>{field.address || "—"}</div>
          </div>
          <div>
            <span>Ne tarlası</span>
            {field.crop ? <span className="crop">{field.crop}</span> : "—"}
          </div>
          <div>
            <span>Dönüm</span>
            {field.area_donum ? field.area_donum.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "—"}
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
        <VisitForm key={visits.length} fieldId={field.id} today={todayISO()} />
      </div>

      <div className="panel">
        <div className="week-head">
          <h2>Reçeteler ({recipes.length})</h2>
          <Link href={`/tarla/${field.id}/recete/yeni`} className="btn btn-sm btn-primary">+ Reçete Yaz</Link>
        </div>
        {recipes.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>Henüz reçete yazılmadı.</p>
        ) : (
          <ul className="visit-list">
            {recipes.map((r) => (
              <li key={r.id}>
                <Link href={`/recete/${r.id}`} style={{ textDecoration: "none", flex: 1 }}>
                  <div className="date">No {recipeNo(r.id)} · {formatDate(r.recipe_date)}</div>
                  <div className="note">{KIND_LABEL[r.method as RecipeKind] ?? r.method} · {r.item_count} ürün</div>
                </Link>
                <span aria-hidden style={{ alignSelf: "center" }}>›</span>
              </li>
            ))}
          </ul>
        )}
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
                  <VisitPhotos visitId={v.id} fieldId={field.id} photoIds={v.photo_ids} />
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
        <Link href={`/yeni?ciftci=${field.farmer_id}`} className="btn">+ Bu çiftçiye tarla ekle</Link>
        <Link href={`/tarla/${field.id}/duzenle`} className="btn">✎ Düzenle</Link>
        <form action={deleteField} style={{ display: "flex" }}>
          <input type="hidden" name="id" value={field.id} />
          <ConfirmButton message="Bu tarla silinsin mi? 30 gün içinde Silinenler'den geri alabilirsiniz." className="btn btn-danger btn-block">
            Tarlayı Sil
          </ConfirmButton>
        </form>
      </div>
    </div>
  );
}
