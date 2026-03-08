
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Settings, Grid3X3, Bookmark, Heart, Loader2, Camera, Play, X, VideoOff, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import EditProfileModal from "@/components/profile/EditProfileModal";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PostCard } from "@/components/feed/PostCard";
import { LazyImage } from "@/components/feed/LazyImage";
import { LazyVideo } from "@/components/feed/LazyVideo";
import { VideoFeedModal } from "@/components/feed/VideoFeedModal";
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

interface Post {
  id: string;
  media_url: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked_by_user: boolean;
  user_id: string;
}

const Profile = () => {
  const { username } = useParams<{ username: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "liked">("posts");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

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

  const { data: posts = [], isLoading: isPostsLoading } = useQuery({
    queryKey: ['profile-posts', profileData?.id, activeTab],
    queryFn: async () => {
      if (!profileData?.id) return [];
      let rawPosts: any[] = [];
      if (activeTab === 'posts') { const { data } = await supabase.from("posts").select(`*, likes:likes(count), comments:comments(count)`).eq("user_id", profileData.id).order("created_at", { ascending: false }); rawPosts = data || []; }
      else if (activeTab === 'saved') { const { data } = await supabase.from("bookmarks").select(`post:posts(*, likes:likes(count), comments:comments(count))`).eq("user_id", profileData.id).order("created_at", { ascending: false }); // @ts-ignore
        rawPosts = data?.map(item => item.post).filter(Boolean) || []; }
      else if (activeTab === 'liked') { const { data } = await supabase.from("likes").select(`post:posts(*, likes:likes(count), comments:comments(count))`).eq("user_id", profileData.id).order("created_at", { ascending: false }); // @ts-ignore
        rawPosts = data?.map(item => item.post).filter(Boolean) || []; }
      let likedPostIds = new Set<string>();
      if (user && rawPosts.length > 0) {
        const postIds = rawPosts.map(p => p.id);
        const { data: likesData } = await supabase.from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds);
        likesData?.forEach(l => likedPostIds.add(l.post_id));
      }
      return rawPosts.map(p => ({ id: p.id, media_url: p.media_url, media_type: p.media_type, caption: p.caption, created_at: p.created_at, user_id: p.user_id, likes_count: p.likes?.[0]?.count || 0, comments_count: p.comments?.[0]?.count || 0, is_liked_by_user: likedPostIds.has(p.id) })) as Post[];
    },
    enabled: !!profileData?.id,
    staleTime: 1000 * 60 * 5,
  });

  const profile = profileData;
  const isOwnProfile = user?.id === profile?.id;

  const handleFollow = async () => {
    if (!user || !profile) { navigate("/auth"); return; }
    queryClient.setQueryData(['profile', username], (old: any) => ({ ...old, isFollowing: !old.isFollowing, followersCount: old.isFollowing ? old.followersCount - 1 : old.followersCount + 1 }));
    if (profileData?.isFollowing) await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
    else await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
    queryClient.invalidateQueries({ queryKey: ['profile', username] });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  if (!profile) return null;

  const tabs = [
    { id: "posts" as const, label: "Posts" },
    ...(isOwnProfile ? [
      { id: "saved" as const, label: "Saved" },
      { id: "liked" as const, label: "Liked" },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Magazine cover header */}
      <div className="relative flex flex-col items-center pt-[calc(4rem+env(safe-area-inset-top,0px))] pb-6 px-5">
        {/* Settings icon */}
        <div className="absolute top-[calc(1rem+env(safe-area-inset-top,0px))] right-4 z-10">
          {isOwnProfile && (
            <Link to="/settings" className="flex items-center justify-center h-9 w-9 rounded-full bg-secondary/60 backdrop-blur-md hover:bg-secondary transition-all">
              <Settings className="w-4 h-4" />
            </Link>
          )}
        </div>

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

          {/* Bio — serif */}
          {profile.bio && (
            <p className="text-[14px] font-serif leading-relaxed text-foreground/80 text-center max-w-xs mt-2 px-4">
              {profile.bio}
            </p>
          )}

          {profile.website && (
            <a
              href={profile.website.match(/^https?:\/\//) ? profile.website : `https://${profile.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[13px] font-bold text-primary mt-1.5 hover:underline"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              {profile.website.replace(/^https?:\/\//, '')}
            </a>
          )}

          {/* Stats — large stacked numbers */}
          <div className="flex items-center gap-10 mt-5">
            <div className="text-center">
              <div className="text-2xl font-display font-bold">{formatNumber(profileData?.followersCount || 0)}</div>
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-display font-bold">{formatNumber(profileData?.followingCount || 0)}</div>
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">following</div>
            </div>
          </div>

          {/* Action button */}
          <div className="mt-5">
            {isOwnProfile ? (
              <Button
                onClick={() => setShowEditModal(true)}
                variant="secondary"
                className="h-10 px-8 rounded-full font-bold"
              >
                Edit Profile
              </Button>
            ) : (
              <Button
                onClick={handleFollow}
                className={cn(
                  "h-10 px-8 rounded-full font-bold transition-all active:scale-95",
                  profileData?.isFollowing
                    ? "bg-secondary text-foreground hover:bg-secondary/80"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                )}
              >
                {profileData?.isFollowing ? "Following" : "Follow"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Pill toggle tabs */}
      <div className="mt-8 px-5">
        <div className="flex gap-2 bg-secondary/50 p-1 rounded-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 py-2 text-[13px] font-bold rounded-full transition-all",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
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
        ) : posts.length > 0 ? (
          <div className="grid grid-cols-2 gap-1">
            {posts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                className={cn(
                  "rounded-xl overflow-hidden relative group cursor-pointer bg-secondary/30",
                  index % 3 === 0 ? "aspect-[3/4]" : "aspect-square"
                )}
                onClick={() => setSelectedPost(post)}
              >
                {post.media_type === 'video' ? (
                  <div className="w-full h-full relative">
                    <GridVideo src={post.media_url || ""} poster={post.thumbnail_url || ""} className="pointer-events-none" priority={index < 6} />
                    <div className="absolute top-2 right-2 z-30">
                      <Play className="w-4 h-4 text-white drop-shadow-md fill-white/20" />
                    </div>
                  </div>
                ) : post.media_url ? (
                  <LazyImage src={post.media_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" priority={index < 6} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/20 bg-card">
                    <Camera className="w-8 h-8" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 pointer-events-none" />
                <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden md:flex pointer-events-none">
                  <div className="flex items-center gap-1 text-white font-bold text-sm">
                    <Heart className="w-4 h-4 fill-white" />
                    <span>{formatNumber(post.likes_count)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-white font-bold text-sm">
                    <MessageCircle className="w-4 h-4 fill-white" />
                    <span>{formatNumber(post.comments_count)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center">
            <Camera className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-bold">No posts yet</h3>
            <p className="text-muted-foreground mt-1 text-sm">Share moments with your community.</p>
          </div>
        )}
      </div>

      {selectedPost && (
        <VideoFeedModal
          posts={posts.map(p => ({ ...p, profiles: { username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url }, likes: p.is_liked_by_user ? [{ user_id: user?.id }] : [], comments: [{ count: p.comments_count }] }))}
          initialIndex={posts.findIndex(p => p.id === selectedPost.id)}
          onClose={() => setSelectedPost(null)}
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
