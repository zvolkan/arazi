"use client";

import { useActionState } from "react";
import { addVisit } from "@/app/actions";

export function VisitForm({ fieldId, today }: { fieldId: number; today: string }) {
  const [state, formAction, pending] = useActionState(addVisit, {});
  return (
    <form action={formAction}>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <input type="hidden" name="field_id" value={fieldId} />
      <label className="field">
        <span>Ziyaret tarihi</span>
        <input type="date" name="visit_date" defaultValue={today} max={today} required />
      </label>
      <label className="field">
        <span>Not</span>
        <textarea name="note" rows={3} placeholder="Ne görüldü, ne önerildi…" />
      </label>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Ziyareti Kaydet"}
      </button>
    </form>
  );
}
