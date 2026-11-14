import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AtSign, Bell, Heart, MessageCircle, Phone, Play, Repeat2, UserPlus } from "lucide-react";
import { differenceInCalendarDays, formatDistanceToNowStrict } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useGoBack } from "@/hooks/useGoBack";
import { useFollowing } from "@/components/reels/useFollowing";
import { cn } from "@/lib/utils";
import { fetchActivity, takeActivitySeen, type ActivityKind, type ActivityRow, type Person } from "@/services/api/activity";

type Filter = "all" | "likes" | "comments" | "follows";
const FILTERS: { key: Filter; label: string; kinds?: ActivityKind[] }[] = [
  { key: "all", label: "All" },
  { key: "likes", label: "Likes", kinds: ["like"] },
  { key: "comments", label: "Comments", kinds: ["comment", "reply", "mention"] },
  { key: "follows", label: "Followers", kinds: ["follow"] },
];

/** "3h", "2d", "5w" — short times like Instagram. */
function ago(at: string): string {
  const s = formatDistanceToNowStrict(new Date(at));
  const [n, unit] = s.split(" ");
  if (unit.startsWith("second")) return "now";
  if (unit.startsWith("minute")) return `${n}m`;
  if (unit.startsWith("hour")) return `${n}h`;
  if (unit.startsWith("day")) return Number(n) >= 7 ? `${Math.floor(Number(n) / 7)}w` : `${n}d`;
  if (unit.startsWith("month")) return `${Math.round(Number(n) * 4.3)}w`;
  return `${n}y`;
}

const BADGE: Record<ActivityKind, { icon: typeof Heart; className: string }> = {
  like: { icon: Heart, className: "bg-rose-500 [&_svg]:fill-white" },
  comment: { icon: MessageCircle, className: "bg-sky-500" },
  reply: { icon: MessageCircle, className: "bg-sky-500" },
  mention: { icon: AtSign, className: "bg-violet-500" },
  follow: { icon: UserPlus, className: "bg-amber-500" },
  repost: { icon: Repeat2, className: "bg-emerald-500" },
  missed_call: { icon: Phone, className: "bg-red-500" },
};

function sentence(row: ActivityRow): string {
  const others = row.total - 1;
  switch (row.kind) {
    case "like": return others > 0 ? `and ${others === 1 ? `${row.people[1]?.username ?? "1 other"}` : `${others} others`} liked your post.` : "liked your post.";
    case "comment": return "commented:";
    case "reply": return "replied to your comment:";
    case "mention": return "mentioned you:";
    case "repost": return "reposted your post.";
    case "missed_call": return "tried to call you.";
    default: return "started following you.";
  }
}

const Face = ({ p, className }: { p: Person; className?: string }) => (
  <Avatar className={className}>
    <AvatarImage src={p.avatar || ""} alt="" className="object-cover" />
    <AvatarFallback className="bg-amber-500/15 text-[15px] font-semibold text-amber-700">{p.name[0]?.toUpperCase() || "?"}</AvatarFallback>
  </Avatar>
);

function Row({ row, isNew }: { row: ActivityRow; isNew: boolean }) {
  const navigate = useNavigate();
  const { isFollowing, canFollow, follow, unfollow } = useFollowing();
  const lead = row.people[0];
  const badge = BADGE[row.kind];
  const open = () => {
    if (row.kind === "follow" || row.kind === "missed_call" || row.kind === "reply" || !row.post) navigate(`/profile/${lead.username}`);
    else navigate(`/post/${row.post.id}`);
  };
  const showFollow = row.kind === "follow" && canFollow(lead.id);
  const following = showFollow && isFollowing(lead.id);

  return (
    <div role="button" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === "Enter") open(); }}
      className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-foreground/[0.05]", isNew && "bg-amber-500/[0.06]")}>
      {/* Photo (two overlapping for grouped likes) with a small badge saying what happened */}
      <button type="button" aria-label={`Open ${lead.name}'s profile`} onClick={(e) => { e.stopPropagation(); navigate(`/profile/${lead.username}`); }}
        className="relative h-12 w-12 shrink-0">
        {row.people.length > 1 ? (
          <>
            <Face p={row.people[1]} className="absolute right-0 top-0 h-9 w-9" />
            <Face p={lead} className="absolute bottom-0 left-0 h-9 w-9 ring-2 ring-background" />
          </>
        ) : <Face p={lead} className="h-12 w-12" />}
        <span className={cn("absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-background", badge.className)}>
          <badge.icon className="h-[11px] w-[11px]" strokeWidth={2.6} />
        </span>
      </button>

      <p className="min-w-0 flex-1 text-[14.5px] leading-[1.35] text-foreground">
        <span className="font-semibold">{lead.username}</span>{" "}
        <span>{sentence(row)}</span>
        {row.text && (row.kind === "comment" || row.kind === "reply" || row.kind === "mention") && <span className="text-foreground/80"> {row.text}</span>}
        <span className="whitespace-nowrap text-muted-foreground"> {ago(row.at)}</span>
      </p>

      {showFollow ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); (following ? unfollow : follow)(lead.id); }}
          className={cn("h-8 shrink-0 rounded-lg px-4 text-[13.5px] font-semibold transition-colors active:scale-95",
            following ? "bg-foreground/[0.07] text-foreground" : "bg-amber-400 text-[#1a1204]")}>
          {following ? "Following" : "Follow back"}
        </button>
      ) : row.post ? (
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-foreground/[0.06]">
          {row.post.image
            ? <img src={row.post.image} alt="" loading="lazy" className="h-full w-full object-cover" />
            : <span className="flex h-full w-full items-center justify-center p-1 text-center text-[8.5px] font-medium leading-tight text-muted-foreground line-clamp-4">{row.post.caption || "Post"}</span>}
          {row.post.video && <Play className="absolute right-1 top-1 h-3 w-3 fill-white text-white drop-shadow" />}
        </span>
      ) : null}
    </div>
  );
}

/** Likes, comments, replies and new followers — laid out like other social apps' activity pages. */
export default function Activity() {
  const { user } = useAuth();
  const goBack = useGoBack("/chat");
  const [filter, setFilter] = useState<Filter>("all");
  const [seenBefore] = useState(takeActivitySeen); // anything newer than the last visit is "New"

  const q = useQuery({ queryKey: ["activity", user?.id], queryFn: () => fetchActivity(user!.id), enabled: !!user, staleTime: 30_000, refetchOnMount: "always" });

  const sections = useMemo(() => {
    const kinds = FILTERS.find((f) => f.key === filter)?.kinds;
    const rows = (q.data ?? []).filter((r) => !kinds || kinds.includes(r.kind));
    const out: { title: string; rows: ActivityRow[] }[] = [];
    const put = (title: string, r: ActivityRow) => {
      const last = out[out.length - 1];
      if (last?.title === title) last.rows.push(r); else out.push({ title, rows: [r] });
    };
    for (const r of rows) {
      const days = differenceInCalendarDays(new Date(), new Date(r.at));
      const title = seenBefore && Date.parse(r.at) > seenBefore ? "New"
        : days === 0 ? "Today" : days === 1 ? "Yesterday" : days < 7 ? "This week" : days < 30 ? "This month" : "Earlier";
      put(title, r);
    }
    return out;
  }, [q.data, filter, seenBefore]);

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--bottom-nav-height)+24px)] text-foreground">
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-10 bg-background/95 backdrop-blur-xl md:top-0">
        <header className="relative flex h-12 items-center justify-center px-2">
          <button type="button" aria-label="Back" onClick={goBack} className="absolute left-1.5 flex h-10 w-10 items-center justify-center rounded-full active:bg-foreground/10"><ArrowLeft className="h-6 w-6" /></button>
          <h1 className="text-[17px] font-bold">Activity</h1>
        </header>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1 scrollbar-hide" role="tablist" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
              className={cn("h-8 shrink-0 rounded-full border px-4 text-[13.5px] font-semibold transition-colors",
                filter === f.key ? "border-foreground bg-foreground text-background" : "border-foreground/15 text-foreground active:bg-foreground/5")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading ? (
        <div className="pt-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <div className="h-12 w-12 animate-pulse rounded-full bg-foreground/[0.07]" />
              <div className="flex-1 space-y-2"><div className="h-3.5 w-3/4 animate-pulse rounded bg-foreground/[0.07]" /><div className="h-3 w-1/3 animate-pulse rounded bg-foreground/[0.05]" /></div>
              <div className="h-12 w-12 animate-pulse rounded-md bg-foreground/[0.05]" />
            </div>
          ))}
        </div>
      ) : q.isError ? (
        <p className="px-8 py-24 text-center text-[15px] text-muted-foreground">Couldn't load your activity. Check your connection and try again.</p>
      ) : sections.length === 0 ? (
        <div className="flex flex-col items-center px-10 py-24 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-foreground/80"><Bell className="h-7 w-7" /></span>
          <h2 className="mt-4 text-[18px] font-bold">{filter === "all" ? "No activity yet" : `No ${FILTERS.find((f) => f.key === filter)!.label.toLowerCase()} yet`}</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">When people like or comment on your posts, or follow you, you'll see it here.</p>
        </div>
      ) : (
        sections.map((s) => (
          <section key={s.title} aria-label={s.title}>
            <h2 className="px-4 pb-1 pt-4 text-[15px] font-bold">{s.title}</h2>
            {s.rows.map((r) => <Row key={r.key} row={r} isNew={s.title === "New"} />)}
          </section>
        ))
      )}
    </div>
  );
}
