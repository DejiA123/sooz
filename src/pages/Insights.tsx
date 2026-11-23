import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, Clock, Heart, Layers, Loader2, MessageCircle, Play, Send, Timer, UserPlus, Image as ImageIcon } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import { screenTime } from "@/services/api/visitors";

interface InsightsData {
  days: number;
  members: number;
  new_members: number;
  active: { today: number; d7: number; d30: number };
  totals: Partial<Record<"post" | "story" | "like" | "comment" | "follow" | "repost" | "share" | "save" | "message", number>>;
  watch?: { videos: number; seconds: number; visits: number; visitors: number; counted: number };
  daily: { day: string; active: number; actions: number; videos?: number }[];
  top_watchers?: { id: string; username: string; name: string; avatar: string | null; videos: number; seconds: number; visits: number; last_at: string }[];
  top_members: { id: string; username: string; name: string; avatar: string | null; total: number; posts: number; likes: number; comments: number; follows: number; shares: number; messages: number; last_at: string }[];
  top_posts: { id: string; caption: string | null; media_type: string | null; image: string | null; username: string; name: string; likes: number; comments: number }[];
}
const fetchInsights = async (days: number): Promise<InsightsData> => {
  const { data, error } = await supabase.rpc("admin_insights" as never, { p_days: days } as never);
  if (error) throw error;
  return data as unknown as InsightsData;
};

const RANGES = [7, 30, 90] as const;

/** Admin-only: how people use SOOZ — who's active, what they do, the most active members and posts.
 *  Private messages stay private: only how many are sent. */
export default function Insights() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const q = useQuery({ queryKey: ["admin-insights", days], queryFn: () => fetchInsights(days), enabled: isAdmin, refetchInterval: 60_000, refetchOnWindowFocus: true });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  const d = q.data;
  const t = d?.totals ?? {};
  const max = Math.max(1, ...(d?.daily ?? []).map((x) => x.active));
  const maxVideos = Math.max(1, ...(d?.daily ?? []).map((x) => x.videos ?? 0));
  const w = d?.watch;
  const perVisit = w && w.counted ? { videos: Math.round(w.videos / w.counted), seconds: w.seconds / w.counted } : null;
  const tiles: { label: string; value: number; icon: typeof Heart }[] = [
    { label: "Posts & stories", value: (t.post ?? 0) + (t.story ?? 0), icon: ImageIcon },
    { label: "Likes", value: t.like ?? 0, icon: Heart },
    { label: "Comments", value: t.comment ?? 0, icon: MessageCircle },
    { label: "Follows", value: t.follow ?? 0, icon: UserPlus },
    { label: "Shares & saves", value: (t.repost ?? 0) + (t.share ?? 0) + (t.save ?? 0), icon: Bookmark },
    { label: "Messages sent", value: t.message ?? 0, icon: Send },
  ];

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--bottom-nav-height)+2rem)] text-foreground">
      <div className="sticky top-0 z-10 border-b border-border/20 bg-background/90 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="flex-1 font-display text-xl font-bold">Insights</h1>
          {q.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button key={r} type="button" onClick={() => setDays(r)}
                className={cn("h-7 rounded-full px-2.5 text-[12.5px] font-semibold", days === r ? "bg-foreground text-background" : "text-muted-foreground")}>{r}d</button>
            ))}
          </div>
        </div>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : q.isError || !d ? (
        <p className="px-6 py-20 text-center text-[15px] text-muted-foreground">Couldn't load the insights. Try again in a moment.</p>
      ) : (
        <div className="mx-auto max-w-xl px-4">
          {/* Active members */}
          <h2 className="px-1 pb-2 pt-4 text-[13px] font-semibold text-muted-foreground">Active members</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {[["Today", d.active.today], ["7 days", d.active.d7], ["30 days", d.active.d30]].map(([label, n]) => (
              <div key={label as string} className="rounded-2xl bg-foreground/[0.045] px-3.5 py-3">
                <p className="text-[13px] font-medium text-muted-foreground">{label as string}</p>
                <p className="font-display text-[26px] font-bold leading-tight tabular-nums">{(n as number).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 px-1 text-[12.5px] text-muted-foreground">
            Members who opened SOOZ signed in or did something, out of {d.members.toLocaleString()} members ({d.new_members} new in the last {d.days} days).
          </p>

          <section className="mt-5 rounded-2xl bg-foreground/[0.045] p-4">
            <h2 className="text-[15px] font-semibold">Active members per day</h2>
            <div className="mt-4 flex h-28 items-end gap-[2px]" role="img" aria-label="Active members per day">
              {d.daily.map((x) => (
                <div key={x.day} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div className={cn("w-full rounded-t-[3px]", x.active ? "bg-amber-500" : "bg-foreground/10")} style={{ height: x.active ? `${Math.max(6, (x.active / max) * 100)}%` : "2px" }} />
                  <span className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[11px] text-background group-hover:block">
                    {format(new Date(x.day.slice(0, 10) + "T12:00:00"), "d MMM")}: {x.active} active · {x.actions} actions{x.videos ? ` · ${x.videos} videos` : ""}
                  </span>
                </div>
              ))}
            </div>
            {d.daily.length > 0 && (
              <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                <span>{format(new Date(d.daily[0].day.slice(0, 10) + "T12:00:00"), "d MMM")}</span><span>Today</span>
              </div>
            )}
          </section>

          {/* Watching: scrolls and time on screen (everyone, signed in or not) */}
          {w && (
            <>
              <h2 className="px-1 pb-2 pt-5 text-[13px] font-semibold text-muted-foreground">Watching · {d.days} days</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {([
                  ["Videos scrolled", w.videos.toLocaleString(), Layers],
                  ["Time in SOOZ", screenTime(w.seconds), Clock],
                  ["Videos per visit", perVisit ? perVisit.videos.toLocaleString() : "–", Play],
                  ["Time per visit", perVisit ? screenTime(perVisit.seconds) : "–", Timer],
                ] as const).map(([label, value, Icon]) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl bg-foreground/[0.045] px-3.5 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700"><Icon className="h-[18px] w-[18px]" /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-display text-[20px] font-bold leading-tight tabular-nums">{value}</span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">{label}</span>
                    </span>
                  </div>
                ))}
              </div>
              <section className="mt-2.5 rounded-2xl bg-foreground/[0.045] p-4">
                <h2 className="text-[15px] font-semibold">Videos scrolled per day</h2>
                <div className="mt-4 flex h-24 items-end gap-[2px]" role="img" aria-label="Videos scrolled per day">
                  {d.daily.map((x) => (
                    <div key={x.day} className="group relative flex h-full flex-1 flex-col justify-end">
                      <div className={cn("w-full rounded-t-[3px]", x.videos ? "bg-amber-500" : "bg-foreground/10")} style={{ height: x.videos ? `${Math.max(6, ((x.videos ?? 0) / maxVideos) * 100)}%` : "2px" }} />
                      <span className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[11px] text-background group-hover:block">
                        {format(new Date(x.day.slice(0, 10) + "T12:00:00"), "d MMM")}: {x.videos ?? 0} videos
                      </span>
                    </div>
                  ))}
                </div>
              </section>
              <p className="mt-2 px-1 text-[12px] text-muted-foreground">Everyone who opens SOOZ, signed in or not ({w.visitors.toLocaleString()} phones / computers, {w.visits.toLocaleString()} visits). Only counts — never which videos. Counted since 23 Nov 2026; your own visits aren't counted.</p>
            </>
          )}

          {/* What they did */}
          <h2 className="px-1 pb-2 pt-5 text-[13px] font-semibold text-muted-foreground">What people did · {d.days} days</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {tiles.map((x) => (
              <div key={x.label} className="flex items-center gap-3 rounded-2xl bg-foreground/[0.045] px-3.5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-700"><x.icon className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0">
                  <span className="block font-display text-[20px] font-bold leading-tight tabular-nums">{x.value.toLocaleString()}</span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">{x.label}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 px-1 text-[12px] text-muted-foreground">Messages: only how many are sent — never what they say or who to. Hearts on Christian TikToks are kept on each phone, so they aren't counted here.</p>

          {/* Most active members */}
          <h2 className="px-1 pb-2 pt-5 text-[13px] font-semibold text-muted-foreground">Most active members</h2>
          <div className="overflow-hidden rounded-2xl bg-foreground/[0.045]">
            {d.top_members.length === 0 && <p className="px-4 py-4 text-[14px] text-muted-foreground">No activity in this period yet.</p>}
            {d.top_members.map((m, i) => {
              const bits = [
                m.posts && `${m.posts} post${m.posts === 1 ? "" : "s"}`,
                m.likes && `${m.likes} like${m.likes === 1 ? "" : "s"}`,
                m.comments && `${m.comments} comment${m.comments === 1 ? "" : "s"}`,
                m.follows && `${m.follows} follow${m.follows === 1 ? "" : "s"}`,
                m.shares && `${m.shares} share${m.shares === 1 ? "" : "s"}`,
                m.messages && `${m.messages} message${m.messages === 1 ? "" : "s"}`,
              ].filter(Boolean).join(" · ");
              return (
                <button key={m.id} type="button" onClick={() => navigate(`/profile/${m.username}`)}
                  className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-foreground/[0.06]", i > 0 && "border-t border-foreground/[0.07]")}>
                  <span className="w-5 shrink-0 text-center text-[13px] font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                  <Avatar className="h-10 w-10 shrink-0"><AvatarImage src={m.avatar || ""} className="object-cover" /><AvatarFallback className="bg-amber-500/15 font-semibold text-amber-700">{m.name[0]?.toUpperCase()}</AvatarFallback></Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{m.name}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">{bits}</span>
                  </span>
                  <span className="shrink-0 text-right text-[12px] text-muted-foreground">{formatDistanceToNowStrict(new Date(m.last_at), { addSuffix: true })}</span>
                </button>
              );
            })}
          </div>

          {/* Who watches the most */}
          {(d.top_watchers?.length ?? 0) > 0 && (
            <>
              <h2 className="px-1 pb-2 pt-5 text-[13px] font-semibold text-muted-foreground">Members who watch the most</h2>
              <div className="overflow-hidden rounded-2xl bg-foreground/[0.045]">
                {d.top_watchers!.map((m, i) => (
                  <button key={m.id} type="button" onClick={() => navigate(`/profile/${m.username}`)}
                    className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-foreground/[0.06]", i > 0 && "border-t border-foreground/[0.07]")}>
                    <span className="w-5 shrink-0 text-center text-[13px] font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                    <Avatar className="h-10 w-10 shrink-0"><AvatarImage src={m.avatar || ""} className="object-cover" /><AvatarFallback className="bg-amber-500/15 font-semibold text-amber-700">{m.name[0]?.toUpperCase()}</AvatarFallback></Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{m.name}</span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">{m.videos.toLocaleString()} video{m.videos === 1 ? "" : "s"} · {screenTime(m.seconds)} · {m.visits} visit{m.visits === 1 ? "" : "s"}</span>
                    </span>
                    <span className="shrink-0 text-right text-[12px] text-muted-foreground">{formatDistanceToNowStrict(new Date(m.last_at), { addSuffix: true })}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Top posts */}
          <h2 className="px-1 pb-2 pt-5 text-[13px] font-semibold text-muted-foreground">Top posts · {d.days} days</h2>
          <div className="overflow-hidden rounded-2xl bg-foreground/[0.045]">
            {d.top_posts.length === 0 && <p className="px-4 py-4 text-[14px] text-muted-foreground">No posts in this period yet.</p>}
            {d.top_posts.map((p, i) => (
              <button key={p.id} type="button" onClick={() => navigate(`/post/${p.id}`)}
                className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-foreground/[0.06]", i > 0 && "border-t border-foreground/[0.07]")}>
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-foreground/[0.06]">
                  {p.image ? <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center p-1 text-center text-[8.5px] leading-tight text-muted-foreground line-clamp-4">{p.caption || "Post"}</span>}
                  {p.media_type === "video" && <Play className="absolute right-1 top-1 h-3 w-3 fill-white text-white drop-shadow" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{p.caption || "(no caption)"}</span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">{p.name} · {p.likes} like{p.likes === 1 ? "" : "s"} · {p.comments} comment{p.comments === 1 ? "" : "s"}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
