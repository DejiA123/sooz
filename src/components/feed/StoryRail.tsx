
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
import { getS3Client, s3Config } from "@/integrations/s3/client";
import { Upload } from "@aws-sdk/lib-storage";
import { Link, useNavigate } from "react-router-dom";

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

    const { data: storyData, isLoading } = useQuery({
        queryKey: ['stories', user?.id],
        queryFn: async () => {
            if (!user) return { storyUsers: [], userStory: null };

            const now = new Date().toISOString();

            // Parallel fetch for speed
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

            // Process Stories
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

            // Process Follows (to show users without stories)
            let followed: StoryUser[] = [];
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
        staleTime: 1000 * 60 * 5, // 5 min cache
    });

    const storyUsers = storyData?.storyUsers || [];
    const userStory = storyData?.userStory || null;
    const followedUsers = storyData?.followedUsers || [];

    useEffect(() => {
        if (!user) return;
        // Subscribe to new stories
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

        const toastId = toast.loading("Uploading story... 0%");

        try {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileExt = file.name.split('.').pop();
            const fileName = `stories/${user.id}/${uniqueSuffix}.${fileExt}`;

            const upload = new Upload({
                client: getS3Client(),
                params: {
                    Bucket: s3Config.bucketName,
                    Key: fileName,
                    Body: file,
                    ContentType: file.type,
                },
            });

            upload.on("httpUploadProgress", (progress) => {
                if (progress.loaded && progress.total) {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    toast.loading(`Uploading story... ${percent}%`, { id: toastId });
                }
            });

            await upload.done();

            const publicUrl = `${import.meta.env.VITE_PUBLIC_R2_URL}/${fileName}`;

            const { error: dbError } = await supabase.from('stories').insert({
                user_id: user.id,
                media_url: publicUrl,
                media_type: file.type.startsWith('video') ? 'video' : 'image'
            });

            if (dbError) throw dbError;

            toast.success("Story added!", { id: toastId });
            queryClient.invalidateQueries({ queryKey: ['stories', user.id] });

        } catch (error: any) {
            console.error("Story upload error:", error);
            toast.error("Failed to upload: " + (error.message || "Unknown error"), { id: toastId });
        }
    };

    const openViewer = (index: number) => {
        setInitialUserIndex(index);
        setViewerOpen(true);
    };

    const handleMyStoryClick = () => {
        if (userStory) {
            // My story is index 0 in the combined list
            openViewer(0);
        } else {
            fileInputRef.current?.click();
        }
    };

    // Combine for viewer: [My Story (if exists), ...Others]
    // Only users with stories go into the viewer
    const viewerStories = userStory ? [userStory, ...storyUsers] : storyUsers;

    // Filter followed users to remove duplicates (those who already have stories)
    const storyUserIds = new Set(storyUsers.map(u => u.id));
    const uniqueFollowedUsers = followedUsers.filter(u => !storyUserIds.has(u.id));

    return (
        <div className="w-full pb-4 pt-2">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-4 px-0 md:px-4 pb-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*,video/*"
                        onChange={handleFileUpload}
                    />

                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex gap-4">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="flex flex-col items-center gap-1.5">
                                    <Skeleton className="w-[68px] h-[68px] rounded-full" />
                                    <Skeleton className="h-3 w-12" />
                                </div>
                            ))}
                        </div>
                    )}

                    {!isLoading && (
                        <>
                            {/* Current User Story */}
                            <div className="flex flex-col items-center gap-1.5 cursor-pointer group" onClick={handleMyStoryClick}>
                                <div className="relative">
                                    <div className={cn(
                                        "p-[2px] rounded-full transition-all duration-300",
                                        userStory ? "bg-gradient-to-tr from-yellow-400 to-fuchsia-600" : ""
                                    )}>
                                        <Avatar className="w-16 h-16 border-2 border-background group-hover:scale-95 transition-transform duration-300">
                                            <AvatarImage src={user?.user_metadata?.avatar_url} className="object-cover" />
                                            <AvatarFallback>ME</AvatarFallback>
                                        </Avatar>
                                    </div>
                                    {!userStory && (
                                        <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1 border-2 border-background">
                                            <Plus className="w-3 h-3" strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                                <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                                    Your Story
                                </span>
                            </div>

                            {/* Users WITH Stories */}
                            {storyUsers.map((storyUser, i) => (
                                <div
                                    key={storyUser.id}
                                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                                    onClick={() => openViewer(userStory ? i + 1 : i)}
                                >
                                    <div className="relative">
                                        <div className="p-[2px] rounded-full transition-all duration-300 bg-gradient-to-tr from-yellow-400 to-fuchsia-600">
                                            <Avatar className="w-16 h-16 border-2 border-background group-hover:scale-95 transition-transform duration-300">
                                                <AvatarImage src={storyUser.avatar || ""} className="object-cover" />
                                                <AvatarFallback>{storyUser.username[0]?.toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors max-w-[64px] truncate text-center">
                                        {storyUser.username}
                                    </span>
                                </div>
                            ))}

                            {/* Followed Users WITHOUT Stories */}
                            {uniqueFollowedUsers.map((followedUser) => (
                                <Link
                                    key={followedUser.id}
                                    to={`/profile/${followedUser.username}`}
                                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                                >
                                    <div className="relative">
                                        <div className="p-[2px] rounded-full transition-all duration-300 border-2 border-muted hover:border-muted-foreground/50">
                                            <Avatar className="w-16 h-16 border-2 border-background group-hover:scale-95 transition-transform duration-300">
                                                <AvatarImage src={followedUser.avatar || ""} className="object-cover" />
                                                <AvatarFallback>{followedUser.username[0]?.toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors max-w-[64px] truncate text-center">
                                        {followedUser.username}
                                    </span>
                                </Link>
                            ))}
                        </>
                    )}
                </div>
                <ScrollBar orientation="horizontal" className="hidden" />
            </ScrollArea>

            {viewerOpen && viewerStories.length > 0 && (
                <StoryViewer
                    initialUserIndex={initialUserIndex}
                    stories={viewerStories}
                    onClose={() => setViewerOpen(false)}
                />
            )}
        </div>
    );
};
