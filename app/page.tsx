import { listFields } from "@/lib/db";
import { FieldList } from "@/components/FieldList";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const fields = await listFields();
  return <FieldList fields={fields} today={todayISO()} />;
}
