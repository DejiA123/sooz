import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { engage, isTikTokLiked, isTikTokSaved, setTikTokLiked, setTikTokSaved, tasteOfVideo, useTasteWatch } from "@/lib/taste";
import { Bookmark, ExternalLink, Heart, MessageCircle, Play, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isReposted } from "@/services/api/reposts";
import { cn } from "@/lib/utils";
import { requestTikTokRefresh, tiktokPlayerUrl, type TikTokVideo } from "@/services/api/tiktok";
import { firstPlayerReady, markPlayerReady, playerAnswered, registerTikTokPlayer, tapForwarded, tiktokTapForwarding, whenFirstPlayerReady, type TikTokPlayerHandle } from "@/lib/tiktokPlayers";
import { useReelUi } from "@/lib/reelUi";
import { useVideoStore } from "@/store/useVideoStore";
import { soundAutoplay, soundBlocked } from "@/lib/soundAutoplay";
import { soundTurnedOff } from "@/lib/soundPref";
import { isIOS } from "@/lib/push";
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
/** SOOZ's daily link-preview cards (800×420, the video's cover in the middle with a play button). */
const CARDS = "https://raw.githubusercontent.com/DejiA123/sooz/covers/tt";
/** Fresh starts for a player stuck on TikTok's loading screen. */
const MAX_RESTARTS = 1;

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

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * SOOZ's progress line for a TikTok in the floating look (TikTok's own bar is out of sight), the same
 * line as on SOOZ videos: drag along it to scrub. TikTok reports the time about twice a second, so the
 * line glides between reports.
 */
const TikTokProgress = ({ clock, playing, onSeek }: {
  clock: React.MutableRefObject<{ t: number; d: number; at: number }>;
  playing: React.MutableRefObject<boolean>;
  onSeek: (seconds: number, done: boolean) => void;
}) => {
  const fillRef = useRef<HTMLDivElement>(null);
  const [seeking, setSeeking] = useState<number | null>(null); // seconds under the finger
  const seekingRef = useRef(false);
  const sentAt = useRef(0);
  const [known, setKnown] = useState(false);
  const knownRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { t, d, at } = clock.current;
      if (d > 0) {
        if (!seekingRef.current && fillRef.current) {
          const now = playing.current ? t + Math.min((performance.now() - at) / 1000, 1.5) : t;
          fillRef.current.style.transform = `scaleX(${Math.min(Math.max(now / d, 0), 1)})`;
        }
        if (!knownRef.current) { knownRef.current = true; setKnown(true); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock, playing]);

  const scrub = (clientX: number, el: HTMLElement, done: boolean) => {
    const d = clock.current.d;
    if (!(d > 0)) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${ratio})`;
    // Never quite the very end: that would finish the video and start it again.
    const seconds = Math.min(ratio * d, Math.max(d - 0.25, 0));
    setSeeking(done ? null : seconds);
    if (done || Date.now() - sentAt.current > 120) { sentAt.current = Date.now(); onSeek(seconds, done); }
  };
  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!seekingRef.current) return;
    seekingRef.current = false;
    scrub(e.clientX, e.currentTarget, true);
  };

  return (
    <>
      {seeking !== null && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--bottom-nav-height)+150px)] z-30 flex justify-center md:bottom-40">
          <span className="rounded-full bg-black/55 px-4 py-1.5 text-[17px] font-bold tabular-nums text-white backdrop-blur">
            {mmss(seeking)} <span className="font-semibold text-white/60">/ {mmss(clock.current.d)}</span>
          </span>
        </div>
      )}
      <div
        className="reel-progress group absolute inset-x-0 z-20 flex h-6 cursor-pointer touch-pan-y items-end px-0"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => { e.stopPropagation(); seekingRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); scrub(e.clientX, e.currentTarget, false); }}
        onPointerMove={(e) => { if (seekingRef.current) scrub(e.clientX, e.currentTarget, false); }}
        onPointerUp={end}
        onPointerCancel={end}
        role="slider"
        aria-label="Video progress"
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn("relative w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-150", seeking !== null ? "h-1.5" : "h-[3px] group-hover:h-1.5")}>
          <div ref={fillRef} className={cn("absolute inset-0 origin-left rounded-full", known ? "bg-white/90" : "bg-white/0")} style={{ transform: "scaleX(0)" }} />
        </div>
      </div>
    </>
  );
};

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
 * the TikTok app. Portrait videos are zoomed to fill; square and landscape videos sit whole on black.
 * The player box always has the video's exact shape, so TikTok never pads it with a blurred copy.
 *
 * Two looks (`src/lib/reelUi.ts`):
 * - floating buttons (like the TikTok app): TikTok's player frame is taller than the box, the extra
 *   out of sight above and below. TikTok keeps the video centred at full size and pins its own name
 *   strip, logo, play bar and like / comment / share column to the frame's top and bottom edges — so
 *   only the video is seen. SOOZ draws the pause icon and progress line, and starts the video itself
 *   (TikTok only starts a player by itself when most of its frame is on screen).
 * - side panel (the earlier look, and the fallback whenever TikTok's player doesn't answer SOOZ's
 *   commands): TikTok's controls stay on screen and a solid dock covers its button column.
 *
 * Players load one slide ahead. Videos start muted by themselves; in Low Power Mode every touch in
 * SOOZ "warms up" the waiting players (see `tiktokPlayers.ts`) so they still start by themselves.
 * A tap on the video plays / unmutes / pauses it. Nothing is ever skipped: TikTok's player always
 * shows (if TikTok can't play a video here, it says so and the viewer swipes on).
 */
export const TikTokReel = memo(function TikTokReel({ video, active, near = false, repostedBy }: TikTokReelProps) {
  // Next door: load ahead of time — except on a fresh open, where the video on screen goes first
  // (until the first TikTok player is ready, at most 4s; see tiktokPlayers.ts).
  const [mayPreload, setMayPreload] = useState(firstPlayerReady);
  useEffect(() => {
    if (mayPreload || !near || active) return;
    const off = whenFirstPlayerReady(() => setMayPreload(true));
    const t = setTimeout(() => setMayPreload(true), 4000);
    return () => { off(); clearTimeout(t); };
  }, [mayPreload, near, active]);
  const mounted = active || (near && mayPreload);
  // A player stuck on TikTok's grey loading logo (TikTok only retries its own request after 10s) is
  // started again once: `attempt` gives the frame a fresh start.
  const [attempt, setAttempt] = useState(0);
  const [errored, setErrored] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  // A slide counts once as "a player that didn't answer" (tiktokPlayers.ts), however it ended up there.
  const silentCounted = useRef(false);
  const countSilent = () => { if (silentCounted.current) return; silentCounted.current = true; playerAnswered(false); };
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [cardFailed, setCardFailed] = useState(false);
  const [thumbRatio, setThumbRatio] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [blockedHint, setBlockedHint] = useState(false);
  const [tapThrough, setTapThrough] = useState(tiktokTapForwarding.broken);
  // Floating buttons need TikTok's player to obey SOOZ; a slide where it doesn't uses the side panel.
  const float = useReelUi() === "float" && !tapThrough;
  // SOOZ's own pause icon and progress line (floating look): where the video is, by TikTok's reports.
  const [pausedIcon, setPausedIcon] = useState(false);
  const clock = useRef({ t: 0, d: 0, at: 0 });
  const scrubbing = useRef(false);
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
  // Save (bookmark), like TikTok: kept on the account and shown in the profile's Saved tab.
  const [saved, setSaved] = useState(() => isTikTokSaved(video.tiktok_id));
  const toggleSave = () => {
    const next = !saved;
    setSaved(next);
    learn(next ? "save" : "unsave");
    setTikTokSaved(video.tiktok_id, next, video.author_handle?.toLowerCase() ?? null);
    refreshProfiles(); // the Saved tab
    if (next) toast("Saved to your profile", { action: { label: "View", onClick: () => navigate("/profile/me?tab=saved") } });
    else toast("Removed from Saved");
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
  const autoUnmuteViaPolicy = useRef(false);
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
    setLoaded(false); setReady(false); setSlow(false); setAttempt(0); setErrored(false); setGaveUp(false); silentCounted.current = false;
    setIsPlaying(false); setBlockedHint(false); setMuted(true); setPausedIcon(false);
    setTapThrough(tiktokTapForwarding.broken); // another chance at the floating look next time
    playing.current = false; lastState.current = -1; ourPause.current = false;
    clock.current = { t: 0, d: 0, at: 0 };
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
        playerAnswered(true);
        markPlayerReady();
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
            setPausedIcon(false);
            clock.current.at = performance.now();
            // Sound is on for the feed: bring it back — allowed once a tap has started this player, or
            // whenever the browser lets sound start by itself (src/lib/soundAutoplay.ts).
            if (soundWanted() && mutedRef.current && (handle.current?.blessed || soundAutoplay.allowed)) {
              autoUnmuteViaPolicy.current = !handle.current?.blessed;
              autoUnmuteAt.current = Date.now();
              send("unMute");
            }
          }
        } else if (state === 2) {
          playing.current = false;
          setIsPlaying(false);
          if (activeRef.current && Date.now() - autoUnmuteAt.current < 1500) {
            // Safari wouldn't allow sound without a tap and paused it: carry on muted.
            autoUnmuteAt.current = 0;
            if (handle.current) handle.current.blessed = false;
            // The browser said sound could start by itself but this player was stopped: stop trying on
            // the next videos and show "Tap for sound".
            if (autoUnmuteViaPolicy.current) soundBlocked();
            ourMuteAt.current = Date.now();
            send("mute");
            send("play");
            return;
          }
          if (ourPause.current) ourPause.current = false;
          else if (activeRef.current) userPaused.current = true; // they paused it — leave it
        } else if (state === 0 && activeRef.current) {
          watch.ended(); // watched to the end
          userPaused.current = false; // TikTok reports "paused" just before "ended": that wasn't the viewer
          send("play"); // loop
        }
      } else if (data.type === "onCurrentTime") {
        const v = data.value as { currentTime?: number; duration?: number } | undefined;
        if (v && Number(v.duration) > 0) {
          if (!scrubbing.current) clock.current = { t: Number(v.currentTime) || 0, d: Number(v.duration), at: performance.now() };
          if (activeRef.current) watch.progress(Number(v.currentTime) / Number(v.duration));
        }
      } else if (data.type === "onPlayerError") {
        // TikTok can't show this video here (removed, private, not embeddable…): show its player the
        // earlier way, so its own message and buttons can be read and tapped. (3xxx = it only refused
        // to start by itself, which SOOZ handles.)
        const code = Number((data.value as { errorCode?: number } | undefined)?.errorCode);
        if (code > 0 && code < 3000) { setTapThrough(true); setErrored(true); }
      } else if (data.type === "onMute") {
        const m = !!data.value;
        setMuted(m);
        // (Not taken as "the sound worked": iPhone reports the sound on and only then pauses the video
        // when it won't allow sound without a tap. A pause the person taps clears autoUnmuteAt in onTap.)
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
    setPausedIcon(false);
  }, [active, kick, send]);

  // Keep nudging for a few seconds after it loads, until TikTok reports it is playing.
  useEffect(() => {
    if (!active || !loaded) return;
    const timers = [150, 600, 1200, 2000, 3200, 5000, 8000].map((ms) => setTimeout(kick, ms));
    return () => timers.forEach(clearTimeout);
  }, [active, loaded, kick]);

  // Floating look: a player that has loaded but never says it is ready can't be started by SOOZ —
  // show it the earlier way (TikTok starts it by itself there, and its own controls can be tapped).
  // (Only once fresh starts haven't helped — see below.)
  useEffect(() => {
    if (!active || !loaded || ready || !float || attempt < MAX_RESTARTS) return;
    const t = setTimeout(() => { countSilent(); setTapThrough(true); }, 9000);
    return () => clearTimeout(t);
  }, [active, loaded, ready, float, attempt]);

  // Loaded, on screen, but TikTok still hasn't got its video ready after 6s: start the player again.
  // Not while SOOZ has stopped relying on TikTok's messages this visit (then "ready" never comes).
  const trustMessages = !tiktokTapForwarding.broken;
  useEffect(() => {
    if (!active || !loaded || ready || errored || !trustMessages || attempt >= MAX_RESTARTS) return;
    const t = setTimeout(() => {
      if (document.hidden) return;
      setLoaded(false);
      playing.current = false; lastState.current = -1;
      if (handle.current) handle.current.ready = false;
      setAttempt((a) => a + 1);
    }, 6000);
    return () => clearTimeout(t);
  }, [active, loaded, ready, errored, trustMessages, attempt]);
  // Fresh start used up: show TikTok's own screen after all (whatever it says), never hide it for good —
  // and count it as a player that didn't answer (two in a row and SOOZ stops waiting for "ready" this
  // visit, in case TikTok's messages have changed).
  useEffect(() => {
    if (!loaded || ready || attempt < MAX_RESTARTS || gaveUp) return;
    const t = setTimeout(() => { setGaveUp(true); if (activeRef.current) countSilent(); }, 3000);
    return () => clearTimeout(t);
  }, [loaded, ready, attempt, gaveUp]);

  // …and once SOOZ has stopped relying on commands for this visit, slides already loaded follow.
  useEffect(() => { if (tiktokTapForwarding.broken) setTapThrough(true); }, [active, near]);

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


  // The video's cover and a spinner stay up until TikTok's player has its video ready (instead of
  // TikTok's grey loading logo); its own screen shows at once if it reports a problem (removed,
  // private…), and after the fresh starts are used up. If TikTok's messages can't be relied on this
  // visit, it shows as soon as it has loaded, as before.
  const showPlayer = ready || errored || gaveUp || (loaded && !trustMessages);
  useEffect(() => {
    if (!active || showPlayer) return;
    const t = setTimeout(() => setSlow(true), 14000);
    return () => clearTimeout(t);
  }, [active, showPlayer]);

  // A tap on the video: play it / turn the sound on / pause it. The command is sent during the tap,
  // which Safari counts as the tap itself (so it works in Low Power Mode and allows sound). If that
  // doesn't work on this phone, taps go straight to TikTok's player from then on (and the slide
  // goes back to the side-panel look, where TikTok's own controls show).
  const onTap = () => {
    // Only a player that has said it is ready is judged: an early tap on a loading one proves nothing.
    const judged = !!handle.current?.ready;
    const check = (ok: () => boolean) => {
      if (judged) setTimeout(() => { const good = ok(); tapForwarded(good); if (!good) setTapThrough(true); }, 1600);
    };
    gestureAt.current = Date.now();
    if (!playing.current) {
      userPaused.current = false;
      setPausedIcon(false);
      send("play");
      // A first tap that starts the video also turns the sound on (like TikTok), unless they turned it
      // off — but not on iPhone: there the next videos could then only start with sound from a tap, and
      // in Low Power Mode they'd stay paused. The next tap turns the sound on there, as before.
      const st = useVideoStore.getState();
      if (soundWanted() || (!isIOS() && !st.soundUnlocked && !soundTurnedOff())) {
        send("unMute");
        if (!soundWanted()) { setGlobalMuted(false); setSoundUnlocked(true); }
      }
      check(() => lastState.current === 1 || lastState.current === 3);
    } else if (mutedRef.current) {
      send("unMute");
      setGlobalMuted(false); // sound on for the whole feed, like TikTok
      setSoundUnlocked(true);
      check(() => !mutedRef.current);
    } else {
      userPaused.current = true;
      autoUnmuteAt.current = 0; // their pause, not the browser refusing sound
      setPausedIcon(true);
      send("pause");
    }
  };

  // Scrubbing SOOZ's progress line (floating look).
  const seek = useCallback((seconds: number, done: boolean) => {
    scrubbing.current = !done;
    clock.current = { ...clock.current, t: seconds, at: performance.now() };
    send("seekTo", seconds);
  }, [send]);

  // TikToks are 9:16 unless we know better (TikTok's lookup no longer tells, so sizes come from the
  // database, the built-in list, or the cover image).
  const dbRatio = video.thumbnail_width && video.thumbnail_height ? video.thumbnail_width / video.thumbnail_height : null;
  // (Floating look: very wide videos keep their true shape too — there is no TikTok play bar to fit in.)
  const ratio = float ? Math.min(2.5, Math.max(0.45, dbRatio ?? thumbRatio ?? 9 / 16)) : clampRatio(dbRatio ?? thumbRatio ?? 9 / 16);
  // Fill the screen when the video is close to the screen's shape; otherwise show it whole on black.
  const sar = stageAR ?? 390 / 738;
  const fill = 1 - Math.min(sar / ratio, ratio / sar) <= MAX_FILL_CROP;
  const thumbnail = video.thumbnail_url || null;
  const cardCover = cardFailed ? null : `${CARDS}/${video.tiktok_id}.jpg`;
  // The phone won't start this video without a tap (iPhone Low Power Mode refuses every video until
  // then — TikTok's player would show its grey logo with its own play button): show the cover and
  // "Tap to play"; a tap anywhere on the slide starts it.
  const tapToStart = active && blockedHint && !isPlaying && !tapThrough && !userPaused.current;
  const posterUp = !(mounted && showPlayer) || tapToStart;
  const posterHasPlay = !!cardCover && !(thumbnail && !thumbFailed);
  const handleName = video.author_handle ? `@${video.author_handle}` : null;
  const who = video.author_name || handleName || "Christian TikTok";
  const tiktokUrl = video.url;
  const profileUrl = video.author_url || (video.author_handle ? `${TIKTOK_ORIGIN}/@${video.author_handle}` : tiktokUrl);

  return (
    <div className="reel-frame">
      <div className="reel-media bg-black">
        <div ref={stageRef} className="tiktok-stage">
          <div
            ref={playerRef}
            className={cn("tiktok-player", fill && (float ? "tiktok-player--cover" : "tiktok-player--fill"), float && "tiktok-player--float")}
            style={{ ["--ar" as string]: String(ratio) }}
          >
            {/* The video's cover: until TikTok's player is ready, and while the phone won't let it start
                without a tap (iPhone Low Power Mode) — instead of TikTok's grey logo and play button. */}
            {posterUp && (
              <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-3 bg-black px-8 text-center text-white">
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
                ) : cardCover ? (
                  // The cover is the middle of SOOZ's daily preview card (with its play button), so the
                  // picture is scaled until that middle part fills the box.
                  <img
                    src={cardCover}
                    alt=""
                    crossOrigin="anonymous"
                    decoding="async"
                    onError={() => setCardFailed(true)}
                    className="absolute left-1/2 top-1/2 h-auto max-w-none -translate-x-1/2 -translate-y-1/2"
                    style={{ width: `${(800 / (420 * Math.min(ratio, 800 / 420))) * 100}%` }}
                  />
                ) : (
                  <>
                    <TikTokMark className="h-9 w-9 text-white/40" />
                    <p className="text-[15px] font-bold text-white/85">{who}</p>
                  </>
                )}
                {active && !slow && !tapToStart && <Spinner className={cn("relative", cardCover && !(thumbnail && !thumbFailed) ? "mt-60" : "mt-4")} />}
                {active && slow && !tapToStart && (
                  <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className="relative mt-4 flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black">
                    <ExternalLink className="h-4 w-4" /> Watch on TikTok
                  </a>
                )}
              </div>
            )}

            {mounted && (
              <iframe
                ref={iframeRef}
                key={`${video.tiktok_id}:${attempt}`}
                src={tiktokPlayerUrl(video.tiktok_id) + (attempt ? `&sooz_retry=${attempt}` : "")}
                title={video.title || `TikTok by ${who}`}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setLoaded(true)}
                className={cn("tiktok-iframe absolute inset-0 h-full w-full border-0 bg-black transition-opacity duration-300", showPlayer && !posterUp ? "opacity-100" : "opacity-0")}
              />
            )}
          </div>
          {/* Covers TikTok's name strip only on phones where it can't be tucked under the status bar. */}
          {fill && !float && <div className="tiktok-topband" style={{ ["--ar" as string]: String(ratio) }} aria-hidden />}

          {/* Tap layer over the video: taps here are SOOZ's, so swipes always move the feed and every
              touch warms up the next players for Low Power Mode. Floating look: the whole slide (TikTok's
              controls are out of sight; SOOZ plays / pauses). Side panel: everywhere but TikTok's own
              buttons along the bottom and right. */}
          {active && mounted && showPlayer && float && <div className="tiktok-tap tiktok-tap--full" onClick={onTap} aria-hidden />}
          {active && mounted && showPlayer && fill && !float && !tapThrough && (
            <>
              <div className="tiktok-tap tiktok-tap--main" onClick={onTap} aria-hidden />
              <div className="tiktok-tap tiktok-tap--side" onClick={onTap} aria-hidden />
            </>
          )}

          {/* Floating look: SOOZ's pause icon, as on SOOZ videos */}
          {float && active && showPlayer && !isPlaying && (pausedIcon || blockedHint) && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
              {/* (The preview card's cover already has a play button in the middle.) */}
              {!(tapToStart && posterHasPlay) && (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/35 backdrop-blur-sm animate-scale-in">
                  <Play className="ml-1 h-10 w-10 fill-white/90 text-white/90" />
                </div>
              )}
              {blockedHint && !pausedIcon && <span className={cn("rounded-full bg-black/55 px-3 py-1 text-[13px] font-semibold text-white", tapToStart && posterHasPlay && "mt-60")}>Tap to play</span>}
            </div>
          )}

          {!float && active && blockedHint && !isPlaying && (
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
        <div className={cn("reel-caption reel-caption--tiktok", float && "reel-caption--float")}>
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

        {float && active && mounted && showPlayer && <TikTokProgress clock={clock} playing={playing} onSeek={seek} />}
      </div>

      {/* SOOZ's buttons, the same as on SOOZ posts; the heart shows TikTok's like count. Floating look:
          they float over the video (TikTok's own column is out of sight). Side panel: TikTok's column is
          on screen and SOOZ can't remove it (it's TikTok's page), so a solid dock covers it — the whole
          column on full-screen TikToks, the video's right edge on landscape ones. */}
      <div
        className={cn("tiktok-sooz-rail reel-dock", !float && "reel-dock--keep", !float && fill && "tiktok-sooz-rail--cover", !float && !fill && playerBox && "tiktok-sooz-rail--onvideo")}
        style={!float && !fill && playerBox ? { top: playerBox.top, minHeight: playerBox.height } : undefined}
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
          ariaLabel={saved ? "Remove from Saved" : "Save"}
          pressed={saved}
          onClick={toggleSave}
          label={saved ? "Saved" : "Save"}
          icon={<Bookmark key={String(saved)} className={cn(railIconClass, saved ? "fill-amber-400 text-amber-400 animate-like-pop" : "fill-white/95 text-white/95")} strokeWidth={1.5} />}
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
