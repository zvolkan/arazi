"use client";

import { useOptimistic, useTransition } from "react";
import { toggleStar } from "@/app/actions";

/** Çiftçiyi öncelikli (yıldızlı) yapar / kaldırır. */
export function StarButton({
  fieldId,
  starred,
  size = "md",
}: {
  fieldId: number;
  starred: boolean;
  size?: "md" | "lg";
}) {
  const [, start] = useTransition();
  const [on, setOn] = useOptimistic(starred);
  return (
    <button
      type="button"
      className={`star${on ? " on" : ""}${size === "lg" ? " star-lg" : ""}`}
      aria-pressed={on}
      aria-label={on ? "Öncelikten çıkar" : "Öncelikli yap"}
      title={on ? "Öncelikten çıkar" : "Öncelikli yap"}
      onClick={(e) => {
        e.preventDefault();
        start(async () => {
          setOn(!on);
          try {
            await toggleStar(fieldId);
          } catch {
            alert("İnternet bağlantısı yok. Bağlantı gelince tekrar deneyin.");
          }
        });
      }}
    >
      {on ? "★" : "☆"}
    </button>
  );
}
