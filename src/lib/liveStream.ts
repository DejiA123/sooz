import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * SOOZ Live (self-hosted, no streaming server).
 *
 * The broadcaster's phone records the camera in short, self-contained clips (each one a complete
 * little video that starts with a full picture), uploads each clip to SOOZ's storage, then tells
 * viewers about it instantly over a Realtime channel (`live:{broadcastId}`). The live row in
 * `live_stream_config` holds `playback_url = "sooz-live:{broadcastId}"` (stable for the whole live)
 * and, in `stream_key`, a small JSON list of the latest clips so people who join late can start
 * straight away. Viewers play the clips back to back with Media Source Extensions.
 *
 * (Uploads get a new random address each time, so a classic playlist file can't work here.)
 */
export const LIVE_PREFIX = "sooz-live:";

export interface LiveClip {
  seq: number;
  url: string;
  /** Seconds. */
  dur: number;
}

export interface LiveManifest {
  v: 1;
  id: string;
  /** What the recorder produced, e.g. video/mp4 or video/webm. */
  mime: string;
  title?: string;
  clips: LiveClip[];
}

export const isSoozLive = (src: string | null | undefined) => !!src && src.startsWith(LIVE_PREFIX);
export const liveIdOf = (src: string) => src.slice(LIVE_PREFIX.length);

export function parseManifest(raw: string | null | undefined): LiveManifest | null {
  if (!raw) return null;
  try {
    const m = JSON.parse(raw) as LiveManifest;
    return m && m.v === 1 && Array.isArray(m.clips) ? m : null;
  } catch {
    return null;
  }
}

/** The current live's clip list (for joining late, and as a safety net if live updates drop). */
export async function fetchLiveManifest(broadcastId: string): Promise<{ manifest: LiveManifest | null; live: boolean }> {
  const { data } = await supabase
    .from("live_stream_config")
    .select("status, playback_url, stream_key")
    .eq("playback_url", LIVE_PREFIX + broadcastId)
    .limit(1)
    .maybeSingle();
  return { manifest: parseManifest(data?.stream_key), live: data?.status === "live" };
}

/**
 * One shared Realtime channel per live (the realtime client hands out the same channel for the same
 * name, and adding listeners after it connected throws), with presence so the host sees how many
 * people are watching.
 */
type ClipListener = (clip: LiveClip) => void;
type EndListener = () => void;
const viewerChannels = new Map<string, { ch: RealtimeChannel; clips: Set<ClipListener>; ends: Set<EndListener> }>();

export function watchLive(broadcastId: string, viewerKey: string, onClip: ClipListener, onEnd: EndListener): () => void {
  let entry = viewerChannels.get(broadcastId);
  if (!entry) {
    const clips = new Set<ClipListener>();
    const ends = new Set<EndListener>();
    const ch = supabase.channel(`live:${broadcastId}`, { config: { presence: { key: viewerKey } } });
    ch.on("broadcast", { event: "clip" }, ({ payload }) => clips.forEach((l) => l(payload as LiveClip)))
      .on("broadcast", { event: "end" }, () => ends.forEach((l) => l()))
      .subscribe((status) => { if (status === "SUBSCRIBED") ch.track({ role: "viewer", at: Date.now() }).catch(() => {}); });
    entry = { ch, clips, ends };
    viewerChannels.set(broadcastId, entry);
  }
  entry.clips.add(onClip);
  entry.ends.add(onEnd);
  return () => {
    const e = viewerChannels.get(broadcastId);
    if (!e) return;
    e.clips.delete(onClip);
    e.ends.delete(onEnd);
    if (!e.clips.size && !e.ends.size) {
      viewerChannels.delete(broadcastId);
      supabase.removeChannel(e.ch);
    }
  };
}

/** Which MSE type to use for a clip, read from the clip itself (exact codecs from its header). */
export function sourceTypeFor(bytes: Uint8Array, recorderMime: string): string {
  const head = bytes.subarray(0, Math.min(bytes.length, 64 * 1024));
  const find = (ascii: string) => {
    const a = [...ascii].map((c) => c.charCodeAt(0));
    outer: for (let i = 0; i + a.length <= head.length; i++) {
      for (let j = 0; j < a.length; j++) if (head[i + j] !== a[j]) continue outer;
      return i;
    }
    return -1;
  };
  const isMp4 = recorderMime.includes("mp4") || find("ftyp") === 4;
  if (isMp4) {
    const codecs: string[] = [];
    const avcC = find("avcC");
    if (avcC >= 0 && avcC + 8 < head.length) {
      const hex = (n: number) => n.toString(16).padStart(2, "0");
      codecs.push(`avc1.${hex(head[avcC + 5])}${hex(head[avcC + 6])}${hex(head[avcC + 7])}`);
    } else if (find("hvcC") >= 0) codecs.push("hvc1.1.6.L93.B0");
    else if (find("vpcC") >= 0) codecs.push("vp09.00.10.08");
    else if (find("av1C") >= 0) codecs.push("av01.0.04M.08");
    if (find("mp4a") >= 0) codecs.push("mp4a.40.2");
    else if (find("Opus") >= 0 || find("dOps") >= 0) codecs.push("opus");
    return codecs.length ? `video/mp4; codecs="${codecs.join(", ")}"` : "video/mp4";
  }
  const codecs: string[] = [];
  if (find("V_VP9") >= 0) codecs.push("vp9");
  else if (find("V_VP8") >= 0) codecs.push("vp8");
  else if (find("V_AV1") >= 0) codecs.push("av01.0.04M.08");
  else if (find("V_MPEG4/ISO/AVC") >= 0) codecs.push("avc1.42E01E");
  if (find("A_OPUS") >= 0) codecs.push("opus");
  return codecs.length ? `video/webm; codecs="${codecs.join(", ")}"` : "video/webm";
}
