import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Forward, MoreVertical, Phone, Pin, Search, Star, Timer, Trash2, Users, Video, X } from "lucide-react";
import { toast } from "sonner";
import { useCall } from "@/contexts/CallContext";
import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/usePresence";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { dayChipLabel, disappearLabel, lastSeenLabel } from "@/lib/chat";
import { useTypingIn, useTypingSender } from "@/lib/chatTyping";
import {
  addMembers, deleteForEveryone, deleteForMe, editChatMessage, fetchBlocked, fetchChatExtras, fetchChatInfo, fetchMembers, fetchMessages,
  markChatRead, messageSummary, openDirectChat, pushToMembers, removeMember, sendChatMessage, setBlocked, setMemberRole, setPinned,
  setReaction, setStarred, setVote, toChatMessage, updateChat, updateMyChat, uploadChatFile,
  type Attachment, type ChatExtras, type ChatInfo, type ChatMember, type ChatMessage, type ChatSummary,
} from "@/services/api/chat";
import { MessageBubble, type Delivery } from "./MessageBubble";
import { MessageMenu, type MenuAction } from "./MessageMenu";
import { Composer } from "./Composer";
import { ChatInfoPanel } from "./ChatInfoPanel";
import { ForwardSheet, MediaViewer, MessageInfoSheet, PeoplePicker, PollCreator, PollVotesSheet, ReactionsSheet, Sheet } from "./ChatSheets";
import { LocationAttachment } from "./AttachmentView";
import { supabase } from "@/integrations/supabase/client";
import { ReportSheet } from "@/components/safety/ReportSheet";
import type { ReportTarget } from "@/services/api/safety";

interface ChatWindowProps {
  chatId: string;
  focusMessageId?: string | null;
  onBack: () => void;
  onOpenChat: (id: string) => void;
}

const EMPTY_EXTRAS: ChatExtras = { reactions: new Map(), starred: new Set(), hidden: new Set(), pins: [], votes: new Map() };
const GROUP_GAP_MS = 3 * 60 * 1000;
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_ALL_WINDOW_MS = 2 * 24 * 3600 * 1000;
const MAX_UPLOAD = 100 * 1024 * 1024;
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

/** Size (and length) of a photo / video before it's sent, so its bubble has the right shape at once. */
function mediaInfo(file: File): Promise<{ w?: number; h?: number; duration?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (v: { w?: number; h?: number; duration?: number }) => { URL.revokeObjectURL(url); resolve(v); };
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () => done({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => done({});
      img.src = url;
    } else {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => done({ w: v.videoWidth || undefined, h: v.videoHeight || undefined, duration: Number.isFinite(v.duration) ? v.duration : undefined });
      v.onerror = () => done({});
      v.src = url;
      setTimeout(() => done({}), 4000);
    }
  });
}

export const ChatWindow = ({ chatId, focusMessageId, onBack, onOpenChat }: ChatWindowProps) => {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { onlineUsers } = usePresence();
  const { startCall, startGroupCall } = useCall();

  const [info, setInfo] = useState<ChatInfo | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [extras, setExtras] = useState<ChatExtras>(EMPTY_EXTRAS);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [notMember, setNotMember] = useState(false);

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [menu, setMenu] = useState<{ msg: ChatMessage; rect: DOMRect } | null>(null);
  const [selecting, setSelecting] = useState<Set<string> | null>(null);
  const [forwardMsgs, setForwardMsgs] = useState<ChatMessage[] | null>(null);
  const [infoMsg, setInfoMsg] = useState<ChatMessage | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reactionsMsg, setReactionsMsg] = useState<ChatMessage | null>(null);
  const [votesMsg, setVotesMsg] = useState<ChatMessage | null>(null);
  const [mediaMsg, setMediaMsg] = useState<ChatMessage | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body?: string; label: string; run: () => void } | null>(null);
  const [selDelete, setSelDelete] = useState(false);
  const [search, setSearch] = useState<{ q: string; idx: number } | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [unreadAnchor, setUnreadAnchor] = useState<{ id: string; count: number } | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newBelow, setNewBelow] = useState(0);
  const [pinIdx, setPinIdx] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const firstScrollDone = useRef(false);
  const live = useRef(false);
  const files = useRef(new Map<string, File>()); // local message id → file still to upload (for retry)

  // ── Who's who ──
  const memberMap = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);
  const meMember = memberMap.get(me);
  const isGroup = info?.type === "group";
  const other = !isGroup ? members.find((m) => m.userId !== me) : undefined;
  const isAdmin = meMember?.role === "admin";
  const canEditInfo = !!isGroup && (isAdmin || !info?.onlyAdminsEdit);
  const blocked = !!other && blockedIds.has(other.userId);
  const title = isGroup ? info?.name || "Group" : other?.name || "";
  const avatar = isGroup ? info?.avatarUrl ?? null : other?.avatar ?? null;
  const myName = meMember?.name || user?.user_metadata?.username || "Someone";

  // ── Loading ──
  const loadMessages = useCallback(async (clearedAt: string | null) => {
    const list = await fetchMessages(chatId, clearedAt).catch(() => null);
    if (!list) return;
    setMessages((prev) => {
      const ids = new Set(list.map((m) => m.id));
      return [...list, ...prev.filter((m) => m.status && !ids.has(m.id))];
    });
  }, [chatId]);

  const loadExtras = useCallback(() => { if (me) fetchChatExtras(chatId, me).then(setExtras).catch(() => {}); }, [chatId, me]);
  const loadMembers = useCallback(() => fetchMembers(chatId).then((m) => { setMembers(m); return m; }), [chatId]);
  const loadInfo = useCallback(() => fetchChatInfo(chatId).then((i) => { if (i) setInfo(i); return i; }), [chatId]);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    setLoading(true); setMessages([]); setExtras(EMPTY_EXTRAS); setInfo(null); setMembers([]); setNotMember(false);
    setReplyTo(null); setEditing(null); setSelecting(null); setSearch(null); setUnreadAnchor(null); setShowInfo(false);
    firstScrollDone.current = false; stick.current = true;
    (async () => {
      const [inf, mem, ex, blocks] = await Promise.all([fetchChatInfo(chatId), fetchMembers(chatId), fetchChatExtras(chatId, me).catch(() => EMPTY_EXTRAS), fetchBlocked(me).catch(() => new Set<string>())]);
      if (cancelled) return;
      const mine = mem.find((m) => m.userId === me);
      if (!inf || !mine) { setNotMember(true); setLoading(false); return; }
      setInfo(inf); setMembers(mem); setExtras(ex); setBlockedIds(blocks);
      const list = await fetchMessages(chatId, mine.clearedAt).catch(() => [] as ChatMessage[]);
      if (cancelled) return;
      // "N unread messages" divider: the first message from others after I last read.
      const firstUnread = list.findIndex((m) => m.senderId !== me && (!mine.lastReadAt || m.createdAt > mine.lastReadAt));
      if (firstUnread >= 0) {
        const count = list.slice(firstUnread).filter((m) => m.senderId !== me).length;
        setUnreadAnchor({ id: list[firstUnread].id, count });
      }
      setMessages(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [chatId, me]);

  const memberMapRef = useRef(memberMap);
  memberMapRef.current = memberMap;

  // ── Live updates ──
  useEffect(() => {
    if (!me) return;
    let extrasTimer = 0;
    const refreshExtras = () => { clearTimeout(extrasTimer); extrasTimer = window.setTimeout(loadExtras, 250); };
    const channel = supabase
      .channel(`chat:${chatId}:${crypto.randomUUID().slice(0, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${chatId}` }, (payload) => {
        const m = toChatMessage(payload.new as Parameters<typeof toChatMessage>[0]);
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.senderId !== me && !stick.current) setNewBelow((n) => n + 1);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${chatId}` }, (payload) => {
        const m = toChatMessage(payload.new as Parameters<typeof toChatMessage>[0]);
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...m } : x)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${chatId}` }, refreshExtras)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, refreshExtras)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_pins", filter: `conversation_id=eq.${chatId}` }, refreshExtras)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_pins" }, refreshExtras)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `conversation_id=eq.${chatId}` }, refreshExtras)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "poll_votes" }, refreshExtras)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${chatId}` }, (payload) => {
        const r = payload.new as { user_id: string; role: string; last_read_at: string | null; delivered_at: string | null; muted_until: string | null; cleared_at: string | null };
        setMembers((prev) => prev.map((m) => (m.userId === r.user_id ? { ...m, role: r.role === "admin" ? "admin" : "member", lastReadAt: r.last_read_at, deliveredAt: r.delivered_at, mutedUntil: r.muted_until, clearedAt: r.cleared_at } : m)));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_participants", filter: `conversation_id=eq.${chatId}` }, () => { loadMembers(); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "conversation_participants" }, () => { loadMembers().then((m) => { if (!m.some((x) => x.userId === me)) setNotMember(true); }); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${chatId}` }, () => { loadInfo(); })
      .subscribe((status) => {
        live.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") { loadMessages(memberMapRef.current.get(me)?.clearedAt ?? null); loadExtras(); }
      });
    // Safety net when live updates drop (weak signal, app in the background).
    const poll = setInterval(() => { if (!live.current && !document.hidden) loadMessages(memberMapRef.current.get(me)?.clearedAt ?? null); }, 8000);
    const onShow = () => { if (!document.hidden) { loadMessages(memberMapRef.current.get(me)?.clearedAt ?? null); loadExtras(); loadMembers(); } };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("online", onShow);
    return () => {
      live.current = false;
      clearTimeout(extrasTimer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("online", onShow);
      supabase.removeChannel(channel);
    };
  }, [chatId, me, loadExtras, loadMembers, loadInfo, loadMessages]);
  // ── What's shown ──
  const visible = useMemo(() => {
    const now = Date.now();
    const cleared = meMember?.clearedAt;
    return messages.filter((m) => !extras.hidden.has(m.id) && (!cleared || m.createdAt > cleared || m.status) && (!m.expiresAt || new Date(m.expiresAt).getTime() > now));
  }, [messages, extras.hidden, meMember?.clearedAt]);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const dayGroups = useMemo(() => {
    const groups: { key: string; first: string; items: { msg: ChatMessage; idx: number }[] }[] = [];
    visible.forEach((msg, idx) => {
      const key = new Date(msg.createdAt).toDateString();
      if (groups[groups.length - 1]?.key !== key) groups.push({ key, first: msg.createdAt, items: [] });
      groups[groups.length - 1].items.push({ msg, idx });
    });
    return groups;
  }, [visible]);

  const delivery = useCallback((m: ChatMessage): Delivery => {
    if (m.status) return m.status;
    const others = members.filter((x) => x.userId !== me);
    if (!others.length) return "sent";
    if (others.every((x) => x.lastReadAt && x.lastReadAt >= m.createdAt)) return "read";
    if (others.every((x) => (x.deliveredAt && x.deliveredAt >= m.createdAt) || (x.lastReadAt && x.lastReadAt >= m.createdAt))) return "delivered";
    return "sent";
  }, [members, me]);

  // ── Read receipts: reading the chat marks it read (blue ticks for the sender) ──
  const lastIncoming = useMemo(() => [...visible].reverse().find((m) => m.senderId !== me && !m.status), [visible, me]);
  useEffect(() => {
    if (loading || !me || !lastIncoming) return;
    const markIfShown = () => {
      if (document.hidden) return;
      const myRead = memberMapRef.current.get(me)?.lastReadAt;
      if (myRead && myRead >= lastIncoming.createdAt) return;
      markChatRead(chatId, me);
      const now = new Date().toISOString();
      setMembers((prev) => prev.map((m) => (m.userId === me ? { ...m, lastReadAt: now, deliveredAt: now } : m)));
      queryClient.setQueryData<ChatSummary[]>(["chats", me], (old) => old?.map((c) => (c.id === chatId ? { ...c, unread: 0, markedUnread: false } : c)));
    };
    const t = setTimeout(markIfShown, 350);
    document.addEventListener("visibilitychange", markIfShown);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", markIfShown); };
  }, [lastIncoming, loading, me, chatId, queryClient]);
  useEffect(() => { // opening a chat marked "unread" clears that
    if (!loading && meMember && me) queryClient.setQueryData<ChatSummary[]>(["chats", me], (old) => old?.map((c) => (c.id === chatId ? { ...c, markedUnread: false } : c)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── Typing ──
  const typingNow = useTypingIn(useMemo(() => [chatId], [chatId]), me)[chatId] ?? {};
  const sendTyping = useTypingSender(chatId, me ? { id: me, name: myName } : null);

  // ── Scrolling ──
  const jumpTo = useCallback((id: string) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-mid="${id}"]`);
    if (!el) { toast("That message isn't available any more"); return; }
    stick.current = false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlashId(id);
    setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1600);
  }, []);

  // A chat opens at the newest message (the "unread messages" line stays as a marker above it),
  // unless it was opened to show a particular message.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || loading) return;
    if (!firstScrollDone.current) {
      firstScrollDone.current = true;
      if (focusMessageId && byId.has(focusMessageId)) { requestAnimationFrame(() => jumpTo(focusMessageId)); return; }
      stick.current = true;
      el.scrollTop = el.scrollHeight;
      return;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [visible.length, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stay at the newest message while things above it finish loading (photos, maps, voice notes,
  // reactions) and when the keyboard opens — unless they've scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content || loading) return;
    const keepDown = () => { if (stick.current) el.scrollTop = el.scrollHeight; };
    const ro = new ResizeObserver(keepDown);
    ro.observe(content);
    ro.observe(el);
    // Photos finishing loading don't always change the layout in one go — catch those too.
    content.addEventListener("load", keepDown, true);
    return () => { ro.disconnect(); content.removeEventListener("load", keepDown, true); };
  }, [loading]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = bottom;
    setAtBottom(bottom);
    if (bottom) setNewBelow(0);
  };
  const toBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    stick.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setNewBelow(0);
  };

  // ── Search in chat ──
  const matches = useMemo(() => {
    const q = search?.q.trim().toLowerCase();
    if (!q) return [] as string[];
    return visible.filter((m) => !m.isDeleted && m.content.toLowerCase().includes(q)).map((m) => m.id);
  }, [search?.q, visible]);
  useEffect(() => {
    if (!search || !matches.length) return;
    const i = Math.min(search.idx, matches.length - 1);
    jumpTo(matches[matches.length - 1 - i]);
  }, [search?.idx, matches.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sending ──
  const notify = (m: ChatMessage) => {
    const mentioned = new Set<string>();
    for (const [, username] of m.content.matchAll(/(?:^|\s)@([\w.]+)/g)) {
      const hit = members.find((x) => x.username.toLowerCase() === username.toLowerCase());
      if (hit) mentioned.add(hit.userId);
    }
    pushToMembers({ members, fromUserId: me, conversationId: chatId, mentioned, title: isGroup ? `${myName} · ${title}` : myName, body: messageSummary(m) || "New message" });
  };

  const deliver = async (temp: ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, status: "sending" } : m)));
    try {
      let attachment = temp.attachment;
      const file = files.current.get(temp.id);
      if (file && attachment && "url" in attachment && attachment.url.startsWith("blob:")) {
        const url = await uploadChatFile(file, file.name);
        attachment = { ...attachment, url } as Attachment;
      }
      const saved = await sendChatMessage({ conversationId: chatId, senderId: me, content: temp.content, replyToId: temp.replyToId, attachment, forwarded: temp.forwarded });
      files.current.delete(temp.id);
      if (attachment && "url" in attachment && temp.attachment && "url" in temp.attachment && temp.attachment.url.startsWith("blob:")) URL.revokeObjectURL(temp.attachment.url);
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== temp.id);
        return without.some((m) => m.id === saved.id) ? without : [...without, saved];
      });
      notify(saved);
    } catch (e) {
      console.warn("Message not sent:", e);
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, status: "failed" } : m)));
    }
  };

  const queue = (draft: { content: string; attachment?: Attachment | null; file?: File; replyToId?: string | null; forwarded?: boolean }) => {
    const temp: ChatMessage = {
      id: `local-${crypto.randomUUID()}`, conversationId: chatId, senderId: me, content: draft.content, createdAt: new Date().toISOString(),
      isDeleted: false, replyToId: draft.replyToId ?? null, forwarded: !!draft.forwarded, editedAt: null, attachment: draft.attachment ?? null, expiresAt: null, status: "sending",
    };
    if (draft.file) files.current.set(temp.id, draft.file);
    stick.current = true;
    setMessages((prev) => [...prev, temp]);
    deliver(temp);
  };

  const takeReply = () => { const r = replyTo?.id ?? null; setReplyTo(null); return r; };

  const sendFiles = async (list: File[], caption: string) => {
    const replyId = takeReply();
    for (const [i, f] of list.entries()) {
      if (f.size > MAX_UPLOAD) { toast.error(`${f.name} is too big (max 100 MB)`); continue; }
      const dims = await mediaInfo(f);
      const url = URL.createObjectURL(f);
      const attachment: Attachment = f.type.startsWith("video/") ? { type: "video", url, ...dims } : { type: "image", url, w: dims.w, h: dims.h };
      queue({ content: i === 0 ? caption : "", attachment, file: f, replyToId: i === 0 ? replyId : null });
    }
  };
  const sendDocument = (f: File) => {
    if (f.size > MAX_UPLOAD) { toast.error("That file is too big (max 100 MB)"); return; }
    queue({ content: "", attachment: { type: "file", url: URL.createObjectURL(f), name: f.name, size: f.size, mime: f.type }, file: f, replyToId: takeReply() });
  };
  const sendVoice = (blob: Blob, seconds: number) => {
    const ext = blob.type.includes("webm") ? "webm" : blob.type.includes("ogg") ? "ogg" : "m4a";
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || "audio/mp4" });
    queue({ content: "", attachment: { type: "audio", url: URL.createObjectURL(file), duration: Math.round(seconds), voice: true }, file, replyToId: takeReply() });
  };
  const askLocation = () => {
    if (!navigator.geolocation) { toast.error("Location isn't available on this device"); return; }
    const t = toast.loading("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => { toast.dismiss(t); setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { toast.dismiss(t); toast.error("Allow location access to share where you are"); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const forwardTo = async (chatIds: string[], msgs: ChatMessage[]) => {
    const ordered = [...msgs].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).filter((m) => !m.isDeleted && !m.status);
    for (const id of chatIds) {
      for (const m of ordered) {
        if (id === chatId) queue({ content: m.content, attachment: m.attachment, forwarded: true });
        else await sendChatMessage({ conversationId: id, senderId: me, content: m.content, attachment: m.attachment, forwarded: true }).catch(() => toast.error("Couldn't forward to one of the chats"));
      }
    }
    toast.success(chatIds.length === 1 ? "Forwarded" : `Forwarded to ${chatIds.length} chats`);
    setSelecting(null);
    queryClient.invalidateQueries({ queryKey: ["chats", me] });
  };

  // ── Message actions ──
  const patchExtras = (fn: (e: ChatExtras) => ChatExtras) => setExtras((e) => fn(e));
  const react = (m: ChatMessage, emoji: string | null) => {
    patchExtras((e) => {
      const reactions = new Map(e.reactions);
      const list = (reactions.get(m.id) ?? []).filter((r) => r.userId !== me);
      if (emoji) list.push({ userId: me, emoji });
      reactions.set(m.id, list);
      return { ...e, reactions };
    });
    setReaction(me, m, emoji).catch(() => { toast.error("Couldn't react"); loadExtras(); });
  };
  const star = (list: ChatMessage[], on: boolean) => {
    patchExtras((e) => { const s = new Set(e.starred); list.forEach((m) => (on ? s.add(m.id) : s.delete(m.id))); return { ...e, starred: s }; });
    Promise.all(list.map((m) => setStarred(me, m, on))).catch(() => { toast.error("Couldn't update starred messages"); loadExtras(); });
  };
  const pin = async (m: ChatMessage, on: boolean) => {
    try {
      if (on && extras.pins.length >= 3) await setPinned(me, { id: extras.pins[extras.pins.length - 1].messageId, conversationId: chatId }, false);
      await setPinned(me, m, on);
      toast(on ? "Message pinned" : "Message unpinned");
      loadExtras();
    } catch { toast.error("Couldn't pin that message"); }
  };
  const hideForMe = (list: ChatMessage[]) => {
    const real = list.filter((m) => !m.status);
    setMessages((prev) => prev.filter((m) => !(m.status && list.some((x) => x.id === m.id))));
    patchExtras((e) => { const h = new Set(e.hidden); real.forEach((m) => h.add(m.id)); return { ...e, hidden: h }; });
    Promise.all(real.map((m) => deleteForMe(me, m))).catch(() => { toast.error("Couldn't delete"); loadExtras(); });
  };
  const deleteAll = (list: ChatMessage[]) => {
    setMessages((prev) => prev.map((m) => (list.some((x) => x.id === m.id) ? { ...m, isDeleted: true, content: "", attachment: null } : m)));
    Promise.all(list.map((m) => deleteForEveryone(m.id, m.senderId !== me))).catch(() => { toast.error("Couldn't delete for everyone"); loadMessages(meMember?.clearedAt ?? null); });
  };
  const canDeleteForAll = (m: ChatMessage) => !m.isDeleted && !m.status && ((m.senderId === me && Date.now() - new Date(m.createdAt).getTime() < DELETE_ALL_WINDOW_MS) || (!!isGroup && isAdmin));
  const canEdit = (m: ChatMessage) => m.senderId === me && !m.isDeleted && !m.status && Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS
    && (!m.attachment || m.attachment.type === "image" || m.attachment.type === "video") && (!!m.content || !m.attachment);

  const onAction = (m: ChatMessage, a: MenuAction) => {
    switch (a) {
      case "reply": setEditing(null); setReplyTo(m); break;
      case "forward": setForwardMsgs([m]); break;
      case "copy": navigator.clipboard?.writeText(m.content).catch(() => toast.error("Couldn't copy")); break;
      case "star": star([m], !extras.starred.has(m.id)); break;
      case "pin": pin(m, !extras.pins.some((p) => p.messageId === m.id)); break;
      case "edit": setReplyTo(null); setEditing(m); break;
      case "info": setInfoMsg(m); break;
      case "select": setSelecting(new Set([m.id])); break;
      case "report": setReportTarget({ type: "message", id: m.id, owner: m.senderId, snapshot: `${members.find((x) => x.userId === m.senderId)?.name ?? "?"}: ${m.content ?? ""}${m.attachment && "url" in m.attachment ? `\n${m.attachment.url}` : ""}` }); break;
      case "deleteMe": hideForMe([m]); break;
      case "deleteAll": deleteAll([m]); break;
    }
  };

  const saveEdit = (text: string) => {
    const m = editing;
    setEditing(null);
    if (!m || text === m.content) return;
    const at = new Date().toISOString();
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, content: text, editedAt: at } : x)));
    editChatMessage(m.id, text).catch(() => { toast.error("Couldn't edit that message"); loadMessages(meMember?.clearedAt ?? null); });
  };

  // ── Chat settings ──
  const setMyChat = (patch: Parameters<typeof updateMyChat>[2], after?: () => void) => {
    updateMyChat(chatId, me, patch).then(() => { queryClient.invalidateQueries({ queryKey: ["chats", me] }); after?.(); }, () => toast.error("Couldn't save that"));
  };
  const mute = (ms: number | null) => {
    const until = ms ? new Date(Date.now() + ms).toISOString() : null;
    setMembers((prev) => prev.map((m) => (m.userId === me ? { ...m, mutedUntil: until } : m)));
    setMyChat({ muted_until: until });
    toast(ms ? "Notifications muted" : "Notifications on");
  };
  const clearChat = () => setConfirm({
    title: `Clear this chat?`, body: "Messages will be removed from this chat on your phone only.", label: "Clear chat",
    run: () => {
      const now = new Date().toISOString();
      setMembers((prev) => prev.map((m) => (m.userId === me ? { ...m, clearedAt: now } : m)));
      setMyChat({ cleared_at: now });
    },
  });
  const deleteChat = () => setConfirm({
    title: `Delete this chat?`, body: "It disappears from your chat list (and its messages are cleared for you). It comes back if someone sends something new.", label: "Delete chat",
    run: () => { const now = new Date().toISOString(); setMyChat({ hidden_at: now, cleared_at: now, archived: false, pinned_at: null }, onBack); },
  });
  const exitGroup = () => setConfirm({
    title: `Exit "${title}"?`, body: "You'll stop getting its messages. An admin can add you back.", label: "Exit group",
    run: () => removeMember(chatId, me).then(() => { toast("You left the group"); queryClient.invalidateQueries({ queryKey: ["chats", me] }); onBack(); }, () => toast.error("Couldn't leave the group")),
  });
  const toggleBlock = (on: boolean) => {
    if (!other) return;
    const run = () => setBlocked(me, other.userId, on).then(() => {
      setBlockedIds((s) => { const n = new Set(s); if (on) n.add(other.userId); else n.delete(other.userId); return n; });
      toast(on ? `${other.name} is blocked` : `${other.name} is unblocked`);
    }, () => toast.error("Couldn't update"));
    if (on) setConfirm({ title: `Block ${other.name}?`, body: "Blocked people can't message or call you here, and you can't message them.", label: "Block", run });
    else run();
  };
  const changeChat = (patch: Parameters<typeof updateChat>[1], ok?: string) =>
    updateChat(chatId, patch).then(() => { loadInfo(); queryClient.invalidateQueries({ queryKey: ["chats", me] }); if (ok) toast(ok); }, (e: Error) => toast.error(e?.message?.includes("admin") ? "Only group admins can change this" : "Couldn't save that"));

  const call = (video: boolean) => {
    if (blocked) { toast("Unblock them to call"); return; }
    if (isGroup) startGroupCall(chatId, title, members.map((m) => m.userId), video);
    else if (other) startCall(other.userId, other.name, other.avatar, video);
  };

  // ── Header status line ──
  const typers = Object.entries(typingNow);
  const status = (() => {
    if (typers.length) {
      const [, t] = typers[0];
      const what = t.kind === "recording" ? "recording audio…" : "typing…";
      if (!isGroup) return { text: what, accent: true };
      return { text: typers.length > 1 ? `${typers.length} people are typing…` : `${t.name.split(" ")[0]} is ${what}`, accent: true };
    }
    if (isGroup) {
      const names = members.filter((m) => m.userId !== me).map((m) => m.name.split(" ")[0]);
      return { text: [...names, "You"].join(", "), accent: false };
    }
    if (!other) return { text: "", accent: false };
    if (blocked) return { text: "", accent: false };
    if (onlineUsers.has(other.userId)) return { text: "online", accent: true };
    return { text: lastSeenLabel(other.lastSeen), accent: false };
  })();

  const pins = extras.pins.filter((p) => byId.has(p.messageId) && !byId.get(p.messageId)!.isDeleted && !extras.hidden.has(p.messageId));
  const pinned = pins.length ? pins[pinIdx % pins.length] : null;
  const pinnedMsg = pinned ? byId.get(pinned.messageId) ?? null : null;

  const disabled = notMember
    ? { text: isGroup ? "You're no longer in this group." : "This chat isn't available." }
    : blocked
      ? { text: `You blocked ${other?.name}.`, action: { label: "Unblock", run: () => toggleBlock(false) } }
      : isGroup && info?.onlyAdminsSend && !isAdmin
        ? { text: "Only admins can send messages." }
        : null;

  const selectedMsgs = selecting ? visible.filter((m) => selecting.has(m.id)) : [];
  const senderName = (id: string) => (id === me ? "You" : memberMap.get(id)?.name || "Member");

  return (
    <div className="chat-window relative flex h-full min-h-0 flex-col bg-white text-neutral-900">
      {/* Header */}
      {selecting ? (
        <header className="chat-header flex shrink-0 items-center gap-1 border-b border-neutral-200/80 bg-neutral-50 px-2">
          <button type="button" aria-label="Cancel" onClick={() => setSelecting(null)} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100"><X className="h-6 w-6" /></button>
          <span className="flex-1 text-[17px] font-semibold">{selecting.size}</span>
          <button type="button" aria-label="Star" disabled={!selectedMsgs.length} onClick={() => { star(selectedMsgs, !selectedMsgs.every((m) => extras.starred.has(m.id))); setSelecting(null); }} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100 disabled:opacity-40"><Star className="h-5 w-5" /></button>
          <button type="button" aria-label="Copy" disabled={!selectedMsgs.some((m) => m.content)} onClick={() => { navigator.clipboard?.writeText(selectedMsgs.filter((m) => m.content).map((m) => m.content).join("\n")).catch(() => {}); setSelecting(null); }} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100 disabled:opacity-40"><Copy className="h-5 w-5" /></button>
          <button type="button" aria-label="Delete" disabled={!selectedMsgs.length} onClick={() => setSelDelete(true)} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100 disabled:opacity-40"><Trash2 className="h-5 w-5" /></button>
          <button type="button" aria-label="Forward" disabled={!selectedMsgs.some((m) => !m.isDeleted)} onClick={() => setForwardMsgs(selectedMsgs)} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100 disabled:opacity-40"><Forward className="h-5 w-5" /></button>
        </header>
      ) : search ? (
        <header className="chat-header flex shrink-0 items-center gap-1 border-b border-neutral-200/80 bg-white px-2">
          <button type="button" aria-label="Close search" onClick={() => setSearch(null)} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100"><ArrowLeft className="h-6 w-6" /></button>
          <input autoFocus value={search.q} onChange={(e) => setSearch({ q: e.target.value, idx: 0 })} placeholder="Search…" className="h-10 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-neutral-400" />
          {search.q && <span className="shrink-0 text-[13px] tabular-nums text-neutral-500">{matches.length ? `${Math.min(search.idx, matches.length - 1) + 1} of ${matches.length}` : "0"}</span>}
          <button type="button" aria-label="Older" disabled={search.idx >= matches.length - 1} onClick={() => setSearch((s) => s && { ...s, idx: s.idx + 1 })} className="flex h-10 w-9 items-center justify-center disabled:opacity-30"><ChevronUp className="h-5 w-5" /></button>
          <button type="button" aria-label="Newer" disabled={search.idx <= 0} onClick={() => setSearch((s) => s && { ...s, idx: s.idx - 1 })} className="flex h-10 w-9 items-center justify-center disabled:opacity-30"><ChevronDown className="h-5 w-5" /></button>
        </header>
      ) : (
        <header className="chat-header flex shrink-0 items-center gap-1 border-b border-neutral-200/80 bg-white/95 px-1.5 backdrop-blur-xl">
          <button type="button" onClick={onBack} aria-label="Back" className="flex h-10 w-9 items-center justify-center rounded-full active:bg-neutral-100 md:hidden"><ArrowLeft className="h-6 w-6" /></button>
          <button type="button" onClick={() => setShowInfo(true)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1 pl-0.5 text-left md:pl-3">
            <span className="relative shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarImage src={avatar || ""} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-700 text-[15px] font-bold text-white">{isGroup ? <Users className="h-5 w-5" /> : title?.[0]?.toUpperCase() || ""}</AvatarFallback>
              </Avatar>
              {!isGroup && other && onlineUsers.has(other.userId) && !blocked && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[16.5px] font-semibold leading-tight">{title}</span>
              {status.text && <span className={cn("block truncate text-[12.5px] leading-tight", status.accent ? "text-emerald-600" : "text-neutral-500")}>{status.text}</span>}
            </span>
          </button>
          <div className="flex shrink-0 items-center">
            <button type="button" aria-label={isGroup ? "Group video call" : "Video call"} onClick={() => call(true)} disabled={notMember} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100 disabled:opacity-40"><Video className="h-[23px] w-[23px]" /></button>
            <button type="button" aria-label={isGroup ? "Group voice call" : "Voice call"} onClick={() => call(false)} disabled={notMember} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100 disabled:opacity-40"><Phone className="h-[21px] w-[21px]" /></button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="More" className="flex h-10 w-9 items-center justify-center rounded-full active:bg-neutral-100"><MoreVertical className="h-5 w-5" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[80] w-56 rounded-2xl border-neutral-200 bg-white p-1 text-neutral-900 shadow-xl">
                {[
                  { label: isGroup ? "Group info" : "Contact info", run: () => setShowInfo(true) },
                  { label: "Search", run: () => setSearch({ q: "", idx: 0 }) },
                  { label: "Media, links and docs", run: () => setShowInfo(true) },
                  { label: "Starred messages", run: () => setShowInfo(true) },
                  { label: meMember && meMember.mutedUntil && new Date(meMember.mutedUntil) > new Date() ? "Unmute notifications" : "Mute notifications", run: () => (meMember?.mutedUntil && new Date(meMember.mutedUntil) > new Date() ? mute(null) : mute(8 * 3600e3)) },
                  { label: "Disappearing messages", run: () => setShowInfo(true) },
                  { label: "Select messages", run: () => setSelecting(new Set()) },
                ].map((i) => <DropdownMenuItem key={i.label} onClick={i.run} className="rounded-xl py-2.5 text-[15px] focus:bg-neutral-100">{i.label}</DropdownMenuItem>)}
                <DropdownMenuSeparator className="bg-neutral-200" />
                <DropdownMenuItem onClick={clearChat} className="rounded-xl py-2.5 text-[15px] text-red-600 focus:bg-red-500/10">Clear chat</DropdownMenuItem>
                {isGroup
                  ? <DropdownMenuItem onClick={exitGroup} className="rounded-xl py-2.5 text-[15px] text-red-600 focus:bg-red-500/10">Exit group</DropdownMenuItem>
                  : other && <DropdownMenuItem onClick={() => toggleBlock(!blocked)} className="rounded-xl py-2.5 text-[15px] text-red-600 focus:bg-red-500/10">{blocked ? "Unblock" : "Block"}</DropdownMenuItem>}
                <DropdownMenuItem onClick={deleteChat} className="rounded-xl py-2.5 text-[15px] text-red-600 focus:bg-red-500/10">Delete chat</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      )}

      {/* Pinned message */}
      {pinnedMsg && !selecting && !search && (
        <button type="button" onClick={() => { jumpTo(pinnedMsg.id); setPinIdx((i) => i + 1); }} className="flex shrink-0 items-center gap-2.5 border-b border-neutral-200/80 bg-neutral-50 px-3 py-2 text-left">
          <span className="flex flex-col gap-0.5">{pins.map((p, i) => <span key={p.messageId} className={cn("h-2.5 w-[3px] rounded-full", i === pinIdx % pins.length ? "bg-amber-500" : "bg-neutral-300")} />)}</span>
          <Pin className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-semibold text-amber-600">Pinned message{pins.length > 1 ? ` ${(pinIdx % pins.length) + 1} of ${pins.length}` : ""}</span>
            <span className="block truncate text-[13.5px] text-neutral-700">{messageSummary(pinnedMsg)}</span>
          </span>
        </button>
      )}

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={onScroll} className="relative h-full overflow-y-auto overflow-x-hidden overscroll-contain px-3 md:px-6">
        <div ref={contentRef} className="flex min-h-full flex-col justify-end pb-3 pt-2">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className={cn("h-10 animate-pulse rounded-[18px] bg-neutral-100", i % 2 ? "w-44 self-start" : "w-32 self-end")} />)}
            </div>
          ) : (
            <>
              {info?.disappearSeconds ? (
                <p className="mx-auto my-2 flex max-w-[85%] items-center gap-1.5 rounded-xl bg-neutral-100 px-3 py-1.5 text-center text-[12.5px] text-neutral-600">
                  <Timer className="h-3.5 w-3.5 shrink-0" /> Disappearing messages are on. New messages disappear after {disappearLabel(info.disappearSeconds).toLowerCase()}.
                </p>
              ) : null}
              {visible.length === 0 && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatar || ""} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-700 text-2xl font-bold text-white">{isGroup ? <Users className="h-8 w-8" /> : title?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <p className="text-[17px] font-semibold">{title}</p>
                  <p className="text-[14px] text-neutral-500">Say hello 👋</p>
                </div>
              )}
              {dayGroups.map((group) => (
                // Each day is its own block, so only the day being read floats its date at the top.
                <div key={group.key}>
                <div className="sticky top-1 z-[5] my-2 flex justify-center">
                  <span className="rounded-lg bg-neutral-100 px-2.5 py-1 text-[12px] font-medium text-neutral-500 shadow-sm ring-1 ring-black/[0.03]">{dayChipLabel(group.first)}</span>
                </div>
                {group.items.map(({ msg, idx }) => {
                const prev = visible[idx - 1];
                const next = visible[idx + 1];
                const newDay = !prev || !sameDay(prev.createdAt, msg.createdAt);
                const t = new Date(msg.createdAt).getTime();
                const joinsPrev = !newDay && !!prev && prev.senderId === msg.senderId && t - new Date(prev.createdAt).getTime() < GROUP_GAP_MS && unreadAnchor?.id !== msg.id;
                const joinsNext = !!next && sameDay(next.createdAt, msg.createdAt) && next.senderId === msg.senderId && new Date(next.createdAt).getTime() - t < GROUP_GAP_MS && unreadAnchor?.id !== next.id;
                const reply = msg.replyToId ? byId.get(msg.replyToId) ?? null : null;
                return (
                  <Fragment key={msg.id}>
                    {unreadAnchor?.id === msg.id && (
                      <div data-unread-divider className="my-2 -mx-3 bg-amber-50 py-1.5 text-center text-[12.5px] font-semibold uppercase tracking-wide text-amber-700">
                        {unreadAnchor.count} unread message{unreadAnchor.count === 1 ? "" : "s"}
                      </div>
                    )}
                    <MessageBubble
                      msg={msg}
                      mine={msg.senderId === me}
                      isGroup={!!isGroup}
                      sender={memberMap.get(msg.senderId)}
                      meId={me}
                      showName={!joinsPrev}
                      joinsPrev={joinsPrev}
                      joinsNext={joinsNext}
                      replyTo={msg.replyToId ? { msg: reply, senderName: reply ? senderName(reply.senderId) : "" } : null}
                      reactions={extras.reactions.get(msg.id)}
                      starred={extras.starred.has(msg.id)}
                      pinned={extras.pins.some((p) => p.messageId === msg.id)}
                      delivery={delivery(msg)}
                      highlight={search?.q}
                      flash={flashId === msg.id}
                      selecting={!!selecting}
                      selected={!!selecting?.has(msg.id)}
                      members={memberMap}
                      votes={extras.votes.get(msg.id)}
                      onReply={(m) => { setEditing(null); setReplyTo(m); }}
                      onMenu={(m, rect) => setMenu({ msg: m, rect })}
                      onToggleSelect={(m) => setSelecting((s) => { const n = new Set(s ?? []); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })}
                      onJumpTo={jumpTo}
                      onOpenMedia={setMediaMsg}
                      onReactions={setReactionsMsg}
                      onVote={(m, options) => {
                        patchExtras((e) => { const votes = new Map(e.votes); const v = new Map(votes.get(m.id) ?? []); v.set(me, options); votes.set(m.id, v); return { ...e, votes }; });
                        setVote(me, m, options).catch(() => { toast.error("Couldn't vote"); loadExtras(); });
                      }}
                      onViewVotes={setVotesMsg}
                      onRetry={deliver}
                      onOpenContact={(userId, username, action) => {
                        if (action === "view") navigate(`/profile/${username}`);
                        else openDirectChat(userId).then(onOpenChat, () => toast.error("Couldn't open that chat"));
                      }}
                    />
                  </Fragment>
                );
                })}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Back to the newest message */}
      {!atBottom && !loading && (
        <button type="button" aria-label="Scroll to newest" onClick={toBottom} className="absolute bottom-3 right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-800 shadow-xl ring-1 ring-black/5 active:scale-95">
          <ChevronDown className="h-6 w-6" />
          {newBelow > 0 && <span className="absolute -right-1 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-[#1a1204]">{newBelow}</span>}
        </button>
      )}
      </div>

      {!selecting && (
        <Composer
          draftKey={chatId}
          disabled={disabled}
          replyTo={replyTo ? { msg: replyTo, senderName: senderName(replyTo.senderId) } : null}
          editing={editing}
          mentionables={isGroup ? members.filter((m) => m.userId !== me).map((m) => ({ username: m.username, name: m.name, avatar: m.avatar })) : null}
          onCancelReply={() => setReplyTo(null)}
          onCancelEdit={() => setEditing(null)}
          onSendText={(text) => queue({ content: text, replyToId: takeReply(), attachment: null })}
          onSaveEdit={saveEdit}
          onSendFiles={sendFiles}
          onSendDocument={sendDocument}
          onSendVoice={sendVoice}
          onLocation={askLocation}
          onContact={() => setContactOpen(true)}
          onPoll={() => setPollOpen(true)}
          onTyping={sendTyping}
        />
      )}

      {/* Overlays */}
      {menu && (
        <MessageMenu
          msg={menu.msg}
          rect={menu.rect}
          mine={menu.msg.senderId === me}
          starred={extras.starred.has(menu.msg.id)}
          pinned={extras.pins.some((p) => p.messageId === menu.msg.id)}
          myReaction={extras.reactions.get(menu.msg.id)?.find((r) => r.userId === me)?.emoji ?? null}
          canEdit={canEdit(menu.msg)}
          canDeleteForAll={canDeleteForAll(menu.msg)}
          canPin={!disabled}
          onReact={(e) => react(menu.msg, e)}
          onAction={(a) => onAction(menu.msg, a)}
          onClose={() => setMenu(null)}
        />
      )}

      {showInfo && info && (
        <ChatInfoPanel
          info={info}
          members={members}
          meId={me}
          online={(id) => onlineUsers.has(id)}
          messages={visible}
          starred={extras.starred}
          isAdmin={!!isAdmin}
          canEditInfo={canEditInfo}
          blocked={blocked}
          mutedUntil={meMember?.mutedUntil ?? null}
          onClose={() => setShowInfo(false)}
          onCall={call}
          onSearch={() => setSearch({ q: "", idx: 0 })}
          onJumpTo={(id) => setTimeout(() => jumpTo(id), 50)}
          onOpenMedia={setMediaMsg}
          onMute={mute}
          onDisappear={(s) => changeChat({ disappear_seconds: s }, s ? `New messages will disappear after ${disappearLabel(s).toLowerCase()}` : "Disappearing messages are off")}
          onBlock={toggleBlock}
          onReport={other ? () => setReportTarget({ type: "user", id: other.userId, owner: other.userId, snapshot: `Reported from a chat with ${other.name}` }) : undefined}
          onClear={clearChat}
          onDeleteChat={deleteChat}
          onExit={exitGroup}
          onRename={(name) => changeChat({ name }, "Group name changed")}
          onDescribe={(description) => changeChat({ description: description || null }, "Description saved")}
          onPhoto={(f) => { const t = toast.loading("Updating group photo…"); uploadChatFile(f, f.name).then((url) => changeChat({ avatar_url: url })).finally(() => toast.dismiss(t)); }}
          onSetting={(key, on) => changeChat({ [key]: on })}
          onAddMembers={() => setAddOpen(true)}
          onMemberAction={(m, action) => {
            if (action === "message") openDirectChat(m.userId).then((id) => { setShowInfo(false); onOpenChat(id); }, () => toast.error("Couldn't open that chat"));
            else if (action === "remove") setConfirm({ title: `Remove ${m.name} from "${title}"?`, label: "Remove", run: () => removeMember(chatId, m.userId).then(() => { loadMembers(); toast(`${m.name} was removed`); }, () => toast.error("Couldn't remove them")) });
            else setMemberRole(chatId, m.userId, action === "admin" ? "admin" : "member").then(() => { loadMembers(); toast(action === "admin" ? `${m.name} is now an admin` : `${m.name} is no longer an admin`); }, () => toast.error("Couldn't change that"));
          }}
        />
      )}

      <ForwardSheet open={!!forwardMsgs} messages={forwardMsgs ?? []} onClose={() => setForwardMsgs(null)} onForward={(ids) => forwardTo(ids, forwardMsgs ?? [])} />
      <MessageInfoSheet open={!!infoMsg} msg={infoMsg} members={members} meId={me} onClose={() => setInfoMsg(null)} />
      <ReactionsSheet open={!!reactionsMsg} reactions={reactionsMsg ? extras.reactions.get(reactionsMsg.id) ?? [] : []} members={memberMap} meId={me} onRemoveMine={() => reactionsMsg && react(reactionsMsg, null)} onClose={() => setReactionsMsg(null)} />
      <PollVotesSheet open={!!votesMsg} poll={votesMsg?.attachment?.type === "poll" ? votesMsg.attachment : null} votes={votesMsg ? extras.votes.get(votesMsg.id) : undefined} members={memberMap} onClose={() => setVotesMsg(null)} />
      <MediaViewer msg={mediaMsg} senderName={mediaMsg ? senderName(mediaMsg.senderId) : ""} onClose={() => setMediaMsg(null)} onForward={() => { if (mediaMsg) { setForwardMsgs([mediaMsg]); setMediaMsg(null); } }} />
      <PollCreator open={pollOpen} onClose={() => setPollOpen(false)} onSend={(poll) => queue({ content: "", attachment: { type: "poll", ...poll }, replyToId: takeReply() })} />
      <PeoplePicker open={contactOpen} title="Share contact" meId={me} onClose={() => setContactOpen(false)}
        onDone={([p]) => p && queue({ content: "", attachment: { type: "contact", userId: p.id, name: p.name, username: p.username, avatar: p.avatar }, replyToId: takeReply() })} />
      <PeoplePicker open={addOpen} title="Add members" meId={me} multiple exclude={new Set(members.map((m) => m.userId))} actionLabel="Add" onClose={() => setAddOpen(false)}
        onDone={(people) => addMembers(chatId, people.map((p) => p.id)).then(() => { loadMembers(); toast(`Added ${people.map((p) => p.name).join(", ")}`); }, () => toast.error("Only group admins can add people"))} />

      <Sheet open={!!location} onClose={() => setLocation(null)} title="Send location">
        {location && (
          <div className="flex flex-col items-center gap-3 px-4 pb-2">
            <LocationAttachment a={{ type: "location", lat: location.lat, lng: location.lng, label: "Current location" }} />
            <button type="button" onClick={() => { queue({ content: "", attachment: { type: "location", lat: location.lat, lng: location.lng, label: "Current location" }, replyToId: takeReply() }); setLocation(null); }}
              className="h-12 w-full rounded-full bg-amber-400 text-[16px] font-bold text-[#1a1204]">Send your current location</button>
          </div>
        )}
      </Sheet>

      <Sheet open={selDelete} onClose={() => setSelDelete(false)} title={`Delete ${selectedMsgs.length} message${selectedMsgs.length === 1 ? "" : "s"}?`}>
        <div className="px-2 pb-2">
          {selectedMsgs.length > 0 && selectedMsgs.every(canDeleteForAll) && (
            <button type="button" onClick={() => { deleteAll(selectedMsgs); setSelDelete(false); setSelecting(null); }} className="block w-full rounded-xl px-3 py-3.5 text-left text-[16px] text-red-600 active:bg-neutral-100">Delete for everyone</button>
          )}
          <button type="button" onClick={() => { hideForMe(selectedMsgs); setSelDelete(false); setSelecting(null); }} className="block w-full rounded-xl px-3 py-3.5 text-left text-[16px] text-red-600 active:bg-neutral-100">Delete for me</button>
          <button type="button" onClick={() => setSelDelete(false)} className="block w-full rounded-xl px-3 py-3.5 text-left text-[16px] active:bg-neutral-100">Cancel</button>
        </div>
      </Sheet>

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title || ""}>
        {confirm && (
          <div className="px-4 pb-2">
            {confirm.body && <p className="pb-3 text-center text-[14px] text-neutral-500">{confirm.body}</p>}
            <button type="button" onClick={() => { confirm.run(); setConfirm(null); }} className="h-12 w-full rounded-full bg-red-500 text-[16px] font-bold text-white">{confirm.label}</button>
            <button type="button" onClick={() => setConfirm(null)} className="mt-2 h-12 w-full rounded-full bg-neutral-100 text-[16px] font-semibold">Cancel</button>
          </div>
        )}
      </Sheet>
      {reportTarget && (
        <ReportSheet target={reportTarget} open={!!reportTarget} onOpenChange={(o) => { if (!o) setReportTarget(null); }} />
      )}
    </div>
  );
};
