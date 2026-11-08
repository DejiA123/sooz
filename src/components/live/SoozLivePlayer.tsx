import { useEffect, useRef, useState } from "react";
import { Loader2, Radio, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchLiveManifest, liveIdOf, sourceTypeFor, watchLive, type LiveClip } from "@/lib/liveStream";

type MSClass = typeof MediaSource;

/** Plays a SOOZ live: the broadcaster's short clips, back to back (see `src/lib/liveStream.ts`). */
export const SoozLivePlayer = ({ src, className, autoPlay = true }: { src: string; className?: string; autoPlay?: boolean }) => {
  const id = liveIdOf(src);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"connecting" | "playing" | "ended" | "unsupported">("connecting");
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const w = window as Window & { ManagedMediaSource?: MSClass };
    const MS: MSClass | undefined = w.ManagedMediaSource ?? window.MediaSource;
    if (!MS) { setState("unsupported"); return; }

    let alive = true;
    let sb: SourceBuffer | null = null;
    let recorderMime = "";
    let nextSeq = -1;
    let lastClipAt = Date.now();
    let fetching = false;
    const pending = new Map<number, LiveClip>();
    const appendQueue: ArrayBuffer[] = [];

    const ms = new MS();
    if (w.ManagedMediaSource && MS === w.ManagedMediaSource) video.disableRemotePlayback = true; // required by iPhone's version
    const objectUrl = URL.createObjectURL(ms);
    video.src = objectUrl;

    const stayLive = () => {
      if (!video.buffered.length) return;
      const last = video.buffered.length - 1;
      const end = video.buffered.end(last);
      // Fell behind (or landed in a gap): jump near the newest picture.
      if (end - video.currentTime > 10 || video.currentTime < video.buffered.start(last)) {
        video.currentTime = Math.max(video.buffered.start(last), end - 3);
      }
      if (autoPlay && video.paused) video.play().catch(() => {});
    };

    const trim = () => {
      if (!sb || sb.updating || !sb.buffered.length) return;
      const start = sb.buffered.start(0);
      if (video.currentTime - start > 40) { try { sb.remove(start, video.currentTime - 15); } catch { /* busy */ } }
    };

    const appendNext = () => {
      if (!sb || sb.updating || !appendQueue.length || ms.readyState !== "open") return;
      try {
        sb.appendBuffer(appendQueue.shift()!);
      } catch (e) {
        if ((e as Error)?.name === "QuotaExceededError") { trim(); }
      }
    };

    const fetchClip = async (url: string) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) return await res.arrayBuffer();
        } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
      return null;
    };

    const pump = async () => {
      if (fetching || !alive || ms.readyState !== "open") return;
      fetching = true;
      try {
        while (alive && pending.has(nextSeq)) {
          const clip = pending.get(nextSeq)!;
          pending.delete(nextSeq);
          const buf = await fetchClip(clip.url);
          nextSeq++;
          if (!buf || !alive) continue;
          if (!sb) {
            let type = sourceTypeFor(new Uint8Array(buf), recorderMime);
            if (!MS.isTypeSupported(type)) type = type.split(";")[0];
            if (!MS.isTypeSupported(type)) { setState("unsupported"); return; }
            sb = ms.addSourceBuffer(type);
            sb.mode = "sequence"; // each clip is a complete little video: play them one after another
            sb.addEventListener("updateend", () => { appendNext(); stayLive(); trim(); });
          }
          appendQueue.push(buf);
          appendNext();
          setState("playing");
        }
      } catch (e) {
        console.error("live playback", e);
      } finally {
        fetching = false;
      }
    };

    const addClip = (c: LiveClip) => {
      if (!c || typeof c.seq !== "number" || !c.url) return;
      lastClipAt = Date.now();
      if (nextSeq >= 0 && c.seq < nextSeq) return;
      if (nextSeq < 0) nextSeq = c.seq;
      pending.set(c.seq, c);
      pump();
    };

    const catchUp = async (first = false) => {
      const { manifest, live } = await fetchLiveManifest(id);
      if (!alive) return;
      if (!live) { if (first || !manifest) setState("ended"); else setState("ended"); return; }
      if (manifest) {
        recorderMime = manifest.mime || recorderMime;
        const list = first ? manifest.clips.slice(-2) : manifest.clips;
        list.forEach(addClip);
      }
      // Waiting on a clip that never arrived: skip ahead to what we have.
      if (pending.size && !pending.has(nextSeq)) { nextSeq = Math.min(...pending.keys()); pump(); }
    };

    ms.addEventListener("sourceopen", () => { catchUp(true); pump(); });

    const viewerKey = `viewer-${crypto.randomUUID().slice(0, 8)}`;
    const stopWatching = watchLive(id, viewerKey, addClip, () => setState("ended"));
    const poll = setInterval(() => { if (Date.now() - lastClipAt > 7000) catchUp(); }, 4000);
    const onStall = () => stayLive();
    video.addEventListener("waiting", onStall);

    return () => {
      alive = false;
      clearInterval(poll);
      stopWatching();
      video.removeEventListener("waiting", onStall);
      try { if (ms.readyState === "open") ms.endOfStream(); } catch { /* closed */ }
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };
  }, [id, autoPlay]);

  return (
    <div className={cn("relative h-full w-full bg-black", className)}>
      <video ref={videoRef} autoPlay={autoPlay} muted={muted} playsInline className="h-full w-full object-contain" />
      {state !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
          {state === "connecting" && <><Loader2 className="h-8 w-8 animate-spin text-white/70" /><p className="text-[15px] font-medium">Joining the live…</p></>}
          {state === "ended" && <><Radio className="h-8 w-8 text-white/50" /><p className="text-[15px] font-medium">This live has ended</p></>}
          {state === "unsupported" && <p className="text-[15px] font-medium">Please update your phone to watch lives on SOOZ</p>}
        </div>
      )}
      {state === "playing" && (
        <button
          type="button"
          onClick={() => { const v = videoRef.current; if (v) { v.muted = !muted; v.play().catch(() => {}); } setMuted(!muted); }}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-2 text-[13px] font-semibold text-white backdrop-blur"
        >
          {muted ? <><VolumeX className="h-4 w-4" /> Tap for sound</> : <Volume2 className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
};
