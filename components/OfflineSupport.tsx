"use client";

import { useEffect, useState } from "react";

/** Service worker kaydı + internet yok bandı */
export function OfflineSupport() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const update = () => {
      setOnline(navigator.onLine);
      // Alttaki bant butonları örtmesin diye sayfa altına boşluk
      document.body.classList.toggle("is-offline", !navigator.onLine);
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;
  return (
    <div className="offline-bar" role="status">
      📴 İnternet yok — son kaydedilen hali gösteriliyor. Yazdıklarınız telefonda saklanır, bağlantı gelince kaydedin.
    </div>
  );
}

/** Ana sayfa açılınca tarla ve reçete ekranlarını internetsiz kullanım için hazırlar (6 saatte bir) */
export function WarmOffline({ fieldIds }: { fieldIds: number[] }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !navigator.onLine) return;
    const KEY = "cevrimdisi-hazir";
    try {
      const last = Number(localStorage.getItem(KEY) || 0);
      if (Date.now() - last < 6 * 3600_000) return;
    } catch {}
    navigator.serviceWorker.ready.then((reg) => {
      const urls = ["/", "/receteler", "/yeni", ...fieldIds.flatMap((id) => [`/tarla/${id}`, `/tarla/${id}/recete/yeni`])];
      reg.active?.postMessage({ type: "hazirla", urls });
      try {
        localStorage.setItem(KEY, String(Date.now()));
      } catch {}
    });
  }, [fieldIds]);
  return null;
}
