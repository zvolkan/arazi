"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { FieldRow } from "@/lib/db";
import {
  REVISIT_DAYS,
  fieldStatus,
  formatDate,
  formatPhone,
  telHref,
  trLower,
  type Status,
} from "@/lib/format";
import { markVisitedToday } from "@/app/actions";

const formatArea = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

type Row = FieldRow & { status: Status; days: number | null };

const SECTIONS: { status: Status; title: string; alert: boolean }[] = [
  { status: "gidilmedi", title: "Hiç gidilmeyenler", alert: true },
  { status: "tekrar", title: "3 haftayı geçenler", alert: true },
  { status: "gidildi", title: "Gidilen ve süresi gelmeyenler", alert: false },
];

export function FieldList({ fields, today }: { fields: FieldRow[]; today: string }) {
  const [crop, setCrop] = useState("");
  const [q, setQ] = useState("");

  const crops = useMemo(
    () =>
      Array.from(new Set(fields.map((f) => f.crop).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "tr")
      ),
    [fields]
  );

  const groups = useMemo(() => {
    const needle = trLower(q.trim());
    const needleDigits = q.replace(/\D/g, "");
    const g: Record<Status, Row[]> = { gidilmedi: [], tekrar: [], gidildi: [] };
    for (const f of fields) {
      if (crop && f.crop !== crop) continue;
      if (needle) {
        const textHit = trLower(`${f.full_name} ${f.address} ${f.crop}`).includes(needle);
        const phoneHit = needleDigits.length >= 3 && f.phone.replace(/\D/g, "").includes(needleDigits);
        if (!textHit && !phoneHit) continue;
      }
      const row = { ...f, ...fieldStatus(f, today) };
      g[row.status].push(row);
    }
    const byName = (a: Row, b: Row) => a.full_name.localeCompare(b.full_name, "tr");
    g.gidilmedi.sort(byName);
    g.tekrar.sort((a, b) => (b.days ?? 0) - (a.days ?? 0)); // en uzun süredir gidilmeyen üstte
    g.gidildi.sort(byName);
    return g;
  }, [fields, today, crop, q]);

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

  const total = groups.gidilmedi.length + groups.tekrar.length + groups.gidildi.length;

  return (
    <>
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

      {total === 0 ? (
        <div className="empty">Aramaya uyan kayıt yok.</div>
      ) : (
        SECTIONS.map((s) => (
          <Section key={s.status} title={s.title} alert={s.alert} rows={groups[s.status]} today={today} />
        ))
      )}
    </>
  );
}

function Section({
  title,
  alert,
  rows,
  today,
}: {
  title: string;
  alert: boolean;
  rows: Row[];
  today: string;
}) {
  const hot = alert && rows.length > 0;
  return (
    <section className="section">
      <h2 className={`section-title${hot ? " section-title-alert" : ""}`}>
        {title}
        <span className="section-count">{rows.length}</span>
      </h2>

      {rows.length === 0 ? (
        <div className="section-empty">Bu bölümde kayıt yok.</div>
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
                  <th>Dönüm</th>
                  <th>Durum</th>
                  <th>Son ziyaret</th>
                  <th>Ziyaret</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id} className={alert ? "row-alert" : undefined}>
                    <td><Link className="name" href={`/tarla/${f.id}`}>{f.full_name}</Link></td>
                    <td>{f.phone ? <a className="phone" href={telHref(f.phone)}>{formatPhone(f.phone)}</a> : "—"}</td>
                    <td className="addr">{f.address || "—"}</td>
                    <td>{f.crop ? <span className="crop">{f.crop}</span> : "—"}</td>
                    <td>{f.area_donum ? formatArea(f.area_donum) : "—"}</td>
                    <td><StatusBadge f={f} today={today} /></td>
                    <td>{f.last_visit ? formatDate(f.last_visit) : "—"}</td>
                    <td>{f.visit_count}</td>
                    <td style={{ textAlign: "right" }}>
                      <VisitTodayButton id={f.id} status={f.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Telefon: kartlar */}
          <div className="cards">
            {rows.map((f) => (
              <div className={`card${alert ? " card-alert" : ""}`} key={f.id}>
                <div className="card-head">
                  <Link href={`/tarla/${f.id}`}>{f.full_name}</Link>
                  <StatusBadge f={f} today={today} />
                </div>
                <div className="meta">
                  {f.crop && <span className="crop" style={{ marginRight: 6 }}>{f.crop}</span>}
                  {f.area_donum ? <span className="crop" style={{ marginRight: 6 }}>{formatArea(f.area_donum)} dönüm</span> : null}
                  {f.address || "Adres girilmemiş"}
                </div>
                <div className="card-actions">
                  {f.phone && (
                    <a className="btn btn-sm" href={telHref(f.phone)}>📞 Ara</a>
                  )}
                  <VisitTodayButton id={f.id} status={f.status} />
                  <Link className="btn btn-sm" href={`/tarla/${f.id}`}>Detay</Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function StatusBadge({
  f,
  today,
}: {
  f: Pick<FieldRow, "visit_count" | "first_visit" | "last_visit">;
  today: string;
}) {
  const { status, days } = fieldStatus(f, today);
  if (status === "gidilmedi") return <span className="badge badge-alert">Gidilmedi</span>;
  if (status === "tekrar")
    return <span className="badge badge-alert">{days} gün oldu</span>;
  return <span className="badge badge-yes">Gidildi · {formatDate(f.last_visit)}</span>;
}

function VisitTodayButton({ id, status }: { id: number; status: Status }) {
  const [pending, start] = useTransition();
  if (status === "gidildi") return null;
  return (
    <button
      type="button"
      className="btn btn-sm btn-primary"
      disabled={pending}
      onClick={() => start(() => markVisitedToday(id))}
      title={`Bugünün tarihiyle ziyaret kaydeder. ${REVISIT_DAYS} gün sonra tekrar listenin üstüne çıkar.`}
    >
      {pending ? "Kaydediliyor…" : "✓ Bugün gidildi"}
    </button>
  );
}
