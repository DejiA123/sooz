import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, ExternalLink, Loader2, PackageOpen, ShieldCheck, Sparkles, Trash2, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { importTikToks, type TikTokImportResult } from "@/services/api/tiktok";
import { STARTER_TIKTOKS, STARTER_TRUSTED_CREATORS, STARTER_VERSION } from "@/data/christianTikTokStarter";
import { LibraryCard } from "@/components/tiktok/LibraryCard";
import { ChristianCreators } from "@/components/tiktok/ChristianCreators";

const STARTER_FLAG = "sooz-tiktok-starter";

type Row = {
  id: string;
  tiktok_id: string;
  url: string;
  title: string | null;
  author_name: string | null;
  author_handle: string | null;
  thumbnail_url: string | null;
  status: string;
  review_note: string | null;
  faith_tags: string[];
  created_at: string;
};

const ROW_COLUMNS = "id, tiktok_id, url, title, author_name, author_handle, thumbnail_url, status, review_note, faith_tags, created_at";

const extractLinks = (text: string) =>
  [...new Set((text.match(/(?:https?:\/\/)?(?:[\w-]+\.)?tiktok\.com\/[^\s<>"']+/gi) || []).map((u) => u.replace(/[),.]+$/, "")))];

const STATUS_STYLE: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  approved: { label: "In the feed", className: "bg-emerald-500/15 text-emerald-400", icon: CheckCircle2 },
  pending: { label: "Waiting for review", className: "bg-amber-500/15 text-amber-400", icon: Clock },
  rejected: { label: "Not added", className: "bg-red-500/15 text-red-400", icon: XCircle },
  duplicate: { label: "Already added", className: "bg-white/10 text-muted-foreground", icon: CheckCircle2 },
  error: { label: "Problem", className: "bg-red-500/15 text-red-400", icon: XCircle },
  needs_override: { label: "Check this one", className: "bg-amber-500/15 text-amber-400", icon: Clock },
};

const StatusChip = ({ status }: { status: string }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", s.className)}>
      <s.icon className="h-3 w-3" /> {s.label}
    </span>
  );
};

const VideoRow = ({ row, actions }: { row: Row; actions?: React.ReactNode }) => (
  <li className="flex gap-3 rounded-2xl border border-border/60 bg-card/60 p-3">
    <a href={row.url} target="_blank" rel="noopener noreferrer" className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-black">
      {row.thumbnail_url && <img src={row.thumbnail_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" loading="lazy" />}
      <ExternalLink className="absolute bottom-1 right-1 h-3.5 w-3.5 text-white drop-shadow" />
    </a>
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-bold">@{row.author_handle || row.author_name || "creator"}</p>
        <StatusChip status={row.status} />
      </div>
      <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{row.title || "No caption"}</p>
      {row.review_note && <p className="mt-1 text-[12px] font-medium text-amber-400">{row.review_note}</p>}
      {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
    </div>
  </li>
);

/** Only SOOZ's admins can open the library manager; everyone else goes back to the feed. */
export default function ChristianTikTok() {
  const { isAdmin, loading } = useIsAdmin();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <ChristianTikTokManager />;
}

function ChristianTikTokManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [results, setResults] = useState<TikTokImportResult[]>([]);
  const [handle, setHandle] = useState("");
  const links = useMemo(() => extractLinks(text), [text]);

  const curator = useQuery({
    queryKey: ["tiktok-curator", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tiktok_curators").select("user_id").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
    retry: false,
  });
  const isCurator = curator.data === true;
  const notSetUp = curator.isError;

  const listKey = ["tiktok-admin", user?.id, isCurator];
  const lists = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      if (isCurator) {
        const [pending, approved, trusted] = await Promise.all([
          supabase.from("tiktok_videos").select(ROW_COLUMNS).eq("status", "pending").order("created_at", { ascending: true }).limit(100),
          supabase.from("tiktok_videos").select(ROW_COLUMNS).eq("status", "approved").order("created_at", { ascending: false }).limit(30),
          supabase.from("tiktok_trusted_creators").select("handle, note, created_at").order("created_at", { ascending: false }),
        ]);
        return { pending: (pending.data || []) as Row[], approved: (approved.data || []) as Row[], trusted: trusted.data || [], mine: [] as Row[] };
      }
      const mine = await supabase.from("tiktok_videos").select(ROW_COLUMNS).eq("submitted_by", user!.id).order("created_at", { ascending: false }).limit(50);
      return { pending: [] as Row[], approved: [] as Row[], trusted: [], mine: (mine.data || []) as Row[] };
    },
    enabled: !!user && curator.isSuccess,
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["tiktok-admin"] });
    queryClient.invalidateQueries({ queryKey: ["feed"] });
  };

  const submit = useMutation({
    mutationFn: ({ urls, force }: { urls: string[]; force?: boolean }) => importTikToks(urls, force),
    onSuccess: ({ results: r }, vars) => {
      setResults((prev) => (vars.force ? prev.map((p) => r.find((n) => n.url === p.url) || p) : r));
      if (!vars.force) setText("");
      const added = r.filter((x) => x.status === "approved").length;
      const pending = r.filter((x) => x.status === "pending").length;
      if (added) toast.success(`${added} video${added > 1 ? "s" : ""} added to the feed`);
      else if (pending) toast.success("Thanks! Sent for review");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("tiktok_videos").update({ status, reviewed_by: user!.id, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => { toast.success(v.status === "approved" ? "Approved — it's in the feed" : "Removed"); refreshAll(); },
    onError: () => toast.error("Couldn't update that video"),
  });

  const trust = useMutation({
    mutationFn: async ({ h, remove }: { h: string; remove?: boolean }) => {
      if (remove) {
        const { error } = await supabase.from("tiktok_trusted_creators").delete().eq("handle", h);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tiktok_trusted_creators").insert({ handle: h, added_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: (_, v) => { if (!v.remove) setHandle(""); toast.success(v.remove ? "Creator removed" : "Creator trusted — their Christian videos are approved automatically"); refreshAll(); },
    onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "Already trusted" : "Couldn't save creator"),
  });

  // Starter pack: real Christian TikToks so the feed is full straight away.
  const [starterProgress, setStarterProgress] = useState<string | null>(null);
  const starter = useMutation({
    mutationFn: async () => {
      // Official ministry accounts become trusted creators (their future links auto-approve).
      await supabase
        .from("tiktok_trusted_creators")
        .upsert(STARTER_TRUSTED_CREATORS.map((h) => ({ handle: h, note: "SOOZ starter pack", added_by: user!.id })), { onConflict: "handle", ignoreDuplicates: true });

      const official = new Set(STARTER_TIKTOKS.filter((t) => t.official).map((t) => t.url));
      const urls = STARTER_TIKTOKS.map((t) => t.url);
      const batches: string[][] = [];
      for (let i = 0; i < urls.length; i += 25) batches.push(urls.slice(i, i + 25)); // import limit per request
      const all: TikTokImportResult[] = [];
      for (const [i, batch] of batches.entries()) {
        setStarterProgress(`Checking videos with TikTok… (part ${i + 1} of ${batches.length})`);
        const { results } = await importTikToks(batch);
        all.push(...results);
      }
      // Official ministry posts sometimes have short captions; add those even without faith keywords.
      const retry = all.filter((r) => r.status === "needs_override" && official.has(r.url)).map((r) => r.url);
      if (retry.length) {
        setStarterProgress("Adding official ministry videos…");
        const { results: second } = await importTikToks(retry.slice(0, 25), true);
        return all.map((r) => second.find((n) => n.url === r.url) || r);
      }
      return all;
    },
    onSuccess: (r) => {
      try { localStorage.setItem(STARTER_FLAG, STARTER_VERSION); } catch { /* private mode */ }
      const added = r.filter((x) => x.status === "approved").length;
      toast.success(added ? `${added} Christian TikToks added to the feed 🙌` : "Starter pack is already in the feed");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setStarterProgress(null),
  });

  // Curators load the starter pack automatically — again whenever new links are added to it.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!isCurator || !lists.data || autoStarted.current) return;
    let version: string | null = null;
    try { version = localStorage.getItem(STARTER_FLAG); } catch { /* ignore */ }
    if (version === STARTER_VERSION) return;
    autoStarted.current = true;
    starter.mutate();
  }, [isCurator, lists.data, starter]);

  const starterSummary = starter.data && {
    added: starter.data.filter((x) => x.status === "approved").length,
    already: starter.data.filter((x) => x.status === "duplicate").length,
    skipped: starter.data.filter((x) => !["approved", "duplicate"].includes(x.status)).length,
  };

  const cleanHandle = handle.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?tiktok\.com\/@/i, "").split(/[/?#\s]/)[0].toLowerCase();

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-4 md:pt-0">
      <Helmet><title>Christian TikTok · SOOZ</title></Helmet>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(120%_90%_at_10%_0%,rgba(245,158,11,0.25),transparent_55%),linear-gradient(160deg,#0f1426,#070910)] p-6 text-white">
        <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-amber-300/90">
          <Sparkles className="h-4 w-4" /> Christian TikTok
        </div>
        <h1 className="mt-2 font-display text-[28px] font-bold leading-tight">Faith-filled TikToks, right in your feed</h1>
        <p className="mt-2 text-[15px] text-white/75">
          Paste links to Christian TikTok videos. SOOZ checks each one with TikTok, makes sure it's Christian content, and plays it in the For You feed with TikTok's official player, so creators keep the credit.
        </p>
      </div>

      <ChristianCreators />

      {!user ? (
        <div className="mt-6 rounded-3xl border border-border bg-card p-6 text-center">
          <p className="font-semibold">Sign in to add Christian TikToks to SOOZ.</p>
          <Button className="mt-4 rounded-full" onClick={() => navigate("/auth")}>Sign in</Button>
        </div>
      ) : notSetUp ? (
        <div className="mt-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm">
          <p className="font-bold text-amber-300">Christian TikTok isn't switched on yet</p>
          <p className="mt-1 text-muted-foreground">The database update for this feature still needs to be applied to the SOOZ backend. Once it is, this page and the TikTok videos in the feed start working automatically.</p>
        </div>
      ) : (
        <>
          {/* Add links */}
          <section className="mt-6 rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">{isCurator ? "Add videos to the feed" : "Suggest a video"}</h2>
              {isCurator && <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary"><ShieldCheck className="h-3.5 w-3.5" /> Curator</span>}
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              In TikTok, tap <b>Share → Copy link</b>, then paste it here. {isCurator ? "You can paste up to 25 links at once." : "Up to 10 at a time — a curator approves them before they appear."}
            </p>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"https://www.tiktok.com/@creator/video/123…\nhttps://vm.tiktok.com/…"}
              className="selectable mt-3 min-h-[110px] rounded-2xl text-[15px]"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[12px] text-muted-foreground">{links.length ? `${links.length} link${links.length > 1 ? "s" : ""} found` : "No TikTok links yet"}</span>
              <Button
                className="rounded-full px-6 font-bold"
                disabled={!links.length || submit.isPending}
                onClick={() => submit.mutate({ urls: links.slice(0, isCurator ? 25 : 10) })}
              >
                {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isCurator ? "Add to feed" : "Suggest"}
              </Button>
            </div>

            {results.length > 0 && (
              <ul className="mt-4 space-y-2">
                {results.map((r) => (
                  <li key={r.url} className="rounded-2xl bg-secondary/50 p-3 text-[13px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{r.author ? `@${r.author}` : r.url}</span>
                      <StatusChip status={r.status} />
                    </div>
                    {r.title && <p className="mt-1 line-clamp-1 text-muted-foreground">{r.title}</p>}
                    <p className="mt-1">{r.message}</p>
                    {r.status === "needs_override" && (
                      <Button size="sm" variant="secondary" className="mt-2 rounded-full" disabled={submit.isPending} onClick={() => submit.mutate({ urls: [r.url], force: true })}>
                        It's Christian — add anyway
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* How it stays Christian */}
          <section className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Verified with TikTok", "Each link's real caption and creator come straight from TikTok."],
              ["Faith filter", "Captions need Christian words, hashtags or Bible verses. Explicit content is blocked."],
              ["Human review", "Suggestions wait for a curator unless the creator is trusted."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-border/60 bg-card/60 p-4">
                <p className="text-sm font-bold">{t}</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">{d}</p>
              </div>
            ))}
          </section>

          <LibraryCard />

          {lists.isLoading && <div className="mt-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

          {isCurator && (
            <section className="mt-6 overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                  {starter.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackageOpen className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-bold">Christian TikTok starter pack</h2>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {STARTER_TIKTOKS.length} hand-picked videos from Bethel Music, Hillsong, Elevation, Maverick City, Moses Bliss, Mercy Chinwo, CeCe Winans, Pastor Jerry Eze, Pastor Mike Todd, YouVersion, BibleProject and gospel favourites like “Tobechukwu”. Their accounts are also trusted, so their other videos are approved straight away.
                  </p>
                  {starter.isPending && <p className="mt-2 text-[13px] font-semibold text-primary">{starterProgress || "Checking each video with TikTok…"} This can take a minute.</p>}
                  {starterSummary && (
                    <p className="mt-2 text-[13px] font-semibold">
                      {starterSummary.added} added · {starterSummary.already} already in the feed{starterSummary.skipped ? ` · ${starterSummary.skipped} skipped (removed, private or not clearly Christian)` : ""}
                    </p>
                  )}
                  <Button size="sm" className="mt-3 rounded-full px-5 font-bold" disabled={starter.isPending} onClick={() => starter.mutate()}>
                    {starter.isPending ? "Adding…" : starterSummary ? "Run again" : "Add the starter pack"}
                  </Button>
                </div>
              </div>
            </section>
          )}

          {isCurator && lists.data && (
            <>
              <section className="mt-8">
                <h2 className="font-display text-lg font-bold">Waiting for review <span className="text-muted-foreground">({lists.data.pending.length})</span></h2>
                {lists.data.pending.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">Nothing to review right now.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {lists.data.pending.map((row) => (
                      <VideoRow
                        key={row.id}
                        row={row}
                        actions={
                          <>
                            <Button size="sm" className="h-8 rounded-full" disabled={review.isPending} onClick={() => review.mutate({ id: row.id, status: "approved" })}>Approve</Button>
                            <Button size="sm" variant="secondary" className="h-8 rounded-full" disabled={review.isPending} onClick={() => review.mutate({ id: row.id, status: "rejected" })}>Reject</Button>
                          </>
                        }
                      />
                    ))}
                  </ul>
                )}
              </section>

              <section className="mt-8 rounded-3xl border border-border bg-card p-5">
                <h2 className="font-display text-lg font-bold">Trusted creators</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">Christian videos from these TikTok accounts are approved without waiting for review (the faith filter still applies).</p>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => { e.preventDefault(); if (cleanHandle) trust.mutate({ h: cleanHandle }); }}
                >
                  <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@creator" className="selectable rounded-full" />
                  <Button type="submit" className="rounded-full" disabled={!cleanHandle || trust.isPending}><UserPlus className="mr-1.5 h-4 w-4" /> Trust</Button>
                </form>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {lists.data.trusted.map((t: { handle: string }) => (
                    <li key={t.handle} className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-[13px] font-semibold">
                      @{t.handle}
                      <button type="button" aria-label={`Remove @${t.handle}`} onClick={() => trust.mutate({ h: t.handle, remove: true })} className="ml-1 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-8">
                <h2 className="font-display text-lg font-bold">Recently added</h2>
                <ul className="mt-3 space-y-2">
                  {lists.data.approved.map((row) => (
                    <VideoRow
                      key={row.id}
                      row={row}
                      actions={<Button size="sm" variant="ghost" className="h-8 rounded-full text-destructive" onClick={() => review.mutate({ id: row.id, status: "rejected" })}>Remove from feed</Button>}
                    />
                  ))}
                </ul>
              </section>
            </>
          )}

          {!isCurator && lists.data && lists.data.mine.length > 0 && (
            <section className="mt-8">
              <h2 className="font-display text-lg font-bold">Your suggestions</h2>
              <ul className="mt-3 space-y-2">{lists.data.mine.map((row) => <VideoRow key={row.id} row={row} />)}</ul>
            </section>
          )}

          <p className="mt-8 text-center text-[12px] text-muted-foreground">
            Videos stay on TikTok and play through TikTok's official embed. <Link to="/" className="font-semibold text-primary">Back to the feed</Link>
          </p>
        </>
      )}
    </div>
  );
}
