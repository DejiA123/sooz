import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { engage, isTikTokLiked, setTikTokLiked, tasteOfVideo, useTasteWatch } from "@/lib/taste";
import { ExternalLink, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isReposted } from "@/services/api/reposts";
import { cn } from "@/lib/utils";
import { requestTikTokRefresh, tiktokPlayerUrl, type TikTokVideo } from "@/services/api/tiktok";
import { registerTikTokPlayer, tiktokTapForwarding, type TikTokPlayerHandle } from "@/lib/tiktokPlayers";
import { useVideoStore } from "@/store/useVideoStore";
import { countTikTokComments } from "@/services/api/tiktokComments";
import { formatCount, Spinner } from "./gestures";
import { RailButton, ShareArrow, railIconClass } from "./ReelRail";
import { refreshProfiles } from "@/lib/profileRefresh";


// The comments sheet only downloads when someone opens it.
const TikTokComments = lazy(() => import("./TikTokComments").then((m) => ({ default: m.TikTokComments })));
const ShareSheet = lazy(() => import("./ShareSheet").then((m) => ({ default: m.ShareSheet })));

const TIKTOK_ORIGIN = "https://www.tiktok.com";
/** Fill the screen (cropping a little, like TikTok) only when that hides at most this much of the video. */
const MAX_FILL_CROP = 0.2;
const clampRatio = (r: number) => Math.min(2, Math.max(0.45, r));

/** Small TikTok-style note mark for attribution. */
export const TikTokMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M16.6 2h-3.4v13.3a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.4 6.4 0 1 0 5.4 6.3V8.6a8 8 0 0 0 4.6 1.5V6.7a4.7 4.7 0 0 1-4.6-4.7z" />
  </svg>
);

/** A TikTok caption with its #hashtags and @mentions in bold, like TikTok. */
const TikTokCaption = ({ text }: { text: string }) => (
  <>{text.split(/([#@][\p{L}\p{N}_.]+)/u).map((part, i) => (i % 2 ? <strong key={i} className="font-semibold text-white">{part}</strong> : part))}</>
);

interface TikTokReelProps {
  video: TikTokVideo;
  active: boolean;
  /** On screen or next to it: its player loads ahead of time, so it is ready (and tap-warmed) on arrival. */
  near?: boolean;
  /** Shown in Following when someone you follow reposted it. */
  repostedBy?: string;
}

/**
 * A Christian TikTok in the feed, played by TikTok's own embed player and filling the screen like
 * the TikTok app (TikTok's player draws its own like / comment / share buttons). Portrait videos
 * are zoomed to fill; square and landscape videos sit whole on black. The player box always has the
 * video's exact shape, so TikTok never pads it with a blurred copy.
 *
 * Players load one slide ahead. Videos start muted by themselves; in Low Power Mode every touch in
 * SOOZ "warms up" the waiting players (see `tiktokPlayers.ts`) so they still start by themselves.
 * A tap on the video plays / unmutes / pauses it. Nothing is ever skipped: TikTok's player always
 * shows (if TikTok can't play a video here, it says so and the viewer swipes on).
 */
export const TikTokReel = memo(function TikTokReel({ video, active, near = false, repostedBy }: TikTokReelProps) {
  const mounted = near || active;
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [thumbRatio, setThumbRatio] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [blockedHint, setBlockedHint] = useState(false);
  const [tapThrough, setTapThrough] = useState(tiktokTapForwarding.broken);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // SOOZ's heart shows TikTok's like count, +1 once you've liked it; hearts are kept on the account
  // (src/lib/taste.ts) and listed in the profile's Liked tab.
  const [liked, setLiked] = useState(() => isTikTokLiked(video.tiktok_id));
  // What this viewer enjoys (For You learns from it): how it's watched, likes, comments, shares…
  const watch = useTasteWatch(tasteOfVideo(video), active);
  const learn = (action: Parameters<typeof engage>[1]) => engage(tasteOfVideo(video), action);
  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    learn(next ? "like" : "unlike");
    setTikTokLiked(video.tiktok_id, next, video.author_handle?.toLowerCase() ?? null);
    refreshProfiles(); // the Liked tab
  };
  const [reposted, setRepostedState] = useState(false);
  // Long captions show two lines with "more"; a tap opens the whole caption (and dims the video).
  const [captionOpen, setCaptionOpen] = useState(false);
  const [captionCut, setCaptionCut] = useState(false);
  const captionRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (!active) setCaptionOpen(false); }, [active]);
  useLayoutEffect(() => {
    const el = captionRef.current;
    if (!el || captionOpen) return;
    const check = () => setCaptionCut(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [video.title, captionOpen]);
  const { user } = useAuth();
  const navigate = useNavigate();

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

  // Where the player box sits (landscape / square videos): SOOZ's dock moves up onto its right edge to
  // cover TikTok's own like / comment / share column there, as it does on full-screen TikToks. Phones only.
  const playerRef = useRef<HTMLDivElement>(null);
  const [playerBox, setPlayerBox] = useState<{ top: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const p = playerRef.current, st = stageRef.current;
    if (!p || !st) return;
    const measure = () => {
      if (window.matchMedia("(min-width: 768px)").matches || !p.offsetHeight) { setPlayerBox(null); return; }
      const next = { top: p.offsetTop, height: p.offsetHeight };
      setPlayerBox((prev) => (prev && prev.top === next.top && prev.height === next.height ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(st);
    ro.observe(p);
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

  // Player removed (scrolled far away): start fresh next time.
  useEffect(() => {
    if (mounted) return;
    setLoaded(false); setReady(false); setSlow(false);
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
            watch.played();
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
          watch.ended(); // watched to the end
          send("play"); // loop
        }
      } else if (data.type === "onCurrentTime") {
        const v = data.value as { currentTime?: number; duration?: number } | undefined;
        if (activeRef.current && v && Number(v.duration) > 0) watch.progress(Number(v.currentTime) / Number(v.duration));
      } else if (data.type === "onMute") {
        const m = !!data.value;
        setMuted(m);
        if (!m && handle.current && Date.now() - gestureAt.current < 4000) handle.current.blessed = true;
        // Sound turned on/off with TikTok's own button: the whole feed follows.
        if (activeRef.current && playing.current && Date.now() - ourMuteAt.current > 1500 && m !== useVideoStore.getState().isGlobalMuted) {
          setGlobalMuted(m);
          if (!m) setSoundUnlocked(true);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mounted, kick, send, setGlobalMuted, setSoundUnlocked, watch]);

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

  // SOOZ comment count for the button (fetched when the slide is on screen or next to it).
  useEffect(() => {
    if (!(near || active) || commentCount !== null) return;
    let alive = true;
    countTikTokComments(video.tiktok_id).then((n) => { if (alive && n !== null) setCommentCount(n); });
    return () => { alive = false; };
  }, [near, active, commentCount, video.tiktok_id]);

  // Show TikTok's player as soon as it has loaded — it always plays (no skipping), like TikTok.
  // Whether I reposted it (once the slide is on screen or next to it).
  useEffect(() => {
    if (!(near || active) || !user) return;
    let alive = true;
    isReposted(user.id, { tiktok: video }).then((r) => { if (alive) setRepostedState(r); });
    return () => { alive = false; };
  }, [near, active, user, video]);


  const showPlayer = loaded || ready;
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
          <div ref={playerRef} className={cn("tiktok-player", fill && "tiktok-player--fill")} style={{ ["--ar" as string]: String(ratio) }}>
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
                {active && !slow && <Spinner className="relative mt-4" />}
                {active && slow && (
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
          {/* Covers TikTok's name strip only on phones where it can't be tucked under the status bar. */}
          {fill && <div className="tiktok-topband" style={{ ["--ar" as string]: String(ratio) }} aria-hidden />}

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

        {!fill && <div className="reel-scrim-top" aria-hidden />}
        <div className="tiktok-scrim" aria-hidden />

        {captionOpen && <div className="tiktok-caption-dim absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setCaptionOpen(false)} aria-hidden />}

        {/* Who made it, like TikTok's caption (kept above TikTok's own play / sound bar) */}
        <div className="reel-caption reel-caption--tiktok">
          {repostedBy && (
            <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-white/85"><Repeat2 className="h-4 w-4 text-amber-400" /> {repostedBy} reposted</p>
          )}
          <a href={profileUrl} target="_blank" rel="noopener noreferrer" onClick={() => learn("profile")} className="inline-block max-w-full truncate align-top text-[16px] font-bold text-white hover:underline">
            {who}
          </a>
          {video.title && (captionOpen ? (
            <button type="button" aria-expanded onClick={() => setCaptionOpen(false)} className="mt-1.5 block max-h-[38vh] w-full overflow-y-auto overscroll-contain text-left text-[14.5px] leading-snug text-white/95 hide-scrollbar">
              <span className="whitespace-pre-line"><TikTokCaption text={video.title} /></span>
              <span className="ml-1.5 font-semibold text-white/60">less</span>
            </button>
          ) : (
            <button type="button" aria-expanded={false} onClick={() => { if (captionCut) { setCaptionOpen(true); learn("more"); } }} className="-my-1 mt-0.5 flex w-full items-end gap-1.5 py-1.5 text-left text-[14.5px] leading-snug text-white/95">
              <p ref={captionRef} className="line-clamp-2 min-w-0 flex-1"><TikTokCaption text={video.title.replace(/\s*\n\s*/g, " ")} /></p>
              {captionCut && <span className="-mr-2 shrink-0 px-2 py-1 font-bold text-white">more</span>}
            </button>
          ))}
          <div className="mt-2 flex max-w-[80%] items-center gap-1.5 overflow-hidden text-[13px] text-white/80">
            <TikTokMark className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">TikTok{handleName && handleName !== who ? ` · ${handleName}` : ""}</span>
          </div>
        </div>
      </div>

      {/* SOOZ's buttons, in the same dock as on SOOZ posts. TikTok's player always draws its own like /
          comment / share column and SOOZ can't remove it (it's TikTok's page), so on full-screen TikToks
          the dock covers that whole column — wherever TikTok puts it — and SOOZ's heart shows TikTok's
          like count. */}
      <div
        className={cn("tiktok-sooz-rail reel-dock", fill && "tiktok-sooz-rail--cover", !fill && playerBox && "tiktok-sooz-rail--onvideo")}
        style={!fill && playerBox ? { top: playerBox.top, minHeight: playerBox.height } : undefined}
      >
        <RailButton
          ariaLabel={liked ? "Unlike" : "Like"}
          pressed={liked}
          onClick={toggleLike}
          label={video.likes != null ? formatCount(video.likes + (liked ? 1 : 0)) : "Like"}
          icon={<Heart key={String(liked)} className={cn(railIconClass, liked ? "fill-[#ff2d55] text-[#ff2d55] animate-like-pop" : "fill-white/95 text-white/95")} strokeWidth={1.5} />}
        />
        <RailButton
          ariaLabel="Comments"
          onClick={() => { setCommentsOpen(true); learn("openComments"); }}
          label={commentCount ? formatCount(commentCount) : "Comment"}
          icon={<MessageCircle className={cn(railIconClass, "fill-white/95 text-white/95")} strokeWidth={1.5} />}
        />
        <RailButton
          ariaLabel="Share"
          onClick={() => { setShareOpen(true); learn("openShare"); }}
          label={reposted ? "Reposted" : "Share"}
          icon={reposted ? <Repeat2 className={cn(railIconClass, "text-amber-400")} strokeWidth={2.2} /> : <ShareArrow className={cn(railIconClass, "text-white/95")} />}
        />
      </div>
      {shareOpen && (
        <Suspense fallback={null}>
          <ShareSheet item={{ kind: "tiktok", video }} open={shareOpen} onOpenChange={setShareOpen}
            onRepostChange={setRepostedState} />
        </Suspense>
      )}
      {commentsOpen && (
        <Suspense fallback={null}>
          <TikTokComments tiktokId={video.tiktok_id} tiktokUrl={tiktokUrl} open={commentsOpen} onOpenChange={setCommentsOpen} onCount={setCommentCount} />
        </Suspense>
      )}
    </div>
  );
});
