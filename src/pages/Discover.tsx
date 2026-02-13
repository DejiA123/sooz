import { useEffect, useState } from "react";
import { Search, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { LazyImage } from "@/components/feed/LazyImage";
import { LazyVideo } from "@/components/feed/LazyVideo";
import { fetchVideos, VideoItem, getYouTubeWatchUrl } from "@/services/videoArchiveService";
import { VideoPlayerModal } from "@/components/videoArchive/VideoPlayerModal";

interface DiscoverPost {
    id: string;
    media_url: string | null;
    media_type: string | null;
}

interface DiscoverUser {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
}

export default function Discover() {
    const [posts, setPosts] = useState<DiscoverPost[]>([]);
    const [users, setUsers] = useState<DiscoverUser[]>([]);
    const [archiveVideos, setArchiveVideos] = useState<VideoItem[]>([]);
    const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, [searchQuery]);

    const handleDownload = (video: VideoItem) => {
        if (video.r2_video_url) {
            const a = document.createElement("a");
            a.href = video.r2_video_url;
            a.download = `${video.title}.mp4`;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            window.open(getYouTubeWatchUrl(video.youtube_id), "_blank");
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Posts
            let postQuery = supabase
                .from("posts")
                .select("id, media_url, media_type, caption")
                .not("media_url", "is", null)
                .order("created_at", { ascending: false })
                .limit(20);

            if (searchQuery.trim()) {
                postQuery = postQuery.ilike("caption", `%${searchQuery.trim()}%`);
            }

            const { data: postData, error: postError } = await postQuery;
            if (postError) throw postError;
            setPosts(postData || []);

            // 2. Fetch Users (only if searching)
            if (searchQuery.trim()) {
                const { data: userData, error: userError } = await supabase
                    .from("profiles")
                    .select("id, username, display_name, avatar_url")
                    .or(`username.ilike.%${searchQuery.trim()}%,display_name.ilike.%${searchQuery.trim()}%`)
                    .limit(10);

                if (userError) throw userError;
                setUsers(userData || []);
            } else {
                setUsers([]);
            }

            // 3. Fetch Video Archive
            const videos = await fetchVideos(undefined, searchQuery.trim() || undefined);
            setArchiveVideos(videos);

        } catch (error) {
            console.error("Error fetching discover data:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pb-20">
            <div className="sticky top-12 md:top-0 z-40 bg-background/80 backdrop-blur-xl px-4 py-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search..."
                        className="pl-10 bg-muted/50 border-white/10 rounded-xl focus:bg-background transition-colors"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Found Users Section */}
            {users.length > 0 && (
                <div className="px-4 py-2 border-b border-white/5 mb-2">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">People</h3>
                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                        {users.map(user => (
                            <div
                                key={user.id}
                                className="flex flex-col items-center gap-1 min-w-[70px] cursor-pointer"
                                onClick={() => navigate(`/profile/${user.username}`)}
                            >
                                <Avatar className="w-14 h-14 border-2 border-primary/20">
                                    <AvatarImage src={user.avatar_url || ""} className="object-cover" />
                                    <AvatarFallback>{(user.display_name || user.username)[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-center truncate w-full">{user.display_name || user.username}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Video Archive Rail */}
            {archiveVideos.length > 0 && (
                <div className="px-4 py-3 border-b border-white/5 mb-2">
                    <h3 className="text-sm font-semibold text-foreground mb-3">📺 Videos</h3>
                    <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar snap-x snap-mandatory">
                        {archiveVideos.slice(0, 20).map(video => {
                            const thumb = video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`;
                            return (
                                <div
                                    key={video.id}
                                    className="relative min-w-[160px] w-[160px] aspect-[9/16] rounded-xl overflow-hidden cursor-pointer group snap-start flex-shrink-0 bg-muted"
                                    onClick={() => setSelectedVideo(video)}
                                >
                                    <img
                                        src={thumb}
                                        alt={video.title}
                                        className="w-full h-full object-cover sm:transition-transform sm:duration-500 sm:group-hover:scale-110"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                            <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                                        </div>
                                    </div>
                                    <div className="absolute bottom-2 left-2 right-2">
                                        <p className="text-white text-[11px] font-medium line-clamp-2 leading-tight drop-shadow-lg">
                                            {video.title}
                                        </p>
                                    </div>
                                    {video.r2_video_url && (
                                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-primary/80 text-[9px] text-white font-bold">
                                            HD
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-3 gap-0.5 px-0.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                        <Skeleton key={i} className="aspect-[3/4] w-full bg-muted/30" />
                    ))}
                </div>
            ) : posts.length === 0 && users.length === 0 && archiveVideos.length === 0 ? (
                <div className="text-center text-muted-foreground py-20">
                    <p>No results found</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-0.5 px-0.5 pb-4">
                    {posts.map((post, index) => (
                        <div
                            key={post.id}
                            className="relative rounded-none overflow-hidden bg-muted aspect-[3/4] group cursor-pointer"
                            onClick={() => navigate(`/post/${post.id}`)}
                        >
                            {post.media_type === 'video' ? (
                                <LazyVideo
                                    src={post.media_url || ""}
                                    id={`discover-${post.id}`}
                                    priority={index < 6}
                                />
                            ) : (
                                <LazyImage
                                    src={post.media_url || ""}
                                    alt="Discover"
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    priority={index < 6}
                                />
                            )}
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors pointer-events-none" />
                        </div>
                    ))}
                </div>
            )}

            {/* Video Player Modal */}
            {selectedVideo && (
                <VideoPlayerModal
                    video={selectedVideo}
                    onClose={() => setSelectedVideo(null)}
                    onDownload={handleDownload}
                />
            )}
        </div>
    );
}
