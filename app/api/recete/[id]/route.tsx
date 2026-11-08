import { renderToBuffer } from "@react-pdf/renderer";
import { getField, getRecipe } from "@/lib/db";
import { formatDate, formatPhone } from "@/lib/format";
import { recipeNo } from "@/lib/recipe";
import { RecetePdf } from "@/lib/pdf/recete";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const recipe = Number.isInteger(id) ? await getRecipe(id) : null;
  const field = recipe ? await getField(recipe.field_id) : null;
  if (!recipe || !field) return new Response("Reçete bulunamadı", { status: 404 });

  const no = recipeNo(recipe.id);
  const buf = await renderToBuffer(
    <RecetePdf
      d={{
        no,
        date: formatDate(recipe.recipe_date),
        farmerName: field.full_name,
        phone: field.phone ? formatPhone(field.phone) : "",
        address: [field.region, field.address].filter(Boolean).join(" · "),
        crop: field.crop,
        recipe,
      }}
    />
  );
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Recete-${no}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
