import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Camera, Eye, Loader2, Radio, RefreshCcw, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPresignedUploadUrl } from "@/integrations/s3/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { LIVE_PREFIX, type LiveClip, type LiveManifest } from "@/lib/liveStream";

interface LiveStudioProps {
  onStreamStarted?: (playbackUrl: string) => void;
  onStreamEnded?: () => void;
  /** Called with true while live (starting, on air or ending), false otherwise. */
  onLiveChange?: (live: boolean) => void;
}

/** Length of each clip. Shorter = less delay for viewers, longer = fewer uploads. */
const CLIP_MS = 4000;
/** If uploads fall this far behind, the oldest waiting clip is dropped to stay live. */
const MAX_WAITING = 3;

const RECORDER_TYPES = [
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm",
];
const pickRecorderType = () =>
  typeof MediaRecorder === "undefined" ? null : RECORDER_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Go live from this phone's camera to everyone on SOOZ (see `src/lib/liveStream.ts`). */
export const LiveStudio = ({ onStreamStarted, onStreamEnded, onLiveChange }: LiveStudioProps) => {
  const { user } = useAuth();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [phase, setPhase] = useState<"idle" | "live" | "ending">("idle");
  const [onAir, setOnAir] = useState(false); // first clip reached viewers
  const [title, setTitle] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [watching, setWatching] = useState(0);
  const [weak, setWeak] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const typeRef = useRef("");
  const idRef = useRef("");
  const rowIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const queue = useRef<{ blob: Blob; dur: number }[]>([]);
  const uploading = useRef(false);
  const seq = useRef(0);
  const clips = useRef<LiveClip[]>([]);
  const titleRef = useRef("");
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const liveRef = useRef(false);

  // ---- Camera ----
  const openCamera = async (want: "user" | "environment" = facing) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: want, width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30, max: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const old = streamRef.current;
      streamRef.current = s;
      if (liveRef.current) nextClip(); // carry on recording from the new camera straight away
      old?.getTracks().forEach((t) => t.stop());
      setStream(s);
      setFacing(want);
      setCameraError(false);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      setCameraError(true);
    }
  };

  useEffect(() => {
    openCamera("user");
    return () => {
      if (liveRef.current) endLive(true);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      timers.current.forEach(clearInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream]);

  // ---- Uploading clips, in order ----
  const upload = async (blob: Blob) => {
    const type = blob.type.split(";")[0] || "video/mp4";
    const ext = type.includes("webm") ? "webm" : "mp4";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { signedUrl, publicUrl } = await getPresignedUploadUrl(`live.${ext}`, type);
        const res = await fetch(signedUrl, { method: "PUT", body: blob, headers: { "Content-Type": type } });
        if (res.ok) return publicUrl;
      } catch { /* try again */ }
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
    return null;
  };

  const saveLiveRow = async () => {
    if (!user) return false;
    const manifest: LiveManifest = { v: 1, id: idRef.current, mime: typeRef.current, title: titleRef.current || undefined, clips: clips.current };
    const row = {
      status: "live",
      is_active: true,
      playback_url: LIVE_PREFIX + idRef.current,
      stream_uid: user.id,
      stream_key: JSON.stringify(manifest),
      updated_at: new Date().toISOString(),
    };
    if (!rowIdRef.current) {
      // Your own live row (each live belongs to the person streaming it — only they can change it).
      const { data } = await supabase.from("live_stream_config").select("id").eq("stream_uid", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      rowIdRef.current = data?.id ?? null;
    }
    if (rowIdRef.current) {
      const { data: changed, error } = await supabase.from("live_stream_config").update(row).eq("id", rowIdRef.current).select("id");
      if (!error && changed?.length) return true;
      if (error) return false;
      rowIdRef.current = null; // not ours any more: start a new row below
    }
    const { data, error } = await supabase.from("live_stream_config").insert(row).select("id").single();
    rowIdRef.current = data?.id ?? null;
    return !error;
  };

  const pump = async () => {
    if (uploading.current) return;
    const item = queue.current.shift();
    if (!item) return;
    uploading.current = true;
    try {
      const url = await upload(item.blob);
      if (!url) { setWeak(true); return; }
      const clip: LiveClip = { seq: seq.current++, url, dur: Math.round(Math.min(10, Math.max(0.5, item.dur)) * 100) / 100 };
      clips.current = [...clips.current, clip].slice(-6);
      channelRef.current?.send({ type: "broadcast", event: "clip", payload: clip }).catch(() => {});
      const saved = await saveLiveRow();
      if (clip.seq === 0) {
        if (!saved) toast.error("Couldn't tell SOOZ you're live — please check your connection");
        setOnAir(true);
        onStreamStarted?.(LIVE_PREFIX + idRef.current);
      }
      setWeak(queue.current.length > 1);
    } finally {
      uploading.current = false;
      if (queue.current.length) pump();
    }
  };

  const enqueue = (blob: Blob, dur: number) => {
    queue.current.push({ blob, dur });
    while (queue.current.length > MAX_WAITING) { queue.current.shift(); setWeak(true); }
    pump();
  };

  // ---- Recording: a fresh recorder per clip, so every clip is a complete video ----
  const startClip = () => {
    const s = streamRef.current;
    if (!s) return null;
    const chunks: Blob[] = [];
    const started = performance.now();
    const rec = new MediaRecorder(s, { ...(typeRef.current ? { mimeType: typeRef.current } : {}), videoBitsPerSecond: 1_400_000, audioBitsPerSecond: 96_000 });
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    rec.onstop = () => {
      if (!chunks.length) return;
      enqueue(new Blob(chunks, { type: rec.mimeType || typeRef.current || "video/mp4" }), (performance.now() - started) / 1000);
    };
    rec.start();
    return rec;
  };

  const nextClip = () => {
    const old = recRef.current;
    try {
      recRef.current = startClip(); // start the next one first, so there's no gap…
      if (old && old.state !== "inactive") old.stop(); // …then finish the last one
    } catch {
      if (old && old.state !== "inactive") old.stop();
      setTimeout(() => { if (liveRef.current) recRef.current = startClip(); }, 0);
    }
  };

  // ---- Going live / ending ----
  const goLive = () => {
    if (!user || !streamRef.current) return;
    const type = pickRecorderType();
    if (type === null) { toast.error("This phone can't go live from SOOZ yet — please update it"); return; }
    typeRef.current = type;
    if (type.includes("webm")) toast("Tip: lives from an iPhone or the latest Chrome play best for everyone");
    idRef.current = crypto.randomUUID();
    seq.current = 0;
    clips.current = [];
    queue.current = [];
    titleRef.current = title.trim();
    liveRef.current = true;
    setOnAir(false);
    setWeak(false);
    setSeconds(0);
    setWatching(0);

    const ch = supabase.channel(`live:${idRef.current}`, { config: { presence: { key: `host-${user.id}` } } });
    ch.on("presence", { event: "sync" }, () => {
      setWatching(Object.keys(ch.presenceState()).filter((k) => !k.startsWith("host-")).length);
    }).subscribe();
    channelRef.current = ch;

    try {
      recRef.current = startClip();
    } catch {
      liveRef.current = false;
      toast.error("Couldn't start the camera recording — please try again");
      supabase.removeChannel(ch);
      return;
    }
    timers.current = [
      setInterval(nextClip, CLIP_MS),
      setInterval(() => setSeconds((s) => s + 1), 1000),
    ];
    setPhase("live");
  };

  const endLive = async (silent = false) => {
    if (!liveRef.current) return;
    liveRef.current = false;
    setPhase("ending");
    timers.current.forEach(clearInterval);
    timers.current = [];
    const rec = recRef.current;
    recRef.current = null;
    if (rec && rec.state !== "inactive") {
      // Wait for the last clip to be handed over (it arrives just after stopping)…
      await new Promise<void>((resolve) => {
        rec.addEventListener("stop", () => setTimeout(resolve, 0), { once: true });
        setTimeout(resolve, 2500);
        rec.stop();
      });
    }
    // …let it go up (briefly), then mark the live as over — never before, or it would flip back to live.
    const t0 = Date.now();
    while ((queue.current.length || uploading.current) && Date.now() - t0 < 6000) await new Promise((r) => setTimeout(r, 200));
    channelRef.current?.send({ type: "broadcast", event: "end", payload: {} }).catch(() => {});
    if (rowIdRef.current) {
      await supabase.from("live_stream_config").update({ status: "offline", is_active: false, updated_at: new Date().toISOString() }).eq("id", rowIdRef.current);
    }
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    setPhase("idle");
    setOnAir(false);
    setSeconds(0);
    if (!silent) toast("Your live has ended. Thank you for sharing 🙏");
    onStreamEnded?.();
  };

  useEffect(() => {
    const onHide = () => { if (liveRef.current) endLive(true); };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLive = phase !== "idle";
  useEffect(() => { onLiveChange?.(isLive); }, [isLive, onLiveChange]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="relative mx-auto aspect-[9/16] max-h-[52vh] overflow-hidden rounded-3xl bg-black">
        <video ref={videoRef} autoPlay muted playsInline className={cn("h-full w-full object-cover", facing === "user" && "-scale-x-100", !stream && "hidden")} />

        {!stream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-white">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10"><Camera className="h-8 w-8" /></span>
            <p className="text-[15px] font-semibold">{cameraError ? "SOOZ needs your camera and microphone to go live" : "Turning on your camera…"}</p>
            {cameraError && (
              <button type="button" onClick={() => openCamera()} className="rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black">
                Turn on camera
              </button>
            )}
          </div>
        )}

        {isLive && (
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-extrabold uppercase tracking-wide text-white", onAir ? "bg-[#ff2d55]" : "bg-white/20")}>
              <span className={cn("h-1.5 w-1.5 rounded-full bg-white", onAir && "animate-pulse")} /> {onAir ? "Live" : "Starting"}
            </span>
            <span className="rounded-md bg-black/50 px-2 py-1 text-[12px] font-semibold tabular-nums text-white">{clock(seconds)}</span>
          </div>
        )}
        {isLive && onAir && (
          <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-[12px] font-semibold text-white">
            <Eye className="h-3.5 w-3.5" /> {watching}
          </span>
        )}
        {isLive && weak && (
          <span className="absolute inset-x-3 bottom-16 flex items-center justify-center gap-1.5 rounded-xl bg-black/65 px-3 py-2 text-[12.5px] font-medium text-white">
            <WifiOff className="h-3.5 w-3.5" /> Weak connection — viewers may see short pauses
          </span>
        )}
        {stream && phase !== "ending" && (
          <button type="button" aria-label="Flip camera" onClick={() => openCamera(facing === "user" ? "environment" : "user")}
            className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur active:scale-90">
            <RefreshCcw className="h-5 w-5" />
          </button>
        )}
      </div>

      {!isLive && (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          placeholder="What's your live about? e.g. Sunday Service"
          className="h-12 w-full rounded-2xl border-0 bg-white/[0.07] px-4 text-[16px] text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
        />
      )}

      {isLive ? (
        <button type="button" onClick={() => endLive()} disabled={phase === "ending"}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#ff2d55]/50 text-[17px] font-bold text-[#ff2d55] active:scale-[0.98] disabled:opacity-60">
          {phase === "ending" ? <><Loader2 className="h-5 w-5 animate-spin" /> Ending…</> : "End live"}
        </button>
      ) : (
        <button type="button" onClick={goLive} disabled={!stream}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff2d55] to-[#ff5e3a] text-[17px] font-bold text-white shadow-lg shadow-[#ff2d55]/25 active:scale-[0.98] disabled:opacity-50">
          <Radio className="h-5 w-5" /> Go Live
        </button>
      )}

      <p className="px-2 text-center text-[13px] leading-snug text-white/50">
        {isLive
          ? onAir ? "You're live! Everyone on SOOZ can watch from the Home screen." : "Getting your live ready — this takes a few seconds…"
          : "Everyone on SOOZ will see you're live and can watch from the Home screen. Keep SOOZ open while you're live."}
      </p>
    </div>
  );
};
