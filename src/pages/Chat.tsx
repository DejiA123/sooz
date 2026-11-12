import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { ChatList } from "@/components/chat/ChatList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { cn } from "@/lib/utils";

/**
 * Messages. Phone: the list, and an open conversation takes the whole screen (its own header at
 * the top, typing bar at the bottom — like WhatsApp). Desktop: list + conversation side by side.
 * The open chat is in the address (?c=ID, and ?m=ID to jump to a message), so the phone's back
 * gesture closes it and notifications / profile "Message" buttons can open a chat directly.
 */
export default function Chat() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedChatId = params.get("c");
  const focusMessageId = params.get("m");
  const openRef = useRef<HTMLDivElement>(null);

  const openChat = (id: string, messageId?: string) => {
    const next = new URLSearchParams();
    next.set("c", id);
    if (messageId) next.set("m", messageId);
    // From the list: a new history step (Back returns to the list). Chat → chat: replace.
    setParams(next, { replace: !!selectedChatId, state: { fromList: !selectedChatId || (location.state as { fromList?: boolean } | null)?.fromList } });
  };
  const closeChat = () => {
    if ((location.state as { fromList?: boolean } | null)?.fromList) navigate(-1);
    else setParams(new URLSearchParams(), { replace: true });
  };

  // The Messages list is light (like TikTok's inbox): the bottom bar turns light with it.
  useEffect(() => {
    document.body.classList.toggle("messages-light-page", !selectedChatId);
    return () => document.body.classList.remove("messages-light-page");
  }, [selectedChatId]);

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
      <div className={cn("chat-list-panel h-full w-full shrink-0 overflow-hidden bg-white md:w-80 md:border-r md:border-neutral-200 lg:w-96", selectedChatId ? "hidden md:block" : "block")}>
        <ChatList selectedId={selectedChatId || undefined} onSelect={openChat} />
      </div>

      {selectedChatId ? (
        <div ref={openRef} className="chat-open fixed inset-x-0 top-0 h-[100dvh] md:static md:z-auto md:h-full md:min-w-0 md:flex-1">
          <ChatWindow key={selectedChatId} chatId={selectedChatId} focusMessageId={focusMessageId} onBack={closeChat} onOpenChat={(id) => openChat(id)} />
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
