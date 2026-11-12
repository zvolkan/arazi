import Link from "next/link";
import { notFound } from "next/navigation";
import { getField, getRecipe } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { KIND_LABEL, METHODS, METHOD_LABEL, WEEKS, computeTotals, formatAmount, recipeNo, totalsBasis, waterOrDefault } from "@/lib/recipe";
import { formatPacks, packCounts } from "@/lib/catalog";
import { deleteRecipe } from "@/app/actions";
import { SharePdfButton } from "@/components/SharePdfButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SaveAsTemplateButton } from "@/components/SaveAsTemplateButton";
import { ClearDraft } from "@/components/ClearDraft";

export const dynamic = "force-dynamic";

function pdfFileName(no: string, name: string) {
  const safe = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `Recete-${no}-${safe || "ciftci"}.pdf`;
}

export default async function RecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kaydedildi?: string }>;
}) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const recipe = Number.isInteger(id) ? await getRecipe(id) : null;
  if (!recipe) notFound();
  const field = await getField(recipe.field_id);
  if (!field) notFound();

  const no = recipeNo(recipe.id);
  const hasFoliar = recipe.items.some((it) => it.method === "yapraktan");
  const water = waterOrDefault(recipe.water_per_donum);
  const basis = totalsBasis(recipe.area_donum, recipe.water_per_donum, hasFoliar);
  const totals = computeTotals(recipe.items, basis.factor);
  const pdfUrl = `/api/recete/${recipe.id}`;

  return (
    <div className="narrow">
      <Link href={`/tarla/${field.id}`} className="back">← {field.full_name}</Link>
      {sp.kaydedildi && <div className="alert alert-ok">Reçete kaydedildi.</div>}
      {sp.kaydedildi && <ClearDraft keys={[`recete:yeni:${field.id}`, `recete:${recipe.id}`]} />}

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Reçete No {no}</h1>
            <p className="subtle" style={{ margin: "4px 0 0" }}>
              {formatDate(recipe.recipe_date)} · {field.full_name}{field.crop ? ` · ${field.crop}` : ""}
            </p>
          </div>
          <span className="badge badge-yes">{KIND_LABEL[recipe.method] ?? recipe.method}</span>
        </div>

        <div style={{ marginTop: 16 }}>
          <SharePdfButton url={pdfUrl} fileName={pdfFileName(no, field.full_name)} />
        </div>
        <div className="actions-row" style={{ marginTop: 4 }}>
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn">📄 PDF'i Aç</a>
          <Link href={`/recete/${recipe.id}/duzenle`} className="btn">✎ Düzenle</Link>
          <SaveAsTemplateButton
            recipeId={recipe.id}
            suggestion={[field.crop, KIND_LABEL[recipe.method]].filter(Boolean).join(" – ")}
          />
        </div>
      </div>

      <div className="panel totals">
        <h2>Toplam ihtiyaç · {basis.areaLabel}</h2>
        <p className="totals-hint">
          PDF'in en altında da yer alır.
          {basis.waterLabel && <> Yapraktan: dönüme {formatAmount(water)} L su, her uygulamada <b>{basis.waterLabel}</b>.</>}
        </p>
        {basis.warning && <p className="alert alert-error" style={{ margin: "0 0 10px" }}>{basis.warning}</p>}
        <ul className="totals-list">
          {totals.map((t) => {
            const packs = packCounts(t.product, t.amount, t.unit);
            return (
              <li key={`${t.product}|${t.unit}`}>
                <span>{t.product}</span>
                <b style={{ textAlign: "right" }}>
                  {formatAmount(t.amount)} {t.unit === "L" ? "Litre" : "kg"}
                  {packs.length > 0 && <span className="pack-line">{formatPacks(packs)}</span>}
                </b>
              </li>
            );
          })}
        </ul>
      </div>

      {WEEKS.map((w) => {
        const items = recipe.items.filter((it) => it.week === w);
        return (
          <div className="panel" key={w}>
            <h2>{w}. Hafta <span className="basis-tag">(dönüme)</span></h2>
            {items.length === 0 ? (
              <p style={{ color: "var(--muted)", margin: 0 }}>Bu hafta için ürün yok.</p>
            ) : (
              METHODS.map((m) => {
                const list = items.filter((it) => it.method === m);
                if (list.length === 0) return null;
                return (
                  <div key={m}>
                    <div className="rx-sub">{m === "sulama" ? "💧" : "🍃"} {METHOD_LABEL[m]}
                      {m === "yapraktan" && <> · {formatAmount(water)} litre suya</>}
                    </div>
                    <ul className="totals-list">
                      {list.map((it, i) => (
                        <li key={i}>
                          <span>
                            {it.product}
                            {it.note && <span className="rx-item-note">{it.note}</span>}
                          </span>
                          <b style={{ textAlign: "right" }}>
                            {formatAmount(it.amount)} {it.unit}
                          </b>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        );
      })}

      {recipe.note && (
        <div className="panel">
          <h2>Genel açıklama</h2>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{recipe.note}</p>
        </div>
      )}

      <form action={deleteRecipe}>
        <input type="hidden" name="id" value={recipe.id} />
        <ConfirmButton message={`Reçete No ${no} silinsin mi?`} className="btn btn-danger btn-block">
          Reçeteyi Sil
        </ConfirmButton>
      </form>
    </div>
  );
}
