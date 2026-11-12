import { memo, useRef, useState } from "react";
import { Ban, Check, CheckCheck, ChevronDown, Clock, Forward, Pin, Play, Reply, RotateCw, Star, Timer } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { bubbleTime, nameColor } from "@/lib/chat";
import { messageSummary, type ChatMember, type ChatMessage } from "@/services/api/chat";
import { TIKTOK_LINK_RE } from "@/services/api/reposts";
import { ChatText } from "./ChatText";
import { AudioAttachment, ContactAttachment, FileAttachment, ImageAttachment, LocationAttachment, PollAttachment, VideoAttachment } from "./AttachmentView";

export type Delivery = "sending" | "failed" | "sent" | "delivered" | "read";

export const Ticks = ({ state, className }: { state: Delivery; className?: string }) => {
  if (state === "sending") return <Clock className={cn("h-[13px] w-[13px]", className)} strokeWidth={2.4} />;
  if (state === "failed") return null;
  if (state === "sent") return <Check className={cn("h-[15px] w-[15px]", className)} strokeWidth={2.4} />;
  return <CheckCheck className={cn("h-[15px] w-[15px]", state === "read" ? "!text-sky-500" : "", className)} strokeWidth={2.4} />;
};

export interface BubbleProps {
  msg: ChatMessage;
  mine: boolean;
  isGroup: boolean;
  sender?: ChatMember;
  meId: string;
  showName: boolean;
  joinsPrev: boolean;
  joinsNext: boolean;
  replyTo?: { msg: ChatMessage | null; senderName: string } | null;
  reactions?: { userId: string; emoji: string }[];
  starred: boolean;
  pinned: boolean;
  delivery: Delivery;
  highlight?: string;
  flash: boolean;
  selecting: boolean;
  selected: boolean;
  members: Map<string, ChatMember>;
  votes?: Map<string, number[]>;
  onReply: (m: ChatMessage) => void;
  onMenu: (m: ChatMessage, rect: DOMRect) => void;
  onToggleSelect: (m: ChatMessage) => void;
  onJumpTo: (id: string) => void;
  onOpenMedia: (m: ChatMessage) => void;
  onReactions: (m: ChatMessage) => void;
  onVote: (m: ChatMessage, options: number[]) => void;
  onViewVotes: (m: ChatMessage) => void;
  onRetry: (m: ChatMessage) => void;
  onOpenContact: (userId: string, username: string, action: "message" | "view") => void;
}

const LONG_PRESS_MS = 420;
const REPLY_AT = 64;

export const MessageBubble = memo(function MessageBubble(p: BubbleProps) {
  const { msg, mine } = p;
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const gesture = useRef<{ x: number; y: number; id: number; dir: "none" | "h" | "v"; timer: number; fired: boolean } | null>(null);
  const longFired = useRef(false); // the finger lifting after a long-press isn't a tap

  const openMenu = () => { if (bubbleRef.current) p.onMenu(msg, bubbleRef.current.getBoundingClientRect()); };

  // Long-press opens the menu; a swipe to the right replies (like WhatsApp).
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    longFired.current = false;
    const timer = window.setTimeout(() => {
      if (!gesture.current || gesture.current.dir === "h") return;
      gesture.current.fired = true;
      longFired.current = true;
      navigator.vibrate?.(12);
      if (p.selecting) p.onToggleSelect(msg); else openMenu();
    }, LONG_PRESS_MS);
    gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, dir: "none", timer, fired: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const mx = e.clientX - g.x, my = e.clientY - g.y;
    if (g.dir === "none" && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      g.dir = Math.abs(mx) > Math.abs(my) && mx > 0 && !p.selecting && !msg.isDeleted && !msg.status ? "h" : "v";
      clearTimeout(g.timer);
    }
    if (g.dir === "h") setDx(Math.max(0, Math.min(90, mx * 0.75)));
  };
  const onPointerEnd = () => {
    const g = gesture.current;
    if (!g) return;
    clearTimeout(g.timer);
    if (g.dir === "h" && dx >= REPLY_AT) { navigator.vibrate?.(10); p.onReply(msg); }
    gesture.current = null;
    setDx(0);
  };
  const onClick = () => {
    if (longFired.current) { longFired.current = false; return; }
    if (p.selecting) p.onToggleSelect(msg);
  };

  const a = msg.attachment;
  const media = !msg.isDeleted && a && (a.type === "image" || a.type === "video");
  const bare = media && !msg.content && !p.replyTo && !msg.forwarded && !(p.isGroup && !mine && p.showName);
  const metaColor = mine ? "text-[#1a1204]/60" : "text-neutral-500";

  const meta = (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-[11px] leading-none", bare ? "text-white" : metaColor)}>
      {msg.expiresAt && <Timer className="h-3 w-3" />}
      {p.pinned && <Pin className="h-3 w-3" />}
      {p.starred && <Star className="h-3 w-3 fill-current" />}
      {msg.editedAt && !msg.isDeleted && <span>Edited</span>}
      <span>{bubbleTime(msg.createdAt)}</span>
      {mine && !msg.isDeleted && <Ticks state={p.delivery} className={bare ? "text-white" : mine ? "text-[#1a1204]/60" : ""} />}
    </span>
  );

  const reactionGroups = (() => {
    const r = p.reactions ?? [];
    const by = new Map<string, number>();
    r.forEach((x) => by.set(x.emoji, (by.get(x.emoji) ?? 0) + 1));
    return { emojis: [...by.entries()].sort((x, y) => y[1] - x[1]).map(([e]) => e).slice(0, 3), total: r.length, mineToo: r.some((x) => x.userId === p.meId) };
  })();

  return (
    <div
      data-mid={msg.id}
      className={cn("relative flex items-end gap-1.5 transition-colors duration-700", mine ? "justify-end" : "justify-start", p.joinsPrev ? "mt-[3px]" : "mt-2",
        reactionGroups.total > 0 && "mb-3", p.flash && "bg-amber-400/15", p.selected && "bg-amber-400/20", p.selecting && "-mx-3 px-3 py-0.5")}
      onClick={onClick}
    >
      {p.selecting && (
        <span className={cn("mr-1 flex h-5 w-5 shrink-0 self-center items-center justify-center rounded-full border-2", p.selected ? "border-amber-400 bg-amber-400 text-[#1a1204]" : "border-neutral-300")}>
          {p.selected && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
        </span>
      )}
      {/* Swipe-to-reply arrow */}
      <span className="pointer-events-none absolute left-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-200 transition-opacity" style={{ opacity: Math.min(1, dx / REPLY_AT) }}>
        <Reply className="h-4 w-4 text-neutral-700" />
      </span>

      {p.isGroup && !mine && (
        <div className="w-8 shrink-0 self-end">
          {!p.joinsNext && (
            <Avatar className="h-8 w-8">
              <AvatarImage src={p.sender?.avatar || ""} className="object-cover" />
              <AvatarFallback className="bg-neutral-200 text-[11px] font-semibold text-neutral-700">{p.sender?.name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
            </Avatar>
          )}
        </div>
      )}

      <div className={cn("flex max-w-[80%] flex-col md:max-w-[65%]", mine ? "items-end" : "items-start")} style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? "none" : "transform 0.2s" }}>
        <div
          ref={bubbleRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onTouchEnd={(e) => { if (longFired.current) e.preventDefault(); }}
          onContextMenu={(e) => { e.preventDefault(); if (!p.selecting) openMenu(); }}
          style={{ touchAction: "pan-y" }}
          className={cn(
            "group/bubble relative select-none text-[15.5px] leading-[1.38]",
            bare ? "overflow-hidden rounded-[16px]" : "rounded-[18px] px-2.5 pb-1.5 pt-1.5",
            !bare && (mine ? "bg-gradient-to-b from-amber-400 to-amber-500 text-[#1a1204]" : "bg-neutral-100 text-neutral-900"),
            !bare && mine && p.joinsPrev && "rounded-tr-[6px]",
            !bare && mine && p.joinsNext && "rounded-br-[6px]",
            !bare && !mine && p.joinsPrev && "rounded-tl-[6px]",
            !bare && !mine && p.joinsNext && "rounded-bl-[6px]",
            msg.status === "sending" && "opacity-75",
          )}
        >
          {/* Desktop: a small arrow opens the menu */}
          {!p.selecting && !msg.status && (
            <button type="button" aria-label="Message menu" onClick={(e) => { e.stopPropagation(); openMenu(); }}
              className={cn("absolute right-1 top-1 z-10 hidden h-6 w-6 items-center justify-center rounded-full opacity-0 transition-opacity group-hover/bubble:opacity-100 md:flex", mine ? "bg-amber-400/90 text-[#1a1204]" : "bg-neutral-100/90 text-neutral-500")}>
              <ChevronDown className="h-4 w-4" />
            </button>
          )}

          {p.isGroup && !mine && p.showName && !msg.isDeleted && (
            <span className={cn("block truncate text-[13px] font-semibold", bare ? "px-2.5 pt-1.5" : "")} style={{ color: p.sender ? nameColor(p.sender.userId) : undefined }}>
              {p.sender?.name || "Member"}
            </span>
          )}

          {msg.forwarded && !msg.isDeleted && (
            <span className={cn("flex items-center gap-1 text-[12.5px] italic", mine ? "text-[#1a1204]/60" : "text-neutral-500")}><Forward className="h-3.5 w-3.5" /> Forwarded</span>
          )}

          {p.replyTo && !msg.isDeleted && (
            <button type="button" onClick={(e) => { e.stopPropagation(); if (p.replyTo?.msg) p.onJumpTo(p.replyTo.msg.id); }}
              className={cn("mb-1 mt-0.5 flex w-full min-w-[160px] overflow-hidden rounded-[10px] text-left", mine ? "bg-black/10" : "bg-black/[0.05]")}>
              <span className="w-1 shrink-0" style={{ background: p.replyTo.msg ? nameColor(p.replyTo.msg.senderId) : "#888" }} />
              <span className="min-w-0 flex-1 px-2 py-1.5">
                <span className="block truncate text-[12.5px] font-semibold" style={{ color: mine ? undefined : p.replyTo.msg ? nameColor(p.replyTo.msg.senderId) : undefined }}>{p.replyTo.senderName}</span>
                <span className={cn("line-clamp-2 text-[13px]", mine ? "text-[#1a1204]/75" : "text-neutral-600")}>{p.replyTo.msg ? messageSummary(p.replyTo.msg) || "Message" : "Message not available"}</span>
              </span>
              {p.replyTo.msg?.attachment?.type === "image" && <img src={p.replyTo.msg.attachment.url} alt="" className="h-12 w-12 shrink-0 object-cover" />}
            </button>
          )}

          {msg.isDeleted ? (
            <span className={cn("flex items-center gap-1.5 py-0.5 pr-1 italic", mine ? "text-[#1a1204]/65" : "text-neutral-500")}>
              <Ban className="h-4 w-4" /> {mine ? "You deleted this message" : "This message was deleted"}
              <span className="ml-2 self-end">{meta}</span>
            </span>
          ) : (
            <>
              {a && (
                <div className={cn(!bare && media && "-mx-1 mb-0.5", !bare && !media && "py-0.5")}>
                  {a.type === "image" && <ImageAttachment a={a} onOpen={() => p.onOpenMedia(msg)} pending={msg.status === "sending"} />}
                  {a.type === "video" && <VideoAttachment a={a} onOpen={() => p.onOpenMedia(msg)} />}
                  {a.type === "audio" && <AudioAttachment a={a} mine={mine} avatar={p.sender?.avatar} name={p.sender?.name} />}
                  {a.type === "file" && <FileAttachment a={a} mine={mine} />}
                  {a.type === "location" && <LocationAttachment a={a} />}
                  {a.type === "contact" && <ContactAttachment a={a} mine={mine} onMessage={() => p.onOpenContact(a.userId, a.username, "message")} onView={() => p.onOpenContact(a.userId, a.username, "view")} />}
                  {a.type === "poll" && <PollAttachment a={a} mine={mine} votes={p.votes} meId={p.meId} members={p.members} onVote={(o) => p.onVote(msg, o)} onViewVotes={() => p.onViewVotes(msg)} />}
                </div>
              )}
              {(() => {
                // A SOOZ TikTok link becomes a "Watch on SOOZ" card that opens it first in For You.
                const t = msg.content.match(TIKTOK_LINK_RE);
                if (!t) return null;
                return (
                  <button type="button" onClick={(e) => { e.stopPropagation(); window.location.assign(`/?tiktok=${t[1]}${t[2] ? `&by=${t[2]}` : ""}`); }}
                    className={cn("mb-1 mt-0.5 flex w-full min-w-[200px] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left", mine ? "bg-black/15" : "bg-black/[0.05]")}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white"><Play className="ml-0.5 h-4 w-4 fill-white" /></span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-bold leading-tight">Watch on SOOZ</span>
                      <span className={cn("block truncate text-[12.5px]", mine ? "text-black/60" : "text-neutral-500")}>Christian TikTok{t[2] ? ` · @${t[2]}` : ""}</span>
                    </span>
                  </button>
                );
              })()}
              {msg.content ? (
                <span className="block whitespace-pre-wrap break-words px-0.5">
                  <ChatText text={msg.content} highlight={p.highlight} mine={mine} />
                  {/* room for the time, which floats bottom-right like WhatsApp */}
                  <span className="inline-block w-[64px]" aria-hidden />
                  {msg.editedAt && <span className="inline-block w-[38px]" aria-hidden />}
                  {mine && <span className="inline-block w-[14px]" aria-hidden />}
                </span>
              ) : !bare && a && a.type !== "image" && a.type !== "video" ? <span className="block h-3" /> : null}
              <span className={cn("absolute bottom-1.5 right-2.5", bare && "rounded-full bg-black/45 px-1.5 py-0.5")}>{meta}</span>
            </>
          )}
        </div>

        {msg.status === "failed" && (
          <button type="button" onClick={(e) => { e.stopPropagation(); p.onRetry(msg); }} className="mr-1 mt-1 flex items-center gap-1 text-[12px] font-medium text-red-600">
            <RotateCw className="h-3 w-3" /> Not sent · Tap to retry
          </button>
        )}

        {reactionGroups.total > 0 && (
          <button type="button" onClick={(e) => { e.stopPropagation(); p.onReactions(msg); }}
            className={cn("absolute -bottom-3 z-10 flex items-center gap-0.5 rounded-full border border-white bg-white px-1.5 py-[1px] text-[13px] shadow", mine ? "right-3" : p.isGroup ? "left-12" : "left-3", reactionGroups.mineToo && "bg-amber-50")}>
            {reactionGroups.emojis.map((e) => <span key={e}>{e}</span>)}
            {reactionGroups.total > 1 && <span className="ml-0.5 text-[11.5px] font-semibold text-neutral-600">{reactionGroups.total}</span>}
          </button>
        )}
      </div>
    </div>
  );
});
