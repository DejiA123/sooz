import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Loader2, Send, X } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { ReportSheet } from "@/components/safety/ReportSheet";
import { useSafeFilter } from "@/components/safety/useSafeFilter";
import { notifyActivity } from "@/lib/push";

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  user: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  sending?: boolean;
}

const SELECT = "id, content, created_at, user_id, parent_id, user:user_id(username, display_name, avatar_url)";

/** The comments table hasn't been created in the database yet (the migration isn't applied). */
const isMissingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));

const shortAgo = (iso: string) =>
  formatDistanceToNowStrict(new Date(iso))
    .replace(/ seconds?/, "s").replace(/ minutes?/, "m").replace(/ hours?/, "h")
    .replace(/ days?/, "d").replace(/ months?/, "mo").replace(/ years?/, "y");

interface TikTokCommentsProps {
  tiktokId: string;
  tiktokUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCount?: (n: number) => void;
}

/** SOOZ members' comments on a TikTok, in a TikTok-style sheet. */
export const TikTokComments = ({ tiktokId, tiktokUrl, open, onOpenChange, onCount }: TikTokCommentsProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { allowed, refresh } = useSafeFilter();
  const [reporting, setReporting] = useState<CommentRow | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("tiktok_comments").select(SELECT).eq("tiktok_id", tiktokId).order("created_at", { ascending: false }).limit(300);
    if (isMissingTable(error)) { setSetupNeeded(true); setLoading(false); return; }
    if (!error && data) setRows(data as unknown as CommentRow[]);
    setLoading(false);
  }, [tiktokId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    load();
    const ch = supabase
      .channel(`tt-comments:${tiktokId}:${crypto.randomUUID().slice(0, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tiktok_comments", filter: `tiktok_id=eq.${tiktokId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, tiktokId, load]);

  useEffect(() => { if (!loading && !setupNeeded) onCount?.(rows.filter((r) => !r.sending).length); }, [rows, loading, setupNeeded, onCount]);

  // Top-level comments newest first, each followed by its replies (oldest first).
  const threads = useMemo(() => {
    // Not what this person reported, and in family-safe mode nothing unsuitable.
    const shown = rows.filter((r) => r.sending || r.user_id === user?.id || allowed("tiktok_comment", r.id, r.content));
    const top = shown.filter((r) => !r.parent_id || !shown.some((p) => p.id === r.parent_id));
    const replies = (id: string) => shown.filter((r) => r.parent_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
    return top.map((c) => ({ c, replies: replies(c.id) }));
  }, [rows, allowed, user?.id]);

  const nameOf = (r: CommentRow) => r.user?.display_name || r.user?.username || "SOOZ member";

  const post = async () => {
    const content = text.trim();
    if (!content) return;
    if (!user) { toast("Sign in to comment"); navigate("/auth"); return; }
    const parent = replyTo ? (replyTo.parent_id ?? replyTo.id) : null;
    const temp: CommentRow = {
      id: `local-${crypto.randomUUID()}`, content, created_at: new Date().toISOString(), user_id: user.id, parent_id: parent,
      user: { username: user.user_metadata?.username ?? null, display_name: user.user_metadata?.display_name ?? null, avatar_url: user.user_metadata?.avatar_url ?? null },
      sending: true,
    };
    setRows((r) => [temp, ...r]);
    setText("");
    setReplyTo(null);
    const { data, error } = await supabase.from("tiktok_comments").insert({ tiktok_id: tiktokId, user_id: user.id, content, parent_id: parent }).select(SELECT).single();
    if (parent) notifyActivity();
    if (error || !data) {
      setRows((r) => r.filter((x) => x.id !== temp.id));
      setText(content);
      if (isMissingTable(error)) setSetupNeeded(true);
      else toast.error("Couldn't post your comment — please try again");
      return;
    }
    setRows((r) => [data as unknown as CommentRow, ...r.filter((x) => x.id !== temp.id && x.id !== (data as { id: string }).id)]);
  };

  const remove = async (id: string) => {
    const before = rows;
    setRows((r) => r.filter((x) => x.id !== id && x.parent_id !== id));
    const { error } = await supabase.from("tiktok_comments").delete().eq("id", id);
    if (error) { setRows(before); toast.error("Couldn't delete that comment"); }
  };

  const count = rows.filter((r) => !r.sending).length;

  const renderComment = (r: CommentRow, reply?: boolean) => (
    <div key={r.id} className={cn("flex gap-3", reply ? "ml-12 mt-3" : "mt-5", r.sending && "opacity-60")}>
      <Avatar className={reply ? "h-7 w-7" : "h-9 w-9"}>
        <AvatarImage src={r.user?.avatar_url || ""} className="object-cover" />
        <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-700 text-[13px] font-bold text-white">{nameOf(r)[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-white/55">{nameOf(r)}</p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-snug text-white">{r.content}</p>
        <div className="mt-1.5 flex items-center gap-4 text-[12.5px] text-white/45">
          <span>{r.sending ? "Posting…" : shortAgo(r.created_at)}</span>
          {!r.sending && (
            <button type="button" className="font-semibold text-white/60" onClick={() => { setReplyTo(r); inputRef.current?.focus(); }}>Reply</button>
          )}
          {!r.sending && user?.id === r.user_id && (
            <button type="button" className="font-semibold text-white/60" onClick={() => remove(r.id)}>Delete</button>
          )}
          {!r.sending && user?.id !== r.user_id && (
            <button type="button" className="font-semibold text-white/40" onClick={() => setReporting(r)}>Report</button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex h-[74vh] flex-col rounded-t-[20px] border-white/10 bg-[#121317] text-white">
        <div className="relative flex shrink-0 items-center justify-center border-b border-white/[0.06] px-4 pb-3 pt-2">
          <DrawerTitle className="text-[15px] font-bold">{loading ? "Comments" : `${count} comment${count === 1 ? "" : "s"}`}</DrawerTitle>
          <button type="button" aria-label="Close" onClick={() => onOpenChange(false)} className="absolute right-3 top-1 flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
          ) : setupNeeded ? (
            <div className="px-4 py-12 text-center">
              <p className="text-[16px] font-semibold">Comments are almost ready</p>
              <p className="mt-2 text-[14px] text-white/55">They switch on as soon as SOOZ's latest database update is applied.</p>
            </div>
          ) : threads.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-[16px] font-semibold">No comments yet</p>
              <p className="mt-2 text-[14px] text-white/55">Be the first to share what this stirred in you 🙏</p>
            </div>
          ) : (
            threads.map(({ c, replies }) => (
              <div key={c.id}>
                {renderComment(c)}
                {replies.map((r) => renderComment(r, true))}
              </div>
            ))
          )}
          <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className="mx-auto mt-8 flex w-fit items-center gap-1.5 rounded-full bg-white/[0.07] px-4 py-2 text-[13px] font-medium text-white/70">
            See comments on TikTok <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="tt-comment-bar shrink-0 border-t border-white/[0.06] bg-[#121317] px-3 pt-2">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded-xl bg-white/[0.06] px-3 py-1.5 text-[13px] text-white/70">
              <span className="truncate">Replying to <b className="text-white">{nameOf(replyTo)}</b></span>
              <button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><X className="h-4 w-4" /></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); post(); } }}
              onFocus={() => { if (!user) { toast("Sign in to comment"); navigate("/auth"); } }}
              disabled={setupNeeded}
              placeholder={setupNeeded ? "Comments are almost ready" : replyTo ? "Add a reply…" : "Add a comment…"}
              className="h-11 flex-1 rounded-full border-0 bg-white/[0.08] px-4 text-[16px] text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-amber-400/40 disabled:opacity-50"
            />
            <button
              type="button"
              aria-label="Post comment"
              onClick={post}
              disabled={!text.trim() || setupNeeded}
              className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors", text.trim() ? "bg-amber-400 text-[#1a1204]" : "bg-white/[0.08] text-white/30")}
            >
              <Send className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </DrawerContent>
      {reporting && (
        <ReportSheet
          target={{ type: "tiktok_comment", id: reporting.id, owner: reporting.user_id, snapshot: `${nameOf(reporting)} on TikTok ${tiktokId}: ${reporting.content}` }}
          open={!!reporting}
          onOpenChange={(o) => { if (!o) setReporting(null); }}
          onReported={refresh}
        />
      )}
    </Drawer>
  );
};
