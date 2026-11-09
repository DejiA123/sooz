import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BookX, Check, Ban, HeartCrack, Megaphone, ShieldAlert, Skull, Sparkles, UserX } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { submitReport, type ReportReason, type ReportTarget } from "@/services/api/safety";

const REASONS: { id: ReportReason; label: string; hint: string; icon: typeof AlertTriangle }[] = [
  { id: "sexual", label: "Sexual or nudity", hint: "Hidden straight away until we check", icon: ShieldAlert },
  { id: "child_safety", label: "Puts a child at risk", hint: "Hidden straight away until we check", icon: AlertTriangle },
  { id: "hate", label: "Hate, bullying or harassment", hint: "", icon: UserX },
  { id: "violence", label: "Violence or dangerous acts", hint: "", icon: Skull },
  { id: "self_harm", label: "Self-harm or suicide", hint: "", icon: HeartCrack },
  { id: "false_teaching", label: "False teaching or misleading", hint: "", icon: BookX },
  { id: "spam", label: "Spam, scam or fake", hint: "", icon: Megaphone },
  { id: "not_christian", label: "Not Christian content", hint: "", icon: Ban },
  { id: "other", label: "Something else", hint: "", icon: Sparkles },
];

const NOUN: Record<ReportTarget["type"], string> = {
  post: "post", comment: "comment", tiktok: "video", tiktok_comment: "comment", user: "account", message: "message", story: "story",
};

/** "Report": why it's wrong, a few optional words, and it's sent to SOOZ's moderators. */
export const ReportSheet = ({ target, open, onOpenChange, onReported }: {
  target: ReportTarget;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** After it was sent (e.g. to move on to the next video). */
  onReported?: () => void;
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const noun = NOUN[target.type];

  const send = async () => {
    if (!reason || sending) return;
    if (!user) { toast("Sign in to report"); navigate("/auth"); return; }
    setSending(true);
    const ok = await submitReport(target, reason, details);
    setSending(false);
    if (!ok) { toast.error("Couldn't send your report — please try again"); return; }
    onOpenChange(false);
    setReason(null);
    setDetails("");
    toast(`Thank you — our moderators will look at this ${noun}. You won't see it again.`);
    onReported?.();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh] border-white/10 bg-[#111216] text-white">
        <div className="overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom,0px),16px)]">
          <DrawerTitle className="pt-2 text-center text-[17px] font-bold">Report this {noun}</DrawerTitle>
          <p className="mx-auto mt-1 max-w-xs text-center text-[13px] text-white/60">Reports are private — the person won't know it was you.</p>
          <div className="mt-4 space-y-1.5">
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReason(r.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors",
                  reason === r.id ? "bg-amber-400/15 ring-1 ring-amber-400/60" : "bg-white/[0.04] active:bg-white/10",
                )}
              >
                <r.icon className={cn("h-5 w-5 shrink-0", reason === r.id ? "text-amber-400" : "text-white/70")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{r.label}</span>
                  {r.hint && <span className="block text-[12px] text-white/50">{r.hint}</span>}
                </span>
                {reason === r.id && <Check className="h-5 w-5 text-amber-400" />}
              </button>
            ))}
          </div>
          {reason && (
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
              placeholder="Anything we should know? (optional)"
              rows={3}
              className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[15px] text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-amber-400/60"
            />
          )}
          <button
            type="button"
            disabled={!reason || sending}
            onClick={send}
            className="mt-3 w-full rounded-full bg-amber-400 py-3.5 text-[15px] font-bold text-black transition-opacity disabled:opacity-40"
          >
            {sending ? "Sending…" : "Send report"}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
