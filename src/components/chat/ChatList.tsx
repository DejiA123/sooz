import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowLeft, Ban, Bell, BellOff, CheckCheck, Heart, HeartOff, LogOut, MailOpen, MessageCircle, MoreHorizontal, MoreVertical, Pin, PinOff, Plus, Search, Star, Trash2, Users, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/usePresence";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { shortChatTime } from "@/lib/chat";
import { useTypingIn } from "@/lib/chatTyping";
import {
  fetchAllStarred, fetchChatList, isChatVisible, isMuted, lastDelivery, markChatRead, markChatsDelivered, messageSummary, openDirectChat,
  removeMember, searchMyMessages, setBlocked, updateMyChat, type ChatSummary, type MyChatSettings,
} from "@/services/api/chat";
import { CreateGroupModal } from "./CreateGroupModal";
import { Ticks } from "./MessageBubble";
import { chatDraft } from "./Composer";
import { PeoplePicker, Sheet } from "./ChatSheets";
import { MUTE_OPTIONS } from "./ChatInfoPanel";

interface ChatListProps {
  selectedId?: string;
  onSelect: (id: string, messageId?: string) => void;
}

type Filter = "all" | "unread" | "favourites" | "groups";
const ACTION_W = 80; // each swipe button

const sortChats = (list: ChatSummary[]) => [...list].sort((a, b) => {
  if (!!a.pinnedAt !== !!b.pinnedAt) return a.pinnedAt ? -1 : 1;
  if (a.pinnedAt && b.pinnedAt) return b.pinnedAt.localeCompare(a.pinnedAt);
  return b.activity.localeCompare(a.activity);
});

/** One chat in the list: swipe right for Unread / Pin, swipe left for More / Archive, long-press for everything. */
const ChatRow = ({ chat, me, selected, online, typing, isOpen, onOpenSwipe, onSelect, onMenu, onPatch, onMarkRead }: {
  chat: ChatSummary;
  me: string;
  selected: boolean;
  online: boolean;
  typing: string | null;
  isOpen: boolean;
  onOpenSwipe: (id: string | null) => void;
  onSelect: () => void;
  onMenu: () => void;
  onPatch: (patch: MyChatSettings) => void;
  onMarkRead: () => void;
}) => {
  const [x, setX] = useState(0);
  const g = useRef<{ sx: number; sy: number; base: number; dir: "none" | "h" | "v"; timer: number; long: boolean } | null>(null);
  const longFired = useRef(false); // a long-press opened the menu: the finger lifting isn't a tap
  useEffect(() => { if (!isOpen) setX(0); }, [isOpen]);

  const unread = chat.unread > 0 || chat.markedUnread;
  const draft = chatDraft(chat.id);
  const mine = chat.last?.senderId === me;

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    longFired.current = false;
    const timer = window.setTimeout(() => { if (g.current && g.current.dir === "none") { g.current.long = true; longFired.current = true; navigator.vibrate?.(12); onMenu(); } }, 500);
    g.current = { sx: e.clientX, sy: e.clientY, base: x, dir: "none", timer, long: false };
  };
  const move = (e: React.PointerEvent) => {
    const s = g.current;
    if (!s) return;
    const dx = e.clientX - s.sx, dy = e.clientY - s.sy;
    if (s.dir === "none" && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) { s.dir = Math.abs(dx) > Math.abs(dy) ? "h" : "v"; clearTimeout(s.timer); if (s.dir === "h") onOpenSwipe(chat.id); }
    if (s.dir === "h") setX(Math.max(-3.4 * ACTION_W, Math.min(2 * ACTION_W, s.base + dx)));
  };
  const up = () => {
    const s = g.current;
    g.current = null;
    if (!s) return;
    clearTimeout(s.timer);
    if (s.dir !== "h") return;
    if (x < -2.8 * ACTION_W) { setX(0); onPatch({ archived: !chat.archived }); toast(chat.archived ? "Chat unarchived" : "Chat archived"); return; }
    if (x < -ACTION_W) setX(-2 * ACTION_W);
    else if (x > ACTION_W) setX(2 * ACTION_W);
    else { setX(0); onOpenSwipe(null); }
  };
  const click = () => {
    if (longFired.current) { longFired.current = false; return; }
    if (x !== 0) { setX(0); onOpenSwipe(null); return; }
    onSelect();
  };
  const act = (fn: () => void) => () => { setX(0); onOpenSwipe(null); fn(); };

  const preview = (() => {
    if (typing) return <span className="text-amber-300">{typing}</span>;
    if (draft && !selected) return <><span className="text-red-400">Draft: </span>{draft}</>;
    if (!chat.last) return chat.isGroup ? "Group created" : "Say hello 👋";
    const who = chat.isGroup && !chat.last.isDeleted ? (mine ? "You: " : chat.last.senderName ? `${chat.last.senderName.split(" ")[0]}: ` : "") : "";
    return (
      <>
        {mine && !chat.last.isDeleted && <Ticks state={lastDelivery(chat)} className="mr-1 inline -mt-0.5 text-white/45" />}
        {who}{chat.last.isDeleted ? <span className="italic">{mine ? "You deleted this message" : "This message was deleted"}</span> : messageSummary(chat.last)}
      </>
    );
  })();

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Swipe right: Unread / Pin */}
      {x > 0 && <div className="absolute inset-y-0 left-0 flex" style={{ width: 2 * ACTION_W }}>
        <button type="button" onClick={act(() => (unread ? onMarkRead() : onPatch({ marked_unread: true })))} className="flex w-20 flex-col items-center justify-center gap-1 bg-sky-600 text-[12px] font-semibold text-white">
          {unread ? <MailOpen className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}{unread ? "Read" : "Unread"}
        </button>
        <button type="button" onClick={act(() => onPatch({ pinned_at: chat.pinnedAt ? null : new Date().toISOString() }))} className="flex w-20 flex-col items-center justify-center gap-1 bg-[#3b3f48] text-[12px] font-semibold text-white">
          {chat.pinnedAt ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />}{chat.pinnedAt ? "Unpin" : "Pin"}
        </button>
      </div>}
      {/* Swipe left: More / Archive */}
      {x < 0 && <div className="absolute inset-y-0 right-0 flex" style={{ width: Math.max(2 * ACTION_W, -x) }}>
        <button type="button" onClick={act(onMenu)} className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 bg-[#3b3f48] text-[12px] font-semibold text-white">
          <MoreHorizontal className="h-5 w-5" />More
        </button>
        <button type="button" onClick={act(() => { onPatch({ archived: !chat.archived }); toast(chat.archived ? "Chat unarchived" : "Chat archived"); })} className="flex min-w-20 flex-1 flex-col items-center justify-center gap-1 bg-amber-600 text-[12px] font-semibold text-white">
          {chat.archived ? <ArchiveRestore className="h-5 w-5" /> : <Archive className="h-5 w-5" />}{chat.archived ? "Unarchive" : "Archive"}
        </button>
      </div>}

      <button
        type="button"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onTouchEnd={(e) => { if (longFired.current) e.preventDefault(); }}
        onClick={click}
        onContextMenu={(e) => { e.preventDefault(); onMenu(); }}
        style={{ transform: `translateX(${x}px)`, transition: g.current?.dir === "h" ? "none" : "transform 0.22s ease", touchAction: "pan-y" }}
        className={cn("relative flex w-full select-none items-center gap-3 bg-[#05070b] px-2 py-2.5 text-left active:bg-[#0c0f15]", selected && "bg-[#11141a]")}
      >
        <span className="relative shrink-0">
          <Avatar className="h-14 w-14">
            <AvatarImage src={chat.avatar || ""} className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-700 text-[20px] font-bold text-white">{chat.isGroup ? <Users className="h-6 w-6" /> : chat.name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          {online && <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-[#05070b] bg-emerald-500" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate text-[16px] font-semibold text-white">{chat.name}</span>
              {chat.favourite && <Heart className="h-3.5 w-3.5 shrink-0 fill-rose-500 text-rose-500" />}
            </span>
            <span className={cn("shrink-0 text-[12.5px]", unread && !isMuted(chat.mutedUntil) ? "font-semibold text-amber-400" : "text-white/40")}>{chat.last ? shortChatTime(chat.last.createdAt) : ""}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={cn("min-w-0 flex-1 truncate text-[14px]", unread ? "text-white/80" : "text-white/55")}>{preview}</span>
            {isMuted(chat.mutedUntil) && <BellOff className="h-4 w-4 shrink-0 text-white/35" />}
            {chat.pinnedAt && <Pin className="h-4 w-4 shrink-0 rotate-45 text-white/35" />}
            {chat.unread > 0 ? (
              <span className={cn("flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11.5px] font-bold", isMuted(chat.mutedUntil) ? "bg-white/25 text-white" : "bg-amber-400 text-[#1a1204]")}>{chat.unread > 999 ? "999+" : chat.unread}</span>
            ) : chat.markedUnread ? <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-amber-400" /> : null}
          </span>
        </span>
      </button>
    </div>
  );
};

export const ChatList = ({ selectedId, onSelect }: ChatListProps) => {
  const { user, loading: authLoading } = useAuth();
  const me = user?.id ?? "";
  const { onlineUsers } = usePresence();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [archivedView, setArchivedView] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);
  const [menuChat, setMenuChat] = useState<ChatSummary | null>(null);
  const [muteChat, setMuteChat] = useState<ChatSummary | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body?: string; label: string; run: () => void } | null>(null);
  const [newChat, setNewChat] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  const [starredOpen, setStarredOpen] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebouncedQ(q), 300); return () => clearTimeout(t); }, [q]);

  const chatsQ = useQuery({ queryKey: ["chats", me], queryFn: fetchChatList, enabled: !!me, staleTime: 30_000 });
  const chats = useMemo(() => (chatsQ.data ?? []).filter(isChatVisible), [chatsQ.data]);

  // Live: new messages, ticks, settings — refresh the list (and tell senders their messages arrived).
  useEffect(() => {
    if (!me) return;
    let t = 0;
    const refresh = () => { clearTimeout(t); t = window.setTimeout(() => queryClient.invalidateQueries({ queryKey: ["chats", me] }), 300); };
    const channel = supabase
      .channel(`chat-list:${crypto.randomUUID().slice(0, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => { if ((p.new as { sender_id?: string }).sender_id !== me) markChatsDelivered(); refresh(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, refresh)
      .subscribe();
    markChatsDelivered();
    return () => { clearTimeout(t); supabase.removeChannel(channel); };
  }, [me, queryClient]);

  // "typing…" for the chats near the top
  const typingIds = useMemo(() => sortChats(chats).slice(0, 15).map((c) => c.id), [chats]);
  const typing = useTypingIn(typingIds, me);
  const typingLabel = (c: ChatSummary) => {
    const t = Object.values(typing[c.id] ?? {});
    if (!t.length) return null;
    const what = t[0].kind === "recording" ? "recording audio…" : "typing…";
    return c.isGroup ? `${t[0].name.split(" ")[0]} is ${what}` : what;
  };

  const patch = (c: ChatSummary, p: MyChatSettings) => {
    if (p.pinned_at && chats.filter((x) => x.pinnedAt && !x.archived).length >= 3) { toast("You can only pin up to 3 chats"); return; }
    queryClient.setQueryData<ChatSummary[]>(["chats", me], (old) => old?.map((x) => (x.id === c.id ? {
      ...x,
      ...(p.archived !== undefined && { archived: p.archived, pinnedAt: p.archived ? null : x.pinnedAt }),
      ...(p.pinned_at !== undefined && { pinnedAt: p.pinned_at }),
      ...(p.muted_until !== undefined && { mutedUntil: p.muted_until }),
      ...(p.marked_unread !== undefined && { markedUnread: p.marked_unread }),
      ...(p.favourite !== undefined && { favourite: p.favourite }),
      ...(p.hidden_at !== undefined && { hiddenAt: p.hidden_at }),
      ...(p.cleared_at !== undefined && { clearedAt: p.cleared_at, last: null, unread: 0 }),
    } : x)));
    const full = p.archived ? { ...p, pinned_at: null } : p;
    updateMyChat(c.id, me, full).catch(() => { toast.error("Couldn't save that"); queryClient.invalidateQueries({ queryKey: ["chats", me] }); });
  };
  const markRead = (c: ChatSummary) => {
    queryClient.setQueryData<ChatSummary[]>(["chats", me], (old) => old?.map((x) => (x.id === c.id ? { ...x, unread: 0, markedUnread: false } : x)));
    markChatRead(c.id, me);
  };
  const readAll = () => chats.filter((c) => c.unread > 0 || c.markedUnread).forEach(markRead);

  // What's listed
  const archived = chats.filter((c) => c.archived);
  const archivedUnread = archived.filter((c) => c.unread > 0 || c.markedUnread).length;
  const base = archivedView ? archived : chats.filter((c) => !c.archived);
  const needle = debouncedQ.trim().toLowerCase();
  const listed = sortChats(base.filter((c) => {
    if (needle && !c.name.toLowerCase().includes(needle) && !(c.otherUsername ?? "").toLowerCase().includes(needle)) return false;
    if (archivedView || needle) return true;
    if (filter === "unread") return c.unread > 0 || c.markedUnread;
    if (filter === "favourites") return c.favourite;
    if (filter === "groups") return c.isGroup;
    return true;
  }));
  const msgHits = useQuery({ queryKey: ["chat-search", needle], queryFn: () => searchMyMessages(needle), enabled: needle.length >= 2, staleTime: 15_000 });
  const chatName = (id: string) => chatsQ.data?.find((c) => c.id === id)?.name || "Chat";

  const starred = useQuery({ queryKey: ["starred-all", me], queryFn: () => fetchAllStarred(me), enabled: starredOpen && !!me });

  const loading = chatsQ.isLoading || authLoading;
  const chips: [Filter, string][] = [["all", "All"], ["unread", `Unread${chats.some((c) => !c.archived && (c.unread || c.markedUnread)) ? ` ${chats.filter((c) => !c.archived && (c.unread || c.markedUnread)).length}` : ""}`], ["favourites", "Favourites"], ["groups", "Groups"]];

  return (
    <div className="flex h-full flex-col bg-[#05070b] text-white" onClick={() => openSwipe && setOpenSwipe(null)}>
      <div className="shrink-0 space-y-3 px-4 pb-2 pt-3">
        {archivedView ? (
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Back" onClick={() => setArchivedView(false)} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10"><ArrowLeft className="h-6 w-6" /></button>
            <h1 className="text-[22px] font-bold">Archived</h1>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h1 className="text-[28px] font-bold leading-none tracking-tight">Messages</h1>
            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="More" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] active:bg-white/15"><MoreVertical className="h-5 w-5" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-2xl border-white/10 bg-[#14171d] p-1 text-white">
                  <DropdownMenuItem onClick={() => setNewGroup(true)} className="rounded-xl py-2.5 text-[15px] focus:bg-white/10"><Users className="mr-2 h-4 w-4" /> New group</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStarredOpen(true)} className="rounded-xl py-2.5 text-[15px] focus:bg-white/10"><Star className="mr-2 h-4 w-4" /> Starred messages</DropdownMenuItem>
                  <DropdownMenuItem onClick={readAll} className="rounded-xl py-2.5 text-[15px] focus:bg-white/10"><CheckCheck className="mr-2 h-4 w-4" /> Read all</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button type="button" aria-label="New chat" onClick={() => setNewChat(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-[#1a1204] active:scale-95">
                <Plus className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search"
            className="h-11 w-full rounded-full bg-white/[0.08] pl-11 pr-10 text-[16px] text-white outline-none placeholder:text-white/40 focus:ring-1 focus:ring-amber-400/40" />
          {q && <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white/50"><X className="h-4 w-4" /></button>}
        </div>

        {!archivedView && !needle && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {chips.map(([key, label]) => (
              <button key={key} type="button" onClick={() => setFilter(key)}
                className={cn("h-8 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-colors", filter === key ? "bg-amber-400 text-[#1a1204]" : "bg-white/[0.08] text-white/75 active:bg-white/15")}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
        {!archivedView && !needle && archived.length > 0 && (
          <button type="button" onClick={() => setArchivedView(true)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left active:bg-white/[0.05]">
            <span className="flex h-14 w-14 items-center justify-center"><Archive className="h-6 w-6 text-white/60" /></span>
            <span className="flex-1 text-[16px] font-semibold">Archived</span>
            {archivedUnread > 0 && <span className="pr-2 text-[13px] font-semibold text-amber-400">{archivedUnread}</span>}
          </button>
        )}
        {archivedView && <p className="px-3 pb-2 text-center text-[13px] text-white/45">Archived chats stay here when new messages arrive.</p>}

        {loading ? (
          [1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2.5">
              <Skeleton className="h-14 w-14 rounded-full bg-white/[0.06]" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2 bg-white/[0.06]" /><Skeleton className="h-3 w-3/4 bg-white/[0.06]" /></div>
            </div>
          ))
        ) : (
          <>
            {needle && listed.length > 0 && <p className="px-3 pb-1 pt-2 text-[13px] font-semibold text-white/45">Chats</p>}
            {listed.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                me={me}
                selected={selectedId === chat.id}
                online={!chat.isGroup && !!chat.otherUserId && onlineUsers.has(chat.otherUserId)}
                typing={typingLabel(chat)}
                isOpen={openSwipe === chat.id}
                onOpenSwipe={setOpenSwipe}
                onSelect={() => onSelect(chat.id)}
                onMenu={() => setMenuChat(chat)}
                onPatch={(p) => patch(chat, p)}
                onMarkRead={() => markRead(chat)}
              />
            ))}
            {needle && (msgHits.data?.length ?? 0) > 0 && (
              <>
                <p className="px-3 pb-1 pt-4 text-[13px] font-semibold text-white/45">Messages</p>
                {msgHits.data!.map((h) => (
                  <button key={h.id} type="button" onClick={() => onSelect(h.conversationId, h.id)} className="block w-full rounded-2xl px-3 py-2.5 text-left active:bg-white/[0.05]">
                    <span className="flex justify-between gap-2"><span className="truncate text-[15px] font-semibold">{chatName(h.conversationId)}</span><span className="shrink-0 text-[12.5px] text-white/40">{shortChatTime(h.createdAt)}</span></span>
                    <span className="mt-0.5 line-clamp-2 block text-[14px] text-white/60">{h.senderId === me ? "You: " : ""}{h.content}</span>
                  </button>
                ))}
              </>
            )}
            {listed.length === 0 && !(needle && msgHits.data?.length) && (
              <div className="py-20 text-center">
                <MessageCircle className="mx-auto mb-3 h-10 w-10 text-white/20" />
                <p className="text-[15px] font-medium text-white/60">
                  {needle ? "No results" : archivedView ? "No archived chats" : filter === "unread" ? "No unread chats" : filter === "favourites" ? "No favourites yet — long-press a chat to add it" : filter === "groups" ? "No groups yet" : "No messages yet"}
                </p>
                {!needle && filter === "all" && !archivedView && (
                  <button type="button" onClick={() => setNewChat(true)} className="mt-4 rounded-full bg-amber-400 px-5 py-2.5 text-[15px] font-bold text-[#1a1204]">Start a chat</button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Long-press / More */}
      <Sheet open={!!menuChat} onClose={() => setMenuChat(null)} title={menuChat?.name || ""}>
        {menuChat && (() => {
          const c = menuChat;
          const unread = c.unread > 0 || c.markedUnread;
          const items: { label: string; icon: typeof Pin; danger?: boolean; run: () => void }[] = [
            { label: c.archived ? "Unarchive" : "Archive", icon: c.archived ? ArchiveRestore : Archive, run: () => { patch(c, { archived: !c.archived }); toast(c.archived ? "Chat unarchived" : "Chat archived"); } },
            { label: unread ? "Mark as read" : "Mark as unread", icon: unread ? MailOpen : MessageCircle, run: () => (unread ? markRead(c) : patch(c, { marked_unread: true })) },
            ...(!c.archived ? [{ label: c.pinnedAt ? "Unpin" : "Pin", icon: c.pinnedAt ? PinOff : Pin, run: () => patch(c, { pinned_at: c.pinnedAt ? null : new Date().toISOString() }) }] : []),
            { label: isMuted(c.mutedUntil) ? "Unmute" : "Mute", icon: isMuted(c.mutedUntil) ? Bell : BellOff, run: () => (isMuted(c.mutedUntil) ? patch(c, { muted_until: null }) : setMuteChat(c)) },
            { label: c.favourite ? "Remove from favourites" : "Add to favourites", icon: c.favourite ? HeartOff : Heart, run: () => patch(c, { favourite: !c.favourite }) },
            { label: "Clear chat", icon: XCircle, danger: true, run: () => setConfirm({ title: "Clear this chat?", body: "Messages are removed from this chat on your phone only.", label: "Clear chat", run: () => patch(c, { cleared_at: new Date().toISOString() }) }) },
            ...(c.isGroup
              ? [{ label: "Exit group", icon: LogOut, danger: true, run: () => setConfirm({ title: `Exit "${c.name}"?`, label: "Exit group", run: () => removeMember(c.id, me).then(() => queryClient.invalidateQueries({ queryKey: ["chats", me] }), () => toast.error("Couldn't leave the group")) }) }]
              : c.otherUserId ? [{ label: `Block ${c.name}`, icon: Ban, danger: true, run: () => setConfirm({ title: `Block ${c.name}?`, body: "Blocked people can't message or call you here.", label: "Block", run: () => setBlocked(me, c.otherUserId!, true).then(() => toast(`${c.name} is blocked`), () => toast.error("Couldn't block")) }) }] : []),
            { label: "Delete chat", icon: Trash2, danger: true, run: () => setConfirm({ title: "Delete this chat?", body: "It comes back if someone sends something new.", label: "Delete chat", run: () => { const now = new Date().toISOString(); patch(c, { hidden_at: now, cleared_at: now, archived: false, pinned_at: null }); } }) },
          ];
          return (
            <div className="px-2 pb-2">
              {items.map(({ label, icon: Icon, danger, run }) => (
                <button key={label} type="button" onClick={() => { setMenuChat(null); run(); }} className={cn("flex w-full items-center gap-3.5 rounded-xl px-3 py-3.5 text-left text-[16px] active:bg-white/10", danger && "text-red-400")}>
                  <Icon className="h-5 w-5 opacity-80" /> {label}
                </button>
              ))}
            </div>
          );
        })()}
      </Sheet>

      <Sheet open={!!muteChat} onClose={() => setMuteChat(null)} title="Mute notifications">
        <div className="px-2 pb-2">
          <p className="px-3 pb-2 text-[13.5px] text-white/50">Others won't see that you muted this chat. You'll still be told if you're @mentioned.</p>
          {MUTE_OPTIONS.map((o) => (
            <button key={o.label} type="button" onClick={() => { if (muteChat) patch(muteChat, { muted_until: new Date(Date.now() + o.ms).toISOString() }); setMuteChat(null); }} className="block w-full rounded-xl px-3 py-3.5 text-left text-[16px] active:bg-white/10">{o.label}</button>
          ))}
        </div>
      </Sheet>

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title || ""}>
        {confirm && (
          <div className="px-4 pb-2">
            {confirm.body && <p className="pb-3 text-center text-[14px] text-white/55">{confirm.body}</p>}
            <button type="button" onClick={() => { confirm.run(); setConfirm(null); }} className="h-12 w-full rounded-full bg-red-500 text-[16px] font-bold text-white">{confirm.label}</button>
            <button type="button" onClick={() => setConfirm(null)} className="mt-2 h-12 w-full rounded-full bg-white/[0.08] text-[16px] font-semibold">Cancel</button>
          </div>
        )}
      </Sheet>

      <Sheet open={starredOpen} onClose={() => setStarredOpen(false)} title="Starred messages" tall>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {starred.isLoading && <p className="py-10 text-center text-[14px] text-white/40">Loading…</p>}
          {starred.data?.length === 0 && (
            <div className="px-8 py-16 text-center"><Star className="mx-auto mb-3 h-10 w-10 text-white/20" /><p className="text-[15px] text-white/55">Long-press any message and tap Star to find it here easily.</p></div>
          )}
          {starred.data?.map(({ message: m }) => (
            <button key={m.id} type="button" onClick={() => { setStarredOpen(false); onSelect(m.conversationId, m.id); }} className="block w-full border-b border-white/[0.05] px-4 py-3 text-left active:bg-white/5">
              <span className="flex justify-between gap-2 text-[13px] text-white/50"><span className="truncate font-semibold text-white/80">{chatName(m.conversationId)}</span><span className="shrink-0">{shortChatTime(m.createdAt)}</span></span>
              <span className="mt-1 line-clamp-3 block text-[15px]">{m.senderId === me ? "You: " : ""}{messageSummary(m)}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <PeoplePicker open={newChat} title="New chat" meId={me} onClose={() => setNewChat(false)}
        onDone={([p]) => p && openDirectChat(p.id).then((id) => { queryClient.invalidateQueries({ queryKey: ["chats", me] }); onSelect(id); }, () => toast.error("Couldn't start that chat"))} />

      {newGroup && <CreateGroupModal onClose={() => setNewGroup(false)} onCreate={() => queryClient.invalidateQueries({ queryKey: ["chats", me] })} />}
    </div>
  );
};
