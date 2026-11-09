import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, EyeOff, Loader2, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/lib/admin";
import { resetForYou } from "@/services/api/feed";
import { fetchReportQueue, moderate, type ReportGroup, type ReportReason, type ReportTargetType } from "@/services/api/safety";

const REASON: Record<ReportReason, string> = {
  sexual: "Sexual / nudity", child_safety: "Child safety", hate: "Hate / bullying", violence: "Violence", self_harm: "Self-harm",
  false_teaching: "False teaching", spam: "Spam / scam", not_christian: "Not Christian", other: "Other",
};
const KIND: Record<ReportTargetType, string> = {
  post: "Post", comment: "Comment", tiktok: "TikTok", tiktok_comment: "TikTok comment", user: "Account", message: "Chat message", story: "Story",
};
const URGENT: ReportReason[] = ["sexual", "child_safety", "self_harm"];

function openLink(g: ReportGroup): string | null {
  if (g.type === "post") return `/post/${g.id}`;
  if (g.type === "tiktok") return `/?tiktok=${g.id}`;
  return null;
}

/** Admin-only: everything members reported, one card per item, with the decision buttons. */
export default function Moderation() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["moderation", tab], queryFn: () => fetchReportQueue(tab), enabled: isAdmin, staleTime: 15_000 });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const act = async (g: ReportGroup, action: "hide" | "remove" | "keep") => {
    setBusy(`${g.type}:${g.id}`);
    try {
      await moderate(g.type, g.id, action);
      toast(action === "keep" ? "Kept — reports closed" : action === "remove" ? "Removed" : "Hidden for everyone");
      resetForYou();
      qc.invalidateQueries({ queryKey: ["moderation"] });
      qc.invalidateQueries({ queryKey: ["moderation-count"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    } catch {
      toast.error("Couldn't do that — please try again");
    }
    setBusy(null);
  };

  const groups = [...(q.data ?? [])].sort((a, b) => {
    const urgent = (g: ReportGroup) => Number(URGENT.some((r) => g.reasons[r]));
    return urgent(b) - urgent(a) || b.people - a.people || b.last.localeCompare(a.last);
  });

  return (
    <div className="min-h-screen bg-background pb-32 text-foreground">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/20 bg-background/90 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-xl">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 font-display text-xl font-bold">Moderation</h1>
        <ShieldCheck className="h-5 w-5 text-amber-400" />
      </div>

      <div className="mx-4 mt-4 flex rounded-full bg-secondary/50 p-1">
        {(["open", "closed"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn("flex-1 rounded-full py-2 text-[14px] font-semibold", tab === t ? "bg-amber-400 text-black" : "text-muted-foreground")}>
            {t === "open" ? "To review" : "Done"}
          </button>
        ))}
      </div>

      <p className="mx-5 mt-3 text-[12.5px] leading-snug text-muted-foreground">
        Reported posts and comments are hidden for everyone straight away after one report for sexual content or child safety, or after three different people report them. <b>Keep</b> shows them again; <b>Hide</b> keeps them hidden; <b>Remove</b> deletes them.
      </p>

      <div className="mt-4 space-y-3 px-4">
        {q.isLoading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
        {q.isError && <p className="py-10 text-center text-sm text-muted-foreground">Couldn't load reports.</p>}
        {!q.isLoading && !q.isError && groups.length === 0 && (
          <div className="py-16 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-emerald-400" />
            <p className="mt-3 font-semibold">{tab === "open" ? "Nothing to review" : "No decisions yet"}</p>
            {tab === "open" && <p className="mt-1 text-sm text-muted-foreground">You'll see anything members report here.</p>}
          </div>
        )}
        {groups.map((g) => {
          const key = `${g.type}:${g.id}`;
          const link = openLink(g);
          const urgent = URGENT.some((r) => g.reasons[r]);
          const canDelete = g.type === "post" || g.type === "comment" || g.type === "tiktok_comment";
          return (
            <div key={key} className={cn("rounded-2xl border bg-card p-4", urgent ? "border-red-500/40" : "border-border/20")}>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[12px] font-bold">{KIND[g.type]}</span>
                <span className="text-[12.5px] text-muted-foreground">{g.people} {g.people === 1 ? "report" : "reports"} · {formatDistanceToNowStrict(new Date(g.last), { addSuffix: true })}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(g.reasons).map(([r, n]) => (
                  <span key={r} className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", URGENT.includes(r as ReportReason) ? "bg-red-500/15 text-red-400" : "bg-amber-400/15 text-amber-300")}>
                    {REASON[r as ReportReason]}{n && n > 1 ? ` ×${n}` : ""}
                  </span>
                ))}
              </div>
              {g.snapshot && <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-secondary/40 p-3 text-[14px] leading-snug">{g.snapshot}</p>}
              {g.details.length > 0 && (
                <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
                  {g.details.slice(0, 5).map((d, i) => <li key={i}>“{d}”</li>)}
                </ul>
              )}
              {link && <Link to={link} className="mt-2 inline-block text-[13px] font-semibold text-amber-400">Open it</Link>}
              {tab === "open" && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button type="button" disabled={busy === key} onClick={() => act(g, "keep")} className="flex items-center justify-center gap-1.5 rounded-full bg-secondary py-2.5 text-[13.5px] font-semibold disabled:opacity-50">
                    <Undo2 className="h-4 w-4" /> Keep
                  </button>
                  <button type="button" disabled={busy === key || g.type === "message"} onClick={() => act(g, "hide")} className="flex items-center justify-center gap-1.5 rounded-full bg-amber-400 py-2.5 text-[13.5px] font-bold text-black disabled:opacity-40">
                    <EyeOff className="h-4 w-4" /> {g.type === "user" ? "Hide posts" : "Hide"}
                  </button>
                  <button type="button" disabled={busy === key || !canDelete} onClick={() => { if (confirm("Delete this for good?")) act(g, "remove"); }} className="flex items-center justify-center gap-1.5 rounded-full bg-red-500/90 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-30">
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
