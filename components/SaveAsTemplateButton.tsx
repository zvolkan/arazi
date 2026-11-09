"use client";

import { useState, useTransition } from "react";
import { saveRecipeAsTemplate } from "@/app/actions";

/** Reçeteyi isim sorarak şablon olarak kaydeder */
export function SaveAsTemplateButton({ recipeId, suggestion }: { recipeId: number; suggestion: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <>
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={() => {
          const name = prompt("Şablon adı:", suggestion);
          if (!name || !name.trim()) return;
          start(async () => {
            const res = await saveRecipeAsTemplate(recipeId, name);
            setMsg(res.error ? res.error : `"${name.trim()}" şablonu kaydedildi.`);
          });
        }}
      >
        {pending ? "Kaydediliyor…" : "📋 Şablon olarak kaydet"}
      </button>
      {msg && <p className="share-hint" style={{ flexBasis: "100%" }}>{msg}</p>}
    </>
  );
}
