import Link from "next/link";
import { notFound } from "next/navigation";
import { getField, productOptions } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { RecipeForm } from "@/components/RecipeForm";

export const dynamic = "force-dynamic";

export default async function NewRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const field = Number.isInteger(id) ? await getField(id) : null;
  if (!field) notFound();
  return (
    <div className="narrow">
      <Link href={`/tarla/${field.id}`} className="back">← {field.full_name}</Link>
      <h1 className="page-title">Yeni Reçete</h1>
      <p className="subtle">{field.full_name}{field.crop ? ` · ${field.crop}` : ""}{field.address ? ` · ${field.address}` : ""}</p>
      <RecipeForm fieldId={field.id} today={todayISO()} products={await productOptions()} />
    </div>
  );
}
