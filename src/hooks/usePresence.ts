import { useState, useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PresenceState {
  [key: string]: { online_at: string; user_id: string }[];
}

/**
 * Who is online. One shared "online-users" channel for the whole app: the chat list and an open
 * chat both use this hook, and the realtime client hands out the *same* channel for the same name —
 * adding listeners to it a second time, after it has connected, throws and broke the chat screen.
 */
let channel: RealtimeChannel | null = null;
let channelUser: string | null = null;
let online = new Set<string>();
const listeners = new Set<(ids: Set<string>) => void>();

const emit = () => { online = new Set(online); listeners.forEach((l) => l(online)); };

function connect(userId: string) {
  if (channel && channelUser === userId) return;
  if (channel) { supabase.removeChannel(channel); channel = null; }
  channelUser = userId;
  const ch = supabase.channel("online-users", { config: { presence: { key: userId } } });
  channel = ch;
  ch.on("presence", { event: "sync" }, () => { online = new Set(Object.keys(ch.presenceState() as PresenceState)); emit(); })
    .on("presence", { event: "join" }, ({ key }) => { online.add(key); emit(); })
    .on("presence", { event: "leave" }, ({ key }) => { online.delete(key); emit(); })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ online_at: new Date().toISOString(), user_id: userId });
    });
}

export const usePresence = () => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(online);

  useEffect(() => {
    if (!user) return;
    try { connect(user.id); } catch (e) { console.error("presence unavailable", e); }
    listeners.add(setOnlineUsers);
    setOnlineUsers(online);
    return () => { listeners.delete(setOnlineUsers); };
  }, [user]);

  return { onlineUsers };
};
