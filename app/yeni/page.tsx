import Link from "next/link";
import { FieldForm } from "@/components/FieldForm";
import { createField } from "@/app/actions";
import { cropOptions } from "@/lib/crops";
import { listFarmers, listRegions } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewFieldPage({ searchParams }: { searchParams: Promise<{ ciftci?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="narrow">
      <Link href="/" className="back">← Listeye dön</Link>
      <h1 className="page-title">Yeni Kayıt</h1>
      <FieldForm
        action={createField}
        crops={await cropOptions()}
        regions={await listRegions()}
        farmers={await listFarmers()}
        presetFarmerId={Number(sp.ciftci) || undefined}
        submitLabel="Kaydet"
      />
    </div>
  );
}
