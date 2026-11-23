/** Admin Visitors page data (only moderators can read visits — `visit_summary()` and RLS check). */
import { supabase } from "@/integrations/supabase/client";

export interface Counts { visits: number; visitors: number; videos?: number; seconds?: number }
export interface VisitSummary {
  now: number;
  today: Counts; d7: Counts; d30: Counts; all: Counts;
  daily: { day: string; visits: number; visitors: number; videos?: number }[];
  sources: { name: string; n: number }[];
  devices: { name: string; n: number }[];
  members: number;
}
export interface Visit {
  id: string; device: string; started_at: string; last_seen: string; first_page: string | null;
  source: string | null; device_kind: string | null; installed: boolean; pages: number; videos?: number; seconds?: number;
  person: { username: string; name: string; avatar: string | null } | null;
}

/** Time on screen in words: "40s", "12 min", "3 h 5 min". */
export function screenTime(secs: number | null | undefined): string {
  const s = Math.max(0, Math.round(secs ?? 0));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
/** "12 videos · 8 min" (empty when nothing was counted). */
export function watchLine(videos?: number | null, seconds?: number | null): string {
  return [videos ? plural(videos, "video") : "", seconds ? screenTime(seconds) : ""].filter(Boolean).join(" · ");
}

export async function fetchVisitSummary(): Promise<VisitSummary> {
  const { data, error } = await supabase.rpc("visit_summary" as never);
  if (error) throw error;
  return data as unknown as VisitSummary;
}

export async function fetchRecentVisits(limit = 60): Promise<Visit[]> {
  const db = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };
  const { data, error } = await db.from("app_visits")
    .select("id, device, user_id, started_at, last_seen, first_page, source, device_kind, installed, pages, videos, seconds")
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
