
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link, useLocation, useSearchParams } from "react-router-dom";
import { Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Settings, Bookmark, Heart, Loader2, Camera, Play, VideoOff, MessageCircle, Repeat2, Flag, History } from "lucide-react";
import { ReportSheet } from "@/components/safety/ReportSheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import EditProfileModal from "@/components/profile/EditProfileModal";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LazyVideo } from "@/components/feed/LazyVideo";
import { ReelsViewer } from "@/components/reels/ReelsViewer";
import { TextTile, TikTokTile } from "@/components/reels/GridTiles";
import { fetchProfileTab, type ProfileTab } from "@/services/api/profileTabs";
import { openDirectChat } from "@/services/api/chat";
import type { FeedItem } from "@/services/api/feed";
import type { TikTokVideo } from "@/services/api/tiktok";
import { useVideoCache } from "@/store/useVideoCache";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

// Optimized video component for grid view with hover-to-play
const GridVideo = ({ src, poster, className, priority = false }: { src: string, poster?: string, className?: string, priority?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { getCachedUrl } = useVideoCache();
  const cachedSrc = getCachedUrl(src) || src;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const finalPoster = poster;
  const videoSrc = useMemo(() => {
    if (!cachedSrc) return "";
    if (finalPoster) return cachedSrc;
    return cachedSrc.includes('#') ? cachedSrc : `${cachedSrc}#t=0.001`;
  }, [cachedSrc, finalPoster]);

  useEffect(() => {
    if (videoReady || hasError) return;
    const timer = setTimeout(() => { if (!videoReady && !finalPoster) setHasError(true); }, 30000);
    return () => clearTimeout(timer);
  }, [videoReady, finalPoster, hasError]);

  useEffect(() => { if (videoReady && hasError) setHasError(false); }, [videoReady]);

  return (
    <div
      className={cn("w-full h-full relative bg-secondary overflow-hidden group", className)}
      onMouseEnter={() => { if (videoRef.current && !hasError) videoRef.current.play().catch(() => { }); }}
      onMouseLeave={() => { if (videoRef.current && !hasError) { videoRef.current.pause(); videoRef.current.currentTime = 0; } }}
    >
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary text-muted-foreground z-30">
          <VideoOff className="w-8 h-8 opacity-50 mb-1" />
          <span className="text-[10px] uppercase font-medium tracking-wider opacity-50">Unavailable</span>
        </div>
      )}
      {finalPoster && !hasError && (
        <img src={finalPoster} alt="" className={cn("absolute inset-0 w-full h-full object-cover transition-opacity duration-300 z-10", imageLoaded ? "opacity-100" : "opacity-0")} onLoad={() => setImageLoaded(true)} onError={(e) => { e.currentTarget.style.display = 'none'; }} loading={priority ? "eager" : "lazy"} />
      )}
      <video ref={videoRef} src={videoSrc} className={cn("w-full h-full object-cover bg-transparent relative z-20 transition-opacity duration-500", (videoReady && !hasError) ? "opacity-100" : "opacity-0")} muted loop playsInline preload={priority ? "auto" : "metadata"} disablePictureInPicture onLoadedData={() => setVideoReady(true)} onError={() => setHasError(true)} />
    </div>
  );
};

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  website: string | null;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

/** A reposted TikTok in the grid (TikTok gives no picture, so its caption makes the tile). */
const TAB_LABEL: Record<ProfileTab, string> = { posts: "Posts", reposts: "Reposts", saved: "Saved", liked: "Liked" };
const EMPTY: Record<ProfileTab, { icon: typeof Camera; title: string; mine: string; theirs: string }> = {
  posts: { icon: Camera, title: "No posts yet", mine: "Share moments with your community.", theirs: "Their posts will show up here." },
  reposts: { icon: Repeat2, title: "No reposts yet", mine: "Videos you repost from the Share button show up here.", theirs: "Videos they repost will show up here." },
  saved: { icon: Bookmark, title: "Nothing saved yet", mine: "Tap Save on a post to keep it here.", theirs: "" },
  liked: { icon: Heart, title: "Nothing liked yet", mine: "Videos and posts you heart show up here.", theirs: "" },
};

const Profile = () => {
  const { username } = useParams<{ username: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  // The full-screen player (?watch=N) — in the address, so the phone's back gesture closes it.
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const watchParam = searchParams.get("watch");
  const watching = watchParam !== null && /^\d+$/.test(watchParam) ? Number(watchParam) : null;
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      if (!username) return null;
      if (username === "me" && !user) return null;
      let query = supabase.from("profiles").select("*");
      if (username === "me") { if (!user) throw new Error("Not authenticated"); query = query.eq("id", user.id); }
      else query = query.eq("username", username);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [followersObj, followingObj, followStatus] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", data.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", data.id),
        user && user.id !== data.id ? supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", data.id).maybeSingle() : Promise.resolve({ data: null })
      ]);
      return { ...data, website: (data as any).website || null, followersCount: followersObj.count || 0, followingCount: followingObj.count || 0, isFollowing: !!followStatus.data };
    },
    enabled: !!username && (username !== "me" || !!user),
    staleTime: 1000 * 60 * 5,
  });

  const { data: items = [], isLoading: isPostsLoading } = useQuery({
    queryKey: ['profile-tab', profileData?.id, activeTab, user?.id],
    queryFn: () => fetchProfileTab(profileData!.id, activeTab, user?.id),
    enabled: !!profileData?.id,
    staleTime: 1000 * 30,
  });

  const openViewer = (index: number) => {
    setSearchParams((p) => { p.set("watch", String(index)); return p; }, { state: { soozViewer: true } });
  };
  const closeViewer = () => {
    if ((location.state as { soozViewer?: boolean } | null)?.soozViewer) navigate(-1);
    else setSearchParams((p) => { p.delete("watch"); return p; }, { replace: true });
  };

  const profile = profileData;
  const isOwnProfile = user?.id === profile?.id;
  const [reporting, setReporting] = useState(false);

  const handleFollow = async () => {
    if (!user || !profile) { navigate("/auth"); return; }
    queryClient.setQueryData(['profile', username], (old: any) => ({ ...old, isFollowing: !old.isFollowing, followersCount: old.isFollowing ? old.followersCount - 1 : old.followersCount + 1 }));
    if (profileData?.isFollowing) await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
    else await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
    queryClient.invalidateQueries({ queryKey: ['profile', username] });
  };

  const handleMessage = async () => {
    if (!user || !profile) { navigate("/auth"); return; }
    try { navigate(`/chat?c=${await openDirectChat(profile.id)}`); }
    catch { toast.error("Couldn't open the chat"); }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  if (!profile) {
    // Signed out on "You": invite them in instead of showing an empty page.
    if (username === "me" && !authLoading && !user) {
      return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-8 text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-4xl">🙏</div>
          <h1 className="font-display text-2xl font-bold">Your SOOZ profile</h1>
          <p className="mt-2 max-w-xs text-muted-foreground">Sign in to share your faith, save posts and follow believers you love.</p>
          <Button className="mt-6 h-12 w-full max-w-xs rounded-full text-[15px] font-bold" onClick={() => navigate("/auth")}>Sign in or create account</Button>
        </div>
      );
    }
    if (authLoading || isProfileLoading) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
        <h1 className="font-display text-xl font-bold">This account doesn't exist</h1>
        <p className="mt-2 text-muted-foreground">The link may be broken, or the account may have been removed.</p>
        <Button variant="secondary" className="mt-6 rounded-full" onClick={() => navigate("/")}>Back to the feed</Button>
      </div>
    );
  }

  const tabs: ProfileTab[] = isOwnProfile ? ["posts", "reposts", "saved", "liked"] : ["posts", "reposts"];
  const empty = EMPTY[activeTab];

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Magazine cover header */}
      <div className="relative flex flex-col items-center pt-[calc(4rem+env(safe-area-inset-top,0px))] pb-6 px-5">
        {/* Settings icon */}
        <div className="absolute top-[calc(1rem+env(safe-area-inset-top,0px))] right-4 z-10">
          {isOwnProfile && (
            <div className="flex gap-2">
              <Link to="/history" aria-label="Watch history" className="flex items-center justify-center h-9 w-9 rounded-full bg-secondary/60 backdrop-blur-md hover:bg-secondary transition-all">
                <History className="w-4 h-4" />
              </Link>
              <Link to="/settings" aria-label="Settings" className="flex items-center justify-center h-9 w-9 rounded-full bg-secondary/60 backdrop-blur-md hover:bg-secondary transition-all">
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          )}
          {!isOwnProfile && profile && (
            <button type="button" aria-label={`Report ${profile.username}`} onClick={() => setReporting(true)} className="flex items-center justify-center h-9 w-9 rounded-full bg-secondary/60 backdrop-blur-md hover:bg-secondary transition-all">
              <Flag className="w-4 h-4" />
            </button>
          )}
        </div>
        {reporting && profile && (
          <ReportSheet
            target={{ type: "user", id: profile.id, owner: profile.id, snapshot: `@${profile.username}${profile.display_name ? ` (${profile.display_name})` : ""}${profile.bio ? `: ${profile.bio}` : ""}` }}
            open={reporting}
            onOpenChange={setReporting}
          />
        )}

        {/* Massive centered avatar */}
        <button onClick={() => setShowAvatarModal(true)} className="group">
          <div className="w-36 h-36 md:w-44 md:h-44 rounded-full border-4 border-background bg-secondary overflow-hidden shadow-2xl transition-transform group-hover:scale-[1.02]">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-5xl font-black">
                {profile.username[0].toUpperCase()}
              </div>
            )}
          </div>
        </button>

        {/* Name — huge display font */}
        <h1 className="text-3xl md:text-4xl font-display font-bold mt-4 tracking-tight text-center">
          {profile.display_name || profile.username}
        </h1>
        <span className="text-[13px] text-muted-foreground mt-0.5">@{profile.username}</span>

        {/* Bio — italic serif */}
        {profile.bio && (
          <p className="text-[14px] font-serif italic leading-relaxed text-foreground/70 text-center max-w-xs mt-2">
            {profile.bio}
          </p>
        )}

        {profile.website && (
          <a href={profile.website.match(/^https?:\/\//) ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[13px] font-bold text-primary mt-1.5 hover:underline">
            <LinkIcon className="w-3.5 h-3.5" />
            {profile.website.replace(/^https?:\/\//, '')}
          </a>
        )}

        {/* Stats — single line */}
        <p className="text-[14px] text-muted-foreground mt-4">
          <span className="font-bold text-foreground">{formatNumber(profileData?.followersCount || 0)}</span> followers
          <span className="mx-2 text-muted-foreground/30">·</span>
          <span className="font-bold text-foreground">{formatNumber(profileData?.followingCount || 0)}</span> following
        </p>

        {/* Action button */}
        <div className="mt-5">
          {isOwnProfile ? (
            <Button onClick={() => setShowEditModal(true)} variant="secondary" className="h-10 px-8 rounded-full font-bold">Edit Profile</Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleFollow} className={cn("h-10 px-8 rounded-full font-bold transition-all active:scale-95", profileData?.isFollowing ? "bg-secondary text-foreground hover:bg-secondary/80" : "bg-primary text-primary-foreground hover:opacity-90")}>
                {profileData?.isFollowing ? "Following" : "Follow"}
              </Button>
              <Button variant="secondary" onClick={handleMessage} className="h-10 rounded-full px-6 font-bold active:scale-95">
                <MessageCircle className="mr-1.5 h-4 w-4" /> Message
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Pill toggle tabs */}
      <div className="mt-8 px-5">
        <div className="flex gap-2 bg-secondary/50 p-1 rounded-full">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-full py-2 text-[13px] font-bold transition-all",
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "reposts" && <Repeat2 className="h-3.5 w-3.5" />}
              {TAB_LABEL[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Posts Grid — 2 column masonry-style */}
      <div className="px-2 mt-4">
        {(isProfileLoading || authLoading || isPostsLoading) ? (
          <div className="grid grid-cols-2 gap-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={cn("bg-secondary/30 rounded-xl overflow-hidden", i % 3 === 0 ? "aspect-[3/4]" : "aspect-square")}>
                <Skeleton className="w-full h-full rounded-none" />
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 gap-1">
            {items.map((item: FeedItem, index) => {
              const post = item.kind === "post" ? item.post : null;
              return (
                <motion.button
                  type="button"
                  key={item.key}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(index, 12) * 0.03 }}
                  className={cn(
                    "group relative block w-full cursor-pointer overflow-hidden rounded-xl bg-secondary/30 text-left",
                    index % 3 === 0 ? "aspect-[3/4]" : "aspect-square"
                  )}
                  onClick={() => openViewer(index)}
                  aria-label={item.kind === "tiktok" ? `TikTok by ${item.video.author_name || item.video.author_handle || "a creator"}` : post?.caption || "Post"}
                >
                  {item.kind === "tiktok" ? (
                    <>
                      <TikTokTile video={item.video} />
                      <Play className="absolute right-2 top-2 z-30 h-4 w-4 fill-white/20 text-white drop-shadow-md" />
                    </>
                  ) : post!.media_type === "video" ? (
                    <div className="relative h-full w-full">
                      <GridVideo src={post!.media_url || ""} poster={post!.thumbnail_url || ""} className="pointer-events-none" priority={index < 6} />
                      <div className="absolute right-2 top-2 z-30">
                        <Play className="h-4 w-4 fill-white/20 text-white drop-shadow-md" />
                      </div>
                    </div>
                  ) : post!.media_url ? (
                    <img src={post!.media_url} alt="" loading={index < 6 ? "eager" : "lazy"} decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <TextTile text={post!.caption || ""} />
                  )}
                  {post && (
                    <div className="pointer-events-none absolute inset-0 hidden items-center justify-center gap-3 bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:flex">
                      <div className="flex items-center gap-1 text-sm font-bold text-white">
                        <Heart className="h-4 w-4 fill-white" />
                        <span>{formatNumber(post.likes_count)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-bold text-white">
                        <MessageCircle className="h-4 w-4 fill-white" />
                        <span>{formatNumber(post.comments_count)}</span>
                      </div>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="py-24 text-center">
            <empty.icon className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
            <h3 className="text-lg font-bold">{empty.title}</h3>
            {(isOwnProfile ? empty.mine : empty.theirs) && <p className="mt-1 text-sm text-muted-foreground">{isOwnProfile ? empty.mine : empty.theirs}</p>}
          </div>
        )}
      </div>

      {watching !== null && items.length > 0 && (
        <ReelsViewer
          key={activeTab}
          items={items}
          startIndex={watching}
          title={activeTab === "posts" ? undefined : TAB_LABEL[activeTab]}
          onClose={closeViewer}
        />
      )}

      {showEditModal && (
        <EditProfileModal profile={profile} onClose={() => setShowEditModal(false)} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['profile', username] })} />
      )}

      <Dialog open={showAvatarModal} onOpenChange={setShowAvatarModal}>
        <DialogContent className="p-0 border-none bg-black/90 max-w-[95vw] sm:max-w-lg overflow-hidden shadow-none flex items-center justify-center outline-none">
          <DialogTitle className="sr-only">Profile Picture</DialogTitle>
          <DialogDescription className="sr-only">Viewing profile picture in full size</DialogDescription>
          <div className="relative w-full aspect-square max-h-[80vh] rounded-3xl overflow-hidden">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-9xl">
                {profile.username[0].toUpperCase()}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
