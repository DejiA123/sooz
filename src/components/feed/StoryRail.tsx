import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StoryViewer } from "./StoryViewer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPresignedUploadUrl } from "@/integrations/s3/client";
import { motion } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: storyData, isLoading } = useQuery({
    queryKey: ['stories', user?.id],
    queryFn: async () => {
      if (!user) return { storyUsers: [], userStory: null, followedUsers: [] };
      const now = new Date().toISOString();
      const [storiesResult, followsResult, profileResult] = await Promise.all([
        supabase.from('stories').select(`id, user_id, media_url, media_type, created_at, profiles ( id, username, display_name, avatar_url )`).gt('expires_at', now).order('created_at', { ascending: true }),
        supabase.from('follows').select(`following_id, profiles:follows_following_id_fkey ( id, username, display_name, avatar_url )`).eq('follower_id', user.id),
        supabase.from('profiles').select('avatar_url, username, display_name').eq('id', user.id).single(),
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
      let followed: StoryUser[] = [];
      if (followsResult.data) followed = followsResult.data.map((f: any) => ({ id: f.profiles.id, username: f.profiles.username, display_name: f.profiles.display_name, avatar: f.profiles.avatar_url, stories: [], hasStory: false }));
      return {
        storyUsers: others,
        userStory: mine,
        followedUsers: followed,
        userProfile: profileResult.data,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const storyUsers = storyData?.storyUsers || [];
  const userStory = storyData?.userStory || null;
  const followedUsers = storyData?.followedUsers || [];
  const userProfile = storyData?.userProfile;

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

  // All users to display after "Your Story"
  const allUsers = [...storyUsers, ...uniqueFollowedUsers.slice(0, 10)];

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.04 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12, scale: 0.85 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 400, damping: 25 } },
  };

  return (
    <div className="w-full">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />

      {/* Glassmorphic story rail */}
      <div className="relative mx-0 mt-2 mb-4">
        <div className="story-rail-glass py-4 px-3 overflow-hidden">
          <motion.div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto hide-scrollbar scroll-smooth px-1"
            style={{ WebkitOverflowScrolling: "touch" }}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Your Story — always first */}
            <motion.button
              variants={itemVariants}
              onClick={handleMyStoryClick}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.94 }}
              className="flex flex-col items-center gap-2 shrink-0 w-[72px] group"
            >
              <div className={cn(
                "relative w-[68px] h-[68px] rounded-full flex items-center justify-center transition-all duration-300",
                userStory ? "story-ring-active p-[3px] shadow-lg shadow-primary/10" : "story-ring-add p-[2.5px]"
              )}>
                <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden ring-2 ring-background">
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                  ) : userProfile?.avatar_url ? (
                    <Avatar className="w-full h-full scale-105 group-hover:scale-110 transition-transform duration-500">
                      <AvatarImage src={userProfile.avatar_url} className="object-cover" />
                      <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-muted to-muted/50 text-muted-foreground">
                        {(userProfile.username || "U")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Plus className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                {/* Plus badge */}
                {!userStory && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center ring-2 ring-background story-plus-pulse shadow-md">
                    <Plus className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3.5} />
                  </div>
                )}
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground/80 truncate w-full text-center leading-tight group-hover:text-foreground transition-colors">
                You
              </span>
            </motion.button>

            {/* Loading skeletons */}
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <motion.div key={`skel-${i}`} variants={itemVariants} className="flex flex-col items-center gap-2 shrink-0 w-[72px]">
                <div className="w-[68px] h-[68px] rounded-full bg-muted/40 animate-pulse border border-border/20" />
                <div className="w-12 h-3 rounded-full bg-muted/40 animate-pulse" />
              </motion.div>
            ))}

            {/* Story & followed users */}
            {allUsers.map((u, i) => (
              <motion.button
                key={u.id}
                variants={itemVariants}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  if (u.hasStory) {
                    const idx = storyUsers.findIndex(su => su.id === u.id);
                    openViewer(userStory ? idx + 1 : idx);
                  }
                }}
                className="flex flex-col items-center gap-2 shrink-0 w-[72px] group"
              >
                <div className={cn(
                  "relative w-[68px] h-[68px] rounded-full p-[3px] transition-all duration-300",
                  u.hasStory ? "story-ring-active shadow-lg shadow-primary/10" : "story-ring-seen"
                )}>
                  <div className="w-full h-full rounded-full bg-background overflow-hidden ring-2 ring-background">
                    <Avatar className="w-full h-full scale-105 group-hover:scale-110 transition-transform duration-500">
                      <AvatarImage src={u.avatar || undefined} className="object-cover" />
                      <AvatarFallback className="text-sm font-bold bg-muted text-muted-foreground">
                        {(u.username || "U")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  {/* Live indicator dot for active stories */}
                  {u.hasStory && (
                    <div className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-primary ring-[2.5px] ring-background story-live-dot shadow-sm" />
                  )}
                </div>
                <span className="text-[11px] font-semibold text-foreground/70 truncate w-full text-center leading-tight group-hover:text-foreground transition-colors group-hover:font-bold">
                  {u.username.length > 9 ? u.username.slice(0, 8) + '…' : u.username}
                </span>
              </motion.button>
            ))}
          </motion.div>
        </div>
      </div>

      {viewerOpen && (
        <StoryViewer stories={viewerStories} initialUserIndex={initialUserIndex} onClose={() => setViewerOpen(false)} />
      )}
    </div>
  );
};
