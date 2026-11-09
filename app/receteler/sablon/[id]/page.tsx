import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate, productOptions } from "@/lib/db";
import { RecipeForm } from "@/components/RecipeForm";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const t = Number.isInteger(id) ? await getTemplate(id) : null;
  if (!t) notFound();
  return (
    <div className="narrow">
      <Link href="/receteler" className="back">← Reçeteler</Link>
      <h1 className="page-title">Şablonu Düzenle</h1>
      <RecipeForm mode="template" products={await productOptions()} initial={t} />
    </div>
  );
}
