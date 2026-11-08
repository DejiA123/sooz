/**
 * Low Power Mode autoplay for TikTok's embed players.
 *
 * iPhone in Low Power Mode only lets a video start when the start comes from a tap — and a tap in
 * SOOZ doesn't count inside TikTok's player, which is a different website. But Safari passes the
 * tap along to a message posted *during* that tap (WebKit forwards user gestures through
 * postMessage for media playback). So on every touch anywhere in SOOZ we send "play" to each
 * TikTok player that hasn't been started by a tap yet: the one on screen starts, and the ones
 * waiting next to it start for a split second and are paused again. Once a player has been started
 * by a tap, Safari lets it play by itself later — so when you swipe to it, it just plays.
 */
export interface TikTokPlayerHandle {
  /** Ready for commands (TikTok sent onPlayerReady). */
  ready: boolean;
  /** Has played at least once after a tap, so it may now play by itself. */
  blessed: boolean;
  isActive: () => boolean;
  /** Called during a user gesture: start (or warm up) the player now. */
  onGesture: () => void;
}

const players = new Set<TikTokPlayerHandle>();

export function registerTikTokPlayer(handle: TikTokPlayerHandle): () => void {
  players.add(handle);
  return () => { players.delete(handle); };
}

/** At least one TikTok player has answered this visit (so silence from another one means trouble). */
export const tiktokProtocol = { works: false };

/** Taps forwarded to TikTok's player didn't start it on this phone: let taps reach TikTok directly. */
export const tiktokTapForwarding = { broken: false };

let started = false;
export function startTikTokGestures(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  const onGesture = () => {
    for (const p of players) if (p.ready && (!p.blessed || p.isActive())) p.onGesture();
  };
  for (const type of ["touchstart", "touchend", "pointerup", "click", "keydown"]) {
    window.addEventListener(type, onGesture, { capture: true, passive: true });
  }
}
