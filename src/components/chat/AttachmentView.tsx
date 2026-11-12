import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, MapPin, MessageCircle, Mic, Pause, Play, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatBytes, formatDuration, safeUrl } from "@/lib/chat";
import type { Attachment, ChatMember } from "@/services/api/chat";

// ── Photo / video ────────────────────────────────────────────────────────────────────────────

export const ImageAttachment = ({ a, onOpen, pending }: { a: Extract<Attachment, { type: "image" }>; onOpen: () => void; pending?: boolean }) => (
  <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="block overflow-hidden rounded-[14px]">
    <img
      src={a.url}
      alt="Photo"
      loading="lazy"
      style={a.w && a.h ? { aspectRatio: `${a.w} / ${a.h}` } : undefined}
      className={cn("max-h-80 min-h-[120px] w-auto min-w-[160px] max-w-full bg-black/20 object-cover", pending && "opacity-60")}
    />
  </button>
);

export const VideoAttachment = ({ a, onOpen }: { a: Extract<Attachment, { type: "video" }>; onOpen: () => void }) => (
  <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="relative block overflow-hidden rounded-[14px] bg-black">
    <video src={`${a.url}#t=0.1`} preload="metadata" playsInline muted className="max-h-80 min-h-[120px] w-auto min-w-[160px] max-w-full object-cover" />
    <span className="absolute inset-0 flex items-center justify-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 backdrop-blur"><Play className="ml-0.5 h-6 w-6 fill-white text-white" /></span>
    </span>
    {a.duration ? <span className="absolute bottom-1.5 left-2 rounded bg-black/50 px-1.5 text-[11px] font-semibold text-white">{formatDuration(a.duration)}</span> : null}
  </button>
);

// ── Voice notes / audio ──────────────────────────────────────────────────────────────────────

let playingNow: HTMLAudioElement | null = null; // only one plays at a time, like WhatsApp
const SPEEDS = [1, 1.5, 2];

const bars = (seed: string, n: number) => {
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const wave = Math.sin(i / 3) * 0.25 + 0.55;
    return Math.max(0.18, Math.min(1, wave + ((h % 1000) / 1000 - 0.5) * 0.7));
  });
};

export const AudioAttachment = ({ a, mine, avatar, name }: { a: Extract<Attachment, { type: "audio" }>; mine: boolean; avatar?: string | null; name?: string }) => {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(a.duration || 0);
  const [speed, setSpeed] = useState(0);
  const shape = useMemo(() => bars(a.url, 34), [a.url]);
  const progress = duration ? Math.min(1, time / duration) : 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => setTime(el.currentTime);
    const onMeta = () => { if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration); };
    const onEnd = () => { setPlaying(false); setTime(0); };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    el.addEventListener("timeupdate", onTime); el.addEventListener("loadedmetadata", onMeta); el.addEventListener("durationchange", onMeta);
    el.addEventListener("ended", onEnd); el.addEventListener("pause", onPause); el.addEventListener("play", onPlay);
    return () => {
      el.removeEventListener("timeupdate", onTime); el.removeEventListener("loadedmetadata", onMeta); el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("ended", onEnd); el.removeEventListener("pause", onPause); el.removeEventListener("play", onPlay);
    };
  }, []);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = ref.current;
    if (!el) return;
    if (playing) { el.pause(); return; }
    if (playingNow && playingNow !== el) playingNow.pause();
    playingNow = el;
    el.playbackRate = SPEEDS[speed];
    el.play().catch(() => {});
  };
  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const el = ref.current;
    if (!el || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    el.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration;
    setTime(el.currentTime);
  };

  return (
    <div className="flex w-[250px] max-w-full items-center gap-2.5 py-0.5" onClick={(e) => e.stopPropagation()}>
      <audio ref={ref} src={a.url} preload="metadata" />
      {a.voice && (
        <span className="relative shrink-0">
          <Avatar className="h-11 w-11">
            <AvatarImage src={avatar || ""} className="object-cover" />
            <AvatarFallback className={cn("text-[14px] font-bold", mine ? "bg-black/15" : "bg-neutral-200 text-neutral-700")}>{name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
          </Avatar>
          <Mic className={cn("absolute -bottom-0.5 -right-1 h-4 w-4", mine ? "text-[#1a1204]" : "text-amber-400")} strokeWidth={2.6} />
        </span>
      )}
      <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="flex h-9 w-9 shrink-0 items-center justify-center">
        {playing ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-0.5 h-7 w-7 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-8 cursor-pointer items-center gap-[2px]" onPointerDown={seek}>
          {shape.map((v, i) => (
            <span key={i} className={cn("w-[3px] shrink-0 rounded-full", i / shape.length < progress ? (mine ? "bg-[#1a1204]" : "bg-amber-400") : mine ? "bg-black/30" : "bg-neutral-300")} style={{ height: `${v * 100}%` }} />
          ))}
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[11.5px] opacity-70">
          <span className="tabular-nums">{formatDuration(playing || time ? time : duration)}</span>
          {(playing || time > 0) && (
            <button type="button" onClick={(e) => { e.stopPropagation(); const n = (speed + 1) % SPEEDS.length; setSpeed(n); if (ref.current) ref.current.playbackRate = SPEEDS[n]; }}
              className={cn("rounded-full px-1.5 text-[11px] font-bold", mine ? "bg-black/15" : "bg-black/[0.07]")}>
              {SPEEDS[speed]}×
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Documents ────────────────────────────────────────────────────────────────────────────────

export const FileAttachment = ({ a, mine }: { a: Extract<Attachment, { type: "file" }>; mine: boolean }) => {
  const ext = (a.name.split(".").pop() || "file").toUpperCase().slice(0, 4);
  return (
    <a href={safeUrl(a.url)} target="_blank" rel="noopener noreferrer" download={a.name} onClick={(e) => e.stopPropagation()}
      className={cn("flex w-[250px] max-w-full items-center gap-3 rounded-xl p-2.5", mine ? "bg-black/10" : "bg-black/[0.05]")}>
      <span className="relative flex h-11 w-9 shrink-0 items-center justify-center rounded-md bg-white text-[#1a1204] shadow-sm">
        <FileText className="h-5 w-5" />
        <span className="absolute -bottom-1 rounded bg-amber-500 px-1 text-[8px] font-black text-white">{ext}</span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold">{a.name}</span>
        <span className="block text-[12px] opacity-70">{[formatBytes(a.size), ext].filter(Boolean).join(" · ")}</span>
      </span>
    </a>
  );
};

// ── Location (OpenStreetMap tiles) ───────────────────────────────────────────────────────────

const W = 260, H = 150, Z = 15;
export const LocationAttachment = ({ a }: { a: Extract<Attachment, { type: "location" }> }) => {
  const n = 2 ** Z;
  const gx = ((a.lng + 180) / 360) * n * 256;
  const latRad = (a.lat * Math.PI) / 180;
  const gy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256;
  const left = gx - W / 2, top = gy - H / 2;
  const tiles: { x: number; y: number }[] = [];
  for (let x = Math.floor(left / 256); x <= Math.floor((left + W) / 256); x++)
    for (let y = Math.floor(top / 256); y <= Math.floor((top + H) / 256); y++) tiles.push({ x, y });
  const maps = /iPhone|iPad|Mac/.test(navigator.userAgent) ? `https://maps.apple.com/?ll=${a.lat},${a.lng}&q=${encodeURIComponent(a.label || "Location")}` : `https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`;
  return (
    <a href={maps} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="block w-[260px] max-w-full overflow-hidden rounded-[14px]">
      <span className="relative block overflow-hidden bg-neutral-200" style={{ width: W, height: H, maxWidth: "100%" }}>
        {tiles.map((t) => (
          <img key={`${t.x}-${t.y}`} src={`https://tile.openstreetmap.org/${Z}/${t.x}/${t.y}.png`} alt="" loading="lazy" draggable={false}
            className="absolute h-[256px] w-[256px] max-w-none" style={{ left: t.x * 256 - left, top: t.y * 256 - top }} />
        ))}
        <MapPin className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-full fill-red-500 text-white drop-shadow" />
        <span className="absolute bottom-0.5 right-1 text-[8px] text-black/60">© OpenStreetMap</span>
      </span>
      <span className="block px-2.5 py-2 text-[13.5px] font-semibold">{a.label || "Location"}</span>
    </a>
  );
};

// ── Contact card ─────────────────────────────────────────────────────────────────────────────

export const ContactAttachment = ({ a, mine, onMessage, onView }: { a: Extract<Attachment, { type: "contact" }>; mine: boolean; onMessage: () => void; onView: () => void }) => (
  <div className="w-[250px] max-w-full" onClick={(e) => e.stopPropagation()}>
    <div className="flex items-center gap-3 p-1.5">
      <Avatar className="h-11 w-11">
        <AvatarImage src={a.avatar || ""} className="object-cover" />
        <AvatarFallback className={mine ? "bg-black/15" : "bg-neutral-200 text-neutral-600"}><UserRound className="h-5 w-5" /></AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold">{a.name}</span>
        <span className="block truncate text-[12.5px] opacity-70">@{a.username}</span>
      </span>
    </div>
    <div className={cn("mt-1 grid grid-cols-2 border-t text-[14px] font-semibold", mine ? "border-black/15" : "border-black/10")}>
      <button type="button" onClick={onMessage} className="flex items-center justify-center gap-1.5 py-2"><MessageCircle className="h-4 w-4" /> Message</button>
      <button type="button" onClick={onView} className={cn("py-2", mine ? "border-l border-black/15" : "border-l border-black/10")}>View</button>
    </div>
  </div>
);

// ── Poll ─────────────────────────────────────────────────────────────────────────────────────

export const PollAttachment = ({ a, mine, votes, meId, members, onVote, onViewVotes }: {
  a: Extract<Attachment, { type: "poll" }>;
  mine: boolean;
  votes: Map<string, number[]> | undefined;
  meId: string;
  members: Map<string, ChatMember>;
  onVote: (options: number[]) => void;
  onViewVotes: () => void;
}) => {
  const counts = a.options.map(() => 0);
  const voters = a.options.map(() => [] as string[]);
  let total = 0;
  votes?.forEach((opts, userId) => {
    if (opts.length) total++;
    opts.forEach((o) => { if (counts[o] !== undefined) { counts[o]++; voters[o].push(userId); } });
  });
  const mineNow = votes?.get(meId) ?? [];
  const max = Math.max(1, ...counts);
  const pick = (i: number) => {
    if (a.multiple) onVote(mineNow.includes(i) ? mineNow.filter((x) => x !== i) : [...mineNow, i].sort());
    else onVote(mineNow.length === 1 && mineNow[0] === i ? [] : [i]);
  };
  return (
    <div className="w-[270px] max-w-full py-1" onClick={(e) => e.stopPropagation()}>
      <p className="text-[15.5px] font-bold leading-snug">{a.question}</p>
      <p className="mb-2 mt-0.5 text-[12px] opacity-70">{a.multiple ? "Select one or more" : "Select one"}</p>
      <div className="space-y-2.5">
        {a.options.map((opt, i) => {
          const chosen = mineNow.includes(i);
          return (
            <button key={i} type="button" onClick={() => pick(i)} className="block w-full text-left">
              <span className="flex items-center gap-2.5">
                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center border-2", a.multiple ? "rounded-md" : "rounded-full",
                  chosen ? (mine ? "border-[#1a1204] bg-[#1a1204] text-amber-300" : "border-amber-400 bg-amber-400 text-[#1a1204]") : mine ? "border-black/40" : "border-neutral-400")}>
                  {chosen && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
                </span>
                <span className="min-w-0 flex-1 text-[14.5px]">{opt}</span>
                <span className="flex shrink-0 items-center -space-x-1.5">
                  {voters[i].slice(0, 3).map((u) => (
                    <Avatar key={u} className={cn("h-5 w-5 border", mine ? "border-amber-400" : "border-neutral-100")}>
                      <AvatarImage src={members.get(u)?.avatar || ""} className="object-cover" />
                      <AvatarFallback className="bg-neutral-300 text-[9px]">{members.get(u)?.name?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                  ))}
                </span>
                <span className="w-5 shrink-0 text-right text-[13px] font-semibold tabular-nums">{counts[i]}</span>
              </span>
              <span className={cn("ml-[30px] mt-1.5 block h-[5px] overflow-hidden rounded-full", mine ? "bg-black/15" : "bg-black/10")}>
                <span className={cn("block h-full rounded-full transition-all", mine ? "bg-[#1a1204]" : "bg-amber-400")} style={{ width: `${(counts[i] / max) * 100}%` }} />
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onViewVotes} className={cn("mt-3 w-full border-t pt-2 text-center text-[14px] font-semibold", mine ? "border-black/15" : "border-black/10 text-amber-700")}>
        View votes{total ? ` · ${total}` : ""}
      </button>
    </div>
  );
};
