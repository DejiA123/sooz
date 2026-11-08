import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { requestTikTokRefresh, tiktokPlayerUrl, type TikTokVideo } from "@/services/api/tiktok";
import { isDeadTikTok, markDeadTikTok } from "@/services/api/tiktokMeta";
import { registerTikTokPlayer, tiktokProtocol, tiktokTapForwarding, type TikTokPlayerHandle } from "@/lib/tiktokPlayers";
import { useVideoStore } from "@/store/useVideoStore";
import { Spinner } from "./gestures";

const TIKTOK_ORIGIN = "https://www.tiktok.com";
/** Fill the screen (cropping a little, like TikTok) only when that hides at most this much of the video. */
const MAX_FILL_CROP = 0.2;
/** TikTok's player hasn't answered this long after loading: it can't play this video here. */
const DEAD_AFTER_MS = 8000;
const clampRatio = (r: number) => Math.min(2, Math.max(0.45, r));

/** Small TikTok-style note mark for attribution. */
export const TikTokMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M16.6 2h-3.4v13.3a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.4 6.4 0 1 0 5.4 6.3V8.6a8 8 0 0 0 4.6 1.5V6.7a4.7 4.7 0 0 1-4.6-4.7z" />
  </svg>
);

interface TikTokReelProps {
  video: TikTokVideo;
  active: boolean;
  /** On screen or next to it: its player loads ahead of time, so it is ready (and tap-warmed) on arrival. */
  near?: boolean;
}

/**
 * A Christian TikTok in the feed, played by TikTok's own embed player and filling the screen like
 * the TikTok app (TikTok's player draws its own like / comment / share buttons). Portrait videos
 * are zoomed to fill; square and landscape videos sit whole on black. The player box always has the
 * video's exact shape, so TikTok never pads it with a blurred copy.
 *
 * Players load one slide ahead. Videos start muted by themselves; in Low Power Mode every touch in
 * SOOZ "warms up" the waiting players (see `tiktokPlayers.ts`) so they still start by themselves.
 * A tap on the video plays / unmutes / pauses it. Videos TikTok can't play here ("Video currently
 * unavailable") are skipped and remembered.
 */
export const TikTokReel = memo(function TikTokReel({ video, active, near = false }: TikTokReelProps) {
  const [dead, setDead] = useState(() => isDeadTikTok(video.tiktok_id));
  const mounted = (near || active) && !dead;
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [slow, setSlow] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [thumbRatio, setThumbRatio] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [blockedHint, setBlockedHint] = useState(false);
  const [tapThrough, setTapThrough] = useState(tiktokTapForwarding.broken);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const mutedRef = useRef(true);
  mutedRef.current = muted;
  const playing = useRef(false);
  const lastState = useRef(-1);
  const userPaused = useRef(false);
  const ourPause = useRef(false);
  const handle = useRef<TikTokPlayerHandle | null>(null);
  // When SOOZ last passed a tap to this player / sent it "mute" / tried to bring its sound back.
  const gestureAt = useRef(0);
  const ourMuteAt = useRef(0);
  const autoUnmuteAt = useRef(0);
  const setGlobalMuted = useVideoStore((s) => s.setGlobalMuted);
  const setSoundUnlocked = useVideoStore((s) => s.setSoundUnlocked);
  /** Sound is on for the whole feed (one tap on any video turns it on, like TikTok). */
  const soundWanted = () => !useVideoStore.getState().isGlobalMuted;

  const [stageAR, setStageAR] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => { if (el.clientWidth && el.clientHeight) setStageAR(el.clientWidth / el.clientHeight); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Commands for TikTok's embed player, in the exact shape Mux's tiktok-video-element sends them.
  const send = useCallback((type: string, value?: unknown) => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage({ "x-tiktok-player": true, type, ...(value !== undefined ? { value } : {}) }, "*");
  }, []);

  // Start the slide on screen (muted unless sound is on, so phones allow it without a tap).
  const kick = useCallback(() => {
    if (!activeRef.current || playing.current || userPaused.current) return;
    if (!soundWanted()) { ourMuteAt.current = Date.now(); send("mute"); }
    send("play");
  }, [send]);

  const markDead = useCallback(() => {
    markDeadTikTok(video.tiktok_id);
    setDead(true);
  }, [video.tiktok_id]);

  // Player removed (scrolled far away): start fresh next time.
  useEffect(() => {
    if (mounted) return;
    setLoaded(false); setReady(false); setReveal(false); setSlow(false);
    setIsPlaying(false); setBlockedHint(false); setMuted(true);
    playing.current = false; lastState.current = -1; ourPause.current = false;
  }, [mounted]);

  // Join the Low Power Mode warm-up: during any touch in SOOZ, start this player.
  useEffect(() => {
    if (!mounted) return;
    const h: TikTokPlayerHandle = {
      ready: false,
      blessed: false,
      isActive: () => activeRef.current,
      onGesture: () => {
        gestureAt.current = Date.now();
        if (activeRef.current) {
          if (!playing.current && !userPaused.current) send("play");
          if (soundWanted() && mutedRef.current) send("unMute");
        } else if (!h.blessed) { ourMuteAt.current = Date.now(); send("mute"); send("play"); }
      },
    };
    handle.current = h;
    const off = registerTikTokPlayer(h);
    return () => { off(); handle.current = null; };
  }, [mounted, send]);

  useEffect(() => {
    if (!mounted) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== TIKTOK_ORIGIN || e.source !== iframeRef.current?.contentWindow) return;
      let data = e.data;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
      if (!data || typeof data !== "object" || typeof data.type !== "string") return;
      if (data.type === "onPlayerReady") {
        tiktokProtocol.works = true;
        if (handle.current) handle.current.ready = true;
        setReady(true);
        kick();
      } else if (data.type === "onStateChange") {
        const state = Number(data.value); // -1 init, 0 ended, 1 playing, 2 paused, 3 buffering
        lastState.current = state;
        if ((state === 1 || state === 3) && handle.current && Date.now() - gestureAt.current < 4000) {
          handle.current.blessed = true; // started by a tap: from now on Safari lets it play (and sound) by itself
        }
        if (state === 1) {
          playing.current = true;
          if (!activeRef.current) { ourPause.current = true; send("pause"); } // warmed up next door: wait
          else {
            setIsPlaying(true);
            setBlockedHint(false);
            // Sound is on for the feed: bring it back (allowed once a tap has started this player).
            if (soundWanted() && mutedRef.current && handle.current?.blessed) { autoUnmuteAt.current = Date.now(); send("unMute"); }
          }
        } else if (state === 2) {
          playing.current = false;
          setIsPlaying(false);
          if (activeRef.current && Date.now() - autoUnmuteAt.current < 1500) {
            // Safari wouldn't allow sound without a tap and paused it: carry on muted.
            autoUnmuteAt.current = 0;
            if (handle.current) handle.current.blessed = false;
            ourMuteAt.current = Date.now();
            send("mute");
            send("play");
            return;
          }
          if (ourPause.current) ourPause.current = false;
          else if (activeRef.current) userPaused.current = true; // they paused it — leave it
        } else if (state === 0 && activeRef.current) {
          send("play"); // loop
        }
      } else if (data.type === "onMute") {
        const m = !!data.value;
        setMuted(m);
        if (!m && handle.current && Date.now() - gestureAt.current < 4000) handle.current.blessed = true;
        // Sound turned on/off with TikTok's own button: the whole feed follows.
        if (activeRef.current && playing.current && Date.now() - ourMuteAt.current > 1500 && m !== useVideoStore.getState().isGlobalMuted) {
          setGlobalMuted(m);
          if (!m) setSoundUnlocked(true);
        }
      } else if (data.type === "onError") {
        markDead();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mounted, kick, send, markDead, setGlobalMuted, setSoundUnlocked]);

  // On screen: play. Scrolled away: pause (and go quiet) — the player stays loaded next door.
  useEffect(() => {
    if (active) {
      userPaused.current = false;
      kick();
      return;
    }
    if (playing.current) { ourPause.current = true; send("pause"); }
    if (!mutedRef.current) { ourMuteAt.current = Date.now(); send("mute"); }
    setIsPlaying(false);
    setBlockedHint(false);
  }, [active, kick, send]);

  // TikTok can't play it here: move on to the next video.
  useEffect(() => {
    if (active && dead) window.dispatchEvent(new CustomEvent("sooz:feed-skip"));
  }, [active, dead]);

  // Keep nudging for a few seconds after it loads, until TikTok reports it is playing.
  useEffect(() => {
    if (!active || !loaded) return;
    const timers = [150, 600, 1200, 2000, 3200, 5000, 8000].map((ms) => setTimeout(kick, ms));
    return () => timers.forEach(clearTimeout);
  }, [active, loaded, kick]);

  // Ready but still not playing: the phone is refusing autoplay — say "tap to play".
  useEffect(() => {
    if (!active || !ready) return;
    const t = setTimeout(() => { if (!playing.current && !userPaused.current) setBlockedHint(true); }, 3500);
    return () => clearTimeout(t);
  }, [active, ready]);

  // No answer from TikTok's player: the video is unavailable here (or TikTok changed its player,
  // in which case just show it as it is).
  useEffect(() => {
    if (!mounted || !loaded || ready) return;
    const t = setTimeout(() => { if (tiktokProtocol.works) markDead(); else setReveal(true); }, DEAD_AFTER_MS);
    return () => clearTimeout(t);
  }, [mounted, loaded, ready, markDead]);

  const showPlayer = ready || reveal;
  useEffect(() => {
    if (!active || showPlayer) return;
    const t = setTimeout(() => setSlow(true), 14000);
    return () => clearTimeout(t);
  }, [active, showPlayer]);

  // A tap on the video: play it / turn the sound on / pause it. The command is sent during the tap,
  // which Safari counts as the tap itself (so it works in Low Power Mode and allows sound). If that
  // doesn't work on this phone, taps go straight to TikTok's player from then on.
  const onTap = () => {
    const check = (ok: () => boolean) => setTimeout(() => {
      if (!ok()) { tiktokTapForwarding.broken = true; setTapThrough(true); }
    }, 1600);
    gestureAt.current = Date.now();
    if (!playing.current) {
      userPaused.current = false;
      send("play");
      if (soundWanted()) send("unMute");
      check(() => lastState.current === 1 || lastState.current === 3);
    } else if (mutedRef.current) {
      send("unMute");
      setGlobalMuted(false); // sound on for the whole feed, like TikTok
      setSoundUnlocked(true);
      check(() => !mutedRef.current);
    } else {
      userPaused.current = true;
      send("pause");
    }
  };

  // TikToks are 9:16 unless we know better (TikTok's lookup no longer tells, so sizes come from the
  // database, the built-in list, or the cover image).
  const dbRatio = video.thumbnail_width && video.thumbnail_height ? video.thumbnail_width / video.thumbnail_height : null;
  const ratio = clampRatio(dbRatio ?? thumbRatio ?? 9 / 16);
  // Fill the screen when the video is close to the screen's shape; otherwise show it whole on black.
  const sar = stageAR ?? 390 / 738;
  const fill = 1 - Math.min(sar / ratio, ratio / sar) <= MAX_FILL_CROP;
  const thumbnail = video.thumbnail_url || null;
  const handleName = video.author_handle ? `@${video.author_handle}` : null;
  const who = video.author_name || handleName || "Christian TikTok";
  const tiktokUrl = video.url;
  const profileUrl = video.author_url || (video.author_handle ? `${TIKTOK_ORIGIN}/@${video.author_handle}` : tiktokUrl);

  return (
    <div className="reel-frame">
      <div className="reel-media bg-black">
        <div ref={stageRef} className="tiktok-stage">
          <div className={cn("tiktok-player", fill && "tiktok-player--fill")} style={{ ["--ar" as string]: String(ratio) }}>
            {/* Until TikTok's player is ready */}
            {!(mounted && showPlayer) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black px-8 text-center text-white">
                {thumbnail && !thumbFailed ? (
                  <img
                    src={thumbnail}
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain"
                    referrerPolicy="no-referrer"
                    onLoad={(e) => {
                      const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                      if (w > 0 && h > 0) setThumbRatio(w / h);
                    }}
                    onError={() => { setThumbFailed(true); requestTikTokRefresh(video.id); }}
                  />
                ) : (
                  <>
                    <TikTokMark className="h-9 w-9 text-white/40" />
                    <p className="text-[15px] font-bold text-white/85">{who}</p>
                  </>
                )}
                {active && !dead && !slow && <Spinner className="relative mt-4" />}
                {active && !dead && slow && (
                  <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className="relative mt-4 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black">
                    <ExternalLink className="h-4 w-4" /> Watch on TikTok
                  </a>
                )}
              </div>
            )}

            {mounted && (
              <iframe
                ref={iframeRef}
                key={video.tiktok_id}
                src={tiktokPlayerUrl(video.tiktok_id)}
                title={video.title || `TikTok by ${who}`}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setLoaded(true)}
                className={cn("absolute inset-0 h-full w-full border-0 bg-black transition-opacity duration-300", showPlayer ? "opacity-100" : "opacity-0")}
              />
            )}
          </div>

          {/* Tap layer over the video (not over TikTok's own buttons along the bottom and right):
              taps here are SOOZ's, so swipes always move the feed and every touch warms up the
              next players for Low Power Mode. */}
          {active && mounted && showPlayer && fill && !tapThrough && (
            <>
              <div className="tiktok-tap tiktok-tap--main" onClick={onTap} aria-hidden />
              <div className="tiktok-tap tiktok-tap--side" onClick={onTap} aria-hidden />
            </>
          )}

          {active && blockedHint && !isPlaying && (
            <div className="pointer-events-none absolute inset-x-0 top-[55%] z-10 flex justify-center px-6">
              <span className="rounded-full bg-black/70 px-5 py-2.5 text-[14px] font-semibold text-white backdrop-blur">
                Tap to play
              </span>
            </div>
          )}
        </div>

        <div className="reel-scrim-top" aria-hidden />
        <div className="tiktok-scrim" aria-hidden />

        {/* Who made it, like TikTok's caption (kept above TikTok's own play / sound bar) */}
        <div className="reel-caption reel-caption--tiktok">
          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-[16px] font-bold text-white hover:underline">
            {who}
          </a>
          {video.title && <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-snug text-white/95">{video.title}</p>}
          <div className="mt-2 flex max-w-[80%] items-center gap-1.5 overflow-hidden text-[13px] text-white/80">
            <TikTokMark className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">TikTok{handleName && handleName !== who ? ` · ${handleName}` : ""}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
