import { lazy, Suspense, useEffect, useState } from "react";
import { Copy, CheckSquare, Flag, Forward, Info, Pencil, Pin, PinOff, Plus, Reply, Star, StarOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { messageSummary, type ChatMessage } from "@/services/api/chat";

const EmojiPicker = lazy(() => import("emoji-picker-react"));
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export type MenuAction = "reply" | "forward" | "copy" | "star" | "pin" | "edit" | "info" | "select" | "report" | "deleteMe" | "deleteAll";

/** Long-press menu on a message: reactions on top, actions below, like WhatsApp. */
export const MessageMenu = ({ msg, rect, mine, starred, pinned, myReaction, canEdit, canDeleteForAll, canPin, onReact, onAction, onClose }: {
  msg: ChatMessage;
  rect: DOMRect;
  mine: boolean;
  starred: boolean;
  pinned: boolean;
  myReaction: string | null;
  canEdit: boolean;
  canDeleteForAll: boolean;
  canPin: boolean;
  onReact: (emoji: string | null) => void;
  onAction: (a: MenuAction) => void;
  onClose: () => void;
}) => {
  const [stage, setStage] = useState<"main" | "delete" | "emoji">("main");
  // Ignore the finger lifting from the long-press that opened this menu.
  const [armed, setArmed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setArmed(true), 350); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const items: { a: MenuAction; label: string; icon: typeof Reply; danger?: boolean; show: boolean }[] = [
    { a: "reply", label: "Reply", icon: Reply, show: !msg.isDeleted },
    { a: "forward", label: "Forward", icon: Forward, show: !msg.isDeleted },
    { a: "copy", label: "Copy", icon: Copy, show: !msg.isDeleted && !!msg.content },
    { a: "star", label: starred ? "Unstar" : "Star", icon: starred ? StarOff : Star, show: !msg.isDeleted },
    { a: "pin", label: pinned ? "Unpin" : "Pin", icon: pinned ? PinOff : Pin, show: !msg.isDeleted && canPin },
    { a: "edit", label: "Edit", icon: Pencil, show: canEdit },
    { a: "info", label: "Info", icon: Info, show: mine && !msg.isDeleted },
    { a: "select", label: "Select", icon: CheckSquare, show: true },
    { a: "report", label: "Report", icon: Flag, danger: true, show: !mine && !msg.isDeleted },
    { a: "deleteMe", label: "Delete", icon: Trash2, danger: true, show: true },
  ];
  const shown = items.filter((i) => i.show);
  const menuH = stage === "delete" ? 190 : shown.length * 46 + 12;
  const previewH = Math.min(rect.height, 160);
  // The message stays where it was; the reactions sit above it and the menu below (or above if no room).
  let top = Math.max(76, Math.min(rect.top, vh - menuH - previewH - 24));
  if (top + previewH + menuH + 20 > vh) top = Math.max(76, vh - menuH - previewH - 24);
  const reactTop = top - 58;
  const menuTop = top + previewH + 10;
  const side = mine ? { right: Math.max(12, vw - rect.right) } : { left: Math.max(12, rect.left) };

  return (
    <div className={cn("fixed inset-0 z-[90]", !armed && "pointer-events-none")} role="dialog" aria-label="Message options">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30 backdrop-blur-[3px] animate-fade-in" onClick={onClose} />

      {stage === "emoji" ? (
        <div className="absolute inset-x-0 bottom-0 flex justify-center pb-[env(safe-area-inset-bottom)]">
          <Suspense fallback={<div className="h-[380px] w-full max-w-md animate-pulse rounded-t-3xl bg-white" />}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <EmojiPicker theme={"light" as any} width="100%" height={380} onEmojiClick={(e) => { onReact(e.emoji); onClose(); }} style={{ maxWidth: 448 }} />
          </Suspense>
        </div>
      ) : (
        <>
          {!msg.isDeleted && stage === "main" && (
            <div className="absolute flex items-center gap-1 rounded-full bg-white px-2 py-1.5 shadow-2xl animate-scale-in" style={{ top: Math.max(12, reactTop), ...side }}>
              {QUICK_REACTIONS.map((e) => (
                <button key={e} type="button" onClick={() => { onReact(myReaction === e ? null : e); onClose(); }}
                  className={cn("flex h-10 w-10 items-center justify-center rounded-full text-[25px] transition-transform active:scale-125", myReaction === e && "bg-neutral-200")}>
                  {e}
                </button>
              ))}
              <button type="button" aria-label="More reactions" onClick={() => setStage("emoji")} className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                <Plus className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* The message, lifted above the dimmed chat */}
          <div className={cn("absolute max-w-[80%] overflow-hidden rounded-[18px] px-3 py-2 text-[15px] shadow-2xl", mine ? "bg-gradient-to-b from-amber-400 to-amber-500 text-[#1a1204]" : "bg-neutral-100 text-neutral-900")}
            style={{ top, ...side, maxHeight: previewH, minWidth: 80 }}>
            <span className="line-clamp-6 whitespace-pre-wrap break-words">{messageSummary(msg) || "Message"}</span>
          </div>

          <div className="absolute w-[230px] overflow-hidden rounded-2xl bg-white py-1.5 text-neutral-900 shadow-2xl animate-scale-in" style={{ top: menuTop, ...side }}>
            {stage === "main" ? (
              shown.map(({ a, label, icon: Icon, danger }) => (
                <button key={a} type="button" onClick={() => (a === "deleteMe" ? setStage("delete") : (onAction(a), onClose()))}
                  className={cn("flex h-[46px] w-full items-center justify-between px-4 text-[15.5px] active:bg-neutral-100", danger && "text-red-600")}>
                  {label}
                  <Icon className="h-[19px] w-[19px] opacity-80" />
                </button>
              ))
            ) : (
              <div className="px-1">
                <p className="px-3 pb-1 pt-2 text-[13px] text-neutral-500">Delete message?</p>
                {canDeleteForAll && (
                  <button type="button" onClick={() => { onAction("deleteAll"); onClose(); }} className="flex h-[46px] w-full items-center px-3 text-[15.5px] text-red-600 active:bg-neutral-100">Delete for everyone</button>
                )}
                <button type="button" onClick={() => { onAction("deleteMe"); onClose(); }} className="flex h-[46px] w-full items-center px-3 text-[15.5px] text-red-600 active:bg-neutral-100">Delete for me</button>
                <button type="button" onClick={onClose} className="flex h-[46px] w-full items-center px-3 text-[15.5px] active:bg-neutral-100">Cancel</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
