import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isImageMessage } from "@/lib/chat";

/**
 * SOOZ messaging (WhatsApp-style): replies, forwards, edits, reactions, stars, pins, polls, read
 * ticks, per-person chat settings. Tables / functions from migration 20261109150000.
 */
// The generated types predate the messaging tables, so this file talks to them untyped.
const db = supabase as unknown as SupabaseClient;

export type Attachment =
  | { type: "image"; url: string; w?: number; h?: number }
  | { type: "video"; url: string; w?: number; h?: number; duration?: number }
  | { type: "audio"; url: string; duration?: number; voice?: boolean }
  | { type: "file"; url: string; name: string; size?: number; mime?: string }
  | { type: "location"; lat: number; lng: number; label?: string }
  | { type: "contact"; userId: string; name: string; username: string; avatar?: string | null }
  | { type: "poll"; question: string; options: string[]; multiple: boolean };

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  isDeleted: boolean;
  replyToId: string | null;
  forwarded: boolean;
  editedAt: string | null;
  attachment: Attachment | null;
  expiresAt: string | null;
  /** Sent from this phone and still on its way / failed. */
  status?: "sending" | "failed";
}

const MSG_COLS = "id, conversation_id, sender_id, content, created_at, is_deleted, reply_to_id, forwarded, edited_at, attachment, expires_at";

type MessageRow = {
  id: string; conversation_id: string; sender_id: string; content: string | null; created_at: string; is_deleted: boolean | null;
  reply_to_id?: string | null; forwarded?: boolean | null; edited_at?: string | null; attachment?: Attachment | null; expires_at?: string | null;
};

export function toChatMessage(r: MessageRow): ChatMessage {
  let content = r.content ?? "";
  let attachment = r.attachment ?? null;
  // Photos used to be sent as just their link.
  if (!attachment && isImageMessage(content)) { attachment = { type: "image", url: content }; content = ""; }
  return {
    id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, content, createdAt: r.created_at,
    isDeleted: !!r.is_deleted, replyToId: r.reply_to_id ?? null, forwarded: !!r.forwarded, editedAt: r.edited_at ?? null,
    attachment, expiresAt: r.expires_at ?? null,
  };
}

/** What a message looks like in one line (chat list, reply quotes, notifications). */
export function messageSummary(m: { content: string; attachment: Attachment | null; isDeleted?: boolean }): string {
  if (m.isDeleted) return "This message was deleted";
  const a = m.attachment;
  // One line, without WhatsApp formatting marks (*bold* → bold).
  const caption = m.content
    .replace(/```/g, "")
    .replace(/(^|[\s(])([*_~`])(\S(?:[^\n]*?\S)?)\2(?=$|[\s.,!?;:)])/g, "$1$3")
    .replace(/\s+/g, " ")
    .trim();
  if (!a) return caption;
  const label = {
    image: "📷 Photo", video: "🎥 Video", audio: a.type === "audio" && a.voice ? "🎤 Voice message" : "🎵 Audio",
    file: `📄 ${a.type === "file" ? a.name : "Document"}`, location: "📍 Location",
    contact: `👤 ${a.type === "contact" ? a.name : "Contact"}`, poll: `📊 ${a.type === "poll" ? a.question : "Poll"}`,
  }[a.type];
  return caption ? `${label.split(" ")[0]} ${caption}` : label;
}

// ── The chat list ────────────────────────────────────────────────────────────────────────────

export interface ChatSummary {
  id: string;
  isGroup: boolean;
  name: string;
  avatar: string | null;
  otherUserId: string | null;
  otherUsername: string | null;
  lastSeen: string | null;
  createdAt: string;
  disappearSeconds: number | null;
  archived: boolean;
  pinnedAt: string | null;
  mutedUntil: string | null;
  markedUnread: boolean;
  favourite: boolean;
  hiddenAt: string | null;
  clearedAt: string | null;
  last: { id: string; content: string; senderId: string; senderName: string | null; createdAt: string; isDeleted: boolean; attachment: Attachment | null } | null;
  unread: number;
  memberCount: number;
  /** When everyone else last read / received something here (for my ticks). */
  othersReadAt: string | null;
  othersDeliveredAt: string | null;
  /** When it was last active (for sorting). */
  activity: string;
}

type ChatListRow = {
  id: string; type: string; name: string | null; avatar_url: string | null; created_at: string; disappear_seconds: number | null;
  archived: boolean; pinned_at: string | null; muted_until: string | null; marked_unread: boolean; favourite: boolean;
  hidden_at: string | null; cleared_at: string | null; last_read_at: string | null;
  other_user_id: string | null; other_username: string | null; other_display_name: string | null; other_avatar_url: string | null; other_updated_at: string | null;
  last_message_id: string | null; last_content: string | null; last_sender_id: string | null; last_sender_name: string | null; last_created_at: string | null;
  last_is_deleted: boolean; last_attachment: Attachment | null; unread: number; member_count: number;
  others_read_at: string | null; others_delivered_at: string | null;
};

export async function fetchChatList(): Promise<ChatSummary[]> {
  const { data, error } = await db.rpc("my_chat_list");
  if (error) throw error;
  return ((data ?? []) as ChatListRow[]).map((r) => {
    const isGroup = r.type === "group";
    const last = r.last_message_id
      ? (() => {
          const m = toChatMessage({ id: r.last_message_id!, conversation_id: r.id, sender_id: r.last_sender_id!, content: r.last_content, created_at: r.last_created_at!, is_deleted: r.last_is_deleted, attachment: r.last_attachment });
          return { id: m.id, content: m.content, senderId: m.senderId, senderName: r.last_sender_name, createdAt: m.createdAt, isDeleted: m.isDeleted, attachment: m.attachment };
        })()
      : null;
    return {
      id: r.id, isGroup,
      name: isGroup ? r.name || "Group" : (r.other_display_name || r.other_username || "SOOZ member").trim(),
      avatar: isGroup ? r.avatar_url : r.other_avatar_url,
      otherUserId: r.other_user_id, otherUsername: r.other_username, lastSeen: r.other_updated_at,
      createdAt: r.created_at, disappearSeconds: r.disappear_seconds,
      archived: r.archived, pinnedAt: r.pinned_at, mutedUntil: r.muted_until, markedUnread: r.marked_unread, favourite: r.favourite,
      hiddenAt: r.hidden_at, clearedAt: r.cleared_at, last, unread: Number(r.unread) || 0, memberCount: Number(r.member_count) || 0,
      othersReadAt: r.others_read_at, othersDeliveredAt: r.others_delivered_at,
      activity: last?.createdAt || r.created_at,
    };
  });
}

export const isMuted = (mutedUntil: string | null | undefined) => !!mutedUntil && new Date(mutedUntil).getTime() > Date.now();

/** A deleted chat comes back when someone sends something new. */
export const isChatVisible = (c: ChatSummary) => !c.hiddenAt || (!!c.last && c.last.createdAt > c.hiddenAt);

export type MyChatSettings = Partial<{
  archived: boolean; pinned_at: string | null; muted_until: string | null; marked_unread: boolean; favourite: boolean;
  cleared_at: string | null; hidden_at: string | null; last_read_at: string; delivered_at: string;
}>;

export async function updateMyChat(conversationId: string, userId: string, patch: MyChatSettings) {
  const { error } = await db.from("conversation_participants").update(patch).eq("conversation_id", conversationId).eq("user_id", userId);
  if (error) throw error;
}

export const markChatRead = (conversationId: string, userId: string) =>
  updateMyChat(conversationId, userId, { last_read_at: new Date().toISOString(), delivered_at: new Date().toISOString(), marked_unread: false }).catch(() => {});

/** Everything sent to me so far reached my phone (double grey tick for the sender). */
export const markChatsDelivered = () => db.rpc("mark_chats_delivered").then(() => {}, () => {});

export async function openDirectChat(otherUserId: string): Promise<string> {
  const { data, error } = await db.rpc("get_or_create_direct_chat", { other_user: otherUserId });
  if (error || !data) throw error ?? new Error("Couldn't open that chat");
  return data as string;
}

// ── One chat ─────────────────────────────────────────────────────────────────────────────────

export interface ChatInfo {
  id: string;
  type: "direct" | "group";
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  disappearSeconds: number | null;
  onlyAdminsSend: boolean;
  onlyAdminsEdit: boolean;
}

export interface ChatMember {
  userId: string;
  name: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  lastSeen: string | null;
  role: "member" | "admin";
  lastReadAt: string | null;
  deliveredAt: string | null;
  mutedUntil: string | null;
  clearedAt: string | null;
  joinedAt: string;
}

export async function fetchChatInfo(conversationId: string): Promise<ChatInfo | null> {
  const { data } = await db.from("conversations").select("id, type, name, description, avatar_url, created_by, created_at, disappear_seconds, only_admins_send, only_admins_edit").eq("id", conversationId).maybeSingle();
  if (!data) return null;
  return {
    id: data.id, type: data.type, name: data.name, description: data.description, avatarUrl: data.avatar_url, createdBy: data.created_by,
    createdAt: data.created_at, disappearSeconds: data.disappear_seconds, onlyAdminsSend: !!data.only_admins_send, onlyAdminsEdit: !!data.only_admins_edit,
  };
}

export async function fetchMembers(conversationId: string): Promise<ChatMember[]> {
  const { data } = await db
    .from("conversation_participants")
    .select("user_id, role, last_read_at, delivered_at, muted_until, cleared_at, joined_at, profiles(username, display_name, avatar_url, bio, updated_at)")
    .eq("conversation_id", conversationId);
  type Row = { user_id: string; role: string; last_read_at: string | null; delivered_at: string | null; muted_until: string | null; cleared_at: string | null; joined_at: string;
    profiles: { username: string; display_name: string | null; avatar_url: string | null; bio: string | null; updated_at: string | null } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    userId: r.user_id, name: (r.profiles?.display_name || r.profiles?.username || "Member").trim(), username: r.profiles?.username || "",
    avatar: r.profiles?.avatar_url ?? null, bio: r.profiles?.bio ?? null, lastSeen: r.profiles?.updated_at ?? null,
    role: r.role === "admin" ? "admin" : "member", lastReadAt: r.last_read_at, deliveredAt: r.delivered_at, mutedUntil: r.muted_until,
    clearedAt: r.cleared_at, joinedAt: r.joined_at,
  }));
}

export async function fetchMessages(conversationId: string, after: string | null): Promise<ChatMessage[]> {
  let q = db.from("messages").select(MSG_COLS).eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(1000);
  if (after) q = q.gt("created_at", after);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).map(toChatMessage).reverse();
}

export async function fetchMessage(id: string): Promise<ChatMessage | null> {
  const { data } = await db.from("messages").select(MSG_COLS).eq("id", id).maybeSingle();
  return data ? toChatMessage(data as MessageRow) : null;
}

export interface ChatExtras {
  reactions: Map<string, { userId: string; emoji: string }[]>;
  starred: Set<string>;
  hidden: Set<string>;
  pins: { messageId: string; pinnedAt: string; pinnedBy: string }[];
  votes: Map<string, Map<string, number[]>>;
}

export async function fetchChatExtras(conversationId: string, userId: string): Promise<ChatExtras> {
  const [r, s, h, p, v] = await Promise.all([
    db.from("message_reactions").select("message_id, user_id, emoji").eq("conversation_id", conversationId),
    db.from("message_stars").select("message_id").eq("conversation_id", conversationId).eq("user_id", userId),
    db.from("message_hidden").select("message_id").eq("conversation_id", conversationId).eq("user_id", userId),
    db.from("message_pins").select("message_id, pinned_at, pinned_by").eq("conversation_id", conversationId).order("pinned_at", { ascending: false }),
    db.from("poll_votes").select("message_id, user_id, options").eq("conversation_id", conversationId),
  ]);
  const reactions = new Map<string, { userId: string; emoji: string }[]>();
  for (const x of (r.data ?? []) as { message_id: string; user_id: string; emoji: string }[]) {
    if (!reactions.has(x.message_id)) reactions.set(x.message_id, []);
    reactions.get(x.message_id)!.push({ userId: x.user_id, emoji: x.emoji });
  }
  const votes = new Map<string, Map<string, number[]>>();
  for (const x of (v.data ?? []) as { message_id: string; user_id: string; options: number[] }[]) {
    if (!votes.has(x.message_id)) votes.set(x.message_id, new Map());
    votes.get(x.message_id)!.set(x.user_id, x.options ?? []);
  }
  return {
    reactions,
    starred: new Set(((s.data ?? []) as { message_id: string }[]).map((x) => x.message_id)),
    hidden: new Set(((h.data ?? []) as { message_id: string }[]).map((x) => x.message_id)),
    pins: ((p.data ?? []) as { message_id: string; pinned_at: string; pinned_by: string }[]).map((x) => ({ messageId: x.message_id, pinnedAt: x.pinned_at, pinnedBy: x.pinned_by })),
    votes,
  };
}

// ── Sending and changing messages ────────────────────────────────────────────────────────────

export async function sendChatMessage(m: { conversationId: string; senderId: string; content: string; replyToId?: string | null; attachment?: Attachment | null; forwarded?: boolean }): Promise<ChatMessage> {
  const { data, error } = await db
    .from("messages")
    .insert({ conversation_id: m.conversationId, sender_id: m.senderId, content: m.content, reply_to_id: m.replyToId ?? null, attachment: m.attachment ?? null, forwarded: !!m.forwarded })
    .select(MSG_COLS)
    .single();
  if (error || !data) throw error ?? new Error("Not sent");
  return toChatMessage(data as MessageRow);
}

export async function editChatMessage(id: string, content: string) {
  const { error } = await db.from("messages").update({ content, edited_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteForEveryone(id: string, asAdmin = false) {
  const { error } = asAdmin
    ? await db.rpc("admin_delete_message", { target_message_id: id })
    : await db.from("messages").update({ is_deleted: true, content: "", attachment: null }).eq("id", id);
  if (error) throw error;
}

export async function deleteForMe(userId: string, msg: { id: string; conversationId: string }) {
  const { error } = await db.from("message_hidden").upsert({ user_id: userId, message_id: msg.id, conversation_id: msg.conversationId });
  if (error) throw error;
}

export async function setStarred(userId: string, msg: { id: string; conversationId: string }, on: boolean) {
  const { error } = on
    ? await db.from("message_stars").upsert({ user_id: userId, message_id: msg.id, conversation_id: msg.conversationId })
    : await db.from("message_stars").delete().eq("user_id", userId).eq("message_id", msg.id);
  if (error) throw error;
}

export async function setPinned(userId: string, msg: { id: string; conversationId: string }, on: boolean) {
  const { error } = on
    ? await db.from("message_pins").upsert({ conversation_id: msg.conversationId, message_id: msg.id, pinned_by: userId })
    : await db.from("message_pins").delete().eq("conversation_id", msg.conversationId).eq("message_id", msg.id);
  if (error) throw error;
}

export async function setReaction(userId: string, msg: { id: string; conversationId: string }, emoji: string | null) {
  const { error } = emoji
    ? await db.from("message_reactions").upsert({ message_id: msg.id, user_id: userId, conversation_id: msg.conversationId, emoji, created_at: new Date().toISOString() })
    : await db.from("message_reactions").delete().eq("message_id", msg.id).eq("user_id", userId);
  if (error) throw error;
}

export async function setVote(userId: string, msg: { id: string; conversationId: string }, options: number[]) {
  const { error } = options.length
    ? await db.from("poll_votes").upsert({ message_id: msg.id, user_id: userId, conversation_id: msg.conversationId, options, updated_at: new Date().toISOString() })
    : await db.from("poll_votes").delete().eq("message_id", msg.id).eq("user_id", userId);
  if (error) throw error;
}

/** Upload a photo, video, voice note or document for a chat; returns its public link. */
export async function uploadChatFile(file: Blob, name: string): Promise<string> {
  const ext = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const path = `chat-files/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

/** Ticks for the last message in the chat list. */
export function lastDelivery(c: ChatSummary): "sent" | "delivered" | "read" {
  if (!c.last) return "sent";
  if (c.othersReadAt && c.othersReadAt >= c.last.createdAt) return "read";
  if (c.othersDeliveredAt && c.othersDeliveredAt >= c.last.createdAt) return "delivered";
  return "sent";
}

export interface StarredHit { message: ChatMessage; starredAt: string }

/** Every message I starred, across all chats, newest first. */
export async function fetchAllStarred(userId: string): Promise<StarredHit[]> {
  const { data } = await db
    .from("message_stars")
    .select(`created_at, messages(${MSG_COLS})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as unknown as { created_at: string; messages: MessageRow | null }[])
    .filter((r) => r.messages)
    .map((r) => ({ message: toChatMessage(r.messages!), starredAt: r.created_at }));
}

export interface MessageSearchHit { id: string; conversationId: string; content: string; createdAt: string; senderId: string }

/** Messages in my chats containing the words (RLS keeps it to my chats). */
export async function searchMyMessages(query: string): Promise<MessageSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data } = await db
    .from("messages")
    .select("id, conversation_id, content, created_at, sender_id")
    .ilike("content", `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(30);
  return ((data ?? []) as { id: string; conversation_id: string; content: string; created_at: string; sender_id: string }[])
    .map((r) => ({ id: r.id, conversationId: r.conversation_id, content: r.content, createdAt: r.created_at, senderId: r.sender_id }));
}

// ── Groups and people ────────────────────────────────────────────────────────────────────────

export async function updateChat(conversationId: string, patch: Partial<{ name: string; description: string | null; avatar_url: string | null; disappear_seconds: number | null; only_admins_send: boolean; only_admins_edit: boolean }>) {
  const { error } = await db.from("conversations").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", conversationId);
  if (error) throw error;
}

export async function addMembers(conversationId: string, userIds: string[]) {
  if (!userIds.length) return;
  const { error } = await db.from("conversation_participants").upsert(userIds.map((user_id) => ({ conversation_id: conversationId, user_id })), { onConflict: "conversation_id,user_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeMember(conversationId: string, userId: string) {
  const { error } = await db.from("conversation_participants").delete().eq("conversation_id", conversationId).eq("user_id", userId);
  if (error) throw error;
}

export async function setMemberRole(conversationId: string, userId: string, role: "member" | "admin") {
  const { error } = await db.rpc("set_chat_role", { target_conversation_id: conversationId, member_id: userId, new_role: role });
  if (error) throw error;
}

export async function fetchBlocked(userId: string): Promise<Set<string>> {
  const { data } = await db.from("user_blocks").select("blocked_id").eq("blocker_id", userId);
  return new Set(((data ?? []) as { blocked_id: string }[]).map((r) => r.blocked_id));
}

export async function setBlocked(userId: string, otherId: string, on: boolean) {
  const { error } = on
    ? await db.from("user_blocks").upsert({ blocker_id: userId, blocked_id: otherId })
    : await db.from("user_blocks").delete().eq("blocker_id", userId).eq("blocked_id", otherId);
  if (error) throw error;
}

export interface PersonResult { id: string; username: string; name: string; avatar: string | null }

export async function searchPeople(query: string, excludeId?: string): Promise<PersonResult[]> {
  const q = query.trim().replace(/[%_,()]/g, "");
  let req = supabase.from("profiles").select("id, username, display_name, avatar_url").limit(30);
  if (q) req = req.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  if (excludeId) req = req.neq("id", excludeId);
  const { data } = await req;
  return (data ?? []).map((p) => ({ id: p.id, username: p.username, name: (p.display_name || p.username).trim(), avatar: p.avatar_url }));
}

/** Notify the others in a chat (skips anyone who muted it, unless they were @mentioned). */
export function pushToMembers(opts: { members: ChatMember[]; fromUserId: string; title: string; body: string; conversationId: string; mentioned?: Set<string> }) {
  for (const m of opts.members) {
    if (m.userId === opts.fromUserId) continue;
    if (isMuted(m.mutedUntil) && !opts.mentioned?.has(m.userId)) continue;
    supabase.functions
      .invoke("push-notifications", { body: { type: "chat_message", toUserId: m.userId, title: opts.title, body: opts.body, url: `/chat?c=${opts.conversationId}` } })
      .then(({ error }) => { if (error) console.warn("Push not sent:", error.message); });
  }
}
