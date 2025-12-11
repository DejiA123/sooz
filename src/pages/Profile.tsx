import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Settings, Grid3X3, Bookmark, Heart, Loader2, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import EditProfileModal from "@/components/profile/EditProfileModal";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
}

interface Post {
  id: string;
  media_url: string | null;
  media_type: string | null;
  caption: string | null;
  created_at: string;
}

const Profile = () => {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "liked">("posts");
  const [showEditModal, setShowEditModal] = useState(false);

  const isOwnProfile = user?.id === profile?.id;

  useEffect(() => {
    if (username) {
      fetchProfile();
    }
  }, [username, user]);

  const fetchProfile = async () => {
    if (!username) return;
    
    setLoading(true);
    
    // Fetch profile
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (profileError || !profileData) {
      toast.error("Profile not found");
      navigate("/");
      return;
    }

    setProfile(profileData);

    // Fetch posts
    const { data: postsData } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", profileData.id)
      .order("created_at", { ascending: false });

    setPosts(postsData || []);

    // Fetch followers count
    const { count: followers } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profileData.id);

    setFollowersCount(followers || 0);

    // Fetch following count
    const { count: following } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profileData.id);

    setFollowingCount(following || 0);

    // Check if current user follows this profile
    if (user && user.id !== profileData.id) {
      const { data: followData } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", profileData.id)
        .maybeSingle();

      setIsFollowing(!!followData);
    }

    setLoading(false);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-lg mx-auto pt-16 pb-24">
        {/* Cover Photo */}
        <div className="relative h-32 bg-gradient-to-br from-secondary/30 to-primary/20">
          {profile.cover_url && (
            <img
              src={profile.cover_url}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Profile Info */}
        <div className="px-4">
          {/* Avatar */}
          <div className="relative -mt-12 mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-background bg-muted overflow-hidden">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">
                    {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
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
                  variant="glass"
                  size="sm"
                  onClick={() => setShowEditModal(true)}
                >
                  Edit Profile
                </Button>
                <Button variant="glass" size="icon-sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant={isFollowing ? "glass" : "gold"}
                size="sm"
                onClick={handleFollow}
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm mb-4">{profile.bio}</p>
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
          <div className="flex border-b border-border mb-4">
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
            <div className="grid grid-cols-3 gap-1">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="aspect-square bg-muted overflow-hidden"
                >
                  {post.media_url ? (
                    <img
                      src={post.media_url}
                      alt=""
                      className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Camera className="w-6 h-6" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No posts yet</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />

      {showEditModal && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onUpdate={fetchProfile}
        />
      )}
    </div>
  );
};

export default Profile;
