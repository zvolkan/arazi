"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { FieldRow } from "@/lib/db";
import { formatDate, formatPhone, telHref, trLower } from "@/lib/format";
import { markVisitedToday } from "@/app/actions";

type Tab = "hepsi" | "gidilmeyen" | "gidilen";

export function FieldList({ fields }: { fields: FieldRow[] }) {
  const [tab, setTab] = useState<Tab>("hepsi");
  const [crop, setCrop] = useState("");
  const [q, setQ] = useState("");

  const crops = useMemo(
    () =>
      Array.from(new Set(fields.map((f) => f.crop).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "tr")
      ),
    [fields]
  );

  const counts = useMemo(() => {
    const visited = fields.filter((f) => f.visit_count > 0).length;
    return { all: fields.length, visited, notVisited: fields.length - visited };
  }, [fields]);

  const rows = useMemo(() => {
    const needle = trLower(q.trim());
    const needleDigits = q.replace(/\D/g, "");
    return fields
      .filter((f) => (tab === "gidilen" ? f.visit_count > 0 : tab === "gidilmeyen" ? f.visit_count === 0 : true))
      .filter((f) => !crop || f.crop === crop)
      .filter((f) => {
        if (!needle) return true;
        if (trLower(`${f.full_name} ${f.address} ${f.crop}`).includes(needle)) return true;
        return needleDigits.length >= 3 && f.phone.replace(/\D/g, "").includes(needleDigits);
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "tr"));
  }, [fields, tab, crop, q]);

  if (fields.length === 0) {
    return (
      <div className="empty">
        <p style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", margin: "0 0 6px" }}>
          Henüz kayıt yok
        </p>
        <p style={{ margin: "0 0 16px" }}>İlk çiftçiyi ve tarlasını ekleyerek başlayın.</p>
        <Link href="/yeni" className="btn btn-primary">+ Yeni Kayıt</Link>
      </div>
    );
  }

  return (
    <>
      <div className="stats">
        <StatButton label="Toplam tarla" value={counts.all} active={tab === "hepsi"} onClick={() => setTab("hepsi")} />
        <StatButton label="Gidilmeyen" value={counts.notVisited} active={tab === "gidilmeyen"} onClick={() => setTab("gidilmeyen")} />
        <StatButton label="Gidilen" value={counts.visited} active={tab === "gidilen"} onClick={() => setTab("gidilen")} />
      </div>

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Ara: isim, telefon, adres…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={crop} onChange={(e) => setCrop(e.target.value)} aria-label="Ürün">
          <option value="">Tüm ürünler</option>
          {crops.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <a href="/api/disa-aktar" className="btn hide-mobile">⬇ Excel'e Aktar</a>
      </div>

      {rows.length === 0 ? (
        <div className="empty">Bu filtreye uyan kayıt yok.</div>
      ) : (
        <>
          {/* Bilgisayar: tablo */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Çiftçi</th>
                  <th>Telefon</th>
                  <th>Tarla adresi</th>
                  <th>Ürün</th>
                  <th>Durum</th>
                  <th>Son ziyaret</th>
                  <th>Ziyaret</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id}>
                    <td><Link className="name" href={`/tarla/${f.id}`}>{f.full_name}</Link></td>
                    <td>{f.phone ? <a className="phone" href={telHref(f.phone)}>{formatPhone(f.phone)}</a> : "—"}</td>
                    <td className="addr">{f.address || "—"}</td>
                    <td>{f.crop ? <span className="crop">{f.crop}</span> : "—"}</td>
                    <td><StatusBadge f={f} /></td>
                    <td>{f.last_visit ? formatDate(f.last_visit) : "—"}</td>
                    <td>{f.visit_count}</td>
                    <td style={{ textAlign: "right" }}>
                      <VisitTodayButton f={f} small />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Telefon: kartlar */}
          <div className="cards">
            {rows.map((f) => (
              <div className="card" key={f.id}>
                <div className="card-head">
                  <Link href={`/tarla/${f.id}`}>{f.full_name}</Link>
                  <StatusBadge f={f} />
                </div>
                <div className="meta">
                  {f.crop && <span className="crop" style={{ marginRight: 6 }}>{f.crop}</span>}
                  {f.address || "Adres girilmemiş"}
                </div>
                <div className="card-actions">
                  {f.phone && (
                    <a className="btn btn-sm" href={telHref(f.phone)}>📞 Ara</a>
                  )}
                  <VisitTodayButton f={f} small />
                  <Link className="btn btn-sm" href={`/tarla/${f.id}`}>Detay</Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function StatButton(props: { label: string; value: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`stat${props.active ? " active" : ""}`} onClick={props.onClick}>
      <b>{props.value}</b>
      <span>{props.label}</span>
    </button>
  );
}

export function StatusBadge({ f }: { f: Pick<FieldRow, "visit_count" | "first_visit"> }) {
  if (f.visit_count === 0) return <span className="badge badge-no">Gidilmedi</span>;
  return <span className="badge badge-yes">Gidildi · {formatDate(f.first_visit)}</span>;
}

function VisitTodayButton({ f, small }: { f: FieldRow; small?: boolean }) {
  const [pending, start] = useTransition();
  const cls = `btn ${small ? "btn-sm" : ""}`;
  if (f.visit_count > 0) return null;
  return (
    <button
      type="button"
      className={`${cls} btn-primary`}
      disabled={pending}
      onClick={() => start(() => markVisitedToday(f.id))}
    >
      {pending ? "Kaydediliyor…" : "✓ Bugün gidildi"}
    </button>
  );
}
