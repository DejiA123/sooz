import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SamplePost {
  caption: string;
  media_url: string;
  media_type: "image" | "video";
  username: string;
  display_name: string;
  avatar_url: string;
}

const samplePosts: SamplePost[] = [
  {
    caption: "Just finished an amazing hike in the mountains! The view was absolutely breathtaking 🏔️ #nature #hiking #adventure",
    media_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=800&fit=crop",
    media_type: "image",
    username: "nature_lover",
    display_name: "Alex Johnson",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop"
  },
  {
    caption: "Coffee and code - the perfect Monday morning combination ☕💻 #coding #programming #mondaymotivation",
    media_url: "https://images.unsplash.com/photo-1515378960530-7c0da6231fb1?w=800&h=800&fit=crop",
    media_type: "image",
    username: "code_master",
    display_name: "Sarah Chen",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop"
  },
  {
    caption: "Sunset at the beach was absolutely magical today! 🌅 Feeling so grateful for these moments",
    media_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=800&fit=crop",
    media_type: "image",
    username: "beach_vibes",
    display_name: "Mike Rodriguez",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop"
  },
  {
    caption: "New artwork completed! This took me 3 weeks but I'm so happy with how it turned out 🎨 #art #creative #painting",
    media_url: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=800&fit=crop",
    media_type: "image",
    username: "artist_soul",
    display_name: "Emma Wilson",
    avatar_url: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop"
  },
  {
    caption: "Just adopted this adorable rescue puppy! Meet Max 🐕❤️ #doglover #rescue #puppy",
    media_url: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=800&fit=crop",
    media_type: "image",
    username: "dog_enthusiast",
    display_name: "Lisa Park",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop"
  },
  {
    caption: "Weekend baking session! These chocolate chip cookies are heavenly 🍪 #baking #cookies #weekendvibes",
    media_url: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&h=800&fit=crop",
    media_type: "image",
    username: "baking_queen",
    display_name: "David Kim",
    avatar_url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop"
  },
  {
    caption: "Morning yoga session at the park. Starting the day with positive energy 🧘‍♀️☀️ #yoga #wellness #morning",
    media_url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=800&fit=crop",
    media_type: "image",
    username: "yoga_guru",
    display_name: "Rachel Green",
    avatar_url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop"
  },
  {
    caption: "City lights at night never get old. Love exploring my hometown after dark 🌃 #city #night #urban",
    media_url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&h=800&fit=crop",
    media_type: "image",
    username: "urban_explorer",
    display_name: "Tom Anderson",
    avatar_url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&h=150&fit=crop"
  }
];

const SampleDataLoader = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sampleDataAdded, setSampleDataAdded] = useState(false);

  useEffect(() => {
    // Check if sample data has already been added
    const checkSampleData = async () => {
      const hasAdded = localStorage.getItem('sampleDataAdded');
      if (hasAdded === 'true') {
        setSampleDataAdded(true);
        return;
      }

      // Check if there are already posts in the database
      const { data, error } = await supabase
        .from('posts')
        .select('id')
        .limit(1);

      if (!error && data && data.length > 0) {
        setSampleDataAdded(true);
        localStorage.setItem('sampleDataAdded', 'true');
      }
    };

    checkSampleData();
  }, []);

  const addSampleData = async () => {
    if (loading || sampleDataAdded) return;

    setLoading(true);
    try {
      // Create sample users first
      for (const post of samplePosts) {
        // Check if user exists
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', post.username)
          .single();

        let userId;
        
        if (!existingUser) {
          // Create a new user in auth.users (we'll use a placeholder since we can't create real users)
          // Instead, we'll create profiles directly
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: crypto.randomUUID(), // Generate a random UUID for the profile
              username: post.username,
              display_name: post.display_name,
              avatar_url: post.avatar_url,
              bio: `Hi! I'm ${post.display_name}. I love sharing moments from my life!`,
            })
            .select('id')
            .single();

          if (!profileError && profileData) {
            userId = profileData.id;
          } else {
            console.error('Error creating profile:', profileError);
            continue;
          }
        } else {
          userId = existingUser.id;
        }

        // Create the post with random view count
        const randomViewCount = Math.floor(Math.random() * 500) + 50; // Random views between 50-550
        const { error: postError } = await supabase
          .from('posts')
          .insert({
            user_id: userId,
            caption: post.caption,
            media_url: post.media_url,
            media_type: post.media_type,
            view_count: randomViewCount,
          });

        if (postError) {
          console.error('Error creating post:', postError);
        }
      }

      setSampleDataAdded(true);
      localStorage.setItem('sampleDataAdded', 'true');
      
      // Refresh the page to show new posts
      window.location.reload();
    } catch (error) {
      console.error('Error adding sample data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (sampleDataAdded) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50">
      <div className="max-w-md mx-auto bg-card border border-border rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-white text-sm font-bold">+</span>
            </div>
            <div>
              <h3 className="font-semibold text-sm">Add Sample Posts</h3>
              <p className="text-xs text-muted-foreground">
                Populate your feed with sample content
              </p>
            </div>
          </div>
          <Button
            onClick={addSampleData}
            disabled={loading}
            size="sm"
            variant="outline"
          >
            {loading ? "Adding..." : "Add Posts"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SampleDataLoader;