import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Voice / video calls, one-to-one and in groups.
 *
 * Every call is a small "room" (a Supabase Realtime channel `call:{id}`). Each person in it connects
 * straight to each other person (WebRTC mesh, fine for up to ~6 people). People are invited through
 * their own channel `user:{id}`. For every pair, the person with the smaller user id makes the offer,
 * so two people never offer to each other at once. Connections that drop are restarted, invites are
 * re-sent until answered, and unanswered calls stop ringing after 45 seconds.
 *
 * Anyone in a call can add more people (like WhatsApp): they're invited into the same room, everyone
 * in the call sees them "Ringing…" (an "add" room message), and a one-to-one call becomes a group
 * call for everyone, so it carries on when any one person hangs up.
 */

export type CallState = "IDLE" | "OUTGOING" | "INCOMING" | "ACTIVE";

export interface CallPeer {
  id: string;
  name: string;
  avatar: string | null;
  stream: MediaStream | null;
  cameraOff: boolean;
  micOff: boolean;
  connection: RTCPeerConnectionState;
}

export interface CallInfo {
  id: string;
  isGroup: boolean;
  isVideo: boolean;
  /** The other person's name (1:1) or the group's name. */
  title: string;
  avatar: string | null;
  /** Everyone invited, apart from me. */
  members: string[];
  /** When the first person connected (for the call timer). */
  connectedAt?: number;
  /** Became a group call by adding people (shown by the names of the people in it). */
  adhoc?: boolean;
}

export interface IncomingCall {
  callId: string;
  from: { id: string; name: string; avatar: string | null };
  isGroup: boolean;
  isVideo: boolean;
  title: string;
  members: string[];
  /** Being added to a call that's already going. */
  added?: boolean;
}

export type CallPerson = { id: string; name: string; avatar: string | null };

interface CallContextType {
  callState: CallState;
  call: CallInfo | null;
  incoming: IncomingCall | null;
  peers: CallPeer[];
  /** People added to the call whose phones are still ringing. */
  ringing: CallPerson[];
  maxPeople: number;
  localStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  startCall: (recipientId: string, recipientName: string, recipientAvatar: string | null, isVideo?: boolean) => Promise<void>;
  startGroupCall: (conversationId: string, title: string, memberIds: string[], isVideo?: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  flipCamera: () => void;
  /** Add people to the call I'm in (rings them; the call becomes a group call). */
  addToCall: (people: CallPerson[]) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used within a CallProvider");
  return context;
};

const RING_MS = 45_000;
const MAX_GROUP = 8;

// STUN finds each phone's public address; TURN (Cloudflare, via the turn-credentials function)
// relays the call when phones can't reach each other directly (most mobile networks).
let iceServers: RTCIceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] },
];
let turnLoaded: Promise<void> = Promise.resolve();
const loadTurn = () => {
  turnLoaded = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("turn-credentials");
      if (error || !data?.iceServers) return;
      const extra = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
      iceServers = [...extra, { urls: "stun:stun.l.google.com:19302" }];
    } catch { /* keep STUN only */ }
  })();
};
loadTurn();
setInterval(loadTurn, 12 * 60 * 60 * 1000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait (briefly) for the connection to gather its addresses, so they travel inside the offer/answer too. */
function gathered(pc: RTCPeerConnection, ms = 1200) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => { pc.removeEventListener("icegatheringstatechange", check); resolve(); };
    const check = () => { if (pc.iceGatheringState === "complete") done(); };
    pc.addEventListener("icegatheringstatechange", check);
    setTimeout(done, ms);
  });
}

type Who = { id: string; name: string; avatar: string | null };

interface PeerEntry {
  id: string;
  pc: RTCPeerConnection;
  stream: MediaStream;
  queue: RTCIceCandidateInit[];
  cameraOff: boolean;
  micOff: boolean;
  restartTimer?: ReturnType<typeof setTimeout>;
}

type RoomSignal = {
  kind: "join" | "hello" | "offer" | "answer" | "ice" | "leave" | "media" | "add" | "unring";
  from: string;
  to?: string;
  name?: string;
  avatar?: string | null;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  cameraOff?: boolean;
  micOff?: boolean;
  /** "add": the people just added; "unring": people who stopped ringing. */
  people?: Who[];
  reason?: "declined" | "busy" | "timeout";
};

type UserSignal = {
  kind: "invite" | "cancel" | "decline" | "busy";
  callId: string;
  from: string;
  name?: string;
  avatar?: string | null;
  isGroup?: boolean;
  isVideo?: boolean;
  title?: string;
  members?: string[];
  missed?: boolean;
  added?: boolean;
};

/** "Ruth", "Ruth & Ben", "Ruth, Ben & 2 others". */
const listNames = (names: string[]) => {
  const first = names.map((n) => n.split(" ")[0]);
  if (first.length <= 1) return first[0] || "";
  if (first.length === 2) return `${first[0]} & ${first[1]}`;
  if (first.length === 3) return `${first[0]}, ${first[1]} & ${first[2]}`;
  return `${first[0]}, ${first[1]} & ${first.length - 2} others`;
};

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>("IDLE");
  const [call, setCall] = useState<CallInfo | null>(null);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [peers, setPeers] = useState<CallPeer[]>([]);
  const [ringing, setRinging] = useState<CallPerson[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const me = useRef<Who | null>(null);
  const stateRef = useRef<CallState>("IDLE");
  const callRef = useRef<CallInfo | null>(null);
  const incomingRef = useRef<IncomingCall | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef(new Map<string, PeerEntry>());
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());
  const names = useRef(new Map<string, Who>());
  const joined = useRef(new Set<string>()); // people who answered this call
  const ringingRef = useRef(new Map<string, { who: Who; timer: ReturnType<typeof setTimeout> }>()); // added, not answered yet
  const invitedByMe = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const facing = useRef<"user" | "environment">("user");
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  const setState = (s: CallState) => { stateRef.current = s; setCallState(s); };
  const updateCall = (c: CallInfo | null) => { callRef.current = c; setCall(c); };
  const updateIncoming = (i: IncomingCall | null) => { incomingRef.current = i; setIncoming(i); };
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const publish = () => {
    setPeers([...peersRef.current.values()].map((e) => {
      const who = names.current.get(e.id);
      return {
        id: e.id,
        name: who?.name || "Someone",
        avatar: who?.avatar ?? null,
        stream: e.stream.getTracks().length ? e.stream : null,
        cameraOff: e.cameraOff,
        micOff: e.micOff,
        connection: e.pc.connectionState,
      };
    }));
  };

  const publishRinging = () => setRinging([...ringingRef.current.values()].map((r) => r.who));
  /** Someone added to the call is being rung (on every phone in the call, until they answer or 45s). */
  const startRinging = (who: Who) => {
    if (ringingRef.current.has(who.id) || peersRef.current.has(who.id) || who.id === me.current?.id) return;
    const timer = setTimeout(() => {
      if (!ringingRef.current.has(who.id)) return;
      ringingRef.current.delete(who.id);
      publishRinging();
      if (invitedByMe.current.has(who.id)) toast(`${who.name} didn't answer`);
    }, RING_MS);
    ringingRef.current.set(who.id, { who, timer });
    publishRinging();
  };
  const stopRinging = (id: string) => {
    const r = ringingRef.current.get(id);
    if (!r) return;
    clearTimeout(r.timer);
    ringingRef.current.delete(id);
    publishRinging();
  };

  // My name and photo, for invites and the other people's screens.
  useEffect(() => {
    if (!user) { me.current = null; return; }
    me.current = { id: user.id, name: user.user_metadata?.display_name || user.user_metadata?.username || "SOOZ user", avatar: user.user_metadata?.avatar_url ?? null };
    supabase.from("profiles").select("username, display_name, avatar_url").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data && me.current) me.current = { id: user.id, name: data.display_name || data.username || me.current.name, avatar: data.avatar_url ?? me.current.avatar };
    });
  }, [user]);

  // ---- Sending ----------------------------------------------------------------------------
  const sendToUser = async (userId: string, signal: Omit<UserSignal, "from">) => {
    if (!me.current) return;
    const payload: UserSignal = { ...signal, from: me.current.id };
    const ch = supabase.channel(`user:${userId}`);
    for (let attempt = 0; attempt < 3; attempt++) {
      try { if ((await ch.send({ type: "broadcast", event: "call-v2", payload })) === "ok") return; } catch { /* retry */ }
      await sleep(500 * (attempt + 1));
    }
  };

  const roomSend = async (signal: Omit<RoomSignal, "from">) => {
    const ch = roomRef.current;
    if (!ch || !me.current) return;
    const payload: RoomSignal = { ...signal, from: me.current.id };
    for (let attempt = 0; attempt < 3; attempt++) {
      try { if ((await ch.send({ type: "broadcast", event: "signal", payload })) === "ok") return; } catch { /* retry */ }
      await sleep(400 * (attempt + 1));
      if (roomRef.current !== ch) return;
    }
  };

  // ---- Media ------------------------------------------------------------------------------
  const getMedia = async (video: boolean, group: boolean) => {
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    const size = group ? { width: { ideal: 480 }, height: { ideal: 640 } } : { width: { ideal: 720 }, height: { ideal: 1280 } };
    const tries: MediaStreamConstraints[] = video
      ? [{ audio, video: { facingMode: "user", ...size } }, { audio: true, video: true }, { audio: true }]
      : [{ audio }, { audio: true }];
    for (const c of tries) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c);
        if (video && !stream.getVideoTracks().length) toast("Camera unavailable — joining with audio only");
        localRef.current = stream;
        setLocalStream(stream);
        setIsMuted(false);
        setIsCameraOff(!stream.getVideoTracks().length);
        facing.current = "user";
        return stream;
      } catch (e) {
        if ((e as Error)?.name === "NotAllowedError") break;
      }
    }
    toast.error("SOOZ needs your microphone for calls. Allow it in your phone's settings for this app.");
    return null;
  };

  const keepAwake = async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      wakeLock.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch { /* not supported */ }
  };

  // ---- Peer connections -------------------------------------------------------------------
  const closePeer = (id: string) => {
    const e = peersRef.current.get(id);
    if (!e) return;
    clearTimeout(e.restartTimer);
    e.pc.onicecandidate = null; e.pc.ontrack = null; e.pc.onconnectionstatechange = null;
    try { e.pc.close(); } catch { /* already closed */ }
    peersRef.current.delete(id);
    publish();
  };

  const offerTo = async (id: string, iceRestart = false) => {
    const e = peersRef.current.get(id);
    if (!e) return;
    try {
      const offer = await e.pc.createOffer({ iceRestart });
      await e.pc.setLocalDescription(offer);
      await gathered(e.pc);
      if (peersRef.current.get(id) !== e) return;
      await roomSend({ kind: "offer", to: id, sdp: e.pc.localDescription!.toJSON(), name: me.current?.name, avatar: me.current?.avatar });
    } catch (err) {
      console.error("offer failed", err);
    }
  };

  const createPeer = (id: string) => {
    closePeer(id);
    const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 2 });
    const entry: PeerEntry = { id, pc, stream: new MediaStream(), queue: pendingIce.current.get(id) ?? [], cameraOff: false, micOff: false };
    pendingIce.current.delete(id);
    peersRef.current.set(id, entry);
    localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));

    pc.onicecandidate = (ev) => { if (ev.candidate) roomSend({ kind: "ice", to: id, candidate: ev.candidate.toJSON() }); };
    pc.ontrack = (ev) => {
      if (!entry.stream.getTracks().some((t) => t.id === ev.track.id)) entry.stream.addTrack(ev.track);
      ev.track.onunmute = publish;
      publish();
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") {
        clearTimeout(entry.restartTimer);
        const c = callRef.current;
        if (c && !c.connectedAt) updateCall({ ...c, connectedAt: Date.now() });
        if (stateRef.current !== "ACTIVE") setState("ACTIVE");
      } else if (s === "failed") {
        // Try again on a fresh route (the person with the smaller id restarts, to avoid clashes).
        if (me.current && me.current.id < id) offerTo(id, true);
      } else if (s === "disconnected") {
        clearTimeout(entry.restartTimer);
        entry.restartTimer = setTimeout(() => {
          if (pc.connectionState === "disconnected" && me.current && me.current.id < id) offerTo(id, true);
        }, 4000);
      }
      publish();
    };
    publish();
    return entry;
  };

  const flushIce = async (e: PeerEntry) => {
    while (e.queue.length) {
      const c = e.queue.shift()!;
      try { await e.pc.addIceCandidate(c); } catch { /* stale candidate */ }
    }
  };

  /** Someone is in the room: the smaller id makes the offer; the other says hello so it can. */
  const meet = (from: string, replyHello: boolean) => {
    if (!me.current || from === me.current.id) return;
    const existing = peersRef.current.get(from);
    const healthy = existing && ["new", "connecting", "connected"].includes(existing.pc.connectionState);
    if (me.current.id < from) {
      if (!healthy) { createPeer(from); offerTo(from); }
    } else if (replyHello) {
      roomSend({ kind: "hello", to: from, name: me.current.name, avatar: me.current.avatar });
    }
  };

  const onRoom = async (s: RoomSignal) => {
    if (!me.current || !s?.from || s.from === me.current.id) return;
    if (s.to && s.to !== me.current.id) return;
    if (s.name) names.current.set(s.from, { id: s.from, name: s.name, avatar: s.avatar ?? null });
    if (s.kind === "join" || s.kind === "hello" || s.kind === "offer") {
      stopRinging(s.from);
      // Someone new is in the call (even if the "add" message got lost): it's a group call now.
      const c = callRef.current;
      if (c && !c.members.includes(s.from)) updateCall({ ...c, isGroup: true, adhoc: c.isGroup ? c.adhoc : true, members: [...c.members, s.from] });
    }

    if (s.kind === "join" || s.kind === "hello") {
      joined.current.add(s.from);
      if (peersRef.current.size + 1 >= MAX_GROUP && !peersRef.current.has(s.from)) return;
      meet(s.from, s.kind === "join");
      publish();
    } else if (s.kind === "offer" && s.sdp) {
      joined.current.add(s.from);
      let e = peersRef.current.get(s.from);
      if (!e || e.pc.connectionState === "closed") e = createPeer(s.from);
      try {
        if (e.pc.signalingState !== "stable") {
          if (me.current.id < s.from) return; // my own offer wins
          await e.pc.setLocalDescription({ type: "rollback" });
        }
        await e.pc.setRemoteDescription(s.sdp);
        await flushIce(e);
        const answer = await e.pc.createAnswer();
        await e.pc.setLocalDescription(answer);
        await gathered(e.pc);
        await roomSend({ kind: "answer", to: s.from, sdp: e.pc.localDescription!.toJSON(), name: me.current.name, avatar: me.current.avatar });
        roomSend({ kind: "media", cameraOff: isCameraOffNow(), micOff: isMutedNow() });
      } catch (err) {
        console.error("answer failed", err);
      }
    } else if (s.kind === "answer" && s.sdp) {
      const e = peersRef.current.get(s.from);
      if (!e || e.pc.signalingState !== "have-local-offer") return;
      try {
        await e.pc.setRemoteDescription(s.sdp);
        await flushIce(e);
        roomSend({ kind: "media", cameraOff: isCameraOffNow(), micOff: isMutedNow() });
      } catch (err) { console.error("answer apply failed", err); }
    } else if (s.kind === "ice" && s.candidate) {
      const e = peersRef.current.get(s.from);
      if (e?.pc.remoteDescription) { try { await e.pc.addIceCandidate(s.candidate); } catch { /* stale */ } }
      else if (e) e.queue.push(s.candidate);
      else pendingIce.current.set(s.from, [...(pendingIce.current.get(s.from) ?? []), s.candidate]);
    } else if (s.kind === "media") {
      const e = peersRef.current.get(s.from);
      if (e) { e.cameraOff = !!s.cameraOff; e.micOff = !!s.micOff; publish(); }
    } else if (s.kind === "add" && s.people?.length) {
      const c = callRef.current;
      if (!c) return;
      const added = s.people.filter((p) => p.id !== me.current.id);
      added.forEach((p) => { names.current.set(p.id, p); startRinging(p); });
      updateCall({ ...c, isGroup: true, adhoc: c.isGroup ? c.adhoc : true, members: [...new Set([...c.members, ...added.map((p) => p.id)])] });
      if (added.length) toast(`${(names.current.get(s.from)?.name || "Someone").split(" ")[0]} added ${listNames(added.map((p) => p.name))}`);
    } else if (s.kind === "unring" && s.people) {
      s.people.forEach((p) => {
        if (!ringingRef.current.has(p.id)) return;
        stopRinging(p.id);
        if (s.reason === "declined") toast(`${p.name} declined`);
        else if (s.reason === "busy") toast(`${p.name} is on another call`);
      });
    } else if (s.kind === "leave") {
      closePeer(s.from);
      const c = callRef.current;
      if (c && !c.isGroup) { toast("Call ended"); finish(); }
      else if (c && peersRef.current.size === 0) {
        // Alone: wait for anyone still ringing. A call that grew from one-to-one ends right away (like
        // WhatsApp); a group chat's call waits a little, since other members may still answer.
        const wait = ringingRef.current.size ? RING_MS : c.adhoc ? 2_000 : 30_000;
        later(() => {
          if (peersRef.current.size === 0 && ringingRef.current.size === 0 && stateRef.current !== "IDLE") { toast(c.adhoc ? "Call ended" : "Everyone has left the call"); finish(); }
          else if (peersRef.current.size === 0 && ringingRef.current.size > 0) later(() => { if (peersRef.current.size === 0 && stateRef.current !== "IDLE") { toast("Call ended"); finish(); } }, RING_MS);
        }, wait);
      }
    }
  };

  const isCameraOffNow = () => !localRef.current?.getVideoTracks().some((t) => t.enabled);
  const isMutedNow = () => !localRef.current?.getAudioTracks().some((t) => t.enabled);

  const joinRoom = (callId: string) =>
    new Promise<void>((resolve) => {
      const ch = supabase.channel(`call:${callId}`, { config: { broadcast: { self: false, ack: true } } });
      ch.on("broadcast", { event: "signal" }, ({ payload }) => apiRef.current.onRoom(payload as RoomSignal));
      roomRef.current = ch;
      let done = false;
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED" && roomRef.current === ch && me.current) {
          // (Also after a reconnect: say hello again so broken connections get rebuilt.)
          roomSend({ kind: "join", name: me.current.name, avatar: me.current.avatar });
          if (!done) { done = true; resolve(); }
        }
      });
      setTimeout(() => { if (!done) { done = true; resolve(); } }, 8000);
    });

  /** Leave the call and put everything back to rest. */
  const finish = () => {
    // Leaving with nobody else in the call: stop ringing the people I added.
    const c = callRef.current;
    if (c && peersRef.current.size === 0) {
      [...ringingRef.current.keys()].filter((id) => invitedByMe.current.has(id)).forEach((id) => sendToUser(id, { kind: "cancel", callId: c.id, missed: true }));
    }
    ringingRef.current.forEach((r) => clearTimeout(r.timer));
    ringingRef.current.clear();
    invitedByMe.current.clear();
    setRinging([]);
    clearTimers();
    if (roomRef.current) {
      const ch = roomRef.current;
      if (me.current) ch.send({ type: "broadcast", event: "signal", payload: { kind: "leave", from: me.current.id } }).catch(() => {});
      roomRef.current = null;
      setTimeout(() => supabase.removeChannel(ch), 800);
    }
    [...peersRef.current.keys()].forEach(closePeer);
    pendingIce.current.clear();
    joined.current.clear();
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    setLocalStream(null);
    setPeers([]);
    updateCall(null);
    updateIncoming(null);
    setIsMuted(false);
    setIsCameraOff(false);
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
    setState("IDLE");
  };

  const logMissed = (fromId: string) => {
    if (!me.current) return;
    supabase.from("notifications").insert({ user_id: me.current.id, actor_id: fromId, type: "missed_call", content: "You missed a call.", is_read: false })
      .then(({ error }) => { if (error) console.error("missed call log failed", error); });
  };

  // ---- Starting, answering, ending --------------------------------------------------------
  const begin = async (info: Omit<CallInfo, "id">) => {
    if (stateRef.current !== "IDLE" || !me.current) return;
    const callId = crypto.randomUUID();
    const c: CallInfo = { ...info, id: callId };
    updateCall(c);
    setState("OUTGOING");
    const stream = await getMedia(info.isVideo, info.isGroup);
    if (!stream || callRef.current?.id !== callId) { finish(); return; }
    keepAwake();
    await Promise.race([turnLoaded, sleep(2500)]);
    await joinRoom(callId);
    if (callRef.current?.id !== callId) return;

    const invite = () => {
      const pending = c.members.filter((m) => !joined.current.has(m));
      pending.forEach((m) => sendToUser(m, {
        kind: "invite", callId, isGroup: c.isGroup, isVideo: c.isVideo,
        name: me.current!.name, avatar: me.current!.avatar,
        title: c.isGroup ? c.title : me.current!.name,
        members: [me.current!.id, ...c.members],
      }));
      return pending;
    };
    const first = invite();
    // Wake their phone too (a notification), in case SOOZ isn't open.
    first.forEach((m) => supabase.functions.invoke("push-notifications", {
      body: {
        type: "chat_message", toUserId: m,
        title: c.isGroup ? `${me.current!.name} · ${c.title}` : me.current!.name,
        body: `Incoming ${c.isVideo ? "video" : "voice"} call`, url: "/chat",
      },
    }).catch(() => {}));
    // Re-send the invite a few times while nobody has answered (a lost message must not lose the call).
    [4000, 9000, 16000].forEach((ms) => later(() => { if (stateRef.current === "OUTGOING" && callRef.current?.id === callId) invite(); }, ms));
    later(() => {
      if (callRef.current?.id !== callId || stateRef.current !== "OUTGOING") return;
      const answered = joined.current.size > 0;
      c.members.forEach((m) => sendToUser(m, { kind: "cancel", callId, missed: !answered }));
      toast(answered ? "Couldn't connect the call — please try again" : c.isGroup ? "No one answered" : `${c.title} didn't answer`);
      finish();
    }, RING_MS);
  };

  const startCall = (recipientId: string, recipientName: string, recipientAvatar: string | null, isVideo = true) => {
    names.current.set(recipientId, { id: recipientId, name: recipientName, avatar: recipientAvatar });
    return begin({ isGroup: false, isVideo, title: recipientName, avatar: recipientAvatar, members: [recipientId] });
  };

  const startGroupCall = (_conversationId: string, title: string, memberIds: string[], isVideo = true) => {
    const members = memberIds.filter((m) => m !== user?.id).slice(0, MAX_GROUP - 1);
    if (!members.length) { toast("There's no one else in this group yet"); return Promise.resolve(); }
    return begin({ isGroup: true, isVideo, title, avatar: null, members });
  };

  const acceptCall = async () => {
    const inc = incomingRef.current;
    if (!inc || !me.current) return;
    clearTimers();
    names.current.set(inc.from.id, inc.from);
    updateIncoming(null);
    updateCall({
      id: inc.callId, isGroup: inc.isGroup, isVideo: inc.isVideo,
      title: inc.isGroup ? inc.title : inc.from.name, avatar: inc.isGroup ? null : inc.from.avatar,
      members: inc.members.filter((m) => m !== me.current!.id),
      adhoc: !!inc.added,
    });
    setState("ACTIVE");
    const stream = await getMedia(inc.isVideo, inc.isGroup);
    if (!stream) { sendToUser(inc.from.id, { kind: "decline", callId: inc.callId }); finish(); return; }
    keepAwake();
    await Promise.race([turnLoaded, sleep(2500)]);
    await joinRoom(inc.callId);
    // Nobody connected within 20s: tell them, rather than sit on "Connecting…" forever.
    later(() => {
      if (callRef.current?.id === inc.callId && !callRef.current.connectedAt) { toast("Couldn't connect the call — please try again"); finish(); }
    }, 20_000);
  };

  const rejectCall = () => {
    const inc = incomingRef.current;
    if (inc) {
      if (!inc.isGroup || inc.added) sendToUser(inc.from.id, { kind: "decline", callId: inc.callId });
      logMissed(inc.from.id);
    }
    clearTimers();
    updateIncoming(null);
    if (!callRef.current) setState("IDLE");
  };

  const endCall = () => {
    const c = callRef.current;
    if (c && stateRef.current === "OUTGOING") c.members.forEach((m) => sendToUser(m, { kind: "cancel", callId: c.id, missed: true }));
    finish();
  };

  const onUser = (s: UserSignal) => {
    if (!me.current || !s?.callId) return;
    if (s.kind === "invite") {
      if (incomingRef.current?.callId === s.callId || callRef.current?.id === s.callId) return; // repeat invite
      if (stateRef.current !== "IDLE") { if (!s.isGroup || s.added) sendToUser(s.from, { kind: "busy", callId: s.callId }); return; }
      updateIncoming({
        callId: s.callId,
        from: { id: s.from, name: s.name || "Someone", avatar: s.avatar ?? null },
        isGroup: !!s.isGroup, isVideo: s.isVideo !== false,
        title: s.title || s.name || "Call",
        members: s.members ?? [s.from, me.current.id],
        added: !!s.added,
      });
      setState("INCOMING");
      clearTimers();
      later(() => {
        if (incomingRef.current?.callId === s.callId) { logMissed(s.from); updateIncoming(null); setState("IDLE"); }
      }, RING_MS);
    } else if (s.kind === "cancel") {
      if (incomingRef.current?.callId === s.callId) {
        clearTimers();
        if (s.missed) { logMissed(s.from); toast(`Missed call from ${incomingRef.current.from.name}`); }
        updateIncoming(null);
        setState("IDLE");
      }
    } else if (s.kind === "decline" || s.kind === "busy") {
      const c = callRef.current;
      // Someone I added said no: tell everyone in the call.
      const r = ringingRef.current.get(s.from);
      if (c?.id === s.callId && r) {
        stopRinging(s.from);
        toast(s.kind === "busy" ? `${r.who.name} is on another call` : `${r.who.name} declined`);
        roomSend({ kind: "unring", people: [r.who], reason: s.kind === "busy" ? "busy" : "declined" });
        return;
      }
      if (c?.id === s.callId && !c.isGroup && stateRef.current === "OUTGOING") {
        toast(s.kind === "busy" ? `${c.title} is on another call` : `${c.title} declined the call`);
        finish();
      }
    }
  };

  // ---- Adding people to the call (like WhatsApp) -------------------------------------------
  const addToCall = (people: CallPerson[]) => {
    const c = callRef.current;
    if (!c || !me.current || stateRef.current !== "ACTIVE") return;
    const room = MAX_GROUP - 1 - peersRef.current.size - ringingRef.current.size;
    const fresh = people.filter((p) => p.id !== me.current!.id && !peersRef.current.has(p.id) && !ringingRef.current.has(p.id)).slice(0, Math.max(0, room));
    if (!fresh.length) { if (room <= 0) toast(`A call can have up to ${MAX_GROUP} people`); return; }
    fresh.forEach((p) => { names.current.set(p.id, p); invitedByMe.current.add(p.id); startRinging(p); });
    const members = [...new Set([...c.members, ...fresh.map((p) => p.id)])];
    const next: CallInfo = { ...c, isGroup: true, adhoc: c.isGroup ? c.adhoc : true, members };
    updateCall(next);
    // Everyone in the call: show them ringing (and turn a one-to-one call into a group call).
    roomSend({ kind: "add", people: fresh, name: me.current.name, avatar: me.current.avatar });
    const inCall = [me.current.name, ...[...peersRef.current.keys()].map((id) => names.current.get(id)?.name || "")].filter(Boolean);
    const title = next.adhoc ? listNames(inCall) : c.title;
    const invite = () => fresh.filter((p) => ringingRef.current.has(p.id)).forEach((p) => sendToUser(p.id, {
      kind: "invite", callId: c.id, isGroup: true, isVideo: c.isVideo, added: true,
      name: me.current!.name, avatar: me.current!.avatar, title, members: [me.current!.id, ...members],
    }));
    invite();
    // Wake their phones too, in case SOOZ isn't open.
    fresh.forEach((p) => supabase.functions.invoke("push-notifications", {
      body: { type: "chat_message", toUserId: p.id, title: me.current!.name, body: `${me.current!.name} is adding you to a ${c.isVideo ? "video" : "voice"} call`, url: "/chat" },
    }).catch(() => {}));
    // Re-send while they haven't answered (a lost message must not lose the invite).
    [4000, 9000, 16000].forEach((ms) => later(() => { if (callRef.current?.id === c.id) invite(); }, ms));
  };

  // ---- In-call controls -------------------------------------------------------------------
  const toggleMute = () => {
    const tracks = localRef.current?.getAudioTracks() ?? [];
    if (!tracks.length) return;
    const next = !tracks[0].enabled;
    tracks.forEach((t) => { t.enabled = next; });
    setIsMuted(!next);
    roomSend({ kind: "media", micOff: !next, cameraOff: isCameraOffNow() });
  };

  const toggleCamera = () => {
    const tracks = localRef.current?.getVideoTracks() ?? [];
    if (!tracks.length) { toast("Camera isn't available in a voice call"); return; }
    const next = !tracks[0].enabled;
    tracks.forEach((t) => { t.enabled = next; });
    setIsCameraOff(!next);
    roomSend({ kind: "media", cameraOff: !next, micOff: isMutedNow() });
  };

  const flipCamera = async () => {
    const stream = localRef.current;
    const old = stream?.getVideoTracks()[0];
    if (!stream || !old) return;
    const want = facing.current === "user" ? "environment" : "user";
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: want } } });
      const track = fresh.getVideoTracks()[0];
      track.enabled = old.enabled;
      await Promise.all([...peersRef.current.values()].map((e) => e.pc.getSenders().find((s) => s.track?.kind === "video")?.replaceTrack(track)));
      stream.removeTrack(old);
      old.stop();
      stream.addTrack(track);
      facing.current = want;
      setLocalStream(new MediaStream(stream.getTracks()));
    } catch {
      toast("Couldn't switch camera");
    }
  };

  // Handlers read the latest functions through this ref (they only use refs, never stale state).
  const apiRef = useRef({ onRoom, onUser, finish });
  apiRef.current = { onRoom, onUser, finish };

  // Listen for calls on my own channel — one steady subscription for as long as I'm signed in.
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`user:${user.id}`);
    ch.on("broadcast", { event: "call-v2" }, ({ payload }) => apiRef.current.onUser(payload as UserSignal)).subscribe();
    const onLeavePage = () => { if (stateRef.current === "ACTIVE" || stateRef.current === "OUTGOING") apiRef.current.finish(); };
    window.addEventListener("pagehide", onLeavePage);
    return () => {
      window.removeEventListener("pagehide", onLeavePage);
      supabase.removeChannel(ch);
    };
  }, [user]);

  return (
    <CallContext.Provider value={{
      callState, call, incoming, peers, ringing, maxPeople: MAX_GROUP, localStream, isMuted, isCameraOff,
      startCall, startGroupCall, acceptCall, rejectCall, endCall, toggleMute, toggleCamera, flipCamera, addToCall,
    }}>
      {children}
    </CallContext.Provider>
  );
};
