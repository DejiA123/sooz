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

/**
 * Does TikTok's player still listen to SOOZ on this phone? The floating-buttons look depends on it
 * (TikTok's own controls are out of sight there), so a slide that gets no answer goes back to the
 * side-panel look, where TikTok's controls can be tapped — and after two in a row with no success in
 * between, so does every slide for the rest of this visit.
 */
export const tiktokTapForwarding = {
  /** Commands can't be relied on here: let taps reach TikTok's player directly. */
  broken: false,
  /** Taps passed to a player that didn't act on them, in a row. */
  fails: 0,
  /** Players that loaded but never said they were ready, in a row. */
  silent: 0,
};

/** A tap was passed on to a ready player: did the player do what was asked? */
export function tapForwarded(ok: boolean): void {
  if (ok) tiktokTapForwarding.fails = 0;
  else if (++tiktokTapForwarding.fails >= 2) tiktokTapForwarding.broken = true;
}

/** A loaded player did (true) or didn't (false) announce it was ready for commands. */
export function playerAnswered(ok: boolean): void {
  if (ok) tiktokTapForwarding.silent = 0;
  else if (++tiktokTapForwarding.silent >= 2) tiktokTapForwarding.broken = true;
}

import { soundOnFromGesture } from "./soundAutoplay";

/**
 * Fresh open: the video on screen gets TikTok's attention first. Until the first TikTok player of
 * this visit is ready, the one waiting next door doesn't start loading (two TikTok players booting at
 * once on a phone — each running TikTok's heavy page — could leave the first stuck on TikTok's grey
 * logo). After that, next-door players load straight away as before.
 */
let firstReady = false;
const readyWaiters = new Set<() => void>();
export const firstPlayerReady = () => firstReady;
export function markPlayerReady(): void {
  if (firstReady) return;
  firstReady = true;
  readyWaiters.forEach((f) => f());
  readyWaiters.clear();
}
export function whenFirstPlayerReady(cb: () => void): () => void {
  if (firstReady) { cb(); return () => {}; }
  readyWaiters.add(cb);
  return () => { readyWaiters.delete(cb); };
}

let started = false;
export function startTikTokGestures(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  const onGesture = (e: Event) => {
    soundOnFromGesture(e); // a real click / key press turns the feed's sound on first
    for (const p of players) if (p.ready && (!p.blessed || p.isActive())) p.onGesture();
  };
  for (const type of ["touchstart", "touchend", "pointerup", "click", "keydown"]) {
    window.addEventListener(type, onGesture, { capture: true, passive: true });
  }
}
