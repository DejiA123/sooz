/**
 * The two rows at the top of Messages: new followers and activity (likes, comments, missed calls…).
 * "New" = since this phone last opened that row (kept on the phone), like an unread badge.
 */
import { supabase } from "@/integrations/supabase/client";

const SEEN_KEY = "sooz-inbox-seen";
type Seen = { followers?: string; activity?: string };
const readSeen = (): Seen => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; } };
export function markInboxSeen(which: keyof Seen) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [which]: new Date().toISOString() })); } catch { /* storage blocked */ }
}

export interface InboxPerson { id: string; name: string; avatar: string | null }
export interface InboxSummary {
  followers: { newCount: number; people: InboxPerson[]; at: string | null };
  activity: { newCount: number; text: string | null; avatar: string | null; at: string | null };
}

type ProfileRow = { id: string; username: string; display_name: string | null; avatar_url: string | null };
const nameOf = (p?: ProfileRow) => (p ? (p.display_name || p.username || "Someone").trim() : "Someone");

/** What each activity says, in a few words (messages are left out: they're the chats below). */
function activityText(type: string, who: string, content: string | null): string {
  switch (type) {
    case "like": return `${who} liked your post`;
    case "comment": return `${who} commented: ${content ?? ""}`.trim();
    case "reply": return `${who} replied to your comment`;
    case "mention": return `${who} mentioned you`;
    case "repost": return `${who} reposted your post`;
    case "missed_call": return `Missed call from ${who}`;
    case "follow": return `${who} started following you`;
    default: return content ? `${who}: ${content}` : `${who} interacted with you`;
  }
}

export async function fetchInboxSummary(me: string): Promise<InboxSummary> {
  const seen = readSeen();
  const [followsRes, notesRes] = await Promise.all([
    supabase.from("follows").select("follower_id, created_at").eq("following_id", me).order("created_at", { ascending: false }).limit(50),
    supabase.from("notifications").select("type, actor_id, content, created_at").eq("user_id", me).neq("type", "message").order("created_at", { ascending: false }).limit(50),
  ]);
  const follows = (followsRes.data ?? []) as { follower_id: string; created_at: string }[];
  const notes = (notesRes.data ?? []) as { type: string; actor_id: string | null; content: string | null; created_at: string }[];

  const newFollows = seen.followers ? follows.filter((f) => f.created_at > seen.followers!) : follows.filter((f) => Date.now() - Date.parse(f.created_at) < 7 * 86_400_000);
  const newNotes = seen.activity ? notes.filter((n) => n.created_at > seen.activity!) : notes.filter((n) => Date.now() - Date.parse(n.created_at) < 7 * 86_400_000);

  const ids = [...new Set([...follows.slice(0, 3).map((f) => f.follower_id), ...(notes[0]?.actor_id ? [notes[0].actor_id] : [])])];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids)
    : { data: [] as ProfileRow[] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p as ProfileRow]));

  const top = notes[0];
  const actor = top?.actor_id ? byId.get(top.actor_id) : undefined;
  return {
    followers: {
      newCount: newFollows.length,
      people: follows.slice(0, 3).map((f) => { const p = byId.get(f.follower_id); return { id: f.follower_id, name: nameOf(p), avatar: p?.avatar_url ?? null }; }),
      at: follows[0]?.created_at ?? null,
    },
    activity: {
      newCount: newNotes.length,
      text: top ? activityText(top.type, nameOf(actor), top.content) : null,
      avatar: actor?.avatar_url ?? null,
      at: top?.created_at ?? null,
    },
  };
}
