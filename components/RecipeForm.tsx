"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { saveRecipe, saveTemplate, type FormState } from "@/app/actions";
import { OFFLINE_MSG, clearDraft, draftTime, isNetworkError, loadDraft, saveDraft } from "@/lib/draft";
import {
  KIND_LABEL,
  METHODS,
  METHOD_LABEL,
  UNITS,
  SLOTS,
  betweenWeeks,
  isBetween,
  computeTotals,
  recipeKind,
  totalsBasis,
  waterOrDefault,
  doseWater,
  DEFAULT_WATER_PER_DONUM,
  formatAmount,
  parseAmount,
  type Method,
  type Recipe,
  type RecipeItem,
  type RecipeTemplate,
  type Unit,
} from "@/lib/recipe";
import { findProduct, sameDimension, packCounts, formatPacks } from "@/lib/catalog";
import { ProductInput } from "@/components/ProductInput";

type Row = { key: number; product: string; amount: string; unit: Unit; note: string };
/** Bir hafta: sulama ve yapraktan satırları ayrı */
type Week = Record<Method, Row[]>;

const ICON: Record<Method, string> = { sulama: "💧", yapraktan: "🍃" };

let nextKey = 1;
const emptyRow = (unit: Unit = "L"): Row => ({ key: nextKey++, product: "", amount: "", unit, note: "" });
const numStr = (n: number | null | undefined) =>
  n != null ? n.toLocaleString("tr-TR", { useGrouping: false, maximumFractionDigits: 2 }) : "";

/** Kayıtlı ürün satırlarından form bölümlerini kurar (SLOTS sırasıyla: hafta ve ara sulamalar) */
function weeksFrom(items: RecipeItem[] | undefined): Week[] {
  return SLOTS.map((w) => {
    // Ara sulama kapalı başlar (satırı yoksa kapalı sayılır)
    if (!items) return isBetween(w) ? { sulama: [], yapraktan: [] } : { sulama: [emptyRow()], yapraktan: [] };
    const pick = (m: Method) =>
      items
        .filter((it) => it.week === w && it.method === m)
        .map((it) => ({ key: nextKey++, product: it.product, amount: numStr(it.amount), unit: it.unit, note: it.note ?? "" }));
    return { sulama: pick("sulama"), yapraktan: pick("yapraktan") };
  });
}

type Props =
  | {
      mode?: "recipe";
      fieldId: number;
      fieldArea: number | null;
      today: string;
      products: string[];
      initial?: Recipe;
      /** Yeni reçetede "Şablondan başla" için */
      templates?: RecipeTemplate[];
    }
  | {
      mode: "template";
      products: string[];
      initial?: RecipeTemplate;
    };

type DraftData = { date: string; area: string; water: string; barrel?: string; note: string; name: string; weeks: Week[] };

export function RecipeForm(props: Props) {
  const isTemplate = props.mode === "template";
  const initialItems = props.initial?.items;
  const serverAction = isTemplate ? saveTemplate : saveRecipe;
  // İnternet yoksa kaydetme denemesi taslağı korur ve uyarı verir
  const [state, formAction, pending] = useActionState(async (prev: FormState, fd: FormData): Promise<FormState> => {
    if (!navigator.onLine) return { error: OFFLINE_MSG };
    try {
      return await serverAction(prev, fd);
    } catch (e) {
      if (isNetworkError(e)) return { error: OFFLINE_MSG };
      throw e;
    }
  }, {});
  const draftKey = isTemplate
    ? `sablon:${props.initial?.id ?? "yeni"}`
    : props.initial
      ? `recete:${props.initial.id}`
      : `recete:yeni:${props.fieldId}`;
  const [restoredAt, setRestoredAt] = useState<number | null>(null);

  // Reçeteye özel alanlar
  const recipeInit = !isTemplate ? (props.initial as Recipe | undefined) : undefined;
  const [date, setDate] = useState(!isTemplate ? (recipeInit?.recipe_date ?? props.today) : "");
  const [area, setArea] = useState(!isTemplate ? numStr(recipeInit ? recipeInit.area_donum : props.fieldArea) : "");
  // Şablona özel
  const [name, setName] = useState(isTemplate ? (props.initial?.name ?? "") : "");

  const [water, setWater] = useState(numStr(props.initial?.water_per_donum ?? DEFAULT_WATER_PER_DONUM));
  const waterEff = waterOrDefault(parseAmount(water) || null);
  // Yapraktan ürün miktarları bu varile göre girilir (boşsa dönüme göre)
  const [barrel, setBarrel] = useState(numStr(props.initial?.barrel_liters));
  const barrelNum = parseAmount(barrel) || null;
  const doseL = doseWater(waterEff, barrelNum);
  const [note, setNote] = useState(props.initial?.note ?? "");
  const [weeks, setWeeks] = useState<Week[]>(() => weeksFrom(initialItems));
  const [usedTemplate, setUsedTemplate] = useState("");

  // Açılışta kaydedilmemiş taslak varsa geri yükle
  const ready = useRef(false);
  useEffect(() => {
    const d = loadDraft<DraftData>(draftKey);
    if (d) {
      setDate(d.data.date || date);
      setArea(d.data.area ?? "");
      setWater(d.data.water ?? "");
      setBarrel(d.data.barrel ?? "");
      setNote(d.data.note ?? "");
      setName(d.data.name ?? "");
      let ws = d.data.weeks;
      // Ara sulama öncesi kaydedilmiş taslak (3 hafta): araları boş ekle
      if (ws.length === 3) ws = [ws[0], { sulama: [], yapraktan: [] }, ws[1], { sulama: [], yapraktan: [] }, ws[2]];
      setWeeks(ws.map((wk) => ({
        sulama: wk.sulama.map((r) => ({ ...r, key: nextKey++ })),
        yapraktan: wk.yapraktan.map((r) => ({ ...r, key: nextKey++ })),
      })));
      setRestoredAt(d.savedAt);
    }
    ready.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const update = (w: number, m: Method, fn: (rows: Row[]) => Row[]) =>
    setWeeks((ws) => ws.map((wk, i) => (i === w ? { ...wk, [m]: fn(wk[m]) } : wk)));
  const setRow = (w: number, m: Method, key: number, patch: Partial<Row>) =>
    update(w, m, (rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  /** Ürün değişince: listedeki ürünse birimi uygun hale getir (Lt ürün → L, Kg ürün → kg) */
  const setProduct = (w: number, m: Method, r: Row, product: string) => {
    const p = findProduct(product);
    const unit = p && !sameDimension(p.unit, r.unit) ? p.unit : r.unit;
    setRow(w, m, r.key, { product, unit });
  };
  const addRow = (w: number, m: Method) =>
    update(w, m, (rows) => [...rows, emptyRow(rows.at(-1)?.unit ?? (m === "yapraktan" ? "ml" : "L"))]);
  const removeRow = (w: number, m: Method, key: number) => update(w, m, (rows) => rows.filter((r) => r.key !== key));
  /** Önceki haftayı (ara sulamayı atlayarak) bu haftaya kopyalar */
  const prevWeekIndex = (w: number) => (SLOTS as readonly number[]).indexOf(SLOTS[w] - 1);
  const copyPrev = (w: number) =>
    setWeeks((ws) => {
      const src = ws[prevWeekIndex(w)];
      return ws.map((wk, i) =>
        i === w
          ? {
              sulama: src.sulama.map((r) => ({ ...r, key: nextKey++ })),
              yapraktan: src.yapraktan.map((r) => ({ ...r, key: nextKey++ })),
            }
          : wk
      );
    });
  const isOpen = (wk: Week) => wk.sulama.length + wk.yapraktan.length > 0;
  const openBetween = (w: number) => update(w, "sulama", () => [emptyRow()]);
  const closeBetween = (w: number) => {
    const wk = weeks[w];
    const filled = [...wk.sulama, ...wk.yapraktan].some((r) => r.product.trim());
    if (filled && !confirm("Ara sulamadaki ürünler silinsin mi?")) return;
    setWeeks((ws) => ws.map((x, i) => (i === w ? { sulama: [], yapraktan: [] } : x)));
  };

  const items = useMemo(
    () =>
      weeks.flatMap((wk, i) =>
        METHODS.flatMap((m) =>
          wk[m]
            .filter((r) => r.product.trim())
            .map((r) => ({
              week: SLOTS[i],
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

  /** Şablondaki ürünleri forma doldurur */
  const applyTemplate = (idStr: string) => {
    if (isTemplate || !props.templates) return;
    const t = props.templates.find((x) => String(x.id) === idStr);
    if (!t) return;
    if (items.length > 0 && !confirm(`Girilen ürünler silinip "${t.name}" şablonu yüklensin mi?`)) return;
    setWeeks(weeksFrom(t.items));
    if (t.water_per_donum) setWater(numStr(t.water_per_donum));
    setBarrel(numStr(t.barrel_liters));
    setNote(t.note ?? "");
    setUsedTemplate(t.name);
  };

  const hasFoliarRows = weeks.some((wk) => wk.yapraktan.length > 0);
  const hasFoliar = items.some((it) => it.method === "yapraktan");
  const basis = totalsBasis(parseAmount(area) || null, parseAmount(water) || null, barrelNum, hasFoliar);
  const totals = useMemo(() => computeTotals(items, basis.factor), [items, basis.factor]);

  const payload = JSON.stringify(
    isTemplate
      ? { id: props.initial?.id, name, note, water_per_donum: hasFoliar ? waterEff : null, barrel_liters: hasFoliar ? barrelNum : null, items }
      : {
          id: recipeInit?.id,
          field_id: props.fieldId,
          recipe_date: date,
          area_donum: parseAmount(area) || null,
          water_per_donum: hasFoliar ? waterEff : null,
          barrel_liters: hasFoliar ? barrelNum : null,
          note,
          items,
        }
  );

  // Her değişiklikte taslağı telefonda sakla
  const firstSave = useRef(true);
  useEffect(() => {
    if (!ready.current) return;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    const t = setTimeout(() => saveDraft<DraftData>(draftKey, { date, area, water, barrel, note, name, weeks }), 400);
    return () => clearTimeout(t);
  }, [draftKey, date, area, water, barrel, note, name, weeks]);

  const templates = !isTemplate ? (props.templates ?? []) : [];
  const blocked = items.length === 0 || (isTemplate && !name.trim());

  return (
    <form action={formAction}>
      <input type="hidden" name="payload" value={payload} />
      {restoredAt && (
        <div className="alert alert-draft">
          📝 Kaydedilmemiş taslak geri yüklendi ({draftTime(restoredAt)}).{" "}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              if (!confirm("Taslak silinip boş forma dönülsün mü?")) return;
              clearDraft(draftKey);
              location.reload();
            }}
          >
            Taslağı sil
          </button>
        </div>
      )}
      {state.error && <div className="alert alert-error">{state.error}</div>}

      {!isTemplate && !recipeInit && (
        <div className="panel tpl-pick">
          <label className="field" style={{ marginBottom: 0 }}>
            <span>📋 Şablondan başla</span>
            <select value="" onChange={(e) => applyTemplate(e.target.value)} disabled={templates.length === 0}>
              <option value="">
                {templates.length === 0
                  ? "Henüz şablon yok — Reçeteler bölümünden oluşturun"
                  : usedTemplate
                    ? `Yüklendi: ${usedTemplate} — başka şablon seç`
                    : "Şablon seçin (isteğe bağlı)"}
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {KIND_LABEL[recipeKind(t.items)]} · {t.items.length} ürün
                </option>
              ))}
            </select>
            {usedTemplate && <small>Şablon yüklendi; miktarları bu tarlaya göre düzenleyebilirsiniz.</small>}
          </label>
        </div>
      )}

      <div className="panel">
        {isTemplate ? (
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Şablon adı *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="örn. Muz – Kış sulama programı"
              autoCapitalize="sentences"
            />
          </label>
        ) : (
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
        )}
        {hasFoliarRows && (
          <label className="field" style={{ marginTop: 14, marginBottom: 0 }}>
            <span>🍃 Yapraktan: dönüme kaç litre su?</span>
            <input
              inputMode="decimal"
              value={water}
              onChange={(e) => setWater(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder={String(DEFAULT_WATER_PER_DONUM)}
            />
            <small>Boş bırakılırsa {DEFAULT_WATER_PER_DONUM} L kabul edilir.</small>
          </label>
        )}
        {hasFoliarRows && (
          <label className="field" style={{ marginTop: 14, marginBottom: 0 }}>
            <span>🍃 Yapraktan uygulanacak varilin litresi kaç?</span>
            <input
              inputMode="decimal"
              value={barrel}
              onChange={(e) => setBarrel(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="örn. 200"
            />
            <small>
              {barrelNum
                ? <>Yapraktan ürün miktarlarını <b>{formatAmount(barrelNum)} litrelik varile</b> göre girin.</>
                : <>Boş bırakılırsa yapraktan miktarları da dönüme ({formatAmount(waterEff)} L suya) göre girilir.</>}
              {barrelNum && !isTemplate && basis.waterLabel && (
                <> Bu tarlada her uygulamada {basis.waterLabel} su = <b>{basis.barrelLabel}</b>.</>
              )}
            </small>
          </label>
        )}
        <p className="basis-hint">
          Sulama miktarlarını <b>dönüme</b>, yapraktan miktarlarını <b>{formatAmount(doseL)} L suya</b> göre girin.
          Her haftada sulama ve yapraktan ürünleri ayrı ayrı ekleyebilirsiniz.
        </p>
      </div>

      {weeks.map((wk, w) => {
        const slot = SLOTS[w];
        const between = isBetween(slot);
        const [a, b] = betweenWeeks(slot);
        if (between && !isOpen(wk)) {
          return (
            <button type="button" key={w} className="btn btn-block between-add" onClick={() => openBetween(w)}>
              + Ara sulama ekle <span>({a}–{b}. hafta arası, isteğe bağlı)</span>
            </button>
          );
        }
        return (
        <div className={`panel${between ? " panel-between" : ""}`} key={w}>
          <div className="week-head">
            {between ? (
              <>
                <h2>
                  Ara sulama <span className="basis-tag">({a}–{b}. hafta arası)</span>
                </h2>
                <button type="button" className="btn btn-sm" onClick={() => closeBetween(w)}>
                  Kaldır
                </button>
              </>
            ) : (
              <>
                <h2>{slot}. Hafta</h2>
                {slot > 1 && (
                  <button type="button" className="btn btn-sm" onClick={() => copyPrev(w)}>
                    ⧉ {slot - 1}. haftayı kopyala
                  </button>
                )}
              </>
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
                  <ProductInput
                    className="rx-product"
                    value={r.product}
                    onChange={(v) => setProduct(w, m, r, v)}
                    extra={props.products}
                  />
                  <input
                    className="rx-amount"
                    inputMode="decimal"
                    placeholder={m === "sulama" ? "Miktar/dönüm" : "Miktar"}
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
                </div>
              ))}
              <button type="button" className="btn btn-sm rx-add" onClick={() => addRow(w, m)}>
                + {METHOD_LABEL[m]} ürünü ekle
              </button>
            </div>
          ))}
        </div>
        );
      })}

      <div className="panel">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Genel açıklama (isteğe bağlı, PDF'te görünür)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </label>
      </div>

      {!isTemplate && (
        <div className="panel totals">
          <h2>Toplam ihtiyaç · {basis.areaLabel}</h2>
          <p className="totals-hint">
            PDF'in en altında da yer alır.
            {basis.waterLabel && (
              <> Yapraktan uygulamada her seferinde <b>{basis.waterLabel} su</b>{basis.barrelLabel && <> ({basis.barrelLabel})</>}.</>
            )}
          </p>
          {basis.warning && <p className="alert alert-error" style={{ margin: "0 0 10px" }}>{basis.warning}</p>}
          {totals.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>Ürün girdikçe burada toplanır.</p>
          ) : (
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
          )}
        </div>
      )}

      {state.error && <div className="alert alert-error">{state.error}</div>}
      <button type="submit" className="btn btn-primary btn-block" disabled={pending || blocked}>
        {pending
          ? "Kaydediliyor…"
          : items.length === 0
            ? "En az bir ürün girin"
            : isTemplate && !name.trim()
              ? "Şablona bir ad verin"
              : isTemplate
                ? "Şablonu Kaydet"
                : "Reçeteyi Kaydet"}
      </button>
    </form>
  );
}
