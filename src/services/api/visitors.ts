/** Admin Visitors page data (only moderators can read visits — `visit_summary()` and RLS check). */
import { supabase } from "@/integrations/supabase/client";

export interface Counts { visits: number; visitors: number }
export interface VisitSummary {
  now: number;
  today: Counts; d7: Counts; d30: Counts; all: Counts;
  daily: { day: string; visits: number; visitors: number }[];
  sources: { name: string; n: number }[];
  devices: { name: string; n: number }[];
  members: number;
}
export interface Visit {
  id: string; device: string; started_at: string; last_seen: string; first_page: string | null;
  source: string | null; device_kind: string | null; installed: boolean; pages: number;
  person: { username: string; name: string; avatar: string | null } | null;
}

export async function fetchVisitSummary(): Promise<VisitSummary> {
  const { data, error } = await supabase.rpc("visit_summary" as never);
  if (error) throw error;
  return data as unknown as VisitSummary;
}

export async function fetchRecentVisits(limit = 60): Promise<Visit[]> {
  const db = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };
  const { data, error } = await db.from("app_visits")
    .select("id, device, user_id, started_at, last_seen, first_page, source, device_kind, installed, pages")
    .order("last_seen", { ascending: false }).limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Omit<Visit, "person"> & { user_id: string | null })[];
  const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids)
    : { data: [] as { id: string; username: string; display_name: string | null; avatar_url: string | null }[] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, { username: p.username, name: (p.display_name || p.username).trim(), avatar: p.avatar_url }]));
  return rows.map((r) => ({ ...r, person: r.user_id ? byId.get(r.user_id) ?? null : null }));
}

/** Visits right now (the menu row). */
export async function visitorsNow(): Promise<number> {
  try { return (await fetchVisitSummary()).now; } catch { return 0; }
}
