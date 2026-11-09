import { useQuery } from "@tanstack/react-query";
import { Library as LibraryIcon, Loader2 } from "lucide-react";
import { loadLibrary } from "@/services/api/feed";
import { STARTER_TIKTOKS } from "@/data/christianTikTokStarter";
import { cn } from "@/lib/utils";

const ORDER = ["Our church", "Worship", "Gospel", "Preaching", "Bible", "Devotional", "Creators"];

/** The Christian TikTok library behind For You: how big it is, what kinds of videos, which creators. */
export const LibraryCard = () => {
  const { data: lib, isLoading } = useQuery({ queryKey: ["christian-tiktok-library"], queryFn: loadLibrary, staleTime: 1000 * 60 * 30 });
  if (isLoading) return <div className="mt-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!lib) return null;

  const kinds = lib.kinds ?? {};
  const counts = new Map<string, number>();
  for (const v of lib.videos) { const k = kinds[v[1]] || "Creators"; counts.set(k, (counts.get(k) ?? 0) + 1); }
  const byKind = new Map<string, string[]>();
  for (const h of Object.keys(lib.creators)) { const k = kinds[h] || "Creators"; if (!byKind.has(k)) byKind.set(k, []); byKind.get(k)!.push(h); }
  const total = lib.videos.length + STARTER_TIKTOKS.length;

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-card/60 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary"><LibraryIcon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold">SOOZ Christian TikTok library</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            <b className="text-foreground">{total.toLocaleString()} videos</b> from <b className="text-foreground">{Object.keys(lib.creators).length} Christian creators</b>, mixed into For You so it never runs out. New videos are added automatically every day{lib.updated ? ` (last update ${lib.updated})` : ""}.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {ORDER.filter((k) => counts.get(k)).map((k) => (
          <span key={k} className={cn("rounded-full px-3 py-1 text-[12.5px] font-semibold", k === "Our church" ? "bg-primary text-primary-foreground" : "bg-white/[0.08] text-white/85")}>
            {k} · {counts.get(k)}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {ORDER.filter((k) => byKind.get(k)?.length).map((k) => (
          <div key={k}>
            <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</p>
            <div className="flex flex-wrap gap-1.5">
              {byKind.get(k)!.map((h) => (
                <a key={h} href={`https://www.tiktok.com/@${h}`} target="_blank" rel="noopener noreferrer"
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[12.5px] text-white/80 active:bg-white/10">
                  {lib.creators[h]}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
