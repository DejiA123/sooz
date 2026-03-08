
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
import { Link, useNavigate } from "react-router-dom";
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
                    .select(`id, user_id, media_url, media_type, created_at, profiles ( id, username, display_name, avatar_url )`)
                    .gt('expires_at', now)
                    .order('created_at', { ascending: true }),
                supabase
                    .from('follows')
                    .select(`following_id, profiles:follows_following_id_fkey ( id, username, display_name, avatar_url )`)
                    .eq('follower_id', user.id)
            ]);

            const grouped: Record<string, StoryUser> = {};
            if (storiesResult.data) {
                storiesResult.data.forEach((story: any) => {
                    const uid = story.user_id;
                    if (!grouped[uid]) {
                        grouped[uid] = { id: uid, username: story.profiles?.username || "User", display_name: story.profiles?.display_name, avatar: story.profiles?.avatar_url, stories: [], hasStory: true };
                    }
                    grouped[uid].stories.push(story);
                });
            }

            const others = Object.values(grouped).filter((g) => g.id !== user.id);
            const mine = grouped[user.id];
            let followed: any[] = [];
            if (followsResult.data) {
                followed = followsResult.data.map((f: any) => ({ id: f.profiles.id, username: f.profiles.username, display_name: f.profiles.display_name, avatar: f.profiles.avatar_url, stories: [], hasStory: false }));
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
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    toast.loading(`Uploading story... ${percent}%`, { id: toastId });
                }
            };
            const uploadPromise = new Promise((resolve, reject) => {
                xhr.onload = () => { if (xhr.status === 200) resolve(true); else reject(new Error('Upload failed')); };
                xhr.onerror = () => reject(new Error('Upload failed'));
                xhr.send(file);
            });
            await uploadPromise;
            const { error: dbError } = await supabase.from('stories').insert({ user_id: user.id, media_url: publicUrl, media_type: file.type.startsWith('video') ? 'video' : 'image' });
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

    const openViewer = (index: number) => { setInitialUserIndex(index); setViewerOpen(true); };

    const handleMyStoryClick = () => {
        if (userStory) { openViewer(0); } else { fileInputRef.current?.click(); }
    };

    const viewerStories = userStory ? [userStory, ...storyUsers] : storyUsers;
    const storyUserIds = new Set(storyUsers.map(u => u.id));
    const uniqueFollowedUsers = followedUsers.filter(u => !storyUserIds.has(u.id));

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.06, duration: 0.5 } }
    } as const;

    const itemVariants = {
        hidden: { scale: 0.9, opacity: 0 },
        visible: { scale: 1, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 20 } }
    } as const;

    const StoryThumb = ({ image, hasStory, children }: { image?: string | null; hasStory?: boolean; children?: React.ReactNode }) => (
        <div className={cn(
            "relative w-14 h-20 rounded-xl overflow-hidden shrink-0 transition-all duration-300",
            hasStory ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
        )}>
            {image ? (
                <img src={image} alt="" className="w-full h-full object-cover" />
            ) : children}
            {hasStory && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/60" />
            )}
        </div>
    );

    return (
        <div className="w-full relative px-1 sm:px-0">
            <div className="transition-all duration-700">
                <ScrollArea className="w-full pb-3">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="flex items-start gap-3 p-2 px-3 md:px-4 w-max min-w-full"
                    >
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />

                        {isLoading ? (
                            <div className="flex gap-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="flex flex-col items-center gap-1.5">
                                        <Skeleton className="w-14 h-20 rounded-xl" />
                                        <Skeleton className="h-2.5 w-10 rounded-full" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                {/* My Story */}
                                <motion.div
                                    variants={itemVariants}
                                    whileTap={{ scale: 0.95 }}
                                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                                    onClick={handleMyStoryClick}
                                >
                                    <div className="relative">
                                        <StoryThumb image={userStory ? (user?.user_metadata?.avatar_url || null) : null} hasStory={!!userStory}>
                                            {!userStory && (
                                                <div className="w-full h-full border-2 border-dashed border-muted-foreground/30 bg-card flex items-center justify-center rounded-xl">
                                                    <Plus className="w-5 h-5 text-primary" />
                                                </div>
                                            )}
                                        </StoryThumb>
                                        {uploading && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl backdrop-blur-sm">
                                                <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-primary rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                                        You
                                    </span>
                                </motion.div>

                                {/* Users with stories */}
                                {storyUsers.map((storyUser) => (
                                    <motion.div
                                        key={storyUser.id}
                                        variants={itemVariants}
                                        whileTap={{ scale: 0.95 }}
                                        className="flex flex-col items-center gap-1.5 cursor-pointer group"
                                        onClick={() => openViewer(userStory ? storyUsers.indexOf(storyUser) + 1 : storyUsers.indexOf(storyUser))}
                                    >
                                        <StoryThumb image={storyUser.avatar} hasStory={true} />
                                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground group-hover:text-foreground transition-colors max-w-14 truncate text-center">
                                            {storyUser.username}
                                        </span>
                                    </motion.div>
                                ))}

                                {/* Followed without stories */}
                                {uniqueFollowedUsers.map((followedUser) => (
                                    <motion.div key={followedUser.id} variants={itemVariants} whileTap={{ scale: 0.95 }}>
                                        <Link to={`/profile/${followedUser.username}`} className="flex flex-col items-center gap-1.5 cursor-pointer group">
                                            <StoryThumb image={followedUser.avatar} hasStory={false} />
                                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 group-hover:text-foreground transition-colors max-w-14 truncate text-center">
                                                {followedUser.username}
                                            </span>
                                        </Link>
                                    </motion.div>
                                ))}
                            </>
                        )}
                    </motion.div>
                    <ScrollBar orientation="horizontal" className="bg-transparent" />
                </ScrollArea>
            </div>

            {viewerOpen && (
                <StoryViewer stories={viewerStories} initialUserIndex={initialUserIndex} onClose={() => setViewerOpen(false)} />
            )}
        </div>
    );
};
