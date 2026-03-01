
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StoryViewer } from "./StoryViewer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPresignedUploadUrl } from "@/integrations/s3/client";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

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
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [uploading, setUploading] = useState(false);

    const { data: storyData, isLoading } = useQuery({
        queryKey: ['stories', user?.id],
        queryFn: async () => {
            if (!user) return { storyUsers: [], userStory: null, followedUsers: [] };

            const now = new Date().toISOString();

            const [storiesResult, followsResult] = await Promise.all([
                supabase
                    .from('stories')
                    .select(`
                        id, user_id, media_url, media_type, created_at,
                        profiles ( id, username, display_name, avatar_url )
                    `)
                    .gt('expires_at', now)
                    .order('created_at', { ascending: true }),
                supabase
                    .from('follows')
                    .select(`
                        following_id,
                        profiles:follows_following_id_fkey ( id, username, display_name, avatar_url )
                    `)
                    .eq('follower_id', user.id)
            ]);

            const grouped: Record<string, StoryUser> = {};
            if (storiesResult.data) {
                storiesResult.data.forEach((story: any) => {
                    const uid = story.user_id;
                    if (!grouped[uid]) {
                        grouped[uid] = {
                            id: uid,
                            username: story.profiles?.username || "User",
                            display_name: story.profiles?.display_name,
                            avatar: story.profiles?.avatar_url,
                            stories: [],
                            hasStory: true
                        };
                    }
                    grouped[uid].stories.push(story);
                });
            }

            const others = Object.values(grouped).filter((g) => g.id !== user.id);
            const mine = grouped[user.id];

            let followed: any[] = [];
            if (followsResult.data) {
                followed = followsResult.data.map((f: any) => ({
                    id: f.profiles.id,
                    username: f.profiles.username,
                    display_name: f.profiles.display_name,
                    avatar: f.profiles.avatar_url,
                    stories: [],
                    hasStory: false
                }));
            }

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
        const channel = supabase
            .channel('public:stories')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
                queryClient.invalidateQueries({ queryKey: ['stories', user.id] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
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

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    toast.loading(`Uploading story... ${percent}%`, { id: toastId });
                }
            };

            const uploadPromise = new Promise((resolve, reject) => {
                xhr.onload = () => {
                    if (xhr.status === 200) resolve(true);
                    else reject(new Error('Upload failed'));
                };
                xhr.onerror = () => reject(new Error('Upload failed'));
                xhr.send(file);
            });

            await uploadPromise;

            const { error: dbError } = await supabase.from('stories').insert({
                user_id: user.id,
                media_url: publicUrl,
                media_type: file.type.startsWith('video') ? 'video' : 'image'
            });

            if (dbError) throw dbError;

            toast.dismiss(toastId);
            setUploading(false);
            queryClient.invalidateQueries({ queryKey: ['stories', user.id] });

        } catch (error: any) {
            console.error("Story upload error:", error);
            setUploading(false);
            toast.error("Failed to upload: " + (error.message || "Unknown error"), { id: toastId });
        }
    };

    const openViewer = (index: number) => {
        setInitialUserIndex(index);
        setViewerOpen(true);
    };

    const handleMyStoryClick = () => {
        if (userStory) {
            openViewer(0);
        } else {
            fileInputRef.current?.click();
        }
    };

    const viewerStories = userStory ? [userStory, ...storyUsers] : storyUsers;
    const storyUserIds = new Set(storyUsers.map(u => u.id));
    const uniqueFollowedUsers = followedUsers.filter(u => !storyUserIds.has(u.id));

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                staggerChildren: 0.1,
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1]
            }
        }
    };

    const itemVariants = {
        hidden: { scale: 0.8, opacity: 0 },
        visible: {
            scale: 1,
            opacity: 1,
            transition: { type: "spring", stiffness: 300, damping: 20 }
        }
    };

    return (
        <div className="w-full relative px-1 sm:px-0">
            {/* Seamless, unconstrained horizontal scroll area */}
            <div className="transition-all duration-700">
                <ScrollArea className="w-full pb-4">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="flex items-center gap-4 p-2 px-2 md:px-4 w-max min-w-full"
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*,video/*"
                            onChange={handleFileUpload}
                        />

                        {isLoading ? (
                            <div className="flex gap-6">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="flex flex-col items-center gap-3">
                                        <Skeleton className="w-[78px] h-[78px] rounded-[28px]" />
                                        <Skeleton className="h-3 w-12 rounded-full opacity-50" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                {/* Current User Story */}
                                <motion.div
                                    variants={itemVariants}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="flex flex-col items-center gap-3 cursor-pointer group relative"
                                    onClick={handleMyStoryClick}
                                >
                                    <div className="relative">
                                        <div className={cn(
                                            "p-[3px] rounded-[32px] transition-all duration-700",
                                            userStory
                                                ? "bg-gradient-to-tr from-[#FF3B30] via-[#FF2D55] to-[#AF52DE] shadow-lg shadow-pink-500/20 animated-story-ring"
                                                : "bg-white/10"
                                        )}>
                                            <Avatar className="w-[72px] h-[72px] rounded-[28px] border-[3px] border-background/50 group-hover:border-transparent transition-all duration-500">
                                                <AvatarImage src={user?.user_metadata?.avatar_url} className="object-cover" />
                                                <AvatarFallback className="bg-secondary text-secondary-foreground font-bold text-lg">ME</AvatarFallback>
                                            </Avatar>
                                        </div>
                                        {!userStory && (
                                            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-2 border-[4px] border-background shadow-xl scale-90 sm:scale-100">
                                                <Plus className="w-4 h-4" strokeWidth={4} />
                                            </div>
                                        )}
                                        {uploading && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-[32px] backdrop-blur-[2px]">
                                                <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[12px] font-display font-bold text-muted-foreground/80 group-hover:text-foreground transition-colors tracking-tight">
                                        Your Story
                                    </span>
                                </motion.div>

                                {/* Users WITH Stories */}
                                {storyUsers.map((storyUser) => (
                                    <motion.div
                                        key={storyUser.id}
                                        variants={itemVariants}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="flex flex-col items-center gap-3 cursor-pointer group"
                                        onClick={() => openViewer(userStory ? storyUsers.indexOf(storyUser) + 1 : storyUsers.indexOf(storyUser))}
                                    >
                                        <div className="relative">
                                            <div className="p-[3px] rounded-[32px] transition-all duration-700 bg-gradient-to-tr from-[#FF3B30] via-[#FF2D55] to-[#AF52DE] shadow-lg shadow-pink-500/10 group-hover:shadow-pink-500/40 animated-story-ring">
                                                <Avatar className="w-[72px] h-[72px] rounded-[28px] border-[3px] border-background/50 group-hover:border-transparent transition-all duration-500">
                                                    <AvatarImage src={storyUser.avatar || ""} className="object-cover" />
                                                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{storyUser.username[0]?.toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                            </div>
                                        </div>
                                        <span className="text-[12px] font-display font-bold text-muted-foreground/80 group-hover:text-foreground transition-colors max-w-[80px] truncate text-center tracking-tight">
                                            {storyUser.username}
                                        </span>
                                    </motion.div>
                                ))}

                                {/* Followed Users WITHOUT Stories */}
                                {uniqueFollowedUsers.map((followedUser) => (
                                    <motion.div
                                        key={followedUser.id}
                                        variants={itemVariants}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Link
                                            to={`/profile/${followedUser.username}`}
                                            className="flex flex-col items-center gap-3 cursor-pointer group"
                                        >
                                            <div className="relative">
                                                <div className="p-[3px] rounded-[32px] transition-all duration-500 bg-white/5 border border-white/5 group-hover:border-primary/40 group-hover:bg-primary/5">
                                                    <Avatar className="w-[72px] h-[72px] rounded-[28px] border-[3px] border-background/50 group-hover:border-transparent group-hover:scale-95 transition-all duration-500">
                                                        <AvatarImage src={followedUser.avatar || ""} className="object-cover" />
                                                        <AvatarFallback className="bg-secondary/50 text-secondary-foreground font-bold text-lg">{followedUser.username[0]?.toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                </div>
                                            </div>
                                            <span className="text-[12px] font-display font-bold text-muted-foreground/60 group-hover:text-foreground transition-colors max-w-[80px] truncate text-center tracking-tight">
                                                {followedUser.username}
                                            </span>
                                        </Link>
                                    </motion.div>
                                ))}
                            </>
                        )}
                    </motion.div>
                    <ScrollBar orientation="horizontal" className="bg-white/5" />
                </ScrollArea>
            </div>

            {viewerOpen && (
                <StoryViewer
                    stories={viewerStories}
                    initialUserIndex={initialUserIndex}
                    onClose={() => setViewerOpen(false)}
                />
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes story-glow {
                    0% { filter: hue-rotate(0deg) brightness(1); }
                    50% { filter: hue-rotate(15deg) brightness(1.2); }
                    100% { filter: hue-rotate(0deg) brightness(1); }
                }
                .animated-story-ring {
                    animation: story-glow 4s ease-in-out infinite;
                }
            `}} />
        </div>
    );
};
