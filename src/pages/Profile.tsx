
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
// ... imports ...
import { Skeleton } from "@/components/ui/skeleton";

// Optimized video component for grid view with hover-to-play
const GridVideo = ({ src, poster, className, priority = false }: { src: string, poster?: string, className?: string, priority?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { getCachedUrl } = useVideoCache();
  const cachedSrc = getCachedUrl(src) || src;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const finalPoster = poster; // Only use explicit poster, stop guessing .jpg to avoid 404s

  // Add a small seek time to the video URL to force mobile browsers 
  // to render the first frame as a "poster" if an image is missing.
  const videoSrc = useMemo(() => {
    if (!cachedSrc) return "";
    if (finalPoster) return cachedSrc; // If we have a poster, no need for the trick

    // Add #t=0.001 to force frame rendering
    return cachedSrc.includes('#') ? cachedSrc : `${cachedSrc}#t=0.001`;
  }, [cachedSrc, finalPoster]);

  // Timeout Fallback: If video takes too long, only show error if it's truly stuck.
  // 30s is more realistic for mobile video metadata fetching.
  useEffect(() => {
    if (videoReady || hasError) return;

    const timer = setTimeout(() => {
      // On mobile, videoReady might be delayed by the browser. 
      // We only show error if we have NO poster and NO video after 30s.
      if (!videoReady && !finalPoster) {
        setHasError(true);
      }
    }, 30000);

    return () => clearTimeout(timer);
  }, [videoReady, finalPoster, hasError]);

  // If video eventually loads after a delay, clear the error
  useEffect(() => {
    if (videoReady && hasError) {
      setHasError(false);
    }
  }, [videoReady]);

  return (
    <div
      className={cn("w-full h-full relative bg-gray-200 dark:bg-gray-800 overflow-hidden group", className)}
      onMouseEnter={() => {
        if (videoRef.current && !hasError) {
          videoRef.current.play().catch(() => { });
        }
      }}
      onMouseLeave={() => {
        if (videoRef.current && !hasError) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
    >
      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 text-muted-foreground z-30">
          <VideoOff className="w-8 h-8 opacity-50 mb-1" />
          <span className="text-[10px] uppercase font-medium tracking-wider opacity-50">Unavailable</span>
        </div>
      )}

      {/* 1. Thumbnail Image Layer (Middle) */}
      {finalPoster && !hasError && (
        <img
          src={finalPoster}
          alt=""
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300 z-10",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            // If the guessed image 404s, ensure we don't show a broken icon
            e.currentTarget.style.display = 'none';
          }}
          loading={priority ? "eager" : "lazy"}
        />
      )}

      {/* 2. Video Player Layer (Top) */}
      <video
        ref={videoRef}
        src={videoSrc}
        className={cn(
          "w-full h-full object-cover bg-transparent relative z-20 transition-opacity duration-500",
          (videoReady && !hasError) ? "opacity-100" : "opacity-0"
        )}
        muted
        loop
        playsInline
        preload={priority ? "auto" : "metadata"}
        disablePictureInPicture
        onLoadedData={() => setVideoReady(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
};

// ... inside Profile component rendered output ...

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
  thumbnail_url: string | null; // Added field
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 1. Fetch Profile Data
  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      if (!username) return null;
      if (username === "me" && !user) {
        // If "me" and no user, we can't fetch.
        // But useAuth loading should be handled.
        return null;
      }

      let query = supabase.from("profiles").select("*");
      if (username === "me") {
        if (!user) throw new Error("Not authenticated");
        query = query.eq("id", user.id);
      } else {
        query = query.eq("username", username);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;

      // Fetch counts in parallel
      const [followersObj, followingObj, followStatus] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", data.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", data.id),
        user && user.id !== data.id
          ? supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", data.id).maybeSingle()
          : Promise.resolve({ data: null })
      ]);

      return {
        ...data,
        website: (data as any).website || null,
        followersCount: followersObj.count || 0,
        followingCount: followingObj.count || 0,
        isFollowing: !!followStatus.data
      };
    },
    enabled: !!username && (username !== "me" || !!user),
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  // 2. Fetch Posts
  const { data: posts = [], isLoading: isPostsLoading } = useQuery({
    queryKey: ['profile-posts', profileData?.id, activeTab],
    queryFn: async () => {
      if (!profileData?.id) return [];

      let rawPosts: any[] = [];
      if (activeTab === 'posts') {
        const { data } = await supabase.from("posts")
          .select(`*, likes:likes(count), comments:comments(count)`)
          .eq("user_id", profileData.id)
          .order("created_at", { ascending: false });
        rawPosts = data || [];
      } else if (activeTab === 'saved') {
        const { data } = await supabase.from("bookmarks")
          .select(`post:posts(*, likes:likes(count), comments:comments(count))`)
          .eq("user_id", profileData.id)
          .order("created_at", { ascending: false });
        // @ts-ignore
        rawPosts = data?.map(item => item.post).filter(Boolean) || [];
      } else if (activeTab === 'liked') {
        const { data } = await supabase.from("likes")
          .select(`post:posts(*, likes:likes(count), comments:comments(count))`)
          .eq("user_id", profileData.id)
          .order("created_at", { ascending: false });
        // @ts-ignore
        rawPosts = data?.map(item => item.post).filter(Boolean) || [];
      }

      // Check liked status
      let likedPostIds = new Set<string>();
      if (user && rawPosts.length > 0) {
        const postIds = rawPosts.map(p => p.id);
        const { data: likesData } = await supabase
          .from("likes").select("post_id").eq("user_id", user.id).in("post_id", postIds);
        likesData?.forEach(l => likedPostIds.add(l.post_id));
      }

      return rawPosts.map(p => ({
        id: p.id,
        media_url: p.media_url,
        media_type: p.media_type,
        caption: p.caption,
        created_at: p.created_at,
        user_id: p.user_id,
        likes_count: p.likes?.[0]?.count || 0,
        comments_count: p.comments?.[0]?.count || 0,
        is_liked_by_user: likedPostIds.has(p.id)
      })) as Post[];
    },
    enabled: !!profileData?.id,
    staleTime: 1000 * 60 * 5,
  });

  const profile = profileData;
  const isOwnProfile = user?.id === profile?.id;

  // Handle side effects (redirect if not found)
  useEffect(() => {
    if (!isProfileLoading && !profileData && username) {
      // Only redirect if we tried to load and failed/empty
      // But maybe wait a bit or handle graceful 'Not Found' UI?
      // For now, keep existing behavior but be careful not to loop.
      // navigate("/"); 
    }
  }, [profileData, isProfileLoading, username, navigate]);


  const handleFollow = async () => {
    if (!user || !profile) {
      navigate("/auth");
      return;
    }

    // Optimistic Update
    const oldData = queryClient.getQueryData(['profile', username]);
    // Toggle state locally
    queryClient.setQueryData(['profile', username], (old: any) => ({
      ...old,
      isFollowing: !old.isFollowing,
      followersCount: old.isFollowing ? old.followersCount - 1 : old.followersCount + 1
    }));

    if (profileData?.isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
    }
    // Invalidate to ensure consistency (optional, or just rely on optimistic)
    queryClient.invalidateQueries({ queryKey: ['profile', username] });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  // Removed blocking spinner to allow instant navigation
  // if (loading) {... }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Premium Cover & Avatar Header */}
      <div className="relative">
        <div className="h-44 md:h-60 bg-gradient-to-br from-indigo-950/40 via-background to-violet-950/20 overflow-hidden relative border-b border-white/5">
          {profile.cover_url ? (
            <img
              src={profile.cover_url}
              alt="Cover"
              className="w-full h-full object-cover opacity-60 transition-opacity duration-700"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]" />
          )}

          {/* Top Actions Overlay */}
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            {isOwnProfile && (
              <Link
                to="/settings"
                className="flex items-center justify-center h-10 w-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all active:scale-95"
              >
                <Settings className="w-5 h-5" />
              </Link>
            )}
          </div>
        </div>

        {/* Profile Info Overlay - Standard "Threads" Layout */}
        <div className="px-6 -mt-10 relative z-10">
          <div className="flex flex-col gap-5">
            <div className="flex items-end justify-between">
              <button
                onClick={() => setShowAvatarModal(true)}
                className="group relative"
              >
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2.5rem] border-4 border-background bg-secondary/80 backdrop-blur-sm overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.username}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-4xl font-black">
                      {profile.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </button>

              <div className="flex gap-2 mb-2">
                {isOwnProfile ? (
                  <Button
                    onClick={() => setShowEditModal(true)}
                    className="h-10 px-6 rounded-full bg-foreground text-background font-bold hover:opacity-90 transition-all active:scale-95 shadow-lg"
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <Button
                    onClick={handleFollow}
                    className={cn(
                      "h-10 px-8 rounded-full font-bold transition-all active:scale-95 shadow-lg",
                      profileData?.isFollowing
                        ? "bg-secondary/80 backdrop-blur-sm border border-white/10 text-foreground"
                        : "bg-primary text-white hover:opacity-90"
                    )}
                  >
                    {profileData?.isFollowing ? "Following" : "Follow"}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tighter sm:text-4xl">
                {profile.display_name || profile.username}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium text-sm">@{profile.username}</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span className="text-xs bg-secondary/80 border border-white/5 py-0.5 px-2 rounded-full font-bold text-muted-foreground/70">
                  sooz.app
                </span>
              </div>
            </div>

            {profile.bio && (
              <p className="text-[15px] leading-relaxed max-w-xl text-foreground/90 font-medium">
                {profile.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {profile.website && (
                <a
                  href={profile.website.match(/^https?:\/\//) ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-bold text-primary hover:opacity-80 transition-opacity"
                >
                  <LinkIcon className="w-4 h-4" />
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}

              <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
                <button className="hover:text-foreground transition-colors">
                  <span className="text-foreground font-bold">{formatNumber(profileData?.followersCount || 0)}</span> followers
                </button>
                <button className="hover:text-foreground transition-colors">
                  <span className="text-foreground font-bold">{formatNumber(profileData?.followingCount || 0)}</span> following
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - Modern Minimalist */}
      <div className="mt-8 px-4">
        <div className="flex border-b border-white/5">
          <button
            onClick={() => setActiveTab("posts")}
            className={cn(
              "flex-1 py-4 text-sm font-bold transition-all relative",
              activeTab === "posts" ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
          >
            Posts
            {activeTab === "posts" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full animate-in fade-in slide-in-from-bottom-1 duration-300" />
            )}
          </button>
          {isOwnProfile && (
            <>
              <button
                onClick={() => setActiveTab("saved")}
                className={cn(
                  "flex-1 py-4 text-sm font-bold transition-all relative",
                  activeTab === "saved" ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                Saved
                {activeTab === "saved" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full animate-in fade-in slide-in-from-bottom-1 duration-300" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("liked")}
                className={cn(
                  "flex-1 py-4 text-sm font-bold transition-all relative",
                  activeTab === "liked" ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                Liked
                {activeTab === "liked" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full animate-in fade-in slide-in-from-bottom-1 duration-300" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Posts Grid - Refined with better spacing and high-end feel */}
      <div className="px-[1px] mt-1">
        {(isProfileLoading || authLoading || isPostsLoading) ? (
          <div className="grid grid-cols-3 gap-[1px]">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="aspect-square bg-white/[0.02]">
                <Skeleton className="w-full h-full rounded-none" />
              </div>
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="grid grid-cols-3 gap-[1px]">
            {posts.map((post, index) => (
              <div
                key={post.id}
                className="aspect-square bg-secondary/20 overflow-hidden relative group cursor-pointer"
                onClick={() => setSelectedPost(post)}
              >
                {post.media_type === 'video' ? (
                  <div className="w-full h-full relative">
                    <GridVideo
                      src={post.media_url || ""}
                      poster={post.thumbnail_url || ""}
                      className="pointer-events-none"
                      priority={index < 9}
                    />
                    <div className="absolute top-2 right-2 z-30">
                      <Play className="w-4 h-4 text-white drop-shadow-md fill-white/20" />
                    </div>
                  </div>
                ) : post.media_url ? (
                  <LazyImage
                    src={post.media_url}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    priority={index < 9}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/20 bg-card">
                    <Camera className="w-8 h-8" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 pointer-events-none" />

                {/* Desktop Hover Stats */}
                <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden md:flex pointer-events-none">
                  <div className="flex items-center gap-1.5 text-white font-bold">
                    <Heart className="w-5 h-5 fill-white" />
                    <span>{formatNumber(post.likes_count)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white font-bold">
                    <MessageCircle className="w-5 h-5 fill-white" />
                    <span>{formatNumber(post.comments_count)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center">
            <div className="w-20 h-20 rounded-full bg-secondary/30 flex items-center justify-center mx-auto mb-6">
              <Camera className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-xl font-bold">No posts yet</h3>
            <p className="text-muted-foreground mt-2 max-w-[200px] mx-auto text-sm">
              Capture and share moments with your community.
            </p>
          </div>
        )}
      </div>

      {/* Full-screen Feed Modal */}
      {selectedPost && (
        <VideoFeedModal
          posts={posts.map(p => ({
            ...p,
            profiles: {
              username: profile.username,
              display_name: profile.display_name,
              avatar_url: profile.avatar_url
            },
            likes: p.is_liked_by_user ? [{ user_id: user?.id }] : [],
            comments: [{ count: p.comments_count }]
          }))}
          initialIndex={posts.findIndex(p => p.id === selectedPost.id)}
          onClose={() => setSelectedPost(null)}
        />
      )}

      {showEditModal && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onUpdate={() => queryClient.invalidateQueries({ queryKey: ['profile', username] })}
        />
      )}

      {/* Avatar Lightbox */}
      <Dialog open={showAvatarModal} onOpenChange={setShowAvatarModal}>
        <DialogContent className="p-0 border-none bg-black/90 max-w-[95vw] sm:max-w-lg overflow-hidden shadow-none flex items-center justify-center outline-none">
          <DialogTitle className="sr-only">Profile Picture</DialogTitle>
          <DialogDescription className="sr-only">Viewing profile picture in full size</DialogDescription>
          <div className="relative w-full aspect-square max-h-[80vh] rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-full h-full object-cover"
              />
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
