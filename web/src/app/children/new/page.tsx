import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewChildForm from "./NewChildForm";

export const dynamic = "force-dynamic";

export default async function NewChild({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: curricula } = await supabase
    .from("curricula")
    .select("id, code, name, grade_noun, grade_offset")
    .order("name");

  return <NewChildForm curricula={curricula ?? []} hasError={!!error} />;
}
