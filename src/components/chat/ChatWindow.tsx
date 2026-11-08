import { useState, useRef, useEffect, useCallback, lazy, Suspense, Fragment } from "react";
import { useCall } from "@/contexts/CallContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Image as ImageIcon, Smile, ArrowLeft, Phone, Video, Info, MoreVertical, Users, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, formatDistanceToNowStrict, isToday, isYesterday, isThisWeek, isThisYear } from "date-fns";
// The emoji picker is large — load it only when the picker is opened.
const EmojiPicker = lazy(() => import("emoji-picker-react"));
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePresence } from "@/hooks/usePresence";
import { isImageMessage } from "@/lib/chat";

interface Message {
  id: string;
  content: string; // for photos, the image URL
  type: "text" | "image";
  senderId: string;
  timestamp: string;
  isDeleted?: boolean;
  /** Sent from this phone and still on its way / failed. */
  status?: "sending" | "failed";
}

interface ChatWindowProps {
  chatId: string;
  onBack: () => void;
}

type Row = { id: string; content: string; sender_id: string; created_at: string; is_deleted?: boolean | null };

const toMessage = (m: Row): Message => ({
  id: m.id,
  content: m.content,
  type: isImageMessage(m.content) ? "image" : "text",
  senderId: m.sender_id,
  timestamp: m.created_at,
  isDeleted: !!m.is_deleted,
});

/** "Today 14:05", "Yesterday 09:12", "Monday 18:30", "12 Mar 14:05", "12 Mar 2024". */
function dayLabel(d: Date) {
  if (isToday(d)) return `Today ${format(d, "HH:mm")}`;
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`;
  if (isThisWeek(d)) return format(d, "EEEE HH:mm");
  if (isThisYear(d)) return format(d, "d MMM HH:mm");
  return format(d, "d MMM yyyy");
}

/** Messages more than this far apart get a time label between them. */
const TIME_GAP_MS = 20 * 60 * 1000;
/** Same sender within this long: bubbles join into one group. */
const GROUP_GAP_MS = 3 * 60 * 1000;

export const ChatWindow = ({ chatId, onBack }: ChatWindowProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [chatInfo, setChatInfo] = useState<{ id?: string; name: string; avatar: string | null; lastSeen?: string | null; isGroup?: boolean }>({ name: "", avatar: null });
  const { onlineUsers } = usePresence();
  const [participants, setParticipants] = useState<Record<string, { username: string; avatar: string | null }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { startCall } = useCall();
  const [showInfo, setShowInfo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const live = useRef(false);
  const stickToBottom = useRef(true);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select("id, content, sender_id, created_at, is_deleted")
      .eq("conversation_id", chatId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (!data) return;
    setMessages((prev) => {
      const fromServer = (data as Row[]).map(toMessage);
      const ids = new Set(fromServer.map((m) => m.id));
      // Keep messages still being sent from this phone.
      return [...fromServer, ...prev.filter((m) => m.status && !ids.has(m.id))];
    });
    setIsLoading(false);
  }, [chatId]);

  // Conversation details, messages and live updates.
  useEffect(() => {
    if (!user || !chatId) return;
    setIsLoading(true);
    setMessages([]);
    stickToBottom.current = true;

    supabase
      .from("conversations")
      .select("*, conversation_participants(user_id, profiles(username, display_name, avatar_url, updated_at))")
      .eq("id", chatId)
      .single()
      .then(({ data: conv }) => {
        if (!conv) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const people = (conv as any).conversation_participants as { user_id: string; profiles: { username: string; display_name: string | null; avatar_url: string | null; updated_at: string | null } | null }[];
        const parts: Record<string, { username: string; avatar: string | null }> = {};
        people.forEach((p) => {
          if (p.profiles) parts[p.user_id] = { username: p.profiles.display_name || p.profiles.username, avatar: p.profiles.avatar_url };
        });
        setParticipants(parts);
        if (conv.type === "group") {
          setChatInfo({ name: conv.name || "Group chat", avatar: null, isGroup: true });
        } else {
          const other = people.find((p) => p.user_id !== user.id);
          if (other?.profiles) {
            setChatInfo({
              id: other.user_id,
              name: other.profiles.display_name || other.profiles.username,
              avatar: other.profiles.avatar_url,
              lastSeen: other.profiles.updated_at,
            });
          }
        }
      });

    loadMessages();

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${chatId}` }, (payload) => {
        const m = toMessage(payload.new as Row);
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${chatId}` }, (payload) => {
        const u = payload.new as Row;
        setMessages((prev) => prev.map((m) => (m.id === u.id ? { ...m, isDeleted: !!u.is_deleted } : m)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${chatId}` }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (id) setMessages((prev) => prev.filter((m) => m.id !== id));
      })
      .subscribe((status) => {
        live.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") loadMessages(); // catch up on anything sent while connecting
      });

    // Safety net: if live updates drop (weak signal, app in background), check for new messages.
    const poll = setInterval(() => { if (!live.current && !document.hidden) loadMessages(); }, 8000);
    const onShow = () => { if (!document.hidden) loadMessages(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("online", onShow);

    return () => {
      live.current = false;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("online", onShow);
      supabase.removeChannel(channel);
    };
  }, [chatId, user, loadMessages]);

  // Stay at the newest message (unless they scrolled up to read older ones).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const notify = (body: string) => {
    if (!user) return;
    const to = chatInfo.isGroup ? Object.keys(participants).filter((id) => id !== user.id) : chatInfo.id ? [chatInfo.id] : [];
    const from = participants[user.id]?.username || user.user_metadata?.username || "New message";
    to.forEach((toUserId) => {
      supabase.functions
        .invoke("push-notifications", {
          body: { type: "chat_message", toUserId, title: chatInfo.isGroup ? `${from} · ${chatInfo.name}` : from, body, url: "/chat" },
        })
        .then(({ error }) => { if (error) console.error("Error sending push:", error); });
    });
  };

  const deliver = async (temp: Message) => {
    if (!user) return;
    setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, status: "sending" } : m)));
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: chatId, sender_id: user.id, content: temp.content })
      .select("id, content, sender_id, created_at")
      .single();
    if (error || !data) {
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, status: "failed" } : m)));
      return;
    }
    const saved = toMessage(data as Row);
    setMessages((prev) => {
      const without = prev.filter((m) => m.id !== temp.id);
      return without.some((m) => m.id === saved.id) ? without : [...without, saved];
    });
    notify(temp.type === "image" ? "📷 Photo" : temp.content);
  };

  const handleSend = () => {
    const content = inputValue.trim();
    if (!content || !user) return;
    setInputValue("");
    stickToBottom.current = true;
    const temp: Message = { id: `local-${crypto.randomUUID()}`, content, type: "text", senderId: user.id, timestamp: new Date().toISOString(), status: "sending" };
    setMessages((prev) => [...prev, temp]);
    deliver(temp);
    inputRef.current?.focus();
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", messageId);
    if (error) { toast.error("Couldn't unsend that message"); return; }
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `chat-images/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("media").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(filePath);
      stickToBottom.current = true;
      const temp: Message = { id: `local-${crypto.randomUUID()}`, content: publicUrl, type: "image", senderId: user.id, timestamp: new Date().toISOString(), status: "sending" };
      setMessages((prev) => [...prev, temp]);
      await deliver(temp);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Couldn't send that photo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isGroup = chatInfo.isGroup;
  const otherOnline = !!chatInfo.id && onlineUsers.has(chatInfo.id);
  const memberCount = Object.keys(participants).length;
  const status = isGroup
    ? `${memberCount} member${memberCount === 1 ? "" : "s"}`
    : otherOnline
      ? "Active now"
      : chatInfo.lastSeen
        ? `Active ${formatDistanceToNowStrict(new Date(chatInfo.lastSeen), { addSuffix: true })}`
        : "";

  return (
    <div className="chat-window flex h-full min-h-0 flex-col bg-[#05070b] text-white">
      {/* Header */}
      <header className="chat-header flex shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#05070b]/95 px-2 backdrop-blur-xl">
        <button type="button" onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10 md:hidden">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <button type="button" onClick={() => setShowInfo(true)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 pl-1 text-left md:pl-3">
          <span className="relative shrink-0">
            <Avatar className="h-10 w-10">
              <AvatarImage src={chatInfo.avatar || ""} className="object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-700 text-[15px] font-bold text-white">
                {isGroup ? <Users className="h-5 w-5" /> : chatInfo.name?.[0]?.toUpperCase() || ""}
              </AvatarFallback>
            </Avatar>
            {otherOnline && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#05070b] bg-emerald-500" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-semibold leading-tight">{chatInfo.name}</span>
            {status && <span className={cn("block truncate text-[12.5px] leading-tight", otherOnline ? "text-emerald-400" : "text-white/50")}>{status}</span>}
          </span>
        </button>
        <div className="flex shrink-0 items-center">
          {!isGroup && (
            <>
              <button type="button" aria-label="Voice call" disabled={!chatInfo.id}
                onClick={() => chatInfo.id && startCall(chatInfo.id, chatInfo.name, chatInfo.avatar, false)}
                className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10 disabled:opacity-40">
                <Phone className="h-[21px] w-[21px]" />
              </button>
              <button type="button" aria-label="Video call" disabled={!chatInfo.id}
                onClick={() => chatInfo.id && startCall(chatInfo.id, chatInfo.name, chatInfo.avatar, true)}
                className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10 disabled:opacity-40">
                <Video className="h-[23px] w-[23px]" />
              </button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="More" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-2xl border-white/10 bg-[#14171d] p-1 text-white">
              <DropdownMenuItem onClick={() => setShowInfo(true)} className="rounded-xl py-2.5 font-medium focus:bg-white/10">
                {isGroup ? "Group info" : "View profile"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 md:px-6">
        <div className="flex min-h-full flex-col justify-end py-4">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={cn("h-10 animate-pulse rounded-[20px] bg-white/[0.06]", i % 2 ? "w-44 self-start" : "w-32 self-end")} />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
              <Avatar className="h-20 w-20">
                <AvatarImage src={chatInfo.avatar || ""} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-700 text-2xl font-bold text-white">
                  {isGroup ? <Users className="h-8 w-8" /> : chatInfo.name?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="text-[17px] font-semibold">{chatInfo.name}</p>
              <p className="text-[14px] text-white/50">Say hello 👋</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const prev = messages[idx - 1];
              const next = messages[idx + 1];
              const t = new Date(msg.timestamp).getTime();
              const showTime = !prev || t - new Date(prev.timestamp).getTime() > TIME_GAP_MS;
              const joinsPrev = !showTime && prev?.senderId === msg.senderId && t - new Date(prev.timestamp).getTime() < GROUP_GAP_MS;
              const nextShowsTime = next && new Date(next.timestamp).getTime() - t > TIME_GAP_MS;
              const joinsNext = !!next && !nextShowsTime && next.senderId === msg.senderId && new Date(next.timestamp).getTime() - t < GROUP_GAP_MS;
              const isMe = msg.senderId === user?.id;
              const sender = participants[msg.senderId];
              return (
                <Fragment key={msg.id}>
                  {showTime && (
                    <p className="my-3 text-center text-[12px] font-medium text-white/40">{dayLabel(new Date(msg.timestamp))}</p>
                  )}
                  <div className={cn("group flex items-end gap-2", isMe ? "justify-end" : "justify-start", joinsPrev ? "mt-0.5" : "mt-2.5")}>
                    {!isMe && (
                      <div className="w-7 shrink-0">
                        {!joinsNext && (
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={sender?.avatar || ""} className="object-cover" />
                            <AvatarFallback className="bg-white/10 text-[11px] font-semibold text-white">{sender?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )}
                    <div className={cn("flex max-w-[78%] flex-col md:max-w-[65%]", isMe ? "items-end" : "items-start")}>
                      {isGroup && !isMe && !joinsPrev && (
                        <span className="mb-1 ml-3 text-[12px] font-medium text-white/50">{sender?.username || "Member"}</span>
                      )}
                      <div className="relative flex items-center gap-1.5">
                        {isMe && !msg.isDeleted && !msg.status && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label="Message options" className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl border-white/10 bg-[#14171d] p-1 text-white">
                              <DropdownMenuItem onClick={() => handleDeleteMessage(msg.id)} className="rounded-lg py-2 text-[13px] font-medium text-red-400 focus:bg-red-500/10">
                                Unsend
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {msg.isDeleted ? (
                          <span className="flex items-center gap-1.5 rounded-[20px] border border-white/10 px-3.5 py-2 text-[13px] italic text-white/45">
                            <Info className="h-3.5 w-3.5" /> Message deleted
                          </span>
                        ) : msg.type === "image" ? (
                          <img
                            src={msg.content}
                            alt="Photo"
                            loading="lazy"
                            onClick={() => window.open(msg.content, "_blank")}
                            className={cn("max-h-72 w-auto max-w-full cursor-pointer rounded-[18px] object-cover", msg.status === "sending" && "opacity-60")}
                          />
                        ) : (
                          <div
                            className={cn(
                              "whitespace-pre-wrap break-words px-3.5 py-2 text-[15.5px] leading-[1.35]",
                              isMe ? "bg-gradient-to-b from-amber-400 to-amber-500 text-[#1a1204]" : "bg-[#1c1f26] text-white",
                              "rounded-[20px]",
                              isMe && joinsPrev && "rounded-tr-[6px]",
                              isMe && joinsNext && "rounded-br-[6px]",
                              !isMe && joinsPrev && "rounded-tl-[6px]",
                              !isMe && joinsNext && "rounded-bl-[6px]",
                              msg.status === "sending" && "opacity-70",
                            )}
                          >
                            {msg.content}
                          </div>
                        )}
                      </div>
                      {msg.status === "failed" && (
                        <button type="button" onClick={() => deliver(msg)} className="mr-1 mt-1 flex items-center gap-1 text-[12px] font-medium text-red-400">
                          <RotateCw className="h-3 w-3" /> Not sent · Tap to retry
                        </button>
                      )}
                    </div>
                  </div>
                </Fragment>
              );
            })
          )}
        </div>
      </div>

      {/* Composer */}
      <footer className="chat-composer shrink-0 border-t border-white/[0.06] bg-[#05070b] px-3 pt-2">
        <div className="mx-auto flex max-w-4xl items-end gap-2">
          <button
            type="button"
            aria-label="Send a photo"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-amber-400 active:scale-95 disabled:opacity-50"
          >
            {uploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /> : <ImageIcon className="h-5 w-5" />}
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

          <div className="flex min-h-[44px] flex-1 items-end rounded-[22px] bg-white/[0.08] pl-4 pr-1">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Message…"
              rows={1}
              className="max-h-32 min-h-[44px] flex-1 resize-none border-0 bg-transparent py-[11px] text-[16px] leading-[22px] text-white placeholder:text-white/40 focus:outline-none focus:ring-0"
            />
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" aria-label="Emoji" className="mb-0.5 hidden h-10 w-10 items-center justify-center rounded-full text-white/50 sm:flex">
                  <Smile className="h-5 w-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden rounded-3xl border-white/10 p-0" align="end" sideOffset={12}>
                <Suspense fallback={<div className="h-[400px] w-[300px] animate-pulse bg-white/5" />}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <EmojiPicker onEmojiClick={(e) => setInputValue((v) => v + e.emoji)} theme={"dark" as any} width={300} height={400} />
                </Suspense>
              </PopoverContent>
            </Popover>
          </div>

          <button
            type="button"
            aria-label="Send"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className={cn(
              "mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all",
              inputValue.trim() ? "bg-amber-400 text-[#1a1204] active:scale-95" : "bg-white/[0.08] text-white/30",
            )}
          >
            <Send className="h-[18px] w-[18px]" />
          </button>
        </div>
      </footer>

      {/* Info */}
      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="max-w-md overflow-hidden rounded-3xl border-white/10 bg-[#0d1016] p-0 text-white">
          <DialogTitle className="sr-only">Conversation info</DialogTitle>
          <div className="space-y-5 p-7 text-center">
            <Avatar className="mx-auto h-24 w-24">
              <AvatarImage src={chatInfo.avatar || ""} className="object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-700 text-3xl font-bold text-white">
                {isGroup ? <Users className="h-10 w-10" /> : chatInfo.name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-[22px] font-bold">{chatInfo.name}</h2>
              <p className="mt-1 text-[14px] text-white/50">{isGroup ? `Group · ${memberCount} members` : status || "Direct message"}</p>
            </div>
            {isGroup && (
              <div className="text-left">
                <h3 className="mb-2 px-1 text-[13px] font-semibold text-white/50">Members</h3>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {Object.entries(participants).map(([id, p]) => (
                    <div key={id} className="flex items-center gap-3 rounded-2xl p-2.5">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={p.avatar || ""} className="object-cover" />
                        <AvatarFallback className="bg-white/10 text-sm font-semibold">{p.username?.[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate text-[15px] font-medium">{p.username}{id === user?.id ? " (you)" : ""}</span>
                      {onlineUsers.has(id) && <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
