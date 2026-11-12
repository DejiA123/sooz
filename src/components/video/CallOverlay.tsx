import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCall, type CallPeer, type CallPerson } from "@/contexts/CallContext";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Mic, MicOff, Phone, PhoneOff, RefreshCcw, Search, UserPlus, Users, Video, VideoOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchChatList, searchPeople } from "@/services/api/chat";
import { useDarkCover } from "@/lib/statusBar";

/** A video element showing a live stream (always muted: sound plays through <PeerAudio>). */
const LiveVideo = ({ stream, mirror, className }: { stream: MediaStream; mirror?: boolean; className?: string }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const trackCount = stream.getTracks().length;
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.play().catch(() => {});
  }, [stream, trackCount]);
  return <video ref={ref} autoPlay playsInline muted className={cn("h-full w-full object-cover", mirror && "-scale-x-100", className)} />;
};

/** One person's sound. Phones may refuse to play until a tap; then we ask for one. */
const PeerAudio = ({ stream, onBlocked }: { stream: MediaStream; onBlocked: () => void }) => {
  const ref = useRef<HTMLAudioElement>(null);
  const audioCount = stream.getAudioTracks().length;
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    if (a.srcObject !== stream) a.srcObject = stream;
    a.play().catch(onBlocked);
  }, [stream, audioCount, onBlocked]);
  return <audio ref={ref} autoPlay playsInline data-call-audio />;
};

const hasLiveVideo = (s: MediaStream | null | undefined) => !!s?.getVideoTracks().some((t) => t.readyState === "live" && !t.muted);

function useElapsed(since?: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return "";
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const Face = ({ name, avatar, size, group, text = "text-[44px]" }: { name: string; avatar: string | null; size: string; group?: boolean; text?: string }) => (
  <Avatar className={size}>
    <AvatarImage src={avatar || ""} className="object-cover" />
    <AvatarFallback className={cn("bg-gradient-to-br from-amber-400 to-amber-700 font-bold text-white", text)}>
      {group ? <Users className="h-1/2 w-1/2" /> : name?.[0]?.toUpperCase() || "?"}
    </AvatarFallback>
  </Avatar>
);

const RoundButton = ({ label, onClick, active, danger, children }: { label: string; onClick: () => void; active?: boolean; danger?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-1.5">
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-[60px] w-[60px] items-center justify-center rounded-full transition-transform active:scale-90",
        danger ? "bg-[#ff3b30] text-white" : active ? "bg-white text-black" : "bg-white/[0.16] text-white backdrop-blur",
      )}
    >
      {children}
    </button>
    <span className="text-[12px] font-medium text-white/80">{label}</span>
  </div>
);

/** A person's square in a group call. */
const Tile = ({ name, avatar, stream, cameraOff, micOff, mirror, connecting, ringing }: {
  name: string; avatar: string | null; stream: MediaStream | null; cameraOff: boolean; micOff: boolean; mirror?: boolean; connecting?: boolean; ringing?: boolean;
}) => (
  <div className={cn("relative overflow-hidden rounded-2xl bg-[#14171d]", ringing && "bg-[#101318]")}>
    {stream && !cameraOff && hasLiveVideo(stream) ? (
      <LiveVideo stream={stream} mirror={mirror} />
    ) : (
      <div className="flex h-full w-full items-center justify-center">
        <span className="relative">
          {ringing && <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/25" />}
          <Face name={name} avatar={avatar} size={cn("relative h-20 w-20", ringing && "opacity-80")} text="text-[32px]" />
        </span>
      </div>
    )}
    <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-[13px] font-semibold text-white">
      {micOff && <MicOff className="h-3.5 w-3.5 text-red-400" />}
      <span className="truncate">{name}</span>
      {ringing ? <span className="ml-auto text-[11px] font-medium text-amber-300">Ringing…</span>
        : connecting && <span className="ml-auto text-[11px] font-medium text-white/60">Connecting…</span>}
    </div>
  </div>
);

/** Pick people to add to the call: recent chats first, or search everyone on SOOZ. */
const AddPeoplePanel = ({ exclude, room, onAdd, onClose }: { exclude: Map<string, string>; room: number; onAdd: (people: CallPerson[]) => void; onClose: () => void }) => {
  const { user } = useAuth();
  const me = user?.id ?? "";
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<Map<string, CallPerson>>(new Map());
  useEffect(() => { const t = setTimeout(() => setTerm(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  const chats = useQuery({ queryKey: ["chats", me], queryFn: fetchChatList, enabled: !!me, staleTime: 30_000 });
  const found = useQuery({ queryKey: ["people-search", term], queryFn: () => searchPeople(term, me), enabled: !!term, staleTime: 60_000 });
  const recent = useMemo(() => (chats.data ?? [])
    .filter((c) => !c.isGroup && c.otherUserId && !c.hiddenAt)
    .sort((a, b) => b.activity.localeCompare(a.activity))
    .map((c) => ({ id: c.otherUserId!, name: c.name, avatar: c.avatar, sub: c.otherUsername ? `@${c.otherUsername}` : "" })), [chats.data]);
  const list = term ? (found.data ?? []).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, sub: `@${p.username}` })) : recent;
  const toggle = (p: CallPerson) => setPicked((m) => {
    const n = new Map(m);
    if (n.has(p.id)) n.delete(p.id); else if (n.size < room) n.set(p.id, p);
    return n;
  });
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#05070b] text-white" role="dialog" aria-label="Add people to the call">
      <div className="flex items-center gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
        <button type="button" aria-label="Close" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10"><X className="h-6 w-6" /></button>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold">Add people</p>
          <p className="text-[12.5px] text-white/50">{room > 0 ? `Up to ${room} more` : "The call is full"}</p>
        </div>
      </div>
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or @username" className="h-11 w-full rounded-full bg-white/[0.08] pl-9 pr-3 text-[16px] outline-none placeholder:text-white/40" />
        </div>
      </div>
      <p className="px-5 pb-1 pt-2 text-[13px] font-semibold text-white/45">{term ? "People" : "Recent chats"}</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {(term ? found.isLoading : chats.isLoading) && <p className="px-3 py-6 text-center text-[14px] text-white/40">Loading…</p>}
        {!(term ? found.isLoading : chats.isLoading) && list.length === 0 && (
          <p className="px-3 py-6 text-center text-[14px] text-white/40">{term ? "No one found" : "Search for someone to add"}</p>
        )}
        {list.map((p) => {
          const already = exclude.get(p.id);
          const on = picked.has(p.id);
          return (
            <button key={p.id} type="button" disabled={!!already || (!on && picked.size >= room)} onClick={() => toggle(p)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left active:bg-white/[0.06] disabled:opacity-50">
              <Face name={p.name} avatar={p.avatar} size="h-11 w-11" text="text-[17px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15.5px] font-semibold">{p.name}</span>
                <span className="block truncate text-[13px] text-white/50">{already || p.sub}</span>
              </span>
              {!already && (
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border-2", on ? "border-amber-400 bg-amber-400 text-[#1a1204]" : "border-white/30")}>
                  {on && <Check className="h-4 w-4" strokeWidth={3} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="call-controls px-4 pt-3">
        <button type="button" disabled={!picked.size} onClick={() => { onAdd([...picked.values()]); onClose(); }}
          className="h-12 w-full rounded-full bg-amber-400 text-[16px] font-bold text-[#1a1204] disabled:opacity-40">
          {picked.size ? `Add to call (${picked.size})` : "Add to call"}
        </button>
      </div>
    </div>
  );
};

export const CallOverlay = () => {
  const {
    callState, call, incoming, peers, ringing, maxPeople, localStream, isMuted, isCameraOff,
    acceptCall, rejectCall, endCall, toggleMute, toggleCamera, flipCamera, addToCall,
  } = useCall();
  const [adding, setAdding] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const blocked = useRef(() => setAudioBlocked(true)).current;
  const elapsed = useElapsed(call?.connectedAt);

  useEffect(() => { if (callState === "IDLE") { setAudioBlocked(false); setAdding(false); } }, [callState]);
  useDarkCover(callState !== "IDLE"); // call screens are full-screen black: so is the status bar

  if (callState === "IDLE") return null;

  // ---- Incoming call ----
  if (callState === "INCOMING" && incoming) {
    const kind = incoming.isVideo ? "video" : "voice";
    return (
      <div
        className="call-screen fixed inset-0 z-[100] flex flex-col items-center justify-between bg-[#05070b] px-6 text-white"
        style={{ backgroundImage: "radial-gradient(90% 60% at 50% 30%, rgba(245,158,11,0.18), transparent 70%)" }}
      >
        <div className="mt-[14vh] flex flex-col items-center text-center">
          <div className="relative">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/25" />
            <Face name={incoming.isGroup ? incoming.title : incoming.from.name} avatar={incoming.isGroup ? null : incoming.from.avatar} size="relative h-28 w-28 ring-4 ring-amber-400/40" group={incoming.isGroup} />
          </div>
          <h2 className="mt-6 text-[28px] font-bold leading-tight">{incoming.isGroup ? incoming.title : incoming.from.name}</h2>
          <p className="mt-2 text-[16px] text-white/60">
            {incoming.added ? `${incoming.from.name} is adding you to a ${kind} call`
              : incoming.isGroup ? `${incoming.from.name} is calling the group · ${kind}` : `SOOZ ${kind} call`}
          </p>
        </div>
        <div className="mb-[8vh] flex w-full max-w-xs items-start justify-between">
          <div className="flex flex-col items-center gap-2">
            <button type="button" aria-label="Decline" onClick={rejectCall} className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#ff3b30] active:scale-90">
              <PhoneOff className="h-8 w-8" />
            </button>
            <span className="text-[14px] text-white/80">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button type="button" aria-label="Accept" onClick={acceptCall} className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#34c759] active:scale-90">
              {incoming.isVideo ? <Video className="h-8 w-8" /> : <Phone className="h-8 w-8 fill-current" />}
            </button>
            <span className="text-[14px] text-white/80">Accept</span>
          </div>
        </div>
      </div>
    );
  }

  if (!call) return null;

  const anyoneConnecting = peers.some((p) => p.connection !== "connected");
  const status = callState === "OUTGOING"
    ? peers.length ? "Connecting…" : call.isGroup ? "Calling the group…" : "Calling…"
    : call.connectedAt
      ? call.isGroup ? `${peers.filter((p) => p.connection === "connected").length + 1} in call · ${elapsed}` : elapsed
      : "Connecting…";

  const inCall = new Map<string, string>([
    ...peers.map((p) => [p.id, "In the call"] as [string, string]),
    ...ringing.map((p) => [p.id, "Ringing…"] as [string, string]),
  ]);
  const room = Math.max(0, maxPeople - 1 - peers.length - ringing.length);
  const canAdd = callState === "ACTIVE" && !!call.connectedAt;
  const controls = (
    <div className={cn("call-controls flex items-start justify-center px-3 pt-4", call.isVideo && canAdd ? "gap-3" : "gap-5")}>
      <RoundButton label={isMuted ? "Unmute" : "Mute"} onClick={toggleMute} active={isMuted}>
        {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </RoundButton>
      {call.isVideo && (
        <>
          <RoundButton label={isCameraOff ? "Camera on" : "Camera off"} onClick={toggleCamera} active={isCameraOff}>
            {isCameraOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </RoundButton>
          <RoundButton label="Flip" onClick={flipCamera}>
            <RefreshCcw className="h-6 w-6" />
          </RoundButton>
        </>
      )}
      {canAdd && (
        <RoundButton label="Add" onClick={() => setAdding(true)}>
          <UserPlus className="h-6 w-6" />
        </RoundButton>
      )}
      <RoundButton label="End" onClick={endCall} danger>
        <PhoneOff className="h-6 w-6" />
      </RoundButton>
    </div>
  );

  const audio = peers.map((p) => p.stream && <PeerAudio key={p.id} stream={p.stream} onBlocked={blocked} />);
  const addPanel = adding && <AddPeoplePanel exclude={inCall} room={room} onAdd={addToCall} onClose={() => setAdding(false)} />;
  const tapForSound = audioBlocked && (
    <button
      type="button"
      onClick={() => { document.querySelectorAll<HTMLAudioElement>("audio[data-call-audio]").forEach((a) => a.play().catch(() => {})); setAudioBlocked(false); }}
      className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-5 py-3 text-[15px] font-semibold text-black shadow-xl"
    >
      Tap to hear the call
    </button>
  );

  // ---- Group call: everyone in a grid ----
  if (call.isGroup) {
    const tiles: (CallPeer & { self?: boolean; ringing?: boolean })[] = [
      { id: "me", name: "You", avatar: null, stream: localStream, cameraOff: isCameraOff || !call.isVideo, micOff: isMuted, connection: "connected", self: true },
      ...peers,
      ...ringing.filter((r) => !peers.some((p) => p.id === r.id)).map((r) => ({ ...r, stream: null, cameraOff: true, micOff: false, connection: "new" as RTCPeerConnectionState, ringing: true })),
    ];
    const cols = tiles.length <= 2 ? 1 : 2;
    // A call that became a group by adding people is named after the people in it.
    const names = peers.map((p) => p.name.split(" ")[0]);
    const title = call.adhoc && names.length
      ? names.length <= 3 ? names.join(names.length === 2 ? " & " : ", ") : `${names.slice(0, 2).join(", ")} & ${names.length - 2} others`
      : call.title;
    return (
      <div className="call-screen fixed inset-0 z-[100] flex flex-col bg-[#05070b] text-white">
        <div className="shrink-0 px-5 pb-3 text-center">
          <p className="truncate text-[18px] font-bold">{title}</p>
          <p className="text-[14px] text-white/60">{status}</p>
        </div>
        <div className="grid min-h-0 flex-1 gap-2 px-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "1fr" }}>
          {tiles.map((t) => (
            <Tile key={t.id} name={t.name} avatar={t.avatar} stream={t.stream} cameraOff={t.cameraOff} micOff={t.micOff} mirror={t.self} connecting={!t.self && t.connection !== "connected"} ringing={t.ringing} />
          ))}
          {peers.length === 0 && ringing.length === 0 && (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-white/15 text-[14px] text-white/50">
              Waiting for others to join…
            </div>
          )}
        </div>
        {controls}
        {audio}
        {tapForSound}
        {addPanel}
      </div>
    );
  }

  // ---- One-to-one call ----
  const other = peers[0];
  const remoteVideo = call.isVideo && other?.stream && !other.cameraOff && hasLiveVideo(other.stream) ? other.stream : null;
  const showSelfFull = call.isVideo && !remoteVideo && callState === "OUTGOING" && localStream && !isCameraOff;
  return (
    <div className="call-screen fixed inset-0 z-[100] flex flex-col bg-[#05070b] text-white">
      <div className="absolute inset-0">
        {remoteVideo ? (
          <LiveVideo stream={remoteVideo} />
        ) : showSelfFull ? (
          <LiveVideo stream={localStream!} mirror className="opacity-60" />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(90%_60%_at_50%_35%,rgba(245,158,11,0.16),transparent_70%)]" />
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center px-6 text-center">
        {!remoteVideo && (
          <div className="mt-[12vh] flex flex-col items-center">
            <Face name={call.title} avatar={call.avatar} size="h-28 w-28" />
            <h2 className="mt-5 text-[28px] font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]">{call.title}</h2>
            <p className="mt-1.5 text-[16px] text-white/70">{other?.cameraOff && call.isVideo && call.connectedAt ? `${elapsed} · camera off` : status}</p>
          </div>
        )}
        {remoteVideo && (
          <div className="mt-3 rounded-full bg-black/40 px-4 py-1.5 text-[14px] font-semibold backdrop-blur">
            {call.title} · {status}
          </div>
        )}
        {other?.micOff && call.connectedAt && (
          <p className="mt-3 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-[13px] text-white/80"><MicOff className="h-3.5 w-3.5" /> {call.title} is muted</p>
        )}
        {anyoneConnecting && callState === "ACTIVE" && call.connectedAt && (
          <p className="mt-3 rounded-full bg-black/40 px-3 py-1 text-[13px] text-white/80">Reconnecting…</p>
        )}
      </div>

      {/* Me, small, top right */}
      {call.isVideo && localStream && !isCameraOff && !showSelfFull && (
        <div className="call-pip absolute right-4 z-20 h-40 w-28 overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl">
          <LiveVideo stream={localStream} mirror />
        </div>
      )}

      <div className="relative z-10">{controls}</div>
      {audio}
      {tapForSound}
      {addPanel}
    </div>
  );
};
