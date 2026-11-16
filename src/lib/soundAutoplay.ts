import { useVideoStore } from "@/store/useVideoStore";
import { isIOS } from "@/lib/push";
import { soundTurnedOff } from "@/lib/soundPref";

/**
 * Sound on by default, like TikTok, wherever the browser allows it.
 *
 * Browsers decide whether a video may start with sound: Chrome on Android lets an installed app do it,
 * desktop Chrome lets sites people use a lot do it, and any browser allows it once the person has
 * clicked or pressed a key on the page. iPhone never lets a video start with sound by itself — there
 * the first tap turns it on (`tiktokPlayers.ts` "blessed" players handle the rest).
 *
 * So: on opening, a silent sound is played to ask the browser. If it may, the feed starts with sound
 * (TikTok players are told to unmute as soon as they play). If not, the feed starts muted with "Tap for
 * sound", and the first real click / key press anywhere turns sound on. Someone who turned sound off
 * with the sound button keeps it off (`sooz-sound` = "off").
 */
export const soundAutoplay = { allowed: false };


let silentUrl: string | null = null;
/** A tenth of a second of silence (8 kHz, 8-bit mono WAV). */
function silence(): string {
  if (silentUrl) return silentUrl;
  const n = 800, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128); // 8-bit silence is the midpoint
  silentUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return silentUrl;
}

/** Turn the feed's sound on now: every SOOZ video and TikTok player in the feed. */
function soundOnEverywhere() {
  useVideoStore.setState({ isGlobalMuted: false, soundUnlocked: true });
  document.querySelectorAll<HTMLVideoElement>(".reels-scroller video").forEach((el) => { el.muted = false; });
  document.querySelectorAll<HTMLIFrameElement>(".reels-scroller iframe").forEach((f) =>
    f.contentWindow?.postMessage({ type: "unMute", "x-tiktok-player": true }, "https://www.tiktok.com"),
  );
}

/** Ask the browser whether sound may start without a tap; if so, the feed starts with sound. */
export async function probeSoundAutoplay(): Promise<boolean> {
  if (typeof window === "undefined" || soundTurnedOff()) return false;
  let ok = false;
  const policy = (navigator as Navigator & { getAutoplayPolicy?: (t: string) => string }).getAutoplayPolicy;
  if (policy) {
    try { ok = policy.call(navigator, "mediaelement") === "allowed"; } catch { ok = false; }
  } else {
    try {
      const a = new Audio(silence());
      await a.play();
      a.pause();
      ok = true;
    } catch { ok = false; }
  }
  if (ok && !soundTurnedOff()) {
    soundAutoplay.allowed = true;
    soundOnEverywhere();
  }
  return ok;
}

/** The browser stopped a video from playing with sound after all: carry on muted, show "Tap for sound". */
export function soundBlocked() {
  soundAutoplay.allowed = false;
  useVideoStore.setState({ isGlobalMuted: true, soundUnlocked: false });
}

/** Feed areas that turn sound on by themselves on the first tap (and would otherwise toggle it straight back). */
const OWN_SOUND_TAP = ".feed-sound-toggle, .tiktok-tap, .reel-media, iframe";

/**
 * A real click or key press anywhere (not a scroll) turns the feed's sound on, unless the person turned it
 * off. Called from the app-wide gesture listener in `tiktokPlayers.ts`, before the players hear the tap.
 */
export function soundOnFromGesture(e: Event) {
  if (e.type !== "click" && e.type !== "keydown") return; // a finger lifting after a swipe isn't a tap
  if (e.type === "keydown" && ["Escape", "Tab", "Shift", "Control", "Alt", "Meta"].includes((e as KeyboardEvent).key)) return;
  const st = useVideoStore.getState();
  if (soundTurnedOff() || !st.isGlobalMuted || st.soundUnlocked) return;
  const t = e.target as Element | null;
  if (t?.closest?.(OWN_SOUND_TAP)) return;
  soundOnEverywhere();
  // Once someone has clicked, Chrome / Firefox / Edge let later videos start with sound too. (Not
  // iPhone: there each player has to be started by a tap, which tiktokPlayers.ts takes care of.)
  if (!isIOS()) setTimeout(() => { probeSoundAutoplay(); }, 0);
}
