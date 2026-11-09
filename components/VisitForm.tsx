"use client";

import { useActionState, useRef, useState } from "react";
import { addVisit } from "@/app/actions";
import { uploadPhoto } from "@/lib/upload";

type Photo = { key: number; preview: string; id?: number; error?: string };
let k = 1;
const MAX_PHOTOS = 10;

export function VisitForm({ fieldId, today }: { fieldId: number; today: string }) {
  const [state, formAction, pending] = useActionState(addVisit, {});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploading = photos.some((p) => !p.id && !p.error);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    for (const file of list) {
      const key = k++;
      const preview = URL.createObjectURL(file);
      setPhotos((ps) => [...ps, { key, preview }]);
      try {
        const id = await uploadPhoto(file);
        setPhotos((ps) => ps.map((p) => (p.key === key ? { ...p, id } : p)));
      } catch (e) {
        setPhotos((ps) => ps.map((p) => (p.key === key ? { ...p, error: (e as Error).message } : p)));
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const ids = photos.filter((p) => p.id).map((p) => p.id);

  return (
    <form action={formAction}>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <input type="hidden" name="field_id" value={fieldId} />
      <input type="hidden" name="photo_ids" value={JSON.stringify(ids)} />
      <label className="field">
        <span>Ziyaret tarihi</span>
        <input type="date" name="visit_date" defaultValue={today} max={today} required />
      </label>
      <label className="field">
        <span>Not</span>
        <textarea name="note" rows={3} placeholder="Ne görüldü, ne önerildi…" />
      </label>

      <div className="field">
        <span>Fotoğraflar</span>
        {photos.length > 0 && (
          <div className="photo-grid">
            {photos.map((p) => (
              <div key={p.key} className={`photo-cell${p.error ? " photo-err" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" />
                {!p.id && !p.error && <span className="photo-badge">Yükleniyor…</span>}
                {p.error && <span className="photo-badge">{p.error}</span>}
                <button
                  type="button"
                  className="photo-x"
                  aria-label="Fotoğrafı çıkar"
                  onClick={() => setPhotos((ps) => ps.filter((x) => x.key !== p.key))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {photos.length < MAX_PHOTOS && (
          <label className="btn btn-sm photo-add">
            📷 Fotoğraf ekle
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
        )}
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={pending || uploading}>
        {pending ? "Kaydediliyor…" : uploading ? "Fotoğraflar yükleniyor…" : "Ziyareti Kaydet"}
      </button>
    </form>
  );
}
