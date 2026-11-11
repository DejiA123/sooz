import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient; // app_feedback isn't in the generated types yet

export type FeedbackRating = "up" | "down";

export interface FeedbackRow {
  id: string;
  user_id: string;
  rating: FeedbackRating;
  comment: string | null;
  page: string | null;
  app_version: string | null;
  device: string | null;
  resolved: boolean;
  created_at: string;
  profile?: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

/** What phone / browser it came from, in a few words (helps fix "it doesn't work on my phone"). */
const deviceLabel = () => {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua) ? `iOS ${(ua.match(/OS (\d+)[._](\d+)/) || []).slice(1, 3).join(".")}`.trim()
    : /Android/.test(ua) ? `Android ${(ua.match(/Android ([\d.]+)/) || [])[1] ?? ""}`.trim()
    : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Other";
  const app = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone ? "installed app" : "browser";
  return `${os} · ${app} · ${window.innerWidth}×${window.innerHeight}`;
};

/** Send a 👍 / 👎 with optional words. Returns true when it was saved. */
export async function sendFeedback(rating: FeedbackRating, comment: string): Promise<boolean> {
  const { error } = await db.from("app_feedback").insert({
    rating,
    comment: comment.trim().slice(0, 2000) || null,
    page: (window.location.pathname + window.location.search).slice(0, 200),
    app_version: typeof __SOOZ_BUILD__ === "undefined" ? "dev" : String(__SOOZ_BUILD__).slice(0, 60),
    device: deviceLabel().slice(0, 300),
  });
  if (error) console.error("feedback", error);
  return !error;
}

/** Everything sent, newest first, with who sent it (moderators only — the database enforces it). */
export async function listFeedback(): Promise<FeedbackRow[]> {
  const { data, error } = await db.from("app_feedback").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  const rows = (data ?? []) as FeedbackRow[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    for (const r of rows) r.profile = byId.get(r.user_id) ?? null;
  }
  return rows;
}

/** Feedback not yet marked done (the menu's badge). */
export async function openFeedbackCount(): Promise<number> {
  const { count } = await db.from("app_feedback").select("id", { count: "exact", head: true }).eq("resolved", false);
  return count ?? 0;
}

export async function setFeedbackResolved(id: string, resolved: boolean) {
  const { error } = await db.from("app_feedback").update({ resolved }).eq("id", id);
  return !error;
}

export async function deleteFeedback(id: string) {
  const { error } = await db.from("app_feedback").delete().eq("id", id);
  return !error;
}
