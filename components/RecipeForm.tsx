"use client";

import { useActionState, useMemo, useState } from "react";
import { saveRecipe } from "@/app/actions";
import {
  METHOD_LABEL,
  UNITS,
  WEEKS,
  AMOUNT_BASIS,
  computeTotals,
  totalsBasis,
  formatAmount,
  parseAmount,
  type Method,
  type Recipe,
  type Unit,
} from "@/lib/recipe";

type Row = { key: number; product: string; amount: string; unit: Unit; note: string };

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
  const [method, setMethod] = useState<Method | null>(initial?.method ?? null);
  const [date, setDate] = useState(initial?.recipe_date ?? today);
  const numStr = (n: number | null | undefined) => (n != null ? formatAmount(n) : "");
  const [area, setArea] = useState(numStr(initial ? initial.area_donum : fieldArea));
  const [water, setWater] = useState(numStr(initial?.water_per_donum));
  const [note, setNote] = useState(initial?.note ?? "");
  const [weeks, setWeeks] = useState<Row[][]>(() =>
    WEEKS.map((w) => {
      const rows = (initial?.items ?? [])
        .filter((it) => it.week === w)
        .map((it) => ({ key: nextKey++, product: it.product, amount: formatAmount(it.amount), unit: it.unit, note: it.note ?? "" }));
      return rows.length ? rows : [emptyRow()];
    })
  );

  const setRow = (w: number, key: number, patch: Partial<Row>) =>
    setWeeks((ws) => ws.map((rows, i) => (i === w ? rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) : rows)));
  const addRow = (w: number) =>
    setWeeks((ws) => ws.map((rows, i) => (i === w ? [...rows, emptyRow(rows.at(-1)?.unit)] : rows)));
  const removeRow = (w: number, key: number) =>
    setWeeks((ws) =>
      ws.map((rows, i) => {
        if (i !== w) return rows;
        const left = rows.filter((r) => r.key !== key);
        return left.length ? left : [emptyRow()];
      })
    );
  const copyPrev = (w: number) =>
    setWeeks((ws) =>
      ws.map((rows, i) => (i === w ? ws[w - 1].map((r) => ({ ...r, key: nextKey++ })) : rows))
    );

  const items = useMemo(
    () =>
      weeks.flatMap((rows, i) =>
        rows
          .filter((r) => r.product.trim())
          .map((r) => ({ week: i + 1, product: r.product, amount: parseAmount(r.amount), unit: r.unit, note: r.note }))
      ),
    [weeks]
  );
  const basis = totalsBasis(method ?? "sulama", parseAmount(area) || null, parseAmount(water) || null);
  const totals = useMemo(() => computeTotals(items, basis.factor), [items, basis.factor]);

  const payload = JSON.stringify({
    id: initial?.id,
    field_id: fieldId,
    recipe_date: date,
    area_donum: parseAmount(area) || null,
    water_per_donum: parseAmount(water) || null,
    method,
    note,
    items,
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="payload" value={payload} />
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <div className="panel">
        <h2>Uygulama şekli</h2>
        <div className="seg">
          {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`seg-btn${method === m ? " on" : ""}`}
              onClick={() => setMethod(m)}
            >
              {m === "sulama" ? "💧 " : "🍃 "}
              {METHOD_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="row2" style={{ marginTop: 14 }}>
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
        {method === "yapraktan" && (
          <label className="field" style={{ marginTop: 14, marginBottom: 0 }}>
            <span>Dönüme kaç litre su?</span>
            <input
              inputMode="decimal"
              value={water}
              onChange={(e) => setWater(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="örn. 50"
            />
          </label>
        )}
        {method && (
          <p className="basis-hint">
            Miktarları <b>{AMOUNT_BASIS[method]}</b> göre girin.
          </p>
        )}
      </div>

      <datalist id="urun-listesi">
        {products.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {weeks.map((rows, w) => (
        <div className="panel" key={w}>
          <div className="week-head">
            <h2>{w + 1}. Hafta</h2>
            {w > 0 && (
              <button type="button" className="btn btn-sm" onClick={() => copyPrev(w)}>
                ⧉ {w}. haftayı kopyala
              </button>
            )}
          </div>
          {rows.map((r) => (
            <div className="rx-row" key={r.key}>
              <input
                className="rx-product"
                list="urun-listesi"
                placeholder="Ürün"
                value={r.product}
                onChange={(e) => setRow(w, r.key, { product: e.target.value })}
                autoComplete="off"
              />
              <input
                className="rx-amount"
                inputMode="decimal"
                placeholder={method === "yapraktan" ? "Miktar/100 L" : "Miktar/dönüm"}
                value={r.amount}
                onChange={(e) => setRow(w, r.key, { amount: e.target.value.replace(/[^\d.,]/g, "") })}
              />
              <select
                className="rx-unit"
                value={r.unit}
                onChange={(e) => setRow(w, r.key, { unit: e.target.value as Unit })}
                aria-label="Birim"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <button type="button" className="rx-del" onClick={() => removeRow(w, r.key)} aria-label="Satırı sil">
                ×
              </button>
              <input
                className="rx-note"
                placeholder="Açıklama (isteğe bağlı)"
                value={r.note}
                onChange={(e) => setRow(w, r.key, { note: e.target.value })}
                autoComplete="off"
              />
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => addRow(w)}>+ Ürün ekle</button>
        </div>
      ))}

      <div className="panel">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Genel açıklama (isteğe bağlı, PDF'te görünür)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </label>
      </div>

      <div className="panel totals">
        <h2>Toplam ihtiyaç{method ? ` · ${basis.label}` : ""}</h2>
        <p className="totals-hint">PDF'in en altında da yer alır.</p>
        {method && basis.warning && <p className="alert alert-error" style={{ margin: "0 0 10px" }}>{basis.warning}</p>}
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

      <button type="submit" className="btn btn-primary btn-block" disabled={pending || !method}>
        {pending ? "Kaydediliyor…" : !method ? "Önce Sulama / Yapraktan seçin" : "Reçeteyi Kaydet"}
      </button>
    </form>
  );
}
