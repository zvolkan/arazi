"use client";

import { useMemo, useState } from "react";
import { findProduct, searchProducts } from "@/lib/catalog";

/**
 * Ürün yazma alanı: yazılan harfleri içeren ürünleri listeler ("clo" → "Bayokim Cloud 7-7-7 +ME").
 * iPhone'da datalist güvenilir olmadığı için kendi listemizi gösteriyoruz.
 */
export function ProductInput({
  value,
  onChange,
  extra,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Listede olmayan ama daha önce yazılmış ürünler */
  extra: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => (open ? searchProducts(value, extra) : []), [open, value, extra]);
  const exact = matches.length === 1 && matches[0].toLocaleLowerCase("tr-TR") === value.trim().toLocaleLowerCase("tr-TR");
  const show = open && matches.length > 0 && !exact;
  const known = !!findProduct(value);

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <div className={`pi ${className ?? ""}`}>
      <input
        placeholder="Ürün (yazınca listeden seçin)"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); pick(matches[active]); }
          if (e.key === "Escape") setOpen(false);
        }}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={known ? "pi-known" : undefined}
      />
      {show && (
        <ul className="pi-list" role="listbox">
          {matches.map((m, i) => (
            <li
              key={m}
              role="option"
              aria-selected={i === active}
              className={i === active ? "on" : undefined}
              // blur'dan önce çalışsın diye mousedown/pointerdown
              onPointerDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
