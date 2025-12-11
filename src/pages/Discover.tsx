import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, TrendingUp, Hash, Music, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { DiscoverSkeleton } from "@/components/discover/DiscoverSkeleton";
import { ErrorState } from "@/components/error/ErrorState";
import { handleSupabaseError } from "@/lib/error-utils";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import PostCard from "@/components/feed/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_following?: boolean;
}

interface TrendingTopic {
  id: string;
  name: string;
  posts_count: number;
  category: string;
}

const Discover = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchPosts, setSearchPosts] = useState<any[]>([]);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "posts" | "tags">("users");

  // Fetch all posts for the main feed
  const fetchAllPosts = async () => {
    try {
      setError(null);
      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          profiles:user_id (id, username, display_name, avatar_url)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      if (data) {
        setAllPosts(data);
      }
    } catch (error) {
      const appError = handleSupabaseError(error, 'fetchAllPosts');
      setError(appError);
    }
  };

  // Fetch trending hashtags from posts
  const fetchTrendingHashtags = async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("caption")
        .not("caption", "is", null)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

      if (!error && data) {
        const hashtagCounts = new Map<string, number>();
        
        data.forEach(post => {
          if (post.caption) {
            const hashtags = post.caption.match(/#\w+/g);
            if (hashtags) {
              hashtags.forEach(tag => {
                const tagLower = tag.toLowerCase();
                hashtagCounts.set(tagLower, (hashtagCounts.get(tagLower) || 0) + 1);
              });
            }
          }
        });

        const sortedHashtags = Array.from(hashtagCounts.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 8)
          .map(([tag, count], index) => ({
            id: (index + 1).toString(),
            name: tag,
            posts_count: count,
            category: "Trending"
          }));

        setTrendingTopics(sortedHashtags);
      }
    } catch (error) {
      console.error("Error fetching trending hashtags:", error);
      // Fallback to sample data
      setTrendingTopics(sampleTrendingTopics);
    }
  };

  // Sample trending topics for fallback
  const sampleTrendingTopics: TrendingTopic[] = [
    { id: "1", name: "#social", posts_count: 15420, category: "Trending" },
    { id: "2", name: "#photography", posts_count: 8930, category: "Trending" },
    { id: "3", name: "#lifestyle", posts_count: 7650, category: "Trending" },
    { id: "4", name: "#travel", posts_count: 23410, category: "Trending" },
    { id: "5", name: "#food", posts_count: 4560, category: "Trending" },
    { id: "6", name: "#nature", posts_count: 18920, category: "Trending" },
    { id: "7", name: "#art", posts_count: 12340, category: "Trending" },
    { id: "8", name: "#music", posts_count: 9870, category: "Trending" },
  ];

  useEffect(() => {
    fetchSuggestedUsers();
    fetchTrendingHashtags();
    fetchAllPosts();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const delayDebounce = setTimeout(() => {
        handleSearch();
      }, 500);
      return () => clearTimeout(delayDebounce);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const fetchSuggestedUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .limit(10);

      if (!error && data) {
        // Check follow status for each user
        if (user) {
          const { data: follows } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id);

          const followingIds = follows?.map(f => f.following_id) || [];
          const usersWithFollowStatus = data.map(u => ({
            ...u,
            is_following: followingIds.includes(u.id)
          }));
          setSuggestedUsers(usersWithFollowStatus);
        } else {
          setSuggestedUsers(data);
        }
      }
    } catch (error) {
      console.error("Error fetching suggested users:", error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      // Search users
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .limit(10);

      // Search posts by caption
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(`
          *,
          profiles:user_id (username, display_name, avatar_url)
        `)
        .ilike("caption", `%${searchQuery}%`)
        .order("created_at", { ascending: false })
        .limit(10);

      // Search by hashtags (extract hashtags from captions)
      const hashtagQuery = searchQuery.startsWith("#") ? searchQuery.slice(1) : searchQuery;
      const { data: hashtagPostsData, error: hashtagError } = await supabase
        .from("posts")
        .select(`
          *,
          profiles:user_id (username, display_name, avatar_url)
        `)
        .ilike("caption", `%#${hashtagQuery}%`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!usersError && usersData) {
        // Check follow status for users
        if (user) {
          const { data: follows } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id);

          const followingIds = follows?.map(f => f.following_id) || [];
          const usersWithFollowStatus = usersData.map(u => ({
            ...u,
            is_following: followingIds.includes(u.id)
          }));
          setSearchResults(usersWithFollowStatus);
        } else {
          setSearchResults(usersData);
        }
      }

      // Combine posts from caption search and hashtag search
      const allPosts = [...(postsData || []), ...(hashtagPostsData || [])];
      // Remove duplicates based on post id
      const uniquePosts = allPosts.filter((post, index, self) => 
        index === self.findIndex(p => p.id === post.id)
      );
      setSearchPosts(uniquePosts);
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      const { error } = await supabase
        .from("follows")
        .insert({
          follower_id: user.id,
          following_id: userId,
        });

      if (!error) {
        // Update local state
        setSearchResults(prev => 
          prev.map(u => u.id === userId ? { ...u, is_following: true } : u)
        );
        setSuggestedUsers(prev => 
          prev.map(u => u.id === userId ? { ...u, is_following: true } : u)
        );
      }
    } catch (error) {
      console.error("Error following user:", error);
    }
  };

  const handleUnfollow = async (userId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", userId);

      if (!error) {
        // Update local state
        setSearchResults(prev => 
          prev.map(u => u.id === userId ? { ...u, is_following: false } : u)
        );
        setSuggestedUsers(prev => 
          prev.map(u => u.id === userId ? { ...u, is_following: false } : u)
        );
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
    }
  };

  const handleUserClick = (username: string) => {
    navigate(`/profile/${username}`);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  // Helper function to format post data for PostCard component
  const formatPostForCard = (post: any) => {
    const mediaType = post.media_type === "video" ? "video" : "image";
    return {
      id: post.id,
      user: {
        id: post.profiles?.id || post.user_id,
        name: post.profiles?.display_name || post.profiles?.username || "Unknown User",
        username: post.profiles?.username || "unknown",
        avatar: post.profiles?.avatar_url || "",
      },
      content: post.media_url ? {
        type: mediaType as "image" | "video",
        url: post.media_url
      } : null,
      caption: post.caption || "",
      likes: post.likes_count || 0,
      comments: post.comments_count || 0,
      shares: post.shares_count || 0,
      view_count: post.view_count || 0,
      timeAgo: new Date(post.created_at).toLocaleDateString()
    };
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        {/* Search Bar */}
        <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search users, posts, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 bg-muted/50 border-0 focus:bg-background"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Search Tabs */}
          <div className="flex gap-2 mt-3">
            <Button
              variant={activeTab === "users" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("users")}
              className="flex-1"
            >
              <User className="w-4 h-4 mr-1" />
              Users
            </Button>
            <Button
              variant={activeTab === "tags" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("tags")}
              className="flex-1"
            >
              <Hash className="w-4 h-4 mr-1" />
              Tags
            </Button>
          </div>
        </div>

        {/* Search Results */}
        {searchQuery && (
          <div className="space-y-6">
            {/* Users Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold px-4">Users</h2>
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <div key={user.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/50">
                      <button 
                        className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 rounded-xl p-1"
                        onClick={() => handleUserClick(user.username)}
                        aria-label={`View profile of ${user.display_name || user.username}`}
                        title={`View profile of ${user.display_name || user.username}`}
                      >
                        <OptimizedAvatar 
                          src={user.avatar_url || ""}
                          alt={`${user.display_name || user.username}'s avatar`}
                          fallback={user.display_name?.charAt(0) || user.username.charAt(0).toUpperCase()}
                          size="md"
                        />
                        <div>
                          <p className="font-medium">{user.display_name || user.username}</p>
                          <p className="text-sm text-muted-foreground">@{user.username}</p>
                          {user.bio && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{user.bio}</p>
                          )}
                        </div>
                      </button>
                      {user.id !== user?.id && (
                        <Button
                          variant={user.is_following ? "outline" : "default"}
                          size="sm"
                          onClick={() => user.is_following ? handleUnfollow(user.id) : handleFollow(user.id)}
                        >
                          {user.is_following ? "Following" : "Follow"}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Posts Results */}
            {searchPosts.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold px-4">Posts</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 px-4">
                  {searchPosts.map((post) => (
                    <div 
                      key={post.id} 
                      className="aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-80"
                      onClick={() => navigate(`/post/${post.id}`)}
                    >
                      {post.media_url ? (
                        <OptimizedImage
                          src={post.media_url}
                          alt="Post preview"
                          className="w-full h-full object-cover"
                          width={400}
                          height={400}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <p className="text-xs text-center p-2 line-clamp-3">{post.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && <DiscoverSkeleton />}

            {/* Error State */}
            {error && (
              <ErrorState 
                error={error}
                onRetry={fetchAllPosts}
                title="Failed to load discover content"
                message="We couldn't load the discover content. Please try again."
              />
            )}

            {/* No Results */}
            {!loading && searchResults.length === 0 && searchPosts.length === 0 && (
              <div className="text-center py-8 px-4">
                <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
                <p className="text-sm text-muted-foreground mt-1">Try searching for users, posts, or hashtags</p>
              </div>
            )}
          </div>
        )}

        {/* All Posts Feed (when no search) */}
        {!searchQuery && allPosts.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold px-4">Discover Posts</h2>
            <div className="space-y-6">
              {allPosts.map((post) => (
                <PostCard key={post.id} post={formatPostForCard(post)} />
              ))}
            </div>
          </div>
        )}

        {/* Trending and Suggested (when no search) */}
        {!searchQuery && (
          <div className="space-y-6">
            {/* Trending Topics */}
            <div className="px-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Trending Now</h2>
              </div>
              <div className="space-y-3">
                {trendingTopics.slice(0, 5).map((topic) => (
                  <button
                    key={topic.id}
                    className="w-full p-3 rounded-xl bg-card hover:bg-accent transition-colors text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
                    onClick={() => setSearchQuery(topic.name)}
                    aria-label={`Search for ${topic.name} in ${topic.category}`}
                    title={`Search for ${topic.name}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{topic.name}</p>
                        <p className="text-xs text-muted-foreground">{topic.category}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {topic.posts_count.toLocaleString()} posts
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Suggested Users */}
            <div className="px-4">
              <h2 className="text-lg font-semibold mb-4">Suggested for You</h2>
              <div className="space-y-3">
                {suggestedUsers.slice(0, 5).map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-card hover:bg-accent transition-colors"
                  >
                    <button
                      className="flex items-center gap-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 rounded-xl p-1"
                      onClick={() => handleUserClick(user.username)}
                      aria-label={`View profile of ${user.display_name || user.username}`}
                      title={`View profile of ${user.display_name || user.username}`}
                    >
                      <OptimizedAvatar 
                        src={user.avatar_url || ""}
                        alt={`${user.display_name || user.username}'s avatar`}
                        fallback={user.display_name?.charAt(0) || user.username.charAt(0).toUpperCase()}
                        size="lg"
                      />
                      <div>
                        <p className="font-semibold">{user.display_name || user.username}</p>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                        {user.bio && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{user.bio}</p>
                        )}
                      </div>
                    </button>
                    {user.id !== user?.id && (
                      <Button
                        variant={user.is_following ? "outline" : "default"}
                        size="sm"
                        onClick={() => user.is_following ? handleUnfollow(user.id) : handleFollow(user.id)}
                      >
                        {user.is_following ? "Following" : "Follow"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default Discover;