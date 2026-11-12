import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, Flag, HeartCrack, Link2, Repeat2, Send, Share2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { postShareUrl } from "@/lib/shareLink";
import { engage, notInterested, tasteOfPost, tasteOfVideo } from "@/lib/taste";
import { ReportSheet } from "@/components/safety/ReportSheet";
import { isReposted, setReposted, soozTikTokLink, type RepostTarget } from "@/services/api/reposts";
import type { TikTokVideo } from "@/services/api/tiktok";
import type { FeedPost } from "@/services/api/posts";
import { refreshProfiles } from "@/lib/profileRefresh";

export type ShareItem = { kind: "post"; post: FeedPost } | { kind: "tiktok"; video: TikTokVideo };

type Chat = { id: string; name: string; avatar: string | null; isGroup: boolean };

/** My conversations, for "Send to". */
async function fetchChats(userId: string): Promise<Chat[]> {
  const { data: mine } = await supabase.from("conversation_participants").select("conversation_id, conversations(id, type, name, created_at)").eq("user_id", userId);
  const convs = ((mine ?? []) as unknown as { conversation_id: string; conversations: { id: string; type: string; name: string | null; created_at: string } | null }[])
    .map((m) => m.conversations).filter((c): c is NonNullable<typeof c> => !!c)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20);
  if (!convs.length) return [];
  const { data: others } = await supabase.from("conversation_participants").select("conversation_id, profiles(username, display_name, avatar_url)").in("conversation_id", convs.map((c) => c.id)).neq("user_id", userId);
  const person = new Map<string, { name: string; avatar: string | null }>();
  ((others ?? []) as unknown as { conversation_id: string; profiles: { username: string; display_name: string | null; avatar_url: string | null } | null }[])
    .forEach((o) => { if (o.profiles && !person.has(o.conversation_id)) person.set(o.conversation_id, { name: o.profiles.display_name || o.profiles.username, avatar: o.profiles.avatar_url }); });
  return convs.map((c) => c.type === "group"
    ? { id: c.id, name: c.name || "Group", avatar: null, isGroup: true }
    : { id: c.id, name: person.get(c.id)?.name || "Chat", avatar: person.get(c.id)?.avatar ?? null, isGroup: false });
}

const Circle = ({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
    <span className={cn("flex h-14 w-14 items-center justify-center rounded-full transition-colors", active ? "bg-amber-400 text-[#1a1204]" : "bg-white/[0.09] text-white")}>{children}</span>
    <span className="text-center text-[12px] leading-tight text-white/75">{label}</span>
  </button>
);

/** TikTok-style share sheet: Repost, send to a SOOZ chat, copy link, WhatsApp, other apps. */
export const ShareSheet = ({ item, open, onOpenChange, onShared, onRepostChange }: {
  item: ShareItem;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Called after it was shared somewhere (to count shares). */
  onShared?: () => void;
  onRepostChange?: (reposted: boolean) => void;
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const target: RepostTarget = item.kind === "post" ? { postId: item.post.id } : { tiktok: item.video };
  const [reposted, setRepostedState] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const chats = useQuery({ queryKey: ["share-chats", user?.id], queryFn: () => fetchChats(user!.id), enabled: open && !!user, staleTime: 1000 * 60 * 5 });

  useEffect(() => {
    if (!open || !user) return;
    isReposted(user.id, target).then(setRepostedState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const link = item.kind === "tiktok" ? soozTikTokLink(item.video) : postShareUrl(item.post.id);
  const who = item.kind === "tiktok" ? item.video.author_name || (item.video.author_handle ? `@${item.video.author_handle}` : "Christian TikTok") : item.post.profiles?.display_name || item.post.profiles?.username || "SOOZ";
  const caption = (item.kind === "tiktok" ? item.video.title : item.post.caption) || "";
  const text = `${item.kind === "tiktok" ? "🎬" : "✨"} ${who}${caption ? `: ${caption.slice(0, 100)}` : ""}`;

  const tasteItem = item.kind === "tiktok" ? tasteOfVideo(item.video) : tasteOfPost(item.post);
  const shared = () => { engage(tasteItem, "share"); onShared?.(); };
  // Report: the share sheet makes way for the report sheet, then both close.
  const [reporting, setReporting] = useState(false);
  const reportTarget = item.kind === "tiktok"
    ? { type: "tiktok" as const, id: item.video.tiktok_id, snapshot: `@${item.video.author_handle ?? "?"}: ${item.video.title ?? ""}` }
    : { type: "post" as const, id: item.post.id, owner: item.post.user_id, snapshot: `${item.post.profiles?.username ?? "?"}: ${item.post.caption ?? ""}${item.post.media_url ? `\n${item.post.media_url}` : ""}` };
  const reported = () => {
    notInterested(tasteItem);
    window.dispatchEvent(new CustomEvent("sooz:feed-next"));
  };

  const notForMe = () => {
    notInterested(tasteItem);
    onOpenChange(false);
    toast("Got it — you'll see fewer videos like this");
    window.dispatchEvent(new CustomEvent("sooz:feed-next"));
  };

  const needUser = () => { if (user) return true; toast("Sign in to do that"); navigate("/auth"); return false; };

  const toggleRepost = async () => {
    if (!needUser()) return;
    const next = !reposted;
    setRepostedState(next);
    const saved = await setReposted(user!.id, target, next);
    if (saved === null) { setRepostedState(!next); toast("Reposts are almost ready — please try again soon"); return; }
    onRepostChange?.(saved);
    refreshProfiles(); // the Reposts tab
    if (saved) engage(tasteItem, "repost");
    toast(saved ? "Reposted — your followers will see it 🔁" : "Repost removed");
  };

  const sendTo = async (chat: Chat) => {
    if (!needUser() || sent.has(chat.id)) return;
    setSent((s) => new Set(s).add(chat.id));
    const { error } = await supabase.from("messages").insert({ conversation_id: chat.id, sender_id: user!.id, content: `${text}\n${link}` });
    if (error) { setSent((s) => { const n = new Set(s); n.delete(chat.id); return n; }); toast.error("Couldn't send — please try again"); return; }
    toast(`Sent to ${chat.name}`);
    shared();
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success("Link copied"); shared(); } catch { toast.error("Couldn't copy the link"); }
  };
  const more = async () => {
    try { if (navigator.share) { await navigator.share({ title: "SOOZ", text, url: link }); shared(); } else copy(); }
    catch { /* cancelled */ }
  };
  const whatsapp = () => { window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`, "_blank", "noopener"); shared(); };

  return (
    <>
    <Drawer open={open && !reporting} onOpenChange={(o) => { if (!reporting) onOpenChange(o); }}>
      <DrawerContent className="sheet-auto rounded-t-[20px] border-white/10 bg-[#121317] pb-[max(env(safe-area-inset-bottom),16px)] text-white">
        <div className="relative flex items-center justify-center px-4 pb-2 pt-1">
          <DrawerTitle className="text-[15px] font-bold">Share to</DrawerTitle>
          <button type="button" aria-label="Close" onClick={() => onOpenChange(false)} className="absolute right-3 top-0 flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:bg-white/10"><X className="h-5 w-5" /></button>
        </div>

        {user && (
          <div className="mt-2">
            <p className="px-4 text-[13px] font-semibold text-white/55">Send to</p>
            <div className="mt-2 flex gap-1 overflow-x-auto px-3 pb-2 hide-scrollbar">
              {chats.isLoading && <p className="px-1 py-4 text-[13px] text-white/40">Loading your chats…</p>}
              {chats.data?.length === 0 && <p className="px-1 py-4 text-[13px] text-white/40">Start a chat to send videos to friends.</p>}
              {chats.data?.map((c) => (
                <button key={c.id} type="button" onClick={() => sendTo(c)} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
                  <span className="relative">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={c.avatar || ""} className="object-cover" />
                      <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-700 text-[18px] font-bold text-white">{c.isGroup ? <Users className="h-6 w-6" /> : c.name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className={cn("absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#121317]", sent.has(c.id) ? "bg-emerald-500" : "bg-amber-400 text-[#1a1204]")}>
                      {sent.has(c.id) ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : <Send className="h-3 w-3" />}
                    </span>
                  </span>
                  <span className="w-full truncate text-center text-[12px] text-white/80">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-2 flex gap-1 overflow-x-auto border-t border-white/[0.06] px-3 pt-4 hide-scrollbar">
          <Circle label={reposted ? "Reposted" : "Repost"} onClick={toggleRepost} active={reposted}><Repeat2 className="h-6 w-6" /></Circle>
          <Circle label="Copy link" onClick={copy}><Link2 className="h-6 w-6" /></Circle>
          <Circle label="WhatsApp" onClick={whatsapp}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2s.2-1.1.1-1.2l-.5-.3z" /></svg>
          </Circle>
          <Circle label="More" onClick={more}><Share2 className="h-6 w-6" /></Circle>
          <Circle label="Not interested" onClick={notForMe}><HeartCrack className="h-6 w-6" /></Circle>
          <Circle label="Report" onClick={() => setReporting(true)}><Flag className="h-6 w-6" /></Circle>
          {item.kind === "tiktok" && (
            <Circle label="Open TikTok" onClick={() => window.open(item.video.url, "_blank", "noopener")}><ExternalLink className="h-6 w-6" /></Circle>
          )}
        </div>
      </DrawerContent>
    </Drawer>
    {reporting && (
      <ReportSheet target={reportTarget} open={reporting} onOpenChange={(o) => { if (!o) { setReporting(false); onOpenChange(false); } }} onReported={reported} />
    )}
    </>
  );
};
