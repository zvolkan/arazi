"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  crops: string[];
  initial?: { id: number; full_name: string; phone: string; address: string; crop: string; area_donum: number | null };
  sharedFarmerNote?: boolean;
  submitLabel: string;
};

export function FieldForm({ action, crops, initial, sharedFarmerNote, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="panel">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <h2>Çiftçi</h2>
      <div className="row2">
        <label className="field">
          <span>Adı Soyadı *</span>
          <input name="full_name" required defaultValue={initial?.full_name} autoComplete="off" autoCapitalize="words" />
        </label>
        <label className="field">
          <span>Telefon</span>
          <input name="phone" type="tel" inputMode="tel" placeholder="05xx xxx xx xx" defaultValue={initial?.phone} autoComplete="off" />
          {!initial && <small>Bu numara kayıtlıysa tarla aynı çiftçiye eklenir.</small>}
          {sharedFarmerNote && <small>Çiftçinin başka tarlaları da var; isim/telefon değişikliği hepsine yansır.</small>}
        </label>
      </div>

      <h2 style={{ marginTop: 4 }}>Tarla</h2>
      <label className="field">
        <span>Tarla adresi</span>
        <textarea name="address" rows={2} defaultValue={initial?.address} placeholder="Köy / mahalle, mevki, tarif…" />
      </label>
      <div className="row2">
      <label className="field">
        <span>Ne tarlası?</span>
        <input name="crop" list="urunler" defaultValue={initial?.crop} placeholder="Muz, çilek, avokado…" autoComplete="off" />
        <datalist id="urunler">
          {crops.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <small>Listeden seçin ya da yazın.</small>
      </label>
      <label className="field">
        <span>Kaç dönüm?</span>
        <input
          name="area_donum"
          inputMode="decimal"
          placeholder="örn. 4"
          defaultValue={initial?.area_donum != null ? String(initial.area_donum).replace(".", ",") : ""}
          autoComplete="off"
        />
        <small>Reçete toplamları bununla çarpılır.</small>
      </label>
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Kaydediliyor…" : submitLabel}
      </button>
    </form>
  );
}
