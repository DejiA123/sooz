/** Admin sign-up counter: every member has a profile, made when they join (profiles.created_at). */
import { supabase } from "@/integrations/supabase/client";

export interface Member { id: string; username: string; display_name: string | null; avatar_url: string | null; created_at: string }

export async function fetchSignups(): Promise<{ total: number; recent: Member[] }> {
  const since = new Date(Date.now() - 91 * 86_400_000).toISOString();
  const [all, recent] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id, username, display_name, avatar_url, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(10000),
  ]);
  if (all.error) throw all.error;
  if (recent.error) throw recent.error;
  return { total: all.count ?? 0, recent: (recent.data ?? []) as Member[] };
}

/** How many joined since local midnight (the admin menu's badge). */
export async function signupsToday(): Promise<number> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString());
  return count ?? 0;
}
