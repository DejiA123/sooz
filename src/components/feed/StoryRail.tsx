
import { useEffect, useState, useRef } from "react";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StoryViewer } from "./StoryViewer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { s3Client, s3Config } from "@/integrations/s3/client";
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
    const [storyUsers, setStoryUsers] = useState<StoryUser[]>([]); // Users with stories
    const [followedUsers, setFollowedUsers] = useState<StoryUser[]>([]); // Users without stories but followed
    const [userStory, setUserStory] = useState<any>(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [initialUserIndex, setInitialUserIndex] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();

        const channel = supabase
            .channel('public:stories')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchData = async () => {
        if (!user) return;
        await Promise.all([fetchStories(), fetchFollowedUsers()]);
    };

    const fetchStories = async () => {
        try {
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from('stories')
                .select(`
                    id, user_id, media_url, media_type, created_at,
                    profiles ( id, username, display_name, avatar_url )
                `)
                .gt('expires_at', now)
                .order('created_at', { ascending: true });

            if (data) {
                // Group by user
                const grouped: Record<string, StoryUser> = {};
                data.forEach((story: any) => {
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

                // Split mine vs others
                const others = Object.values(grouped).filter((g) => g.id !== user?.id);
                const mine = grouped[user?.id || ''];

                setStoryUsers(others);
                setUserStory(mine);
            }
        } catch (error) {
            console.error("Error fetching stories:", error);
        }
    };

    const fetchFollowedUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('follows')
                .select(`
                    following_id,
                    profiles:follows_following_id_fkey ( id, username, display_name, avatar_url )
                `)
                .eq('follower_id', user?.id || '');

            if (error) throw error;

            if (data) {
                const formatted: StoryUser[] = data.map((f: any) => ({
                    id: f.profiles.id,
                    username: f.profiles.username,
                    display_name: f.profiles.display_name,
                    avatar: f.profiles.avatar_url,
                    stories: [],
                    hasStory: false
                }));
                setFollowedUsers(formatted);
            }
        } catch (error) {
            console.error("Error fetching follows:", error);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        const toastId = toast.loading("Uploading story... 0%");

        try {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileExt = file.name.split('.').pop();
            const fileName = `stories/${user.id}/${uniqueSuffix}.${fileExt}`;

            const upload = new Upload({
                client: s3Client,
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
            fetchData();

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
