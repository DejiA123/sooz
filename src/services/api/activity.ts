/**
 * The Activity page: likes, comments, replies, new followers and missed calls, newest first.
 * Chat messages aren't here (they're in Messages). Likes on the same post close together become one
 * row ("Grace and 2 others liked your post"), like Instagram.
 */
import { supabase } from "@/integrations/supabase/client";

export type ActivityKind = "like" | "comment" | "reply" | "follow" | "missed_call" | "mention" | "repost";
export interface Person { id: string; username: string; name: string; avatar: string | null }
export interface PostPreview { id: string; image: string | null; video: boolean; caption: string | null }
export interface ActivityRow {
  key: string;
  kind: ActivityKind;
  at: string;
  people: Person[]; // newest first; more than one only for grouped likes
  total: number; // how many people (grouped likes)
  text: string | null; // the comment / reply
  post: PostPreview | null;
}

const KINDS: ActivityKind[] = ["like", "comment", "reply", "follow", "missed_call", "mention", "repost"];
type ProfileRow = { id: string; username: string; display_name: string | null; avatar_url: string | null };
type Raw = { id: string; kind: ActivityKind; at: string; actor: string; ref: string | null; text: string | null };

export async function fetchActivity(me: string): Promise<ActivityRow[]> {
  const [notes, follows, likes] = await Promise.all([
    supabase.from("notifications").select("id, type, actor_id, reference_id, content, created_at")
      .eq("user_id", me).in("type", KINDS).order("created_at", { ascending: false }).limit(150),
    // Followers from before Activity recorded follows.
    supabase.from("follows").select("id, follower_id, created_at").eq("following_id", me).order("created_at", { ascending: false }).limit(60),
    // Likes from before Activity recorded likes.
    supabase.from("likes").select("id, user_id, post_id, created_at, posts!inner(user_id)").eq("posts.user_id", me).neq("user_id", me)
      .order("created_at", { ascending: false }).limit(60),
  ]);
  if (notes.error) throw notes.error;

  const raw: Raw[] = (notes.data ?? []).filter((n) => n.actor_id).map((n) => ({
    id: n.id, kind: n.type as ActivityKind, at: n.created_at, actor: n.actor_id!, text: n.content,
    ref: n.type === "follow" ? null : n.reference_id,
  }));
  const has = new Set(raw.map((r) => `${r.kind}:${r.actor}:${r.kind === "follow" ? "" : r.ref}`));
  for (const f of follows.data ?? []) if (!has.has(`follow:${f.follower_id}:`)) raw.push({ id: f.id, kind: "follow", at: f.created_at, actor: f.follower_id, ref: null, text: null });
  for (const l of (likes.data ?? []) as { id: string; user_id: string; post_id: string; created_at: string }[]) {
    if (!has.has(`like:${l.user_id}:${l.post_id}`)) raw.push({ id: l.id, kind: "like", at: l.created_at, actor: l.user_id, ref: l.post_id, text: null });
  }
  raw.sort((a, b) => b.at.localeCompare(a.at));

  const actorIds = [...new Set(raw.map((r) => r.actor))];
  const postIds = [...new Set(raw.filter((r) => (r.kind === "like" || r.kind === "comment" || r.kind === "mention" || r.kind === "repost") && r.ref).map((r) => r.ref!))];
  const [{ data: profiles }, { data: posts }] = await Promise.all([
    actorIds.length ? supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", actorIds) : Promise.resolve({ data: [] as ProfileRow[] }),
    postIds.length ? supabase.from("posts").select("id, media_url, media_type, thumbnail_url, caption").in("id", postIds) : Promise.resolve({ data: [] as { id: string; media_url: string | null; media_type: string | null; thumbnail_url: string | null; caption: string | null }[] }),
  ]);
  const people = new Map((profiles ?? []).map((p) => [p.id, { id: p.id, username: p.username, name: (p.display_name || p.username).trim(), avatar: p.avatar_url } as Person]));
  const previews = new Map((posts ?? []).map((p) => [p.id, {
    id: p.id, video: p.media_type === "video", caption: p.caption,
    image: p.thumbnail_url || (p.media_type === "image" ? p.media_url : null),
  } as PostPreview]));

  // Likes on the same post within a day of each other → one row.
  const rows: ActivityRow[] = [];
  const openLikeRow = new Map<string, ActivityRow>();
  for (const r of raw) {
    const person = people.get(r.actor);
    if (!person) continue; // deleted account
    if (r.kind === "like" && r.ref) {
      const row = openLikeRow.get(r.ref);
      if (row && Date.parse(row.at) - Date.parse(r.at) < 86_400_000) {
        if (!row.people.some((p) => p.id === person.id)) { row.people.push(person); row.total++; }
        continue;
      }
    }
    const row: ActivityRow = { key: r.id, kind: r.kind, at: r.at, people: [person], total: 1, text: r.text, post: r.ref ? previews.get(r.ref) ?? null : null };
    if (r.kind === "like" && r.ref) openLikeRow.set(r.ref, row);
    rows.push(row);
  }
  return rows;
}

const SEEN_KEY = "sooz-activity-seen";
/** When Activity was last opened on this phone (for the "New" section); notes this visit. */
export function takeActivitySeen(): number {
  let prev = 0;
  try { prev = Number(localStorage.getItem(SEEN_KEY)) || 0; localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* storage blocked */ }
  return prev;
}
