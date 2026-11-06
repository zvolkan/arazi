import Link from "next/link";
import { notFound } from "next/navigation";
import { getField, getRecipe, productOptions } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { recipeNo } from "@/lib/recipe";
import { RecipeForm } from "@/components/RecipeForm";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const recipe = Number.isInteger(id) ? await getRecipe(id) : null;
  if (!recipe) notFound();
  const field = await getField(recipe.field_id);
  return (
    <div className="narrow">
      <Link href={`/recete/${recipe.id}`} className="back">← Geri</Link>
      <h1 className="page-title">Reçete No {recipeNo(recipe.id)} — Düzenle</h1>
      {field && <p className="subtle">{field.full_name}{field.crop ? ` · ${field.crop}` : ""}</p>}
      <RecipeForm fieldId={recipe.field_id} fieldArea={field?.area_donum ?? null} today={todayISO()} products={await productOptions()} initial={recipe} />
    </div>
  );
}
