import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "./support-db";

export type SavedView = {
  id: string;
  userId: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
};

export async function listSavedViews(userId: string): Promise<SavedView[]> {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data } = await sdb
    .from("user_preferences")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "support_saved_views")
    .maybeSingle();

  const row = data as { value: unknown } | null;
  if (!row?.value) return [];
  return (row.value as SavedView[]) ?? [];
}

export async function saveView(userId: string, name: string, filters: Record<string, unknown>) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const existing = await listSavedViews(userId);
  const newView: SavedView = {
    id: crypto.randomUUID(),
    userId,
    name,
    filters,
    createdAt: new Date().toISOString(),
  };
  existing.push(newView);

  await sdb.from("user_preferences").upsert({
    user_id: userId,
    key: "support_saved_views",
    value: existing,
  }, { onConflict: "user_id,key" });

  return newView;
}

export async function deleteView(userId: string, viewId: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const existing = await listSavedViews(userId);
  const filtered = existing.filter((v) => v.id !== viewId);

  await sdb.from("user_preferences").upsert({
    user_id: userId,
    key: "support_saved_views",
    value: filtered,
  }, { onConflict: "user_id,key" });
}
