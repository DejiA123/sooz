import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Inbox, Loader2, RotateCcw, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/lib/admin";
import { deleteFeedback, listFeedback, setFeedbackResolved, type FeedbackRow } from "@/services/api/feedback";

type Filter = "open" | "down" | "up" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "To read" },
  { key: "down", label: "👎" },
  { key: "up", label: "👍" },
  { key: "all", label: "All" },
];

/** Admin-only: every 👍 / 👎 people sent with "Send feedback", newest first. */
export default function FeedbackInbox() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["feedback-inbox"], queryFn: listFeedback, enabled: isAdmin, staleTime: 15_000 });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const rows = q.data ?? [];
  const ups = rows.filter((r) => r.rating === "up").length;
  const downs = rows.length - ups;
  const shown = rows.filter((r) => filter === "all" ? true : filter === "open" ? !r.resolved : r.rating === filter);

  const update = (id: string, patch: Partial<FeedbackRow> | null) => {
    qc.setQueryData<FeedbackRow[]>(["feedback-inbox"], (old) => patch === null ? (old ?? []).filter((r) => r.id !== id) : (old ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)));
    qc.invalidateQueries({ queryKey: ["feedback-count"] });
  };
  const resolve = async (r: FeedbackRow) => {
    setBusy(r.id);
    if (await setFeedbackResolved(r.id, !r.resolved)) update(r.id, { resolved: !r.resolved });
    else toast.error("Couldn't update it");
    setBusy(null);
  };
  const remove = async (r: FeedbackRow) => {
    if (!window.confirm("Delete this feedback?")) return;
    setBusy(r.id);
    if (await deleteFeedback(r.id)) update(r.id, null);
    else toast.error("Couldn't delete it");
    setBusy(null);
  };

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--bottom-nav-height)+2rem)] text-foreground">
      <div className="sticky top-0 z-10 border-b border-border/20 bg-background/90 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="flex-1 font-display text-xl font-bold">Feedback</h1>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 px-1">
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3"><ThumbsUp className="h-5 w-5 text-emerald-400" /><span className="text-[22px] font-bold tabular-nums">{ups}</span><span className="text-[13px] text-muted-foreground">liked it</span></div>
          <div className="flex items-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-3"><ThumbsDown className="h-5 w-5 text-rose-400" /><span className="text-[22px] font-bold tabular-nums">{downs}</span><span className="text-[13px] text-muted-foreground">had issues</span></div>
        </div>
        <div className="mt-3 flex gap-2 px-1">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
              className={cn("rounded-full px-4 py-1.5 text-[13.5px] font-semibold", filter === f.key ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")}>
              {f.label}{f.key === "open" ? ` (${rows.filter((r) => !r.resolved).length})` : ""}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : q.isError ? (
        <p className="px-6 py-16 text-center text-sm text-muted-foreground">Couldn't load feedback. Pull down to try again.</p>
      ) : shown.length === 0 ? (
        <div className="px-8 py-20 text-center">
          <Inbox className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="mt-3 font-semibold">{filter === "open" ? "All caught up 🙌" : "Nothing here yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">People send feedback from the menu or Settings → Send feedback.</p>
        </div>
      ) : (
        <div className="space-y-3 px-3 pt-3">
          {shown.map((r) => {
            const name = r.profile?.display_name || r.profile?.username || "Someone";
            return (
              <div key={r.id} className={cn("rounded-2xl border border-border/20 bg-card p-4", r.resolved && "opacity-60")}>
                <div className="flex items-center gap-3">
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", r.rating === "up" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400")}>
                    {r.rating === "up" ? <ThumbsUp className="h-5 w-5" /> : <ThumbsDown className="h-5 w-5" />}
                  </span>
                  <Link to={r.profile ? `/profile/${r.profile.username}` : "#"} className="flex min-w-0 flex-1 items-center gap-2">
                    <Avatar className="h-7 w-7"><AvatarImage src={r.profile?.avatar_url || ""} className="object-cover" /><AvatarFallback className="text-[11px]">{name[0]?.toUpperCase()}</AvatarFallback></Avatar>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold">{name}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">{formatDistanceToNowStrict(new Date(r.created_at), { addSuffix: true })}{r.profile ? ` · @${r.profile.username}` : ""}</span>
                    </span>
                  </Link>
                </div>
                {r.comment ? <p className="mt-3 whitespace-pre-line text-[15px] leading-snug">{r.comment}</p> : <p className="mt-3 text-[14px] italic text-muted-foreground">No comment</p>}
                <p className="mt-2 text-[11.5px] text-muted-foreground">{[r.page && `on ${r.page}`, r.device].filter(Boolean).join(" · ")}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={busy === r.id} onClick={() => resolve(r)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-secondary py-2 text-[13.5px] font-semibold active:scale-[0.98] disabled:opacity-50">
                    {r.resolved ? <><RotateCcw className="h-4 w-4" /> Mark unread</> : <><Check className="h-4 w-4" /> Mark done</>}
                  </button>
                  <button type="button" disabled={busy === r.id} onClick={() => remove(r)} aria-label="Delete" className="flex w-12 items-center justify-center rounded-xl bg-secondary text-rose-400 active:scale-95 disabled:opacity-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
