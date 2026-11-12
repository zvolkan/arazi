"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RecipeListRow } from "@/lib/db";
import { formatDate, trLower } from "@/lib/format";
import { KIND_LABEL, recipeNo } from "@/lib/recipe";

/** Aranmadığında gösterilen son reçete sayısı */
const RECENT = 30;

/** Reçeteler bölümü: çiftçi adı veya telefonla reçete arama; arama yokken son yazılanlar */
export function RecipeSearch({ recipes }: { recipes: RecipeListRow[] }) {
  const [q, setQ] = useState("");
  const needle = trLower(q.trim());
  const digits = q.replace(/\D/g, "");

  const shown = useMemo(() => {
    if (!needle) return recipes.slice(0, RECENT);
    return recipes.filter(
      (r) =>
        trLower(r.full_name).includes(needle) ||
        (digits.length >= 3 && (r.phone ?? "").replace(/\D/g, "").includes(digits))
    );
  }, [recipes, needle, digits]);

  return (
    <div className="panel">
      <h2>{needle ? `🔎 Arama sonucu (${shown.length})` : "🧾 Son yazılan reçeteler"}</h2>
      <input
        className="search"
        type="search"
        placeholder="Çiftçi ara: isim veya telefon"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />
      {recipes.length === 0 ? (
        <p style={{ color: "var(--muted)", margin: 0 }}>Henüz reçete yazılmadı.</p>
      ) : shown.length === 0 ? (
        <p style={{ color: "var(--muted)", margin: 0 }}>Bu isimle reçete bulunamadı.</p>
      ) : (
        <ul className="visit-list">
          {shown.map((r) => (
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
      {!needle && recipes.length > RECENT && (
        <p className="totals-hint" style={{ margin: "10px 0 0" }}>
          Son {RECENT} reçete gösteriliyor; eskiler için isimle arayın.
        </p>
      )}
    </div>
  );
}
