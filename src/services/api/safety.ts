/**
 * Reporting and moderation (tables `reports`, `blocked_tiktoks`, RPCs `moderate` / `reported_items`,
 * migration 20261110090000). Reported posts and comments hide themselves for everyone after one
 * report for sexual content / child safety, or three people for anything else, until a moderator
 * decides (the /moderation screen).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient; // these tables aren't in the generated types yet

export type ReportTargetType = "post" | "comment" | "tiktok" | "tiktok_comment" | "user" | "message" | "story";
export type ReportReason = "sexual" | "child_safety" | "hate" | "violence" | "self_harm" | "false_teaching" | "spam" | "not_christian" | "other";
export interface ReportTarget {
  type: ReportTargetType;
  id: string;
  /** Who posted it (SOOZ content). */
  owner?: string | null;
  /** What it said / showed, as the reporter saw it. */
  snapshot?: string | null;
}

export async function submitReport(target: ReportTarget, reason: ReportReason, details: string): Promise<boolean> {
  const { error } = await db.from("reports").insert({
    target_type: target.type,
    target_id: target.id,
    target_owner: target.owner ?? null,
    snapshot: target.snapshot ? target.snapshot.slice(0, 2000) : null,
    reason,
    details: details.trim().slice(0, 1000) || null,
  });
  if (!error || error.code === "23505") { hideLocally(target.type, target.id); return true; }
  return false;
}

// ── Things this person reported: never shown to them again ──
const HIDDEN_KEY = "sooz-hidden-items";
let hidden: Set<string> | null = null;
const hiddenSet = () => {
  if (!hidden) {
    try { hidden = new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]") as string[]); } catch { hidden = new Set(); }
  }
  return hidden;
};
export function hideLocally(type: ReportTargetType, id: string) {
  const s = hiddenSet();
  s.add(`${type}:${id}`);
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...s].slice(-2000))); } catch { /* storage full */ }
}
export const isHiddenLocally = (type: ReportTargetType, id: string) => hiddenSet().has(`${type}:${id}`);

// ── TikToks a moderator took out (video ids, or "@handle" for a whole creator), for everyone ──
let blocked: { at: number; set: Promise<Set<string>> } | null = null;
export function blockedTikToks(): Promise<Set<string>> {
  if (!blocked || Date.now() - blocked.at > 10 * 60_000) {
    blocked = {
      at: Date.now(),
      set: Promise.resolve(db.from("blocked_tiktoks").select("key").limit(5000))
        .then(({ data }) => new Set(((data ?? []) as { key: string }[]).map((r) => r.key.toLowerCase())))
        .catch(() => new Set<string>()),
    };
  }
  return blocked.set;
}
export const tiktokIsBlocked = (set: Set<string>, v: { tiktok_id: string; author_handle?: string | null }) =>
  set.has(v.tiktok_id) || (!!v.author_handle && set.has(`@${v.author_handle.toLowerCase()}`));

// ── Items with open reports (family-safe mode leaves them out) ──
let reported: { at: number; set: Promise<Set<string>> } | null = null;
export function reportedItems(): Promise<Set<string>> {
  if (!reported || Date.now() - reported.at > 5 * 60_000) {
    reported = {
      at: Date.now(),
      set: Promise.resolve(db.rpc("reported_items"))
        .then(({ data }) => new Set(((data ?? []) as { target_type: string; target_id: string }[]).map((r) => `${r.target_type}:${r.target_id}`)))
        .catch(() => new Set<string>()),
    };
  }
  return reported.set;
}

// ── Moderation (moderators only; the database checks) ──
export interface ReportRow {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  target_owner: string | null;
  snapshot: string | null;
  reason: ReportReason;
  details: string | null;
  status: "open" | "actioned" | "dismissed";
  created_at: string;
}
export interface ReportGroup {
  type: ReportTargetType;
  id: string;
  owner: string | null;
  snapshot: string | null;
  reasons: Partial<Record<ReportReason, number>>;
  people: number;
  details: string[];
  first: string;
  last: string;
}
export async function fetchReportQueue(status: "open" | "closed" = "open"): Promise<ReportGroup[]> {
  const q = db.from("reports").select("*").order("created_at", { ascending: false }).limit(1000);
  const { data, error } = status === "open" ? await q.eq("status", "open") : await q.neq("status", "open");
  if (error) throw error;
  const groups = new Map<string, ReportGroup>();
  for (const r of (data ?? []) as ReportRow[]) {
    const key = `${r.target_type}:${r.target_id}`;
    let g = groups.get(key);
    if (!g) {
      g = { type: r.target_type, id: r.target_id, owner: r.target_owner, snapshot: r.snapshot, reasons: {}, people: 0, details: [], first: r.created_at, last: r.created_at };
      groups.set(key, g);
    }
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
    g.people += 1;
    if (r.details) g.details.push(r.details);
    if (r.created_at < g.first) g.first = r.created_at;
    g.snapshot ||= r.snapshot;
  }
  return [...groups.values()];
}
export async function openReportCount(): Promise<number> {
  const { count } = await db.from("reports").select("id", { count: "exact", head: true }).eq("status", "open");
  return count ?? 0;
}
export async function moderate(type: ReportTargetType, id: string, action: "hide" | "remove" | "keep") {
  const { error } = await db.rpc("moderate", { p_type: type, p_id: id, p_action: action });
  if (error) throw error;
  blocked = null;
  reported = null;
}
