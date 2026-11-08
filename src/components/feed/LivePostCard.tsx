import { useEffect, useState } from "react";
import { Radio, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { parseManifest } from "@/lib/liveStream";
import { ShareArrow } from "@/components/reels/ReelRail";
import { LivePlayer } from "../live/LivePlayer";

type LiveInfo = {
  playback_url: string;
  title: string | null;
  host: { display_name: string | null; username: string; avatar_url: string | null } | null;
};

/** The live stream, full screen like a TikTok LIVE: who's live, what it's about, and the video. */
export const LivePostCard = ({ onClose }: { onClose?: () => void }) => {
  const [live, setLive] = useState<LiveInfo | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from("live_stream_config")
        .select("playback_url, status, stream_uid, stream_key")
        .eq("status", "live")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      if (!data?.playback_url) { setLive(null); return; }
      let host: LiveInfo["host"] = null;
      if (data.stream_uid) {
        const { data: p } = await supabase.from("profiles").select("display_name, username, avatar_url").eq("id", data.stream_uid).maybeSingle();
        host = p;
      }
      if (!alive) return;
      // Keep the same player when only the clip list changes (it updates every few seconds).
      setLive((prev) => prev && prev.playback_url === data.playback_url
        ? prev
        : { playback_url: data.playback_url!, title: parseManifest(data.stream_key)?.title ?? null, host });
    };
    load();
    const channel = supabase
      .channel(`live-card:${crypto.randomUUID().slice(0, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_stream_config" }, () => load())
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, []);

  const share = async () => {
    const url = `${window.location.origin}/`;
    const text = `${live?.host?.display_name || "SOOZ"} is live on SOOZ${live?.title ? `: ${live.title}` : ""} 🙏`;
    try {
      if (navigator.share) await navigator.share({ title: "SOOZ Live", text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); toast.success("Link copied"); }
    } catch { /* cancelled */ }
  };

  const name = live?.host?.display_name || live?.host?.username || "SOOZ";

  return (
    <div className="relative h-full w-full bg-black text-white">
      {live ? (
        <LivePlayer src={live.playback_url} className="absolute inset-0" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          {live === undefined ? (
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
          ) : (
            <><Radio className="h-9 w-9 text-white/40" /><p className="text-[16px] font-semibold">No one is live right now</p></>
          )}
        </div>
      )}

      {/* Top: who's live */}
      <div className="live-top absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent px-3 pb-8">
        {live ? (
          <div className="flex min-w-0 items-center gap-2 rounded-full bg-black/40 py-1 pl-1 pr-3 backdrop-blur">
            <Avatar className="h-9 w-9">
              <AvatarImage src={live.host?.avatar_url || ""} className="object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-700 text-[14px] font-bold">{name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold leading-tight">{name}</p>
              <p className="truncate text-[12px] leading-tight text-white/70">{live.title || "Live on SOOZ"}</p>
            </div>
            <span className="ml-1 rounded bg-[#ff2d55] px-1.5 py-0.5 text-[11px] font-extrabold uppercase">Live</span>
          </div>
        ) : <span />}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close live" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {live && (
        <button type="button" onClick={share} aria-label="Share live"
          className="live-share absolute right-3 flex flex-col items-center gap-1 text-[12px] font-semibold">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur"><ShareArrow className="h-7 w-7" /></span>
          Share
        </button>
      )}
    </div>
  );
};
