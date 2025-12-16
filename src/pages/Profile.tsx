
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Settings, Grid3X3, Bookmark, Heart, Loader2, Camera, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import EditProfileModal from "@/components/profile/EditProfileModal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PostCard } from "@/components/feed/PostCard";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  website: string | null;
}

interface Post {
  id: string;
  media_url: string | null;
  media_type: string | null;
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

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "liked">("posts");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const isOwnProfile = user?.id === profile?.id;

  useEffect(() => {
    if (username) {
      fetchProfile();
    }
  }, [username, user, authLoading]);

  // Fetch posts based on tab
  useEffect(() => {
    if (profile) {
      fetchPosts();
    }
  }, [activeTab, profile, user]);

  const fetchProfile = async () => {
    if (!username) return;

    if (username === "me" && authLoading) return;

    setLoading(true);

    let query = supabase.from("profiles").select("*");

    if (username === "me") {
      if (!user) {
        navigate("/auth");
        return;
      }
      query = query.eq("id", user.id);
    } else {
      query = query.eq("username", username);
    }

    const { data: profileData, error: profileError } = await query.maybeSingle();

    if (profileError || !profileData) {
      toast.error("Profile not found");
      navigate("/");
      return;
    }

    setProfile(profileData);

    // Fetch counts
    const { count: followers } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profileData.id);
    setFollowersCount(followers || 0);

    const { count: following } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profileData.id);
    setFollowingCount(following || 0);

    if (user && user.id !== profileData.id) {
      const { data: followData } = await supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", profileData.id).maybeSingle();
      setIsFollowing(!!followData);
    }

    setLoading(false);
  };

  const fetchPosts = async () => {
    if (!profile) return;

    try {
      let rawPosts: any[] = [];

      if (activeTab === 'posts') {
        const { data } = await supabase
          .from("posts")
          .select(`
            *,
            likes:likes(count),
            comments:comments(count)
          `)
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false });
        rawPosts = data || [];
      } else if (activeTab === 'saved') {
        const { data } = await supabase
          .from("bookmarks")
          .select(`
             post:posts(
                *,
                likes:likes(count),
                comments:comments(count)
             )
          `)
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false });
        // @ts-ignore
        rawPosts = data?.map(item => item.post).filter(Boolean) || [];
      } else if (activeTab === 'liked') {
        const { data } = await supabase
          .from("likes")
          .select(`
             post:posts(
                *,
                likes:likes(count),
                comments:comments(count)
             )
          `)
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false });
        // @ts-ignore
        rawPosts = data?.map(item => item.post).filter(Boolean) || [];
      }

      // Check liked status for current user if logged in
      let likedPostIds = new Set<string>();
      if (user && rawPosts.length > 0) {
        const postIds = rawPosts.map(p => p.id);
        const { data: likesData } = await supabase
          .from("likes")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", postIds);

        likesData?.forEach(l => likedPostIds.add(l.post_id));
      }

      const formattedPosts: Post[] = rawPosts.map(p => ({
        id: p.id,
        media_url: p.media_url,
        media_type: p.media_type,
        caption: p.caption,
        created_at: p.created_at,
        user_id: p.user_id,
        likes_count: p.likes?.[0]?.count || 0,
        comments_count: p.comments?.[0]?.count || 0,
        is_liked_by_user: likedPostIds.has(p.id)
      }));

      setPosts(formattedPosts);

    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  };

  const handleFollow = async () => {
    if (!user || !profile) {
      navigate("/auth");
      return;
    }

    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profile.id);
      setIsFollowing(false);
      setFollowersCount((prev) => prev - 1);
    } else {
      await supabase.from("follows").insert({
        follower_id: user.id,
        following_id: profile.id,
      });
      setIsFollowing(true);
      setFollowersCount((prev) => prev + 1);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center pt-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
              className={isFollowing ? "bg-background/50 backdrop-blur-sm border-white/10" : "bg-primary text-primary-foreground hover:bg-primary/90"}
              size="sm"
              onClick={handleFollow}
            >
              {isFollowing ? "Following" : "Follow"}
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
            <div className="font-bold">{formatNumber(followersCount)}</div>
            <div className="text-xs text-muted-foreground">Followers</div>
          </div>
          <div className="text-center">
            <div className="font-bold">{formatNumber(followingCount)}</div>
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
        {posts.length > 0 ? (
          <div className="grid grid-cols-3 gap-0.5">
            {posts.map((post) => (
              <div
                key={post.id}
                className="aspect-square bg-muted overflow-hidden relative group cursor-pointer"
                onClick={() => setSelectedPost(post)}
              >
                {post.media_type === 'video' ? (
                  <div className="w-full h-full relative">
                    <video
                      src={post.media_url || ""}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      loop
                      onMouseOver={(e) => e.currentTarget.play()}
                      onMouseOut={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                    <div className="absolute top-2 right-2">
                      <Play className="w-4 h-4 text-white drop-shadow-md fill-white/50" />
                    </div>
                  </div>
                ) : post.media_url ? (
                  <img
                    src={post.media_url}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="p-0 border-none bg-transparent max-w-md w-full overflow-hidden sm:rounded-3xl shadow-none">
          {selectedPost && (
            <div className="bg-background rounded-3xl overflow-hidden">
              <PostCard
                id={selectedPost.id}
                user={{
                  id: profile.id,
                  username: profile.username,
                  display_name: profile.display_name,
                  avatar_url: profile.avatar_url
                }}
                caption={selectedPost.caption}
                media_url={selectedPost.media_url}
                media_type={selectedPost.media_type}
                created_at={selectedPost.created_at}
                likes_count={selectedPost.likes_count}
                comments_count={selectedPost.comments_count}
                is_liked_by_user={selectedPost.is_liked_by_user}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {
        showEditModal && (
          <EditProfileModal
            profile={profile}
            onClose={() => setShowEditModal(false)}
            onUpdate={fetchProfile}
          />
        )
      }

      {/* Avatar Lightbox */}
      <Dialog open={showAvatarModal} onOpenChange={setShowAvatarModal}>
        <DialogContent className="p-0 border-none bg-transparent max-w-lg w-full overflow-hidden shadow-none flex items-center justify-center outline-none">
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
