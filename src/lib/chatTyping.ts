import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * "typing…" / "recording audio…" for a chat, over a Realtime broadcast channel `typing:{chatId}`.
 * One channel per chat for the whole app (the chat list and the open chat share it): the realtime
 * client hands back an existing channel for the same name, and adding listeners after it has
 * connected throws — so listeners attach once and fan out from here. Unused channels close after a
 * short grace period (reopening a chat right away reuses it).
 */
export type TypingKind = "typing" | "recording";
export type TypingEvent = { userId: string; name: string; kind: TypingKind | "stop" };
type Listener = (e: TypingEvent) => void;

interface Room { ch: RealtimeChannel; listeners: Set<Listener>; refs: number; ready: boolean; closeTimer?: number }
const rooms = new Map<string, Room>();

function join(chatId: string, listener: Listener) {
  let room = rooms.get(chatId);
  if (!room) {
    const ch = supabase.channel(`typing:${chatId}`, { config: { broadcast: { self: false } } });
    const r: Room = { ch, listeners: new Set(), refs: 0, ready: false };
    ch.on("broadcast", { event: "typing" }, ({ payload }) => r.listeners.forEach((l) => l(payload as TypingEvent)));
    ch.subscribe((status) => { r.ready = status === "SUBSCRIBED"; });
    rooms.set(chatId, r);
    room = r;
  }
  const r = room;
  if (r.closeTimer) { clearTimeout(r.closeTimer); r.closeTimer = undefined; }
  r.refs++;
  r.listeners.add(listener);
  return {
    send: (e: TypingEvent) => { if (r.ready) r.ch.send({ type: "broadcast", event: "typing", payload: e }); },
    leave: () => {
      r.listeners.delete(listener);
      r.refs--;
      if (r.refs <= 0) {
        r.closeTimer = window.setTimeout(() => {
          if (r.refs > 0) return;
          rooms.delete(chatId);
          supabase.removeChannel(r.ch);
        }, 30000);
      }
    },
  };
}

/** Who is typing in these chats right now: chatId → userId → what they're doing. */
export function useTypingIn(chatIds: string[], meId?: string) {
  const [typing, setTyping] = useState<Record<string, Record<string, { name: string; kind: TypingKind }>>>({});
  const key = chatIds.join(",");
  useEffect(() => {
    const timers = new Map<string, number>();
    const handles = chatIds.map((chatId) => join(chatId, (e) => {
      if (e.userId === meId) return;
      const tk = `${chatId}:${e.userId}`;
      clearTimeout(timers.get(tk));
      setTyping((prev) => {
        const room = { ...(prev[chatId] ?? {}) };
        if (e.kind === "stop") delete room[e.userId];
        else room[e.userId] = { name: e.name, kind: e.kind };
        return { ...prev, [chatId]: room };
      });
      // If their "stop" never arrives (app closed), forget them after a few seconds.
      if (e.kind !== "stop") timers.set(tk, window.setTimeout(() => setTyping((prev) => {
        const room = { ...(prev[chatId] ?? {}) };
        delete room[e.userId];
        return { ...prev, [chatId]: room };
      }), 6000));
    }));
    return () => { handles.forEach((h) => h.leave()); timers.forEach((t) => clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, meId]);
  return typing;
}

/** Tell the others in a chat that I'm typing / recording (throttled), and that I stopped. */
export function useTypingSender(chatId: string, me: { id: string; name: string } | null) {
  const handle = useRef<ReturnType<typeof join> | null>(null);
  const lastSent = useRef<{ kind: TypingKind | "stop"; at: number }>({ kind: "stop", at: 0 });
  useEffect(() => {
    if (!me) return;
    const h = join(chatId, () => {});
    handle.current = h;
    return () => {
      if (lastSent.current.kind !== "stop") h.send({ userId: me.id, name: me.name, kind: "stop" });
      h.leave();
      handle.current = null;
    };
  }, [chatId, me?.id, me?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  return (kind: TypingKind | "stop") => {
    if (!me || !handle.current) return;
    const now = Date.now();
    if (kind === lastSent.current.kind && kind !== "stop" && now - lastSent.current.at < 2500) return;
    if (kind === "stop" && lastSent.current.kind === "stop") return;
    lastSent.current = { kind, at: now };
    handle.current.send({ userId: me.id, name: me.name, kind });
  };
}
