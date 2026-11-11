import { useState } from "react";
import { ArrowLeft, ChevronRight, LogOut, ThumbsUp } from "lucide-react";
import { FeedbackSheet } from "@/components/feedback/FeedbackSheet";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FamilySafeSetting } from "@/components/safety/FamilySafeSetting";
import { useIsAdmin } from "@/lib/admin";
import { REEL_UI_DEFAULT, setReelUi, useReelUi, type ReelUi } from "@/lib/reelUi";
import { cn } from "@/lib/utils";

/** Admin only: try the two looks of the feed's buttons on this phone (everyone else gets REEL_UI_DEFAULT). */
const VideoButtonsSetting = () => {
  const ui = useReelUi();
  const options: { value: ReelUi; label: string; hint: string }[] = [
    { value: "float", label: "Floating", hint: "Over the video, like TikTok" },
    { value: "dock", label: "Side panel", hint: "The earlier look" },
  ];
  return (
    <>
      <p className="px-1 pt-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Video buttons · admin</p>
      <div className="rounded-2xl border border-border/20 bg-card p-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Video buttons">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={ui === o.value}
              onClick={() => setReelUi(o.value)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-colors",
                ui === o.value ? "border-primary bg-primary/10" : "border-border/30 bg-secondary/40 active:bg-secondary"
              )}
            >
              <span className="block text-[14px] font-semibold">{o.label}</span>
              <span className="block text-[12px] text-muted-foreground">{o.hint}</span>
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[12px] leading-snug text-muted-foreground">
          Only changes this phone. Everyone else sees {REEL_UI_DEFAULT === "float" ? "Floating" : "Side panel"}.
        </p>
      </div>
    </>
  );
};

export default function Settings() {
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { isAdmin } = useIsAdmin();
  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch (error) { console.error(error); }
    finally { Object.keys(localStorage).forEach((key) => { if (key.startsWith("sb-")) localStorage.removeItem(key); }); window.location.href = "/auth"; }
  };

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--bottom-nav-height)+6rem)]">
      <div className="px-5 py-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display font-bold">Settings</h1>
        </div>

        <div className="space-y-3">
          {/* Safety */}
          <p className="px-1 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Safety</p>
          <FamilySafeSetting />

          {isAdmin && <VideoButtonsSetting />}

          {/* Feedback */}
          <p className="px-1 pt-4 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Help us improve</p>
          <button type="button" onClick={() => setFeedbackOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-border/20 bg-card p-4 text-left active:bg-secondary/40">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-sky-400"><ThumbsUp className="h-[18px] w-[18px]" /></span>
            <span className="flex-1">
              <span className="block text-[14px] font-semibold">Send feedback</span>
              <span className="block text-[12px] text-muted-foreground">👍 or 👎 and tell us why</span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Logout */}
          <div className="pt-4">
            <Button variant="ghost" className="w-full justify-start gap-3 h-14 text-destructive hover:text-destructive hover:bg-destructive/5 rounded-2xl" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
              <span className="font-bold">Log Out</span>
            </Button>
          </div>
        </div>
      </div>
      <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}