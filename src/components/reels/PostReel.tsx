import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Check, Edit, Flag, Heart, MessageCircle, MoreHorizontal, Music2, Plus, Repeat2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVideoStore } from "@/store/useVideoStore";
import type { FeedPost } from "@/services/api/posts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReelVideo, type ReelVideoHandle } from "./ReelVideo";
import { RichCaption } from "./RichCaption";
import { RailButton, ShareArrow, railIconClass } from "./ReelRail";
import { formatCount, useHeartBursts, useTapGesture } from "./gestures";
import { useFollowing } from "./useFollowing";
import { engage, tasteOfPost, useTasteWatch } from "@/lib/taste";
import { resetForYou } from "@/services/api/feed";

// Only needed once someone taps comments/edit, so they load on demand.
const ReportSheet = lazy(() => import("@/components/safety/ReportSheet").then((m) => ({ default: m.ReportSheet })));
const CommentDrawer = lazy(() => import("@/components/feed/CommentDrawer").then((m) => ({ default: m.CommentDrawer })));
const EditPostDialog = lazy(() => import("@/components/feed/EditPostDialog").then((m) => ({ default: m.EditPostDialog })));
const ShareSheet = lazy(() => import("./ShareSheet").then((m) => ({ default: m.ShareSheet })));

export const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  if (s < 2629800) return `${Math.floor(s / 604800)}w`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: s > 31557600 ? "numeric" : undefined });
};

// Text posts become scripture-style cards; each post keeps the same palette every time.
const CARD_PALETTES = [
  "radial-gradient(120% 80% at 50% 0%, rgba(245,158,11,0.35), transparent 60%), linear-gradient(160deg, #0b1324 0%, #111a33 45%, #05070d 100%)",
  "radial-gradient(110% 70% at 80% 10%, rgba(168,85,247,0.35), transparent 60%), linear-gradient(170deg, #160f2e 0%, #0d0b1f 55%, #050409 100%)",
  "radial-gradient(120% 80% at 20% 0%, rgba(20,184,166,0.32), transparent 60%), linear-gradient(165deg, #04201f 0%, #071717 50%, #030808 100%)",
  "radial-gradient(120% 80% at 50% 0%, rgba(244,63,94,0.30), transparent 60%), linear-gradient(160deg, #2a0d17 0%, #170a10 55%, #070305 100%)",
];
const paletteFor = (id: string) => CARD_PALETTES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % CARD_PALETTES.length];

const TextCard = ({ id, text, name }: { id: string; text: string; name: string }) => {
  const len = text.length;
  const size = len < 60 ? "text-[30px]" : len < 140 ? "text-[24px]" : len < 280 ? "text-[19px]" : "text-[16px]";
  return (
    <div className="absolute inset-0 flex items-center justify-center pl-7 pr-[84px] md:px-10" style={{ background: paletteFor(id) }}>
      <div className="max-h-[62%] w-full max-w-md overflow-y-auto text-center hide-scrollbar">
        <div className="font-serif text-6xl leading-none text-amber-300/60" aria-hidden>“</div>
        <p className={cn("selectable whitespace-pre-line font-serif leading-snug text-white", size)}>
          <RichCaption text={text} />
        </p>
        <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">— {name}</p>
      </div>
    </div>
  );
};

const ReelImage = ({ src, active }: { src: string; active: boolean }) => {
  const [fit, setFit] = useState<"cover" | "contain">("contain");
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="absolute inset-0 bg-black">
      <img
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        {...({ fetchpriority: active ? "high" : "auto" } as Record<string, string>)}
        className={cn("absolute inset-0 h-full w-full transition-opacity duration-300", fit === "cover" ? "object-cover" : "object-contain", loaded ? "opacity-100" : "opacity-0")}
        onLoad={(e) => {
          const img = e.currentTarget;
          setFit(img.naturalHeight / img.naturalWidth >= 1.3 ? "cover" : "contain");
          setLoaded(true);
        }}
      />
      {!loaded && <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-white/[0.04] to-white/[0.08]" />}
    </div>
  );
};

interface PostReelProps {
  post: FeedPost;
  active: boolean;
  /** Whether heavy media (the <video> element) should be mounted. */
  mounted: boolean;
  /** Shown in Following when someone you follow reposted it. */
  repostedBy?: string;
}

export const PostReel = memo(function PostReel({ post, active, mounted, repostedBy }: PostReelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = post.profiles;
  const name = profile?.display_name || profile?.username || "SOOZ";
  const isVideo = post.media_type === "video" && !!post.media_url;
  const isText = !post.media_url;

  const [liked, setLiked] = useState(post.is_liked_by_user);
  const [likes, setLikes] = useState(post.likes_count);
  const [saved, setSaved] = useState(post.is_saved_by_user);
  const [caption, setCaption] = useState(post.caption);
  const [expanded, setExpanded] = useState(false);
  // Two lines with "more" when the caption is longer, like TikTok.
  const [captionCut, setCaptionCut] = useState(false);
  const captionRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = captionRef.current;
    if (!el || expanded) return;
    const check = () => setCaptionCut(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [caption, expanded]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleted, setDeleted] = useState<false | string>(false);
  const [soundHint, setSoundHint] = useState(false);
  const [justFollowed, setJustFollowed] = useState(false);
  const videoRef = useRef<ReelVideoHandle>(null);
  const busy = useRef({ like: false, save: false });
  const viewed = useRef(false);
  const { add: burst, node: bursts } = useHeartBursts();
  const { isFollowing, canFollow, follow } = useFollowing();
  // What this viewer enjoys (For You learns from it): how long it's watched, likes, comments, shares…
  useTasteWatch(tasteOfPost(post), active);
  const learn = (action: Parameters<typeof engage>[1]) => engage(tasteOfPost(post), action);

  useEffect(() => { setLiked(post.is_liked_by_user); setLikes(post.likes_count); }, [post.is_liked_by_user, post.likes_count]);
  useEffect(() => { setSaved(post.is_saved_by_user); }, [post.is_saved_by_user]);
  useEffect(() => { if (!active) setExpanded(false); }, [active]);

  // Count a view the first time the slide is on screen.
  useEffect(() => {
    if (!active || viewed.current) return;
    viewed.current = true;
    supabase.from("post_views").insert({ post_id: post.id }).then(() => {}, () => {});
  }, [active, post.id]);

  const requireUser = (what: string) => {
    if (user) return true;
    toast(`Sign in to ${what}`);
    navigate("/auth");
    return false;
  };

  const setLike = async (next: boolean) => {
    if (!requireUser("like posts") || busy.current.like || next === liked) return;
    busy.current.like = true;
    learn(next ? "like" : "unlike");
    setLiked(next);
    setLikes((c) => Math.max(0, c + (next ? 1 : -1)));
    const { error } = next
      ? await supabase.from("likes").insert({ post_id: post.id, user_id: user!.id })
      : await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user!.id);
    if (error && !(next && error.code === "23505")) {
      setLiked(!next);
      setLikes((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.error("Couldn't update like");
    }
    busy.current.like = false;
  };

  const toggleSave = async () => {
    if (!requireUser("save posts") || busy.current.save) return;
    busy.current.save = true;
    const next = !saved;
    setSaved(next);
    const { error } = next
      ? await supabase.from("bookmarks").insert({ user_id: user!.id, post_id: post.id })
      : await supabase.from("bookmarks").delete().eq("user_id", user!.id).eq("post_id", post.id);
    if (error && !(next && error.code === "23505")) { setSaved(!next); toast.error("Couldn't update saved posts"); }
    else toast.success(next ? "Saved" : "Removed from saved");
    busy.current.save = false;
  };

  const [shares, setShares] = useState(post.shares_count ?? 0);
  // Count a share (like TikTok's number under the arrow) once it actually happened.
  const countShare = () => {
    if (!user) return;
    supabase.from("post_shares").insert({ post_id: post.id, user_id: user.id }).then(({ error }) => { if (!error) setShares((n) => n + 1); });
  };
  // Share opens SOOZ's share sheet: Repost, send to a chat, copy link, WhatsApp, other apps.
  const [shareOpen, setShareOpen] = useState(false);
  const share = () => { setShareOpen(true); learn("openShare"); };

  const remove = async () => {
    if (!user || user.id !== post.user_id || !confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) { toast.error("Couldn't delete post"); return; }
    setDeleted("Post deleted");
    resetForYou();
    queryClient.invalidateQueries({ queryKey: ["feed"] });
  };

  // First tap turns sound on (browsers start videos muted); after that, taps pause/play.
  const onFirstTap = useCallback(() => {
    const st = useVideoStore.getState();
    if (!isVideo || !st.isGlobalMuted || st.soundUnlocked) return false;
    videoRef.current?.unmuteNow();
    st.setGlobalMuted(false);
    st.setSoundUnlocked(true);
    setSoundHint(true);
    setTimeout(() => setSoundHint(false), 1200);
    return true;
  }, [isVideo]);

  const onTap = useTapGesture({
    onSingle: () => { if (isVideo) videoRef.current?.togglePlay(); else setExpanded(false); },
    onDouble: (p) => { burst(p); setLike(true); },
    onFirstTap,
  });

  if (deleted) {
    return <div className="flex h-full w-full items-center justify-center px-8 text-center text-sm text-white/50">{deleted}</div>;
  }

  const showFollow = !!profile && (!user || (canFollow(profile.id) && !isFollowing(profile.id)));
  const isOwner = user?.id === post.user_id;

  return (
    <div className="reel-frame">
      <div className="reel-media" onClick={onTap}>
        {isVideo ? (
          <ReelVideo ref={videoRef} src={post.media_url!} poster={post.thumbnail_url} active={active} mounted={mounted} />
        ) : isText ? (
          <TextCard id={post.id} text={caption || ""} name={name} />
        ) : (
          <ReelImage src={post.media_url!} active={active} />
        )}

        <div className="reel-scrim-top" aria-hidden />
        <div className="reel-scrim-bottom" aria-hidden />
        {bursts}

        {soundHint && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 px-4 py-2 text-sm font-semibold text-white backdrop-blur animate-scale-in">
            🔊 Sound on
          </div>
        )}

        <div className="reel-caption">
          {repostedBy && (
            <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-white/85"><Repeat2 className="h-4 w-4 text-amber-400" /> {repostedBy} reposted</p>
          )}
          <div className="flex items-center gap-2">
            <Link to={`/profile/${profile?.username ?? ""}`} onClick={(e) => { e.stopPropagation(); learn("profile"); }} className="truncate text-[16px] font-bold text-white hover:underline">
              {name}
            </Link>
            <span className="shrink-0 text-[13px] text-white/60">· {timeAgo(post.created_at)}</span>
          </div>

          {caption && !isText && (expanded ? (
            <button
              type="button"
              aria-expanded
              onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
              className="mt-1.5 block max-h-[40vh] w-full overflow-y-auto overscroll-contain text-left text-[14.5px] leading-snug text-white/95 hide-scrollbar"
            >
              <RichCaption text={caption} />
              <span className="ml-1.5 font-semibold text-white/60">less</span>
            </button>
          ) : (
            <button
              type="button"
              aria-expanded={false}
              onClick={(e) => { e.stopPropagation(); if (captionCut) { setExpanded(true); learn("more"); } }}
              className="mt-1.5 flex w-full items-end gap-1.5 text-left text-[14.5px] leading-snug text-white/95"
            >
              <span ref={captionRef} className="line-clamp-2 min-w-0 flex-1"><RichCaption text={caption} /></span>
              {captionCut && <span className="shrink-0 font-bold text-white">more</span>}
            </button>
          ))}

          {isVideo && (
            <div className="mt-2.5 flex max-w-[75%] items-center gap-1.5 overflow-hidden text-[13px] text-white/85">
              <Music2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Original sound · {name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right-hand actions */}
      <div className="reel-rail reel-dock">
        <div className="relative mb-2.5">
          <Link
            to={`/profile/${profile?.username ?? ""}`}
            onClick={(e) => { e.stopPropagation(); learn("profile"); }}
            aria-label={`${name}'s profile`}
            className="reel-dock-avatar block overflow-hidden rounded-full bg-neutral-700 ring-2 ring-white/90"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-400 to-amber-700 text-lg font-bold text-white">
                {name[0]?.toUpperCase()}
              </span>
            )}
          </Link>
          {(showFollow || justFollowed) && (
            <button
              type="button"
              aria-label={`Follow ${name}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!requireUser("follow people")) return;
                follow(profile!.id);
                learn("follow");
                setJustFollowed(true);
                setTimeout(() => setJustFollowed(false), 1400);
              }}
              className={cn(
                "absolute -bottom-2.5 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full shadow-md transition-colors",
                justFollowed ? "bg-white text-emerald-600" : "bg-primary text-primary-foreground"
              )}
            >
              {justFollowed ? <Check className="h-4 w-4" strokeWidth={3} /> : <Plus className="h-4 w-4" strokeWidth={3} />}
            </button>
          )}
        </div>

        <RailButton
          ariaLabel={liked ? "Unlike" : "Like"}
          pressed={liked}
          onClick={() => setLike(!liked)}
          label={formatCount(likes)}
          icon={<Heart key={String(liked)} className={cn(railIconClass, liked ? "fill-[#ff2d55] text-[#ff2d55] animate-like-pop" : "fill-white/95 text-white/95")} strokeWidth={1.5} />}
        />
        <RailButton
          ariaLabel="Comments"
          onClick={() => { setCommentsOpen(true); learn("openComments"); }}
          label={formatCount(post.comments_count)}
          icon={<MessageCircle className={cn(railIconClass, "fill-white/95 text-white/95")} strokeWidth={1.5} />}
        />
        <RailButton
          ariaLabel={saved ? "Remove from saved" : "Save"}
          pressed={saved}
          onClick={toggleSave}
          label={saved ? "Saved" : "Save"}
          icon={<Bookmark className={cn(railIconClass, saved ? "fill-amber-400 text-amber-400" : "fill-white/95 text-white/95")} strokeWidth={1.5} />}
        />
        <RailButton ariaLabel="Share" onClick={share} label={shares > 0 ? formatCount(shares) : "Share"} icon={<ShareArrow className={cn(railIconClass, "text-white/95")} />} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="More options" onClick={(e) => e.stopPropagation()} className="reel-rail-icon flex h-10 w-12 items-center justify-center rounded-full text-white">
              <MoreHorizontal className="h-7 w-7 drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="left" className="rounded-xl">
            {isOwner ? (
              <>
                <DropdownMenuItem onClick={() => setEditOpen(true)}><Edit className="mr-2 h-4 w-4" /> Edit caption</DropdownMenuItem>
                <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete post</DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => setReportOpen(true)}><Flag className="mr-2 h-4 w-4" /> Report</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Suspense fallback={null}>
        {shareOpen && (
          <Suspense fallback={null}>
            <ShareSheet item={{ kind: "post", post }} open={shareOpen} onOpenChange={setShareOpen} onShared={countShare} />
          </Suspense>
        )}
        {reportOpen && (
          <Suspense fallback={null}>
            <ReportSheet
              target={{ type: "post", id: post.id, owner: post.user_id, snapshot: `${profile?.username ?? "?"}: ${post.caption ?? ""}${post.media_url ? `\n${post.media_url}` : ""}` }}
              open={reportOpen}
              onOpenChange={setReportOpen}
              onReported={() => { setDeleted("Thanks — you won't see this post again"); window.dispatchEvent(new CustomEvent("sooz:feed-next")); }}
            />
          </Suspense>
        )}
        {commentsOpen && <CommentDrawer postId={post.id} postOwnerUsername={profile?.username} open={commentsOpen} onOpenChange={setCommentsOpen} />}
        {editOpen && <EditPostDialog post={{ id: post.id, caption }} open={editOpen} onOpenChange={setEditOpen} onUpdate={setCaption} />}
      </Suspense>
    </div>
  );
});
