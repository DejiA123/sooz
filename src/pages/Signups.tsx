import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/lib/admin";
import { fetchSignups, type Member } from "@/services/api/signups";

const RANGES = [7, 30, 90] as const;

/** Admin-only: how many people have joined SOOZ — totals, a day-by-day chart and the newest members. */
export default function Signups() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  // Kept fresh while open, so new sign-ups appear without reloading (e.g. while an ad is running).
  const q = useQuery({ queryKey: ["admin-signups"], queryFn: fetchSignups, enabled: isAdmin, refetchInterval: 30_000, refetchOnWindowFocus: true });

  const days = useMemo(() => {
    const members = q.data?.recent ?? [];
    const out: { day: Date; count: number }[] = [];
    const start = new Date(); start.setHours(0, 0, 0, 0);
    for (let i = range - 1; i >= 0; i--) {
      const day = new Date(start); day.setDate(start.getDate() - i);
      out.push({ day, count: 0 });
    }
    const first = out[0].day.getTime();
    for (const m of members) {
      const d = new Date(m.created_at); d.setHours(0, 0, 0, 0);
      const i = Math.round((d.getTime() - first) / 86_400_000);
      if (i >= 0 && i < out.length) out[i].count++;
    }
    return out;
  }, [q.data, range]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const recent = q.data?.recent ?? [];
  const since = (ms: number) => recent.filter((m) => Date.parse(m.created_at) >= ms).length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const stats = [
    { label: "All members", value: q.data?.total ?? 0 },
    { label: "Today", value: since(today.getTime()) },
    { label: "7 days", value: since(Date.now() - 7 * 86_400_000) },
    { label: "30 days", value: since(Date.now() - 30 * 86_400_000) },
  ];
  const max = Math.max(1, ...days.map((d) => d.count));
  const inRange = days.reduce((n, d) => n + d.count, 0);

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--bottom-nav-height)+2rem)] text-foreground">
      <div className="sticky top-0 z-10 border-b border-border/20 bg-background/90 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="flex-1 font-display text-xl font-bold">Sign-ups</h1>
          {q.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : q.isError ? (
        <p className="px-6 py-20 text-center text-[15px] text-muted-foreground">Couldn't load the numbers. Pull down or try again in a moment.</p>
      ) : (
        <div className="mx-auto max-w-xl px-4">
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {stats.map((s, i) => (
              <div key={s.label} className={cn("rounded-2xl bg-foreground/[0.045] px-4 py-3.5", i === 0 && "col-span-3")}>
                <p className="text-[13px] font-medium text-muted-foreground">{s.label}</p>
                <p className={cn("font-display font-bold tabular-nums leading-tight", i === 0 ? "text-[40px]" : "text-[26px]")}>{s.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          <section className="mt-6 rounded-2xl bg-foreground/[0.045] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">New members per day</h2>
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button key={r} type="button" onClick={() => setRange(r)}
                    className={cn("h-7 rounded-full px-2.5 text-[12.5px] font-semibold", range === r ? "bg-foreground text-background" : "text-muted-foreground")}>{r}d</button>
                ))}
              </div>
            </div>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{inRange} in the last {range} days</p>
            <div className="mt-4 flex h-32 items-end gap-[2px]" role="img" aria-label={`New members per day for the last ${range} days`}>
              {days.map((d) => (
                <div key={d.day.toISOString()} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div className={cn("w-full rounded-t-[3px]", d.count ? "bg-amber-500" : "bg-foreground/10")} style={{ height: d.count ? `${Math.max(6, (d.count / max) * 100)}%` : "2px" }} />
                  <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[11px] text-background group-hover:block">
                    {format(d.day, "d MMM")}: {d.count}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>{format(days[0].day, "d MMM")}</span><span>Today</span>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="px-1 pb-2 text-[13px] font-semibold text-muted-foreground">Newest members</h2>
            {recent.length === 0 ? (
              <p className="flex items-center gap-2 px-1 text-[14px] text-muted-foreground"><UserPlus className="h-4 w-4" /> No one has joined in the last 90 days.</p>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-foreground/[0.045]">
                {recent.slice(0, 50).map((m: Member, i) => (
                  <button key={m.id} type="button" onClick={() => navigate(`/profile/${m.username}`)}
                    className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-foreground/[0.06]", i > 0 && "border-t border-foreground/[0.07]")}>
                    <Avatar className="h-10 w-10"><AvatarImage src={m.avatar_url || ""} className="object-cover" /><AvatarFallback className="bg-amber-500/15 font-semibold text-amber-700">{(m.display_name || m.username)[0]?.toUpperCase()}</AvatarFallback></Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{m.display_name || m.username}</span>
                      <span className="block truncate text-[13px] text-muted-foreground">@{m.username}</span>
                    </span>
                    <span className="shrink-0 text-[12.5px] text-muted-foreground">{formatDistanceToNowStrict(new Date(m.created_at), { addSuffix: true })}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
