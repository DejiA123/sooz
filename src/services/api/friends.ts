/**
 * Add friends: who to suggest. People who follow you that you don't follow back come first, then
 * people you chat with, then friends of friends (followed by people you follow, most shared first),
 * then the newest members — never yourself or anyone you already follow.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchChatList } from "./chat";

export interface FriendSuggestion {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
  reason: "follows_you" | "chat" | "mutual" | "new";
  mutuals?: number;
}

type ProfileRow = { id: string; username: string; display_name: string | null; avatar_url: string | null };
const toPerson = (p: ProfileRow) => ({ id: p.id, username: p.username, name: (p.display_name || p.username).trim(), avatar: p.avatar_url });

async function profilesById(ids: string[]): Promise<Map<string, ProfileRow>> {
  if (!ids.length) return new Map();
  const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids.slice(0, 300));
  return new Map((data ?? []).map((p) => [p.id, p as ProfileRow]));
}

export async function friendSuggestions(me: string): Promise<{ followBack: FriendSuggestion[]; suggested: FriendSuggestion[] }> {
  const [followingRes, followersRes, chats] = await Promise.all([
    supabase.from("follows").select("following_id").eq("follower_id", me).limit(2000),
    supabase.from("follows").select("follower_id").eq("following_id", me).limit(2000),
    fetchChatList().catch(() => []),
  ]);
  const following = new Set((followingRes.data ?? []).map((r) => r.following_id as string));
  const skip = (id: string | null | undefined) => !id || id === me || following.has(id);

  const followBackIds = (followersRes.data ?? []).map((r) => r.follower_id as string).filter((id) => !skip(id));
  const chatIds = [...new Set(chats.map((c) => c.otherUserId).filter((id): id is string => !skip(id) && !followBackIds.includes(id!)))];

  // Friends of friends
  const mutual = new Map<string, number>();
  if (following.size) {
    const { data } = await supabase.from("follows").select("following_id").in("follower_id", [...following].slice(0, 200)).limit(3000);
    for (const r of data ?? []) {
      const id = r.following_id as string;
      if (!skip(id) && !followBackIds.includes(id) && !chatIds.includes(id)) mutual.set(id, (mutual.get(id) ?? 0) + 1);
    }
  }
  const mutualIds = [...mutual.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([id]) => id);

  const profiles = await profilesById([...followBackIds, ...chatIds, ...mutualIds]);
  const make = (id: string, reason: FriendSuggestion["reason"]): FriendSuggestion | null => {
    const p = profiles.get(id);
    return p ? { ...toPerson(p), reason, mutuals: mutual.get(id) } : null;
  };
  const followBack = followBackIds.map((id) => make(id, "follows_you")).filter((x): x is FriendSuggestion => !!x);
  const suggested = [...chatIds.map((id) => make(id, "chat")), ...mutualIds.map((id) => make(id, "mutual"))].filter((x): x is FriendSuggestion => !!x);

  // Top up with the newest members.
  if (suggested.length < 20) {
    const taken = new Set([...followBack, ...suggested].map((s) => s.id));
    const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url").order("created_at", { ascending: false }).limit(60);
    for (const p of (data ?? []) as ProfileRow[]) {
      if (suggested.length >= 30) break;
      if (!skip(p.id) && !taken.has(p.id)) suggested.push({ ...toPerson(p), reason: "new" });
    }
  }
  return { followBack, suggested };
}
