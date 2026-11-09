"use client";

import { useEffect, useState } from "react";

/**
 * PDF'i önceden indirir; dokununca iPhone paylaşım menüsünü açar (WhatsApp seçilir).
 * Paylaşım desteklenmiyorsa PDF yeni sekmede açılır.
 */
export function SharePdfButton({ url, fileName }: { url: string; fileName: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => alive && setFile(new File([b], fileName, { type: "application/pdf" })))
      .catch(() =>
        alive &&
        setMsg(
          navigator.onLine
            ? "PDF hazırlanamadı, sayfayı yenileyin."
            : "İnternet yok. Bağlantı gelince sayfayı yenileyip gönderin."
        )
      );
    return () => {
      alive = false;
    };
  }, [url, fileName]);

  async function share() {
    setMsg("");
    if (file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setMsg("Paylaşılamadı. PDF'i açıp oradan paylaşabilirsiniz.");
      }
      return;
    }
    window.open(url, "_blank");
  }

  return (
    <div>
      <button type="button" className="btn btn-whatsapp btn-block" onClick={share} disabled={!file && !msg}>
        {file || msg ? "WhatsApp'tan Gönder" : "PDF hazırlanıyor…"}
      </button>
      <p className="share-hint">
        {msg || "Açılan menüden WhatsApp'ı, sonra çiftçiyi seçin."}
      </p>
    </div>
  );
}
