import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { ChatList } from "@/components/chat/ChatList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { cn } from "@/lib/utils";

/**
 * Messages. Phone: the list, and an open conversation takes the whole screen (its own header at
 * the top, typing bar at the bottom — like WhatsApp / TikTok's inbox). Desktop: list + conversation.
 */
export default function Chat() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const openRef = useRef<HTMLDivElement>(null);

  // iPhone keyboard: keep the open conversation exactly the visible height, so the typing bar sits
  // right above the keyboard and the header stays at the top.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = openRef.current;
    if (!vv || !el || !selectedChatId) return;
    const fit = () => {
      if (window.matchMedia("(min-width: 768px)").matches) { el.style.height = ""; el.style.transform = ""; return; }
      el.style.height = `${vv.height}px`;
      el.style.transform = `translateY(${vv.offsetTop}px)`;
    };
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => { vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); };
  }, [selectedChatId]);

  return (
    <div className={cn("chat-page fixed inset-x-0 bottom-0 flex bg-[#05070b] md:left-64 md:top-0", selectedChatId && "z-[60] md:z-auto")}>
      <div className={cn("h-full w-full shrink-0 border-white/[0.06] md:w-80 md:border-r lg:w-96", selectedChatId ? "hidden md:block" : "block")}>
        <ChatList selectedId={selectedChatId || undefined} onSelect={setSelectedChatId} />
      </div>

      {selectedChatId ? (
        <div ref={openRef} className="chat-open fixed inset-x-0 top-0 h-[100dvh] md:static md:z-auto md:h-full md:min-w-0 md:flex-1">
          <ChatWindow chatId={selectedChatId} onBack={() => setSelectedChatId(null)} />
        </div>
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center gap-3 text-center md:flex">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.06]">
            <MessageCircle className="h-9 w-9 text-amber-400" />
          </span>
          <p className="text-[18px] font-semibold text-white">Your messages</p>
          <p className="text-[14px] text-white/50">Pick a conversation to start chatting</p>
        </div>
      )}
    </div>
  );
}
