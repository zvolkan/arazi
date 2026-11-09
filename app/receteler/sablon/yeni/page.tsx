import Link from "next/link";
import { productOptions } from "@/lib/db";
import { RecipeForm } from "@/components/RecipeForm";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  return (
    <div className="narrow">
      <Link href="/receteler" className="back">← Reçeteler</Link>
      <h1 className="page-title">Yeni Şablon</h1>
      <RecipeForm mode="template" products={await productOptions()} />
    </div>
  );
}
