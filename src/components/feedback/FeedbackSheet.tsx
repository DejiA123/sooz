import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { sendFeedback, type FeedbackRating } from "@/services/api/feedback";

/** "Send feedback": 👍 or 👎, a few optional words, straight to SOOZ's team. */
export const FeedbackSheet = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { if (!open) { setRating(null); setComment(""); setSending(false); } }, [open]);

  const send = async () => {
    if (!rating || sending) return;
    if (!user) { onOpenChange(false); toast("Sign in to send feedback"); navigate("/auth"); return; }
    setSending(true);
    const ok = await sendFeedback(rating, comment);
    setSending(false);
    if (!ok) { toast.error("Couldn't send it — please try again"); return; }
    toast.success(rating === "up" ? "Thank you! 🙌 That means a lot" : "Thank you — we'll look into it 🙏");
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="border-white/10 bg-[#121318] pb-[calc(env(safe-area-inset-bottom,0px)+16px)] text-white">
        <div className="mx-auto w-full max-w-md px-5 pt-3">
          <DrawerTitle className="text-center font-display text-[20px] font-bold">How's SOOZ for you?</DrawerTitle>
          <DrawerDescription className="mt-1 text-center text-[13.5px] text-white/60">Your feedback goes straight to the SOOZ team.</DrawerDescription>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {([
              { r: "up" as const, Icon: ThumbsUp, label: "I like it", on: "bg-emerald-500/20 ring-emerald-400 text-emerald-300" },
              { r: "down" as const, Icon: ThumbsDown, label: "Something's wrong", on: "bg-rose-500/20 ring-rose-400 text-rose-300" },
            ]).map(({ r, Icon, label, on }) => (
              <button
                key={r}
                type="button"
                aria-pressed={rating === r}
                onClick={() => setRating(r)}
                className={cn("flex flex-col items-center gap-2 rounded-2xl bg-white/[0.06] py-5 text-[14px] font-semibold ring-2 ring-transparent transition active:scale-95", rating === r && on)}
              >
                <Icon className={cn("h-9 w-9", rating === r && "fill-current/20")} />
                {label}
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 2000))}
            rows={4}
            placeholder={rating === "down" ? "What went wrong? What were you doing? (optional)" : rating === "up" ? "What do you love? Anything we could add? (optional)" : "Add a comment (optional)"}
            className="mt-4 w-full resize-none rounded-2xl border-0 bg-white/[0.07] p-4 text-[16px] text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
          />

          <button
            type="button"
            onClick={send}
            disabled={!rating || sending}
            className="mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 text-[16px] font-bold text-black active:scale-[0.98] disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send feedback"}
          </button>
          {!rating && <p className="mt-2 text-center text-[12.5px] text-white/45">Tap 👍 or 👎 first</p>}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
