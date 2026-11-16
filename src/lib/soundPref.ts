/** The person's own sound choice for the feed ("off" only if they turned it off), kept on the phone. */
const PREF_KEY = "sooz-sound";
export const soundTurnedOff = () => { try { return localStorage.getItem(PREF_KEY) === "off"; } catch { return false; } };
/** The person chose sound on / off themselves (sound button, tap on a video, TikTok's own button). */
export const saveSoundChoice = (muted: boolean) => { try { localStorage.setItem(PREF_KEY, muted ? "off" : "on"); } catch { /* storage blocked */ } };
