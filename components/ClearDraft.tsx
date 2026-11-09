"use client";

import { useEffect } from "react";
import { clearDraft } from "@/lib/draft";

/** Kayıt başarılı olunca ilgili taslakları siler */
export function ClearDraft({ keys }: { keys: string[] }) {
  useEffect(() => {
    keys.forEach(clearDraft);
  }, [keys]);
  return null;
}
