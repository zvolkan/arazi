import Link from "next/link";
import { listRecentRecipes, listTemplates } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { KIND_LABEL, recipeKind, recipeNo } from "@/lib/recipe";
import { deleteTemplate } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ sablon?: string }> }) {
  const sp = await searchParams;
  const [templates, recent] = await Promise.all([listTemplates(), listRecentRecipes(30)]);
  return (
    <div className="narrow">
      <Link href="/" className="back">← Listeye dön</Link>
      <h1 className="page-title">Reçeteler</h1>
      {sp.sablon && <div className="alert alert-ok">Şablon kaydedildi.</div>}

      <div className="panel">
        <div className="week-head">
          <h2>📋 Şablonlar ({templates.length})</h2>
          <Link href="/receteler/sablon/yeni" className="btn btn-sm btn-primary">+ Yeni Şablon</Link>
        </div>
        <p className="totals-hint" style={{ marginTop: 0 }}>
          Sık kullanılan reçeteleri isim vererek saklayın. Yeni reçete yazarken &quot;Şablondan başla&quot; ile seçilir.
        </p>
        {templates.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>Henüz şablon yok.</p>
        ) : (
          <ul className="visit-list">
            {templates.map((t) => (
              <li key={t.id}>
                <Link href={`/receteler/sablon/${t.id}`} style={{ textDecoration: "none", flex: 1 }}>
                  <div className="date">{t.name}</div>
                  <div className="note">
                    {KIND_LABEL[recipeKind(t.items)]} · {t.items.length} ürün
                  </div>
                </Link>
                <form action={deleteTemplate} style={{ alignSelf: "center" }}>
                  <input type="hidden" name="id" value={t.id} />
                  <ConfirmButton message={`"${t.name}" şablonu silinsin mi?`} className="btn btn-sm btn-danger">
                    Sil
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <h2>🧾 Son yazılan reçeteler</h2>
        {recent.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>Henüz reçete yazılmadı.</p>
        ) : (
          <ul className="visit-list">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/recete/${r.id}`} style={{ textDecoration: "none", flex: 1 }}>
                  <div className="date">{r.full_name}</div>
                  <div className="note">
                    No {recipeNo(r.id)} · {formatDate(r.recipe_date)}
                    {r.crop ? ` · ${r.crop}` : ""} · {KIND_LABEL[r.method] ?? r.method} · {r.item_count} ürün
                  </div>
                </Link>
                <span aria-hidden style={{ alignSelf: "center" }}>›</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
