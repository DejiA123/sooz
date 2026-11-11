import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, Loader2, RefreshCcw, Timer, X, Zap, ZapOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { pickRecorderType } from "@/lib/recorder";

export type CameraMode = "60s" | "30s" | "15s" | "photo" | "text";

/** What the mode row offers: posts like TikTok (60s / 15s / photo / text), stories 30s video or a photo. */
export const MODES: Record<"post" | "story", CameraMode[]> = {
  post: ["60s", "15s", "photo", "text"],
  story: ["30s", "photo"],
};
export const DEFAULT_MODE: Record<"post" | "story", CameraMode> = { post: "15s", story: "photo" };

const LABEL: Record<CameraMode, string> = { "60s": "60s", "30s": "30s", "15s": "15s", photo: "PHOTO", text: "TEXT" };
const LIMIT: Partial<Record<CameraMode, number>> = { "60s": 60, "30s": 30, "15s": 15 };
const TIMERS = [0, 3, 10] as const;
/** Holding the shutter longer than this records only while held (TikTok's hold-to-record). */
const HOLD_MS = 450;

interface CameraCaptureProps {
  target: "post" | "story";
  mode: CameraMode;
  onModeChange: (m: CameraMode) => void;
  text: string;
  onTextChange: (t: string) => void;
  /** A photo or video, taken here or picked from the phone. */
  onMedia: (file: File) => void;
  /** TEXT mode's Next. */
  onText: () => void;
  onClose: () => void;
  /** Recording / counting down: the screen around shouldn't switch tabs. */
  onBusyChange?: (busy: boolean) => void;
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** TikTok-style full-screen camera: flip, flash, timer, mode row, tap or hold to record, upload from the phone. */
export const CameraCapture = ({ target, mode, onModeChange, text, onTextChange, onMedia, onText, onClose, onBusyChange }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const pressAt = useRef(0);
  const alive = useRef(true);
  const discard = useRef(false);
  const attempt = useRef(0);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [status, setStatus] = useState<"starting" | "ready" | "denied">("starting");
  const [torchOk, setTorchOk] = useState(false);
  const [flash, setFlash] = useState(false);
  const [timer, setTimer] = useState<(typeof TIMERS)[number]>(0);
  const [countdown, setCountdown] = useState(0);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [screenFlash, setScreenFlash] = useState(false);
  const [dragging, setDragging] = useState(false);

  const isVideo = mode in LIMIT;
  const limitMs = (LIMIT[mode] ?? 15) * 1000;
  const busy = recording || countdown > 0;
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  // ---- Camera ----
  const stopTracks = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };

  const start = useCallback(async (want: "user" | "environment") => {
    const my = ++attempt.current;
    setStatus("starting");
    stopTracks();
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("denied"); return; }
    const video = { facingMode: want, width: { ideal: 1920 }, height: { ideal: 1080 } };
    let s: MediaStream | null = null;
    try { s = await navigator.mediaDevices.getUserMedia({ video, audio: true }); }
    catch { try { s = await navigator.mediaDevices.getUserMedia({ video }); } catch { s = null; } } // no microphone: photos and silent videos still work
    if (!alive.current || my !== attempt.current) { s?.getTracks().forEach((t) => t.stop()); return; }
    if (!s) { setStatus("denied"); return; }
    streamRef.current = s;
    if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => {}); }
    const track = s.getVideoTracks()[0];
    const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
    setTorchOk(!!caps.torch);
    setStatus("ready");
  }, []);

  useEffect(() => {
    alive.current = true;
    start(facing);
    return () => {
      alive.current = false;
      discard.current = true;
      try { if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop(); } catch { /* already stopped */ }
      stopTracks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flip = () => {
    if (busy) return;
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    start(next);
  };

  // The back camera's light, where the phone allows it (kept on while recording).
  const setTorch = async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchOk) return;
    try { await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }); } catch { /* not this camera */ }
  };
  useEffect(() => {
    if (torchOk) setTorch(flash && (recording || mode !== "photo"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash, torchOk, recording, mode]);

  // ---- Photo ----
  const takePhoto = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    // No camera light (e.g. the front camera): light their face with a white screen, like TikTok.
    if (flash && !torchOk) { setScreenFlash(true); await new Promise((r) => setTimeout(r, 280)); }
    else if (flash && torchOk) { await setTorch(true); await new Promise((r) => setTimeout(r, 250)); }
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); } // what they saw (mirrored)
    ctx.drawImage(v, 0, 0);
    setScreenFlash(false);
    if (flash && torchOk && mode === "photo") setTorch(false);
    canvas.toBlob((blob) => {
      if (blob && alive.current) onMedia(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  };

  // ---- Video ----
  const startRec = () => {
    const s = streamRef.current;
    if (!s || recRef.current) return;
    const type = pickRecorderType();
    if (type === null) { toast.error("This browser can't record video — take a photo or upload one instead"); return; }
    let rec: MediaRecorder;
    try { rec = type ? new MediaRecorder(s, { mimeType: type }) : new MediaRecorder(s); }
    catch { toast.error("Couldn't start recording — please try again"); return; }
    chunks.current = [];
    discard.current = false;
    rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    rec.onstop = () => {
      recRef.current = null;
      setRecording(false);
      if (discard.current || !alive.current) return;
      const mime = (rec.mimeType || type || "video/webm").split(";")[0];
      const blob = new Blob(chunks.current, { type: mime });
      if (!blob.size) { toast.error("That recording didn't work — please try again"); return; }
      onMedia(new File([blob], `video-${Date.now()}.${mime.includes("mp4") ? "mp4" : "webm"}`, { type: mime }));
    };
    try { rec.start(250); } catch { toast.error("Couldn't start recording — please try again"); return; }
    recRef.current = rec;
    startedAt.current = Date.now();
    setElapsed(0);
    setRecording(true);
  };

  const stopRec = () => {
    const rec = recRef.current;
    if (!rec || rec.state === "inactive") return;
    try { rec.requestData(); } catch { /* fine */ }
    rec.stop();
  };

  // Recording clock + auto-stop at the mode's limit.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(Math.min(ms, limitMs));
      if (ms >= limitMs) stopRec();
    }, 100);
    return () => clearInterval(id);
  }, [recording, limitMs]);

  // ---- Countdown ----
  const countThen = (action: () => void) => {
    let n = timer as number;
    setCountdown(n);
    const id = setInterval(() => {
      n -= 1;
      if (!alive.current) { clearInterval(id); return; }
      if (n <= 0) { clearInterval(id); setCountdown(0); action(); }
      else setCountdown(n);
    }, 1000);
  };

  // ---- Shutter: tap for a photo; tap to start / stop a video, or hold to record while held ----
  const onShutterDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isVideo || status !== "ready" || countdown) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (recRef.current) { pressAt.current = 0; stopRec(); return; }
    if (timer) { pressAt.current = 0; countThen(startRec); return; }
    pressAt.current = Date.now();
    startRec();
  };
  const onShutterUp = () => {
    if (isVideo && recRef.current && pressAt.current && Date.now() - pressAt.current > HOLD_MS) stopRec();
    pressAt.current = 0;
  };
  const onShutterClick = (e: React.MouseEvent) => {
    if (mode === "text") { if (text.trim()) onText(); return; }
    if (status !== "ready" || countdown) return;
    if (mode === "photo") { if (timer) countThen(takePhoto); else takePhoto(); return; }
    if (e.detail === 0) { if (recRef.current) stopRec(); else if (timer) countThen(startRec); else startRec(); } // keyboard
  };

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/") && !f.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm|avi)$/i.test(f.name)) {
      toast.error("Choose a photo or a video");
      return;
    }
    onMedia(f);
  };

  const modes = MODES[target];
  const progress = isVideo ? elapsed / limitMs : 0;
  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-black text-white"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn("absolute inset-0 h-full w-full object-cover", facing === "user" && "-scale-x-100", (status !== "ready" || mode === "text") && "invisible")}
      />

      {/* TEXT mode: type on a colour card, like TikTok's text posts */}
      {mode === "text" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(160deg,#f59e0b_0%,#b45309_45%,#3b1446_100%)] px-8">
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value.slice(0, 2200))}
            placeholder="Tap to type"
            rows={5}
            aria-label="Your text"
            className="w-full resize-none border-0 bg-transparent text-center font-display !text-[28px] font-bold leading-tight text-white placeholder:text-white/70 focus:outline-none"
          />
        </div>
      )}

      {status === "starting" && mode !== "text" && (
        <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/60" /></div>
      )}
      {status === "denied" && mode !== "text" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 pb-40 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10"><Camera className="h-8 w-8" /></span>
          <p className="text-[17px] font-bold">Allow SOOZ to use your camera</p>
          <p className="text-[14px] leading-snug text-white/60">To take photos and videos, allow camera access. Or upload from your phone.</p>
          <div className="mt-1 flex gap-3">
            <button type="button" onClick={() => start(facing)} className="rounded-full bg-white/15 px-5 py-2.5 text-[14px] font-semibold active:scale-95">Turn on camera</button>
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full bg-amber-400 px-5 py-2.5 text-[14px] font-bold text-black active:scale-95">Upload</button>
          </div>
        </div>
      )}

      {screenFlash && <div className="absolute inset-0 z-30 bg-white" />}
      {dragging && <div className="absolute inset-3 z-30 flex items-center justify-center rounded-3xl border-2 border-dashed border-amber-400 bg-black/60 text-[17px] font-bold">Drop a photo or video</div>}

      {/* Top: progress while recording, close, time */}
      {recording && (
        <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+6px)] z-20 h-1 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-[#ff2d55]" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+14px)] z-20 flex items-center justify-between px-3">
        <button type="button" aria-label="Close" onClick={onClose} disabled={busy} className={cn("flex h-10 w-10 items-center justify-center rounded-full", busy && "invisible")}>
          <X className="h-7 w-7 drop-shadow" />
        </button>
        {recording && <span className="rounded-full bg-black/45 px-3 py-1 text-[14px] font-semibold tabular-nums">{fmt(elapsed)}</span>}
        <span className="h-10 w-10" />
      </div>

      {/* Right column: flip, timer, flash */}
      {mode !== "text" && !recording && (
        <div className="absolute right-2 top-[calc(env(safe-area-inset-top,0px)+70px)] z-20 flex flex-col items-center gap-4">
          <SideTool label="Flip" onClick={flip} disabled={status === "starting" || busy}><RefreshCcw className="h-[26px] w-[26px]" /></SideTool>
          <SideTool label={timer ? `${timer}s` : "Timer"} active={!!timer} onClick={() => setTimer((t) => TIMERS[(TIMERS.indexOf(t) + 1) % TIMERS.length])} disabled={busy}>
            <Timer className="h-[26px] w-[26px]" />
          </SideTool>
          <SideTool label="Flash" active={flash} onClick={() => setFlash((f) => !f)} disabled={busy}>
            {flash ? <Zap className="h-[26px] w-[26px] fill-current" /> : <ZapOff className="h-[26px] w-[26px]" />}
          </SideTool>
        </div>
      )}

      {countdown > 0 && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span key={countdown} className="animate-in zoom-in-50 fade-in font-display text-[120px] font-bold drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]">{countdown}</span>
        </div>
      )}

      {/* Bottom: modes, shutter, upload */}
      <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+48px)] z-20 bg-gradient-to-t from-black/50 via-black/20 to-transparent pb-3 pt-10">
        {!recording && (
          <div className="mb-4 flex items-center justify-center gap-5" role="tablist" aria-label="Camera mode">
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                disabled={busy}
                onClick={() => onModeChange(m)}
                className={cn("relative pb-1.5 text-[14px] font-bold tracking-wide drop-shadow transition-colors", mode === m ? "text-white" : "text-white/60")}
              >
                {LABEL[m]}
                {mode === m && <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white" />}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-6">
          <span />
          {mode === "text" ? (
            <button
              type="button"
              aria-label="Next"
              onClick={onShutterClick}
              disabled={!text.trim()}
              className="flex h-[78px] w-[78px] items-center justify-center rounded-full bg-amber-400 text-black shadow-lg transition active:scale-95 disabled:opacity-40"
            >
              <Check className="h-9 w-9" strokeWidth={3} />
            </button>
          ) : (
            <button
              type="button"
              aria-label={mode === "photo" ? "Take photo" : recording ? "Stop recording" : "Record video"}
              onPointerDown={onShutterDown}
              onPointerUp={onShutterUp}
              onPointerCancel={onShutterUp}
              onClick={onShutterClick}
              onContextMenu={(e) => e.preventDefault()}
              disabled={status !== "ready"}
              className="relative flex h-[96px] w-[96px] touch-none select-none items-center justify-center disabled:opacity-40 [-webkit-touch-callout:none]"
            >
              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
                <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="6" className={cn(recording && "opacity-30")} />
                {recording && <circle cx="50" cy="50" r={R} fill="none" stroke="#ff2d55" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />}
              </svg>
              <span
                className={cn(
                  "block transition-all duration-200",
                  mode === "photo" ? "h-[70px] w-[70px] rounded-full bg-white"
                    : recording ? "h-8 w-8 rounded-lg bg-[#ff2d55]" : "h-[70px] w-[70px] rounded-full bg-[#ff2d55]",
                )}
              />
            </button>
          )}
          <div className="flex justify-end">
            {!recording && (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="flex flex-col items-center gap-1 active:scale-95" aria-label="Upload from your phone">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-white bg-gradient-to-br from-amber-300 to-amber-600"><ImagePlus className="h-5 w-5 text-black" /></span>
                <span className="text-[12px] font-semibold drop-shadow">Upload</span>
              </button>
            )}
          </div>
        </div>
        {isVideo && !recording && status === "ready" && <p className="mt-2 text-center text-[12px] text-white/70 drop-shadow">Tap to record · hold to record while pressed</p>}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }}
      />
    </div>
  );
};

const SideTool = ({ label, onClick, disabled, active, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={active} className="flex w-14 flex-col items-center gap-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] active:scale-90 disabled:opacity-50">
    <span className={cn(active && "text-amber-300")}>{children}</span>
    <span className="text-[11.5px] font-semibold">{label}</span>
  </button>
);
