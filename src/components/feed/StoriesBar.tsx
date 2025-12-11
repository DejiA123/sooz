import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { StoriesBarSkeleton } from "@/components/stories/StoriesBarSkeleton";
import StoryModal from "@/components/stories/StoryModal";

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  created_at: string;
  expires_at: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface UserStory {
  id: string;
  name: string;
  avatar: string;
  hasNew: boolean;
  stories: Story[];
}

const StoriesBar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState<UserStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStories, setSelectedStories] = useState<Story[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showStoryModal, setShowStoryModal] = useState(false);
  useEffect(() => {
    fetchStories();
  }, [user]);

  const fetchStories = async () => {
    try {
      setLoading(true);
      
      // Fetch active stories (not expired)
      const { data: storiesData, error: storiesError } = await supabase
        .from("stories")
        .select(`
          *,
          profiles:user_id (username, display_name, avatar_url)
        `)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      if (storiesError) {
        console.error("Error fetching stories:", storiesError);
        return;
      }

      // Group stories by user
      const storiesByUser = new Map<string, Story[]>();
      
      (storiesData || []).forEach((story) => {
        const userId = story.user_id;
        if (!storiesByUser.has(userId)) {
          storiesByUser.set(userId, []);
        }
        storiesByUser.get(userId)!.push(story as Story);
      });

      // Convert to UserStory format
      const userStories: UserStory[] = [];

      // Add "Your Story" placeholder if user is logged in
      if (user) {
        userStories.push({
          id: "add",
          name: "Your Story",
          avatar: user.user_metadata?.avatar_url || "",
          hasNew: false,
          stories: [],
        });
      }

      // Add other users' stories
      storiesByUser.forEach((userStoriesArray, userId) => {
        if (userStoriesArray.length > 0) {
          const profile = userStoriesArray[0].profiles;
          userStories.push({
            id: userId,
            name: profile.display_name || profile.username,
            avatar: profile.avatar_url || "",
            hasNew: true, // You can implement logic to check if user has seen these stories
            stories: userStoriesArray,
          });
        }
      });

      setStories(userStories);
    } catch (error) {
      console.error("Error loading stories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStoryClick = (storyGroup: UserStory, index: number) => {
    if (storyGroup.id === "add") {
      // Handle creating a new story
      navigate("/story/create");
      return;
    }

    if (storyGroup.stories.length > 0) {
      setSelectedStories(storyGroup.stories);
      setSelectedIndex(0);
      setShowStoryModal(true);
    }
  };

  const handleStoryModalClose = () => {
    setShowStoryModal(false);
    setSelectedStories([]);
    setSelectedIndex(0);
  };

  const handleStoryChange = (index: number) => {
    setSelectedIndex(index);
  };

  if (loading) {
    return <StoriesBarSkeleton />;
  }

  return (
    <>
      <div className="py-4 px-4 overflow-x-auto hide-scrollbar bg-surface/95 backdrop-blur-sm border-b border-surface-variant/10 shadow-sm">
        <div className="flex gap-4">
          {stories.map((story, index) => (
            <div 
                key={story.id} 
                className="flex flex-col items-center gap-1.5 min-w-fit cursor-pointer group transition-all duration-200 hover:scale-105"
                onClick={() => handleStoryClick(story, index)}
              >
                <div
                  className={`relative w-20 h-20 rounded-full p-[2px] transition-all duration-300 ${
                    story.id === "add"
                      ? "bg-gray-300 dark:bg-gray-600"
                      : story.hasNew
                      ? "bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 animate-pulse"
                      : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                {story.id === "add" ? (
                  <div className="w-full h-full rounded-full bg-surface flex items-center justify-center border-2 border-dashed border-neutral-400 dark:border-neutral-500 group-hover:border-primary-400 transition-colors">
                    <Plus className="w-6 h-6 text-primary-500 group-hover:scale-110 transition-transform" />
                  </div>
                ) : (
                  <OptimizedAvatar 
                    src={story.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(story.name)}&background=random`}
                    alt={story.name}
                    fallback={story.name.charAt(0)}
                    size="md"
                    className="w-full h-full rounded-full border-2 border-surface"
                  />
                )}
              </div>
              <span className={`text-xs text-center w-20 truncate transition-colors ${
                story.hasNew 
                  ? "text-gray-800 dark:text-gray-200 font-semibold" 
                  : "text-gray-500 dark:text-gray-400"
              }`}>
                {story.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Story Modal */}
      {showStoryModal && selectedStories.length > 0 && (
        <StoryModal
          stories={selectedStories}
          initialIndex={selectedIndex}
          isOpen={showStoryModal}
          onClose={handleStoryModalClose}
          onStoryChange={handleStoryChange}
        />
      )}
    </>
  );
};

export default StoriesBar;
