/**
 * Low Power Mode on iPhone stops videos from starting by themselves, except on video players the
 * viewer has already started with a tap. So SOOZ keeps a small set of video players, "wakes" all of
 * them on the viewer's first tap anywhere in the app, and reuses those same players for every feed
 * video. After that first tap, feed videos autoplay even in Low Power Mode.
 */

// 1-frame silent clip, only used to wake players that have nothing loaded yet.
const BLANK = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMQbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAGQAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAjp0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAGQAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAABkAAAAAAABAAAAAAGybWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAABABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABXW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAR1zdGJsAAAAuXN0c2QAAAAAAAAAAQAAAKlhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAL2F2Y0MBQsAe/+EAFmdCwB7ZHsBEAAADAAQAAAMAUDxYuSABAAZoy4BlEyAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAADJ4AAAyeAAAAAYc3R0cwAAAAAAAAABAAAAAQAABAAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAEAAAABAAAAFHN0c3oAAAAAAAAChgAAAAEAAAAUc3RjbwAAAAAAAAABAAADQAAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjAuMTYuMTAwAAAACGZyZWUAAAKObWRhdAAAAnMGBf//b9xF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjQgcjMxMDggMzFlMTlmOSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjMgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0wIHJlZj0zIGRlYmxvY2s9MTotMzotMyBhbmFseXNlPTB4MToweDExMSBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9Mi4wMDowLjcwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MCBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tNCB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0wIHdlaWdodHA9MCBrZXlpbnQ9MjUwIGtleWludF9taW49MTAgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTUxLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjIwAIAAAAALZYiEDs5yYoAAgY4=";
const POOL_SIZE = 5;

const all: HTMLVideoElement[] = [];
const free: HTMLVideoElement[] = [];
let active: HTMLVideoElement | null = null;
let started = false;
let unlocked = false;

function create(): HTMLVideoElement {
  const v = document.createElement("video");
  v.muted = true;
  v.defaultMuted = true;
  v.playsInline = true;
  v.loop = true;
  v.preload = "auto";
  v.disablePictureInPicture = true;
  v.setAttribute("playsinline", "");
  v.setAttribute("webkit-playsinline", "true");
  v.setAttribute("x-webkit-airplay", "deny");
  return v;
}

function unlock() {
  if (unlocked) return;
  unlocked = true;
  for (const type of EVENTS) window.removeEventListener(type, unlock, true);
  for (const v of all) {
    if (v === active) {
      // The video on screen: just start it (this is the tap Low Power Mode was waiting for).
      v.play().catch(() => {});
      continue;
    }
    const empty = !v.getAttribute("src");
    if (empty) v.src = BLANK;
    const wasMuted = v.muted;
    v.muted = true;
    v.play().catch(() => {});
    v.pause();
    v.muted = wasMuted;
    if (empty) { v.removeAttribute("src"); v.load(); }
  }
}

const EVENTS = ["touchend", "pointerup", "click", "keydown"] as const;

/** Creates the players and listens for the first tap. Safe to call more than once. */
export function startVideoPool() {
  if (started || typeof document === "undefined") return;
  started = true;
  for (let i = 0; i < POOL_SIZE; i++) {
    const v = create();
    all.push(v);
    free.push(v);
  }
  for (const type of EVENTS) window.addEventListener(type, unlock, { capture: true, passive: true });
}

/** A (woken, when possible) video player for a feed slide. Give it back with releaseVideo. */
export function acquireVideo(): HTMLVideoElement {
  startVideoPool();
  const v = free.pop();
  if (v) return v;
  const extra = create(); // more slides than players: still works, just not woken
  all.push(extra);
  return extra;
}

export function releaseVideo(v: HTMLVideoElement) {
  if (active === v) active = null;
  v.pause();
  v.removeAttribute("src");
  v.removeAttribute("poster");
  v.load();
  v.remove();
  if (!free.includes(v)) free.push(v);
}

/** Tells the pool which player is on screen (so the first tap starts it rather than pausing it). */
export function setActiveVideo(v: HTMLVideoElement | null) {
  active = v;
}
