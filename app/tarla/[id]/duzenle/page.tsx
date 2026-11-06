import Link from "next/link";
import { notFound } from "next/navigation";
import { FieldForm } from "@/components/FieldForm";
import { updateField } from "@/app/actions";
import { getField, otherFieldsOfFarmer } from "@/lib/db";
import { cropOptions } from "@/lib/crops";

export const dynamic = "force-dynamic";

export default async function EditFieldPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const field = Number.isInteger(id) ? await getField(id) : null;
  if (!field) notFound();
  const others = await otherFieldsOfFarmer(field.farmer_id, field.id);

  return (
    <div className="narrow">
      <Link href={`/tarla/${field.id}`} className="back">← Geri</Link>
      <h1 className="page-title">Kaydı Düzenle</h1>
      <FieldForm
        action={updateField}
        crops={await cropOptions()}
        initial={field}
        sharedFarmerNote={others.length > 0}
        submitLabel="Değişiklikleri Kaydet"
      />
    </div>
  );
}
