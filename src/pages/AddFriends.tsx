import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, Loader2, Search, Share2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { SHARE_ORIGIN } from "@/lib/shareLink";
import { useFollowing } from "@/components/reels/useFollowing";
import { searchPeople, type PersonResult } from "@/services/api/chat";
import { friendSuggestions, type FriendSuggestion } from "@/services/api/friends";
import { shareOnWhatsApp } from "@/lib/whatsapp";

const REASON: Record<FriendSuggestion["reason"], string> = {
  follows_you: "Follows you",
  chat: "You've chatted",
  mutual: "Friends with people you follow",
  new: "New on SOOZ",
};

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2s.2-1.1.1-1.2l-.5-.3z" /></svg>
);

/** One person with a Follow / Following button. */
const PersonRow = ({ person, sub }: { person: { id: string; username: string; name: string; avatar: string | null }; sub?: string }) => {
  const { isFollowing, canFollow, follow, unfollow } = useFollowing();
  const following = isFollowing(person.id);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Link to={`/profile/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={person.avatar || ""} className="object-cover" />
          <AvatarFallback className="bg-gradient-to-br from-amber-400 to-amber-700 font-bold text-white">{person.name[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{person.name}</span>
          <span className="block truncate text-[13px] text-muted-foreground">@{person.username}{sub ? ` · ${sub}` : ""}</span>
        </span>
      </Link>
      {canFollow(person.id) && (
        <button
          type="button"
          onClick={() => (following ? unfollow(person.id) : follow(person.id))}
          className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold transition-colors active:scale-95",
            following ? "bg-secondary text-foreground" : "bg-amber-400 text-black")}
        >
          {following ? <><Check className="h-4 w-4" /> Following</> : <><UserPlus className="h-4 w-4" /> Follow</>}
        </button>
      )}
    </div>
  );
};

/** Add friends: invite people to SOOZ, find them by name, follow back, and people you may know. */
export default function AddFriends() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PersonResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const suggestions = useQuery({ queryKey: ["friend-suggestions", user?.id], queryFn: () => friendSuggestions(user!.id), enabled: !!user, staleTime: 60_000 });
  const me = useQuery({
    queryKey: ["my-username", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("username").eq("id", user!.id).single()).data?.username as string | undefined,
  });

  // Search as they type.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchPeople(term, user?.id).then((r) => { setResults(r); setSearching(false); }, () => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, user?.id]);

  if (!loading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-8 text-center">
        <UserPlus className="h-12 w-12 text-amber-400" />
        <h1 className="mt-4 font-display text-2xl font-bold">Find your friends on SOOZ</h1>
        <button type="button" onClick={() => navigate("/auth")} className="mt-6 rounded-full bg-amber-400 px-8 py-3 font-bold text-black">Sign in or join free</button>
      </div>
    );
  }

  const link = me.data ? `${SHARE_ORIGIN}/profile/${me.data}` : SHARE_ORIGIN;
  const invite = `Join me on SOOZ 🙌🏾 Christian videos, nothing else — worship, preaching, gospel & more. Follow me here: ${link}`;
  const whatsapp = () => shareOnWhatsApp(invite);
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast.success("Your link is copied"); } catch { toast.error("Couldn't copy"); } };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: "SOOZ", text: invite, url: link }); else copy(); } catch { /* cancelled */ } };

  const { followBack = [], suggested = [] } = suggestions.data ?? {};

  return (
    <div className="min-h-screen bg-background pb-[calc(var(--bottom-nav-height)+2rem)] text-foreground">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/20 bg-background/90 px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-xl">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 font-display text-xl font-bold">Add friends</h1>
      </div>

      {/* Invite */}
      <div className="mx-4 mt-4 rounded-3xl border border-amber-400/30 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(251,191,36,0.18),transparent_60%)] p-4">
        <p className="text-[16px] font-bold">Invite friends to SOOZ</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Send them your link — they'll land on your profile and can follow you straight away.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button type="button" onClick={whatsapp} className="flex flex-col items-center gap-1 rounded-2xl bg-[#25D366] py-3 text-[12.5px] font-bold text-white active:scale-95"><WhatsAppIcon /> WhatsApp</button>
          <button type="button" onClick={copy} className="flex flex-col items-center gap-1 rounded-2xl bg-secondary py-3 text-[12.5px] font-bold active:scale-95"><Copy className="h-5 w-5" /> Copy link</button>
          <button type="button" onClick={share} className="flex flex-col items-center gap-1 rounded-2xl bg-secondary py-3 text-[12.5px] font-bold active:scale-95"><Share2 className="h-5 w-5" /> More</button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mx-4 mt-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or @username"
          className="h-12 w-full rounded-full bg-secondary/60 pl-11 pr-4 text-[16px] outline-none placeholder:text-muted-foreground"
        />
      </div>

      {results !== null ? (
        <section className="mt-2">
          {searching && !results.length ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            : results.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No one found — try their username, or invite them above.</p>
            : results.map((p) => <PersonRow key={p.id} person={p} />)}
        </section>
      ) : (
        <>
          {followBack.length > 0 && (
            <section className="mt-3">
              <h2 className="px-4 pb-1 pt-3 text-[13px] font-bold uppercase tracking-wider text-muted-foreground">Follow back</h2>
              {followBack.map((p) => <PersonRow key={p.id} person={p} sub={REASON[p.reason]} />)}
            </section>
          )}
          <section className="mt-3">
            <h2 className="px-4 pb-1 pt-3 text-[13px] font-bold uppercase tracking-wider text-muted-foreground">People you may know</h2>
            {suggestions.isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              : suggested.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">Invite your friends above to get started.</p>
              : suggested.map((p) => <PersonRow key={p.id} person={p} sub={p.reason === "mutual" && p.mutuals ? `${p.mutuals} mutual${p.mutuals > 1 ? "s" : ""}` : REASON[p.reason]} />)}
          </section>
        </>
      )}
    </div>
  );
}
