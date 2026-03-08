import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StoryViewer } from "./StoryViewer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPresignedUploadUrl } from "@/integrations/s3/client";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface StoryUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar: string | null;
  stories: any[];
  hasStory: boolean;
}

export const StoryRail = () => {
  const { user } = useAuth();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [initialUserIndex, setInitialUserIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: storyData, isLoading } = useQuery({
    queryKey: ['stories', user?.id],
    queryFn: async () => {
      if (!user) return { storyUsers: [], userStory: null, followedUsers: [] };
      const now = new Date().toISOString();
      const [storiesResult, followsResult] = await Promise.all([
        supabase.from('stories').select(`id, user_id, media_url, media_type, created_at, profiles ( id, username, display_name, avatar_url )`).gt('expires_at', now).order('created_at', { ascending: true }),
        supabase.from('follows').select(`following_id, profiles:follows_following_id_fkey ( id, username, display_name, avatar_url )`).eq('follower_id', user.id)
      ]);
      const grouped: Record<string, StoryUser> = {};
      if (storiesResult.data) {
        storiesResult.data.forEach((story: any) => {
          const uid = story.user_id;
          if (!grouped[uid]) grouped[uid] = { id: uid, username: story.profiles?.username || "User", display_name: story.profiles?.display_name, avatar: story.profiles?.avatar_url, stories: [], hasStory: true };
          grouped[uid].stories.push(story);
        });
      }
      const others = Object.values(grouped).filter((g) => g.id !== user.id);
      const mine = grouped[user.id];
      let followed: any[] = [];
      if (followsResult.data) followed = followsResult.data.map((f: any) => ({ id: f.profiles.id, username: f.profiles.username, display_name: f.profiles.display_name, avatar: f.profiles.avatar_url, stories: [], hasStory: false }));
      return { storyUsers: others, userStory: mine, followedUsers: followed };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const storyUsers = storyData?.storyUsers || [];
  const userStory = storyData?.userStory || null;
  const followedUsers = storyData?.followedUsers || [];

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('public:stories').on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => { queryClient.invalidateQueries({ queryKey: ['stories', user.id] }); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const toastId = toast.loading("Uploading story... 0%");
    try {
      const { signedUrl, publicUrl } = await getPresignedUploadUrl(file.name, file.type);
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) toast.loading(`Uploading story... ${Math.round((e.loaded / e.total) * 100)}%`, { id: toastId }); };
      await new Promise((resolve, reject) => { xhr.onload = () => xhr.status === 200 ? resolve(true) : reject(new Error('Upload failed')); xhr.onerror = () => reject(new Error('Upload failed')); xhr.send(file); });
      const { error: dbError } = await supabase.from('stories').insert({ user_id: user.id, media_url: publicUrl, media_type: file.type.startsWith('video') ? 'video' : 'image' });
      if (dbError) throw dbError;
      toast.dismiss(toastId);
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ['stories', user.id] });
    } catch (error: any) {
      setUploading(false);
      toast.error("Failed to upload: " + (error.message || "Unknown error"), { id: toastId });
    }
  };

  const openViewer = (index: number) => { setInitialUserIndex(index); setViewerOpen(true); };
  const handleMyStoryClick = () => { if (userStory) openViewer(0); else fileInputRef.current?.click(); };

  const viewerStories = userStory ? [userStory, ...storyUsers] : storyUsers;
  const storyUserIds = new Set(storyUsers.map(u => u.id));
  const uniqueFollowedUsers = followedUsers.filter(u => !storyUserIds.has(u.id));

  // Build ticker text from stories + followed
  const tickerItems = [
    ...storyUsers.map(u => ({ name: u.display_name || u.username, action: "shared a story", hasStory: true, id: u.id })),
    ...uniqueFollowedUsers.slice(0, 3).map(u => ({ name: u.display_name || u.username, action: "is online", hasStory: false, id: u.id })),
  ];

  return (
    <div className="w-full">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />

      {/* Ticker strip */}
      <div className="relative overflow-hidden border-y border-border/10 bg-secondary/30">
        <div className="flex items-center h-10 px-4 gap-3">
          {/* Add story button */}
          <button
            onClick={handleMyStoryClick}
            className="flex items-center gap-1.5 shrink-0 text-primary font-bold text-[12px] hover:opacity-80 transition-opacity"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5" />
              </div>
            )}
            <span>{userStory ? "Your story" : "Add"}</span>
          </button>

          {isLoading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-3 w-40" />
            </div>
          ) : tickerItems.length > 0 ? (
            <div className="overflow-hidden flex-1">
              <div className="flex items-center gap-1 ticker-scroll whitespace-nowrap">
                {tickerItems.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.hasStory) {
                        const idx = storyUsers.findIndex(u => u.id === item.id);
                        openViewer(userStory ? idx + 1 : idx);
                      }
                    }}
                    className="flex items-center gap-1 text-[12px] shrink-0"
                  >
                    {item.hasStory && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                    <span className="font-bold text-foreground">{item.name}</span>
                    <span className="text-muted-foreground">{item.action}</span>
                    {i < tickerItems.length - 1 && <span className="text-muted-foreground/30 mx-2">·</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <span className="text-[12px] text-muted-foreground/50">No stories yet</span>
          )}
        </div>
      </div>

      {viewerOpen && (
        <StoryViewer stories={viewerStories} initialUserIndex={initialUserIndex} onClose={() => setViewerOpen(false)} />
      )}
    </div>
  );
};