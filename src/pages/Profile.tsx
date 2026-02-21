
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Settings, Grid3X3, Bookmark, Heart, Loader2, Camera, Play, X, VideoOff } from "lucide-react";
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
    <div className="pb-20">
      {/* Cover Photo */}
      <div className="relative h-32 bg-gradient-to-br from-secondary/30 to-primary/20 -mx-4 md:rounded-t-xl overflow-hidden">
        {profile.cover_url && (
          <img
            src={profile.cover_url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Profile Info */}
      <div className="px-1">
        {/* Avatar */}
        <div className="relative -mt-12 mb-4">
          <button
            onClick={() => setShowAvatarModal(true)}
            className="group relative"
          >
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-background bg-secondary overflow-hidden">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-4xl">
                  {profile.username[0].toUpperCase()}
                </div>
              )}
              {/* Overlay hint */}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                <Grid3X3 className="w-6 h-6 text-white drop-shadow-md" />
              </div>
            </div>
          </button>
        </div>

        {/* Name and Actions */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">{profile.display_name || profile.username}</h1>
            <p className="text-muted-foreground">@{profile.username}</p>
          </div>

          {isOwnProfile ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-background/50 backdrop-blur-sm border-white/10 hover:bg-white/10"
                onClick={() => setShowEditModal(true)}
              >
                Edit Profile
              </Button>
              <Link
                to="/settings"
                className="flex items-center justify-center h-9 w-9 rounded-md bg-background/50 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <Button
              className={profileData?.isFollowing ? "bg-background/50 backdrop-blur-sm border-white/10" : "bg-primary text-primary-foreground hover:bg-primary/90"}
              size="sm"
              onClick={handleFollow}
            >
              {profileData?.isFollowing ? "Following" : "Follow"}
            </Button>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm mb-2">{profile.bio}</p>
        )}

        {/* Link */}
        {profile.website && (
          <a
            href={profile.website.match(/^https?:\/\//) ? profile.website : `https://${profile.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300 mb-4 transition-colors"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            {profile.website.replace(/^https?:\/\//, '')}
          </a>
        )}

        {/* Stats */}
        <div className="flex gap-6 mb-6">
          <div className="text-center">
            <div className="font-bold">{posts.length}</div>
            <div className="text-xs text-muted-foreground">Posts</div>
          </div>
          <div className="text-center">
            <div className="font-bold">{formatNumber(profileData?.followersCount || 0)}</div>
            <div className="text-xs text-muted-foreground">Followers</div>
          </div>
          <div className="text-center">
            <div className="font-bold">{formatNumber(profileData?.followingCount || 0)}</div>
            <div className="text-xs text-muted-foreground">Following</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-1">
          <button
            onClick={() => setActiveTab("posts")}
            className={cn(
              "flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors",
              activeTab === "posts"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            )}
          >
            <Grid3X3 className="w-5 h-5" />
          </button>
          {isOwnProfile && (
            <>
              <button
                onClick={() => setActiveTab("saved")}
                className={cn(
                  "flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors",
                  activeTab === "saved"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                )}
              >
                <Bookmark className="w-5 h-5" />
              </button>
              <button
                onClick={() => setActiveTab("liked")}
                className={cn(
                  "flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors",
                  activeTab === "liked"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                )}
              >
                <Heart className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Posts Grid */}
        {(isProfileLoading || authLoading || isPostsLoading) ? (
          <div className="grid grid-cols-3 gap-0.5">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-square">
                <Skeleton className="w-full h-full" />
              </div>
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="grid grid-cols-3 gap-0.5">
            {posts.map((post, index) => (
              <div
                key={post.id}
                className="aspect-square bg-muted overflow-hidden relative group cursor-pointer"
                onClick={() => setSelectedPost(post)}
              >
                {post.media_type === 'video' ? (
                  <div className="w-full h-full relative">
                    <GridVideo
                      src={post.media_url || ""}
                      poster={post.thumbnail_url || ""} // Pass poster
                      className="pointer-events-none"
                      priority={index < 6}
                    />
                  </div>
                ) : post.media_url ? (
                  <LazyImage
                    src={post.media_url}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    priority={index < 6}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-card">
                    <Camera className="w-6 h-6" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Camera className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No posts yet</p>
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
            likes: p.is_liked_by_user ? [{ user_id: user?.id }] : [], // Mock like structure for modal
            comments: [{ count: p.comments_count }] // Mock comment structure for modal
          }))}
          initialIndex={posts.findIndex(p => p.id === selectedPost.id)}
          onClose={() => setSelectedPost(null)}
        />
      )}

      {
        showEditModal && (
          <EditProfileModal
            profile={profile}
            onClose={() => setShowEditModal(false)}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ['profile', username] })}
          />
        )
      }

      {/* Avatar Lightbox */}
      <Dialog open={showAvatarModal} onOpenChange={setShowAvatarModal}>
        <DialogContent className="p-0 border-none bg-transparent max-w-lg w-full overflow-hidden shadow-none flex items-center justify-center outline-none">
          <DialogTitle className="sr-only">Profile Picture</DialogTitle>
          <DialogDescription className="sr-only">Viewing profile picture in full size</DialogDescription>
          <div className="relative w-full aspect-square max-h-[80vh] rounded-full overflow-hidden border-4 border-white/20 shadow-2xl">
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
    </div >
  );
};

export default Profile;
