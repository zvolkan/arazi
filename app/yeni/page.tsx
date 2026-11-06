import Link from "next/link";
import { FieldForm } from "@/components/FieldForm";
import { createField } from "@/app/actions";
import { cropOptions } from "@/lib/crops";

export const dynamic = "force-dynamic";

export default async function NewFieldPage() {
  return (
    <div className="narrow">
      <Link href="/" className="back">← Listeye dön</Link>
      <h1 className="page-title">Yeni Kayıt</h1>
      <FieldForm action={createField} crops={await cropOptions()} submitLabel="Kaydet" />
    </div>
  );
}
