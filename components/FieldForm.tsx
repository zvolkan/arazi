"use client";

import { useActionState, useMemo, useState } from "react";
import type { FormState } from "@/app/actions";
import type { FarmerOption } from "@/lib/db";
import { formatPhone, phoneKey, trLower } from "@/lib/format";

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  crops: string[];
  regions: string[];
  initial?: {
    id: number;
    full_name: string;
    phone: string;
    address: string;
    region: string;
    crop: string;
    area_donum: number | null;
  };
  sharedFarmerNote?: boolean;
  submitLabel: string;
  /** Yeni kayıtta isim yazarken önerilecek kayıtlı çiftçiler */
  farmers?: FarmerOption[];
  /** "+ Bu çiftçiye tarla ekle" ile gelindiyse seçili çiftçi */
  presetFarmerId?: number;
};

export function FieldForm({
  action,
  crops,
  regions,
  initial,
  sharedFarmerNote,
  submitLabel,
  farmers = [],
  presetFarmerId,
}: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [selected, setSelected] = useState<FarmerOption | null>(
    () => farmers.find((f) => f.id === presetFarmerId) ?? null
  );
  const [name, setName] = useState(initial?.full_name ?? selected?.full_name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? selected?.phone ?? "");
  const [nameFocus, setNameFocus] = useState(false);

  // İsim yazarken benzer kayıtlı çiftçiler (engellemez, sadece gösterir)
  const suggestions = useMemo(() => {
    if (initial || selected) return [];
    const q = trLower(name.trim());
    if (q.length < 2) return [];
    return farmers.filter((f) => trLower(f.full_name).includes(q)).slice(0, 5);
  }, [farmers, name, initial, selected]);

  // Numara başka bir çiftçiye kayıtlıysa bilgi ver (tarla o çiftçiye eklenir)
  const phoneOwner = useMemo(() => {
    if (initial || selected) return null;
    const k = phoneKey(phone);
    return k.length >= 7 ? (farmers.find((f) => phoneKey(f.phone) === k) ?? null) : null;
  }, [farmers, phone, initial, selected]);

  return (
    <form action={formAction} className="panel">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <h2>Çiftçi</h2>
      {selected && <input type="hidden" name="farmer_id" value={selected.id} />}
      {selected && (
        <div className="farmer-chosen">
          <div>
            <b>{selected.full_name}</b> · {selected.phone ? formatPhone(selected.phone) : "telefon yok"} ·{" "}
            {selected.field_count} tarla
            <div className="note">Bu çiftçiye yeni tarla eklenecek.</div>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setSelected(null);
              setName("");
              setPhone("");
            }}
          >
            Farklı kişi
          </button>
        </div>
      )}
      <div className="row2" style={selected ? { display: "none" } : undefined}>
        <label className="field" style={{ position: "relative" }}>
          <span>Adı Soyadı *</span>
          <input
            name="full_name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setNameFocus(true)}
            onBlur={() => setTimeout(() => setNameFocus(false), 150)}
            autoComplete="off"
            autoCapitalize="words"
          />
          {nameFocus && suggestions.length > 0 && (
            <ul className="pi-list farmer-sug">
              <li className="farmer-sug-head">Kayıtlı çiftçiler — aynı kişiyse seçin, değilse yazmaya devam edin</li>
              {suggestions.map((f) => (
                <li
                  key={f.id}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setSelected(f);
                    setName(f.full_name);
                    setPhone(f.phone);
                  }}
                >
                  <b>{f.full_name}</b>
                  <span className="note">
                    {f.phone ? formatPhone(f.phone) : "telefon yok"} · {f.field_count} tarla
                  </span>
                </li>
              ))}
            </ul>
          )}
        </label>
        <label className="field">
          <span>Telefon</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="05xx xxx xx xx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="off"
          />
          {phoneOwner ? (
            <small className="warn-text">
              Bu numara <b>{phoneOwner.full_name}</b> adına kayıtlı; tarla ona eklenecek.
            </small>
          ) : (
            !initial && <small>Bu numara kayıtlıysa tarla aynı çiftçiye eklenir.</small>
          )}
          {sharedFarmerNote && <small>Çiftçinin başka tarlaları da var; isim/telefon değişikliği hepsine yansır.</small>}
        </label>
      </div>

      <h2 style={{ marginTop: 4 }}>Tarla</h2>
      <label className="field">
        <span>Bölge</span>
        <input name="region" list="bolgeler" defaultValue={initial?.region} placeholder="İskele, Ören, Bozdoğan…" autoComplete="off" autoCapitalize="words" />
        <datalist id="bolgeler">
          {regions.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <small>Listede bölgeye göre süzmek için. Listeden seçin ya da yazın.</small>
      </label>
      <label className="field">
        <span>Tarla adresi</span>
        <textarea name="address" rows={2} defaultValue={initial?.address} placeholder="Mevki, tarif…" />
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
