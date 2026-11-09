"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePhoto } from "@/app/actions";
import { uploadPhoto } from "@/lib/upload";

/** Kayıtlı bir ziyaretin fotoğrafları: büyütme, silme, sonradan ekleme (kamera veya galeri) */
export function VisitPhotos({ visitId, fieldId, photoIds }: { visitId: number; fieldId: number; photoIds: number[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState<number[]>([]);
  const [, start] = useTransition();
  const ids = photoIds.filter((id) => !removed.includes(id));

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const list = Array.from(files).slice(0, 10);
    setUploading(list.length);
    let failed = 0;
    for (const f of list) {
      try {
        await uploadPhoto(f, visitId);
      } catch {
        failed++;
      }
      setUploading((n) => n - 1);
    }
    if (failed) setError(`${failed} fotoğraf yüklenemedi, tekrar deneyin.`);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="visit-photos">
      {(ids.length > 0 || uploading > 0) && (
        <div className="photo-grid photo-grid-sm">
          {ids.map((pid) => (
            <div key={pid} className="photo-cell">
              <a href={`/api/foto/${pid}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/foto/${pid}?k=kucuk`} alt="Ziyaret fotoğrafı" loading="lazy" />
              </a>
              <button
                type="button"
                className="photo-x"
                aria-label="Fotoğrafı sil"
                onClick={() => {
                  if (!confirm("Bu fotoğraf silinsin mi?")) return;
                  setRemoved((r) => [...r, pid]);
                  start(async () => {
                    try {
                      await deletePhoto(pid, fieldId);
                    } catch {
                      setRemoved((r) => r.filter((x) => x !== pid));
                      alert("İnternet bağlantısı yok. Bağlantı gelince tekrar deneyin.");
                    }
                  });
                }}
              >
                ×
              </button>
            </div>
          ))}
          {Array.from({ length: uploading }).map((_, i) => (
            <div key={`u${i}`} className="photo-cell photo-loading">
              <span className="photo-badge">Yükleniyor…</span>
            </div>
          ))}
        </div>
      )}
      <label className="photo-link">
        📷 Fotoğraf ekle
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
      </label>
      {error && <div className="note" style={{ color: "var(--danger)" }}>{error}</div>}
    </div>
  );
}
