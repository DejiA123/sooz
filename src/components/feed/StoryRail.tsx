
import { useEffect, useState, useRef } from "react";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StoryViewer } from "./StoryViewer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const StoryRail = () => {
    const { user } = useAuth();
    const [stories, setStories] = useState<any[]>([]);
    const [userStory, setUserStory] = useState<any>(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [initialUserIndex, setInitialUserIndex] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchStories();

        const channel = supabase
            .channel('public:stories')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
                fetchStories();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

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
                const grouped: any = {};
                data.forEach((story: any) => {
                    const uid = story.user_id;
                    if (!grouped[uid]) {
                        grouped[uid] = {
                            id: uid,
                            username: story.profiles?.username || "User",
                            display_name: story.profiles?.display_name,
                            avatar: story.profiles?.avatar_url,
                            stories: []
                        };
                    }
                    grouped[uid].stories.push(story);
                });

                // Split mine vs others
                const others = Object.values(grouped).filter((g: any) => g.id !== user?.id);
                const mine = grouped[user?.id || ''];

                setStories(others);
                setUserStory(mine);
            }
        } catch (error) {
            console.error("Error fetching stories:", error);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        const toastId = toast.loading("Uploading story...");

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `stories/${user.id}/${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('media')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('media')
                .getPublicUrl(fileName);

            const { error: dbError } = await supabase.from('stories').insert({
                user_id: user.id,
                media_url: publicUrl,
                media_type: file.type.startsWith('video') ? 'video' : 'image'
            });

            if (dbError) throw dbError;

            toast.success("Story added!", { id: toastId });
            fetchStories();

        } catch (error: any) {
            toast.error("Failed to upload: " + error.message, { id: toastId });
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
    const viewerStories = userStory ? [userStory, ...stories] : stories;

    return (
        <div className="w-full pb-4 pt-2">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-4 px-4 pb-2">
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

                    {/* Other Users */}
                    {stories.map((story, i) => (
                        <div
                            key={story.id}
                            className="flex flex-col items-center gap-1.5 cursor-pointer group"
                            onClick={() => openViewer(userStory ? i + 1 : i)}
                        >
                            <div className="relative">
                                <div className="p-[2px] rounded-full transition-all duration-300 bg-gradient-to-tr from-yellow-400 to-fuchsia-600">
                                    <Avatar className="w-16 h-16 border-2 border-background group-hover:scale-95 transition-transform duration-300">
                                        <AvatarImage src={story.avatar} className="object-cover" />
                                        <AvatarFallback>{story.username[0].toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                </div>
                            </div>
                            <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors max-w-[64px] truncate text-center">
                                {story.username}
                            </span>
                        </div>
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
