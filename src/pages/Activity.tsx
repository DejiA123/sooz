import { useState, useEffect } from "react";
import { Heart, MessageCircle, UserPlus, Clock, Check } from "lucide-react";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import { ErrorState } from "@/components/error/ErrorState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { handleSupabaseError } from "@/lib/error-utils";
import ActivitySkeleton from "@/components/activity/ActivitySkeleton";

interface Activity {
  id: string;
  type: "like" | "comment" | "follow";
  user_id: string;
  post_id?: string;
  comment_content?: string;
  created_at: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  posts?: {
    id: string;
    media_url: string | null;
    caption: string | null;
  };
}

const Activity = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "likes" | "comments" | "follows">("all");

  useEffect(() => {
    if (user) {
      fetchActivities();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchActivities = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      // Fetch likes on user's posts
      const { data: likesData, error: likesError } = await supabase
        .from("likes")
        .select(`
          *,
          profiles:user_id (username, display_name, avatar_url),
          posts:post_id (id, media_url, caption)
        `)
        .eq("posts.user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      // Fetch comments on user's posts
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select(`
          *,
          profiles:user_id (username, display_name, avatar_url),
          posts:post_id (id, media_url, caption)
        `)
        .eq("posts.user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      // Fetch follows
      const { data: followsData, error: followsError } = await supabase
        .from("follows")
        .select(`
          *,
          profiles:follower_id (username, display_name, avatar_url)
        `)
        .eq("following_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const activities: Activity[] = [];

      // Transform likes
      if (likesData) {
        likesData.forEach(like => {
          activities.push({
            id: `like_${like.id}`,
            type: "like",
            user_id: like.user_id,
            post_id: like.post_id,
            created_at: like.created_at,
            profiles: like.profiles,
            posts: like.posts,
          });
        });
      }

      // Transform comments
      if (commentsData) {
        commentsData.forEach(comment => {
          activities.push({
            id: `comment_${comment.id}`,
            type: "comment",
            user_id: comment.user_id,
            post_id: comment.post_id,
            comment_content: comment.content,
            created_at: comment.created_at,
            profiles: comment.profiles,
            posts: comment.posts,
          });
        });
      }

      // Transform follows
      if (followsData) {
        followsData.forEach(follow => {
          activities.push({
            id: `follow_${follow.id}`,
            type: "follow",
            user_id: follow.follower_id,
            created_at: follow.created_at,
            profiles: follow.profiles,
          });
        });
      }

      // Sort by created_at
      activities.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setActivities(activities);
    } catch (error) {
      const appError = handleSupabaseError(error, 'fetchActivities');
      setError(appError);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "like":
        return <Heart className="w-4 h-4 text-red-500 fill-current" />;
      case "comment":
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case "follow":
        return <UserPlus className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getActivityText = (activity: Activity) => {
    const userName = activity.profiles.display_name || activity.profiles.username;
    
    switch (activity.type) {
      case "like":
        return `${userName} liked your post`;
      case "comment":
        return `${userName} commented: "${activity.comment_content}"`;
      case "follow":
        return `${userName} started following you`;
      default:
        return "Unknown activity";
    }
  };

  const filteredActivities = activities.filter(activity => {
    if (activeTab === "all") return true;
    return activity.type === activeTab.slice(0, -1); // Remove 's' from tab name
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-lg mx-auto pt-16 pb-24">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Heart className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">See Your Activity</h2>
            <p className="text-muted-foreground mb-6">
              Log in to see likes, comments, and follows on your posts.
            </p>
            <Button onClick={() => navigate("/auth")}>
              Log In
            </Button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-lg mx-auto pt-16 pb-24">
        {/* Activity Header */}
        <div className="px-4 py-4 border-b border-border/50">
          <h1 className="text-2xl font-bold">Activity</h1>
          <p className="text-muted-foreground">See who's interacting with your content</p>
        </div>

        {/* Activity Tabs */}
        <div className="flex border-b border-border/50">
          {[
            { id: "all", label: "All" },
            { id: "likes", label: "Likes" },
            { id: "comments", label: "Comments" },
            { id: "follows", label: "Follows" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Activity List */}
        <div className="divide-y divide-border/50">
          {loading ? (
            <ActivitySkeleton />
          ) : error ? (
            <ErrorState 
              error={error}
              onRetry={fetchActivities}
              title="Failed to load activity"
              message="We couldn't load your recent activity. Please try again."
            />
          ) : filteredActivities.length > 0 ? (
            filteredActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => {
                  if (activity.post_id) {
                    // Navigate to post (we'll need to implement post detail page)
                    console.log("Navigate to post:", activity.post_id);
                  } else if (activity.type === "follow") {
                    navigate(`/profile/${activity.profiles.username}`);
                  }
                }}
              >
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3">
                    <OptimizedAvatar
                      src={activity.profiles.avatar_url || ""}
                      alt={`${activity.profiles.display_name || activity.profiles.username}'s avatar`}
                      fallback={activity.profiles.display_name?.charAt(0) || activity.profiles.username.charAt(0).toUpperCase()}
                      size="md"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">
                          {activity.profiles.display_name || activity.profiles.username}
                        </span>
                        {" "}
                        <span className="text-muted-foreground">
                          {getActivityText(activity)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(activity.created_at)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Post preview for likes/comments */}
                {activity.posts?.media_url && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <OptimizedImage
                      src={activity.posts.media_url}
                      alt="Post preview"
                      className="w-full h-full object-cover"
                      width={48}
                      height={48}
                      priority={false}
                    />
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Activity Yet</h3>
              <p className="text-muted-foreground">
                {activeTab === "all"
                  ? "When people interact with your posts, you'll see it here."
                  : `No ${activeTab} activity yet.`}
              </p>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Activity;