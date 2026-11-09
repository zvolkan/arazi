"use client";

import { useActionState, useMemo, useState } from "react";
import { saveRecipe } from "@/app/actions";
import {
  METHODS,
  METHOD_LABEL,
  UNITS,
  WEEKS,
  computeTotals,
  totalsBasis,
  per100L,
  waterOrDefault,
  DEFAULT_WATER_PER_DONUM,
  formatAmount,
  parseAmount,
  type Method,
  type Recipe,
  type Unit,
} from "@/lib/recipe";

type Row = { key: number; product: string; amount: string; unit: Unit; note: string };
/** Bir hafta: sulama ve yapraktan satırları ayrı */
type Week = Record<Method, Row[]>;

const ICON: Record<Method, string> = { sulama: "💧", yapraktan: "🍃" };

let nextKey = 1;
const emptyRow = (unit: Unit = "L"): Row => ({ key: nextKey++, product: "", amount: "", unit, note: "" });

export function RecipeForm({
  fieldId,
  fieldArea,
  today,
  products,
  initial,
}: {
  fieldId: number;
  fieldArea: number | null;
  today: string;
  products: string[];
  initial?: Recipe;
}) {
  const [state, formAction, pending] = useActionState(saveRecipe, {});
  const [date, setDate] = useState(initial?.recipe_date ?? today);
  const numStr = (n: number | null | undefined) => (n != null ? formatAmount(n) : "");
  const [area, setArea] = useState(numStr(initial ? initial.area_donum : fieldArea));
  const [water, setWater] = useState(numStr(initial?.water_per_donum ?? DEFAULT_WATER_PER_DONUM));
  const waterEff = waterOrDefault(parseAmount(water) || null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [weeks, setWeeks] = useState<Week[]>(() =>
    WEEKS.map((w) => {
      const pick = (m: Method) =>
        (initial?.items ?? [])
          .filter((it) => it.week === w && it.method === m)
          .map((it) => ({
            key: nextKey++,
            product: it.product,
            amount: formatAmount(it.amount),
            unit: it.unit,
            note: it.note ?? "",
          }));
      // Yeni reçetede her hafta bir boş sulama satırıyla başlar; yapraktan isteğe bağlı eklenir
      return initial
        ? { sulama: pick("sulama"), yapraktan: pick("yapraktan") }
        : { sulama: [emptyRow()], yapraktan: [] };
    })
  );

  const update = (w: number, m: Method, fn: (rows: Row[]) => Row[]) =>
    setWeeks((ws) => ws.map((wk, i) => (i === w ? { ...wk, [m]: fn(wk[m]) } : wk)));
  const setRow = (w: number, m: Method, key: number, patch: Partial<Row>) =>
    update(w, m, (rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = (w: number, m: Method) =>
    update(w, m, (rows) => [...rows, emptyRow(rows.at(-1)?.unit ?? (m === "yapraktan" ? "ml" : "L"))]);
  const removeRow = (w: number, m: Method, key: number) => update(w, m, (rows) => rows.filter((r) => r.key !== key));
  const copyPrev = (w: number) =>
    setWeeks((ws) =>
      ws.map((wk, i) =>
        i === w
          ? {
              sulama: ws[w - 1].sulama.map((r) => ({ ...r, key: nextKey++ })),
              yapraktan: ws[w - 1].yapraktan.map((r) => ({ ...r, key: nextKey++ })),
            }
          : wk
      )
    );

  const items = useMemo(
    () =>
      weeks.flatMap((wk, i) =>
        METHODS.flatMap((m) =>
          wk[m]
            .filter((r) => r.product.trim())
            .map((r) => ({
              week: i + 1,
              method: m,
              product: r.product,
              amount: parseAmount(r.amount),
              unit: r.unit,
              note: r.note,
            }))
        )
      ),
    [weeks]
  );
  const hasFoliarRows = weeks.some((wk) => wk.yapraktan.length > 0);
  const hasFoliar = items.some((it) => it.method === "yapraktan");
  const basis = totalsBasis(parseAmount(area) || null, parseAmount(water) || null, hasFoliar);
  const totals = useMemo(() => computeTotals(items, basis.factor), [items, basis.factor]);

  const payload = JSON.stringify({
    id: initial?.id,
    field_id: fieldId,
    recipe_date: date,
    area_donum: parseAmount(area) || null,
    water_per_donum: hasFoliar ? waterEff : null,
    note,
    items,
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="payload" value={payload} />
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <div className="panel">
        <div className="row2">
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Reçete tarihi</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Dönüm</span>
            <input
              inputMode="decimal"
              value={area}
              onChange={(e) => setArea(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="örn. 4"
            />
          </label>
        </div>
        {hasFoliarRows && (
          <label className="field" style={{ marginTop: 14, marginBottom: 0 }}>
            <span>🍃 Yapraktan: dönüme kaç litre su?</span>
            <input
              inputMode="decimal"
              value={water}
              onChange={(e) => setWater(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder={String(DEFAULT_WATER_PER_DONUM)}
            />
            <small>Boş bırakılırsa {DEFAULT_WATER_PER_DONUM} L kabul edilir. 100 L suya düşen miktar otomatik hesaplanır.</small>
          </label>
        )}
        <p className="basis-hint">
          Tüm miktarları <b>dönüme</b> göre girin. Her haftada sulama ve yapraktan ürünleri ayrı ayrı ekleyebilirsiniz.
        </p>
      </div>

      <datalist id="urun-listesi">
        {products.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {weeks.map((wk, w) => (
        <div className="panel" key={w}>
          <div className="week-head">
            <h2>{w + 1}. Hafta</h2>
            {w > 0 && (
              <button type="button" className="btn btn-sm" onClick={() => copyPrev(w)}>
                ⧉ {w}. haftayı kopyala
              </button>
            )}
          </div>

          {METHODS.map((m) => (
            <div className={`rx-block rx-block-${m}`} key={m}>
              <div className="rx-block-head">
                {ICON[m]} {METHOD_LABEL[m]}
                {wk[m].length > 0 && <span className="rx-block-count">{wk[m].filter((r) => r.product.trim()).length}</span>}
              </div>
              {wk[m].map((r) => (
                <div className="rx-row" key={r.key}>
                  <input
                    className="rx-product"
                    list="urun-listesi"
                    placeholder="Ürün"
                    value={r.product}
                    onChange={(e) => setRow(w, m, r.key, { product: e.target.value })}
                    autoComplete="off"
                  />
                  <input
                    className="rx-amount"
                    inputMode="decimal"
                    placeholder="Miktar/dönüm"
                    value={r.amount}
                    onChange={(e) => setRow(w, m, r.key, { amount: e.target.value.replace(/[^\d.,]/g, "") })}
                  />
                  <select
                    className="rx-unit"
                    value={r.unit}
                    onChange={(e) => setRow(w, m, r.key, { unit: e.target.value as Unit })}
                    aria-label="Birim"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <button type="button" className="rx-del" onClick={() => removeRow(w, m, r.key)} aria-label="Satırı sil">
                    ×
                  </button>
                  <input
                    className="rx-note"
                    placeholder="Açıklama (isteğe bağlı)"
                    value={r.note}
                    onChange={(e) => setRow(w, m, r.key, { note: e.target.value })}
                    autoComplete="off"
                  />
                  {m === "yapraktan" &&
                    (() => {
                      const c = per100L(parseAmount(r.amount), waterEff);
                      return c != null ? (
                        <div className="rx-calc">100 L suya: <b>{formatAmount(c)} {r.unit}</b></div>
                      ) : null;
                    })()}
                </div>
              ))}
              <button type="button" className="btn btn-sm rx-add" onClick={() => addRow(w, m)}>
                + {METHOD_LABEL[m]} ürünü ekle
              </button>
            </div>
          ))}
        </div>
      ))}

      <div className="panel">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Genel açıklama (isteğe bağlı, PDF'te görünür)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </label>
      </div>

      <div className="panel totals">
        <h2>Toplam ihtiyaç · {basis.areaLabel}</h2>
        <p className="totals-hint">
          PDF'in en altında da yer alır.
          {basis.waterLabel && <> Yapraktan uygulamada her seferinde <b>{basis.waterLabel} su</b>.</>}
        </p>
        {basis.warning && <p className="alert alert-error" style={{ margin: "0 0 10px" }}>{basis.warning}</p>}
        {totals.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>Ürün girdikçe burada toplanır.</p>
        ) : (
          <ul className="totals-list">
            {totals.map((t) => (
              <li key={`${t.product}|${t.unit}`}>
                <span>{t.product}</span>
                <b>{formatAmount(t.amount)} {t.unit === "L" ? "Litre" : "kg"}</b>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={pending || items.length === 0}>
        {pending ? "Kaydediliyor…" : items.length === 0 ? "En az bir ürün girin" : "Reçeteyi Kaydet"}
      </button>
    </form>
  );
}
