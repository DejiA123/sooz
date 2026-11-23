import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Smartphone, Monitor, Tablet } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/lib/admin";
import { fetchRecentVisits, fetchVisitSummary, watchLine, type Counts, type Visit } from "@/services/api/visitors";

const RANGES = [7, 30, 90] as const;

/** A friendly short name for an anonymous phone ("Visitor 3F2A"). */
const visitorName = (device: string) => `Visitor ${device.slice(0, 4).toUpperCase()}`;
const DeviceIcon = ({ kind }: { kind: string | null }) =>
  kind === "Computer" ? <Monitor className="h-3.5 w-3.5 shrink-0" /> : kind?.includes("iPad") || kind?.includes("tablet") ? <Tablet className="h-3.5 w-3.5 shrink-0" /> : <Smartphone className="h-3.5 w-3.5 shrink-0" />;

/** Admin-only: how many people open SOOZ — right now, today, this week — where from, and who. */
export default function Visitors() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const summary = useQuery({ queryKey: ["visit-summary"], queryFn: fetchVisitSummary, enabled: isAdmin, refetchInterval: 20_000, refetchOnWindowFocus: true });
  const recent = useQuery({ queryKey: ["visit-recent"], queryFn: () => fetchRecentVisits(80), enabled: isAdmin, refetchInterval: 20_000, refetchOnWindowFocus: true });

  const days = useMemo(() => (summary.data?.daily ?? []).slice(-range), [summary.data, range]);
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const s = summary.data;
  const max = Math.max(1, ...days.map((d) => d.visitors));
  const inRange = days.reduce((n, d) => n + d.visitors, 0);
  const sourceTotal = Math.max(1, ...(s?.sources ?? []).map((x) => x.n));
  const deviceTotal = Math.max(1, ...(s?.devices ?? []).map((x) => x.n));
  const busy = summary.isFetching || recent.isFetching;

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--bottom-nav-height)+2rem)] text-foreground">
      <div className="sticky top-0 z-10 border-b border-border/20 bg-background/90 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="flex-1 font-display text-xl font-bold">Visitors</h1>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {summary.isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : summary.isError || !s ? (
        <p className="px-6 py-20 text-center text-[15px] text-muted-foreground">Couldn't load the numbers. Try again in a moment.</p>
      ) : (
        <div className="mx-auto max-w-xl px-4">
          {/* Right now */}
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-foreground/[0.045] px-4 py-3.5">
            <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" /></span>
            <p className="flex-1 text-[15px]"><span className="text-[22px] font-bold tabular-nums">{s.now}</span> <span className="text-muted-foreground">on SOOZ right now</span></p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {[["Today", s.today], ["7 days", s.d7], ["30 days", s.d30]].map(([label, c]) => (
              <div key={label as string} className="rounded-2xl bg-foreground/[0.045] px-3.5 py-3">
                <p className="text-[13px] font-medium text-muted-foreground">{label as string}</p>
                <p className="font-display text-[26px] font-bold leading-tight tabular-nums">{(c as { visitors: number }).visitors.toLocaleString()}</p>
                <p className="text-[12px] text-muted-foreground">{(c as Counts).visits.toLocaleString()} visits</p>
                {watchLine((c as Counts).videos, (c as Counts).seconds) && <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{watchLine((c as Counts).videos, (c as Counts).seconds)}</p>}
              </div>
            ))}
          </div>
          <p className="mt-2 px-1 text-[12.5px] text-muted-foreground">
            Visitors = different phones / computers; videos = scrolled through, time = SOOZ on screen. {s.members} signed-in member{s.members === 1 ? "" : "s"} visited in the last 30 days. Your own visits aren't counted.
          </p>

          {/* Per day */}
          <section className="mt-5 rounded-2xl bg-foreground/[0.045] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Visitors per day</h2>
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button key={r} type="button" onClick={() => setRange(r)}
                    className={cn("h-7 rounded-full px-2.5 text-[12.5px] font-semibold", range === r ? "bg-foreground text-background" : "text-muted-foreground")}>{r}d</button>
                ))}
              </div>
            </div>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{inRange.toLocaleString()} in the last {range} days</p>
            <div className="mt-4 flex h-32 items-end gap-[2px]" role="img" aria-label={`Visitors per day for the last ${range} days`}>
              {days.map((d) => (
                <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div className={cn("w-full rounded-t-[3px]", d.visitors ? "bg-amber-500" : "bg-foreground/10")} style={{ height: d.visitors ? `${Math.max(6, (d.visitors / max) * 100)}%` : "2px" }} />
                  <span className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[11px] text-background group-hover:block">
                    {format(new Date(d.day.slice(0, 10) + "T12:00:00"), "d MMM")}: {d.visitors}{d.videos ? ` · ${d.videos} videos` : ""}
                  </span>
                </div>
              ))}
            </div>
            {days.length > 0 && (
              <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                <span>{format(new Date(days[0].day.slice(0, 10) + "T12:00:00"), "d MMM")}</span><span>Today</span>
              </div>
            )}
          </section>

          {/* Where from / devices */}
          {[["Where they came from", s.sources, sourceTotal], ["Devices", s.devices, deviceTotal]].map(([title, list, top]) => (
            <section key={title as string} className="mt-5">
              <h2 className="px-1 pb-2 text-[13px] font-semibold text-muted-foreground">{title as string} · 30 days</h2>
              <div className="space-y-2 rounded-2xl bg-foreground/[0.045] p-4">
                {(list as { name: string; n: number }[]).length === 0 && <p className="text-[14px] text-muted-foreground">No visits yet.</p>}
                {(list as { name: string; n: number }[]).slice(0, 8).map((x) => (
                  <div key={x.name}>
                    <div className="flex justify-between text-[14px]"><span className="truncate pr-2">{x.name}</span><span className="tabular-nums text-muted-foreground">{x.n}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]"><div className="h-full rounded-full bg-amber-500" style={{ width: `${(x.n / (top as number)) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Recent visits */}
          <section className="mt-5">
            <h2 className="px-1 pb-2 text-[13px] font-semibold text-muted-foreground">Recent visits</h2>
            <div className="overflow-hidden rounded-2xl bg-foreground/[0.045]">
              {(recent.data ?? []).length === 0 && <p className="px-4 py-4 text-[14px] text-muted-foreground">No visits yet — they'll show here as people open SOOZ.</p>}
              {(recent.data ?? []).map((v: Visit, i) => {
                const live = Date.now() - Date.parse(v.last_seen) < 5 * 60_000;
                return (
                  <button key={v.id} type="button" disabled={!v.person} onClick={() => v.person && navigate(`/profile/${v.person.username}`)}
                    className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left enabled:active:bg-foreground/[0.06]", i > 0 && "border-t border-foreground/[0.07]")}>
                    <span className="relative shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={v.person?.avatar || ""} className="object-cover" />
                        <AvatarFallback className={cn("text-[13px] font-semibold", v.person ? "bg-amber-500/15 text-amber-700" : "bg-foreground/[0.08] text-muted-foreground")}>{v.person ? v.person.name[0]?.toUpperCase() : "?"}</AvatarFallback>
                      </Avatar>
                      {live && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{v.person ? v.person.name : visitorName(v.device)}</span>
                      <span className="flex items-center gap-1.5 truncate text-[12.5px] text-muted-foreground">
                        <DeviceIcon kind={v.device_kind} />{v.device_kind ?? "Device"}{v.installed ? " app" : ""}{v.installed && v.source === "Home Screen app" ? "" : ` · ${v.source ?? "Direct"}`} · {v.pages} page{v.pages === 1 ? "" : "s"}{watchLine(v.videos, v.seconds) && ` · ${watchLine(v.videos, v.seconds)}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[12.5px] text-muted-foreground">
                      {live ? <span className="font-semibold text-emerald-600">Now</span> : formatDistanceToNowStrict(new Date(v.last_seen), { addSuffix: true })}
                      <span className="block text-[11px]">{format(new Date(v.started_at), "d MMM, HH:mm")}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
