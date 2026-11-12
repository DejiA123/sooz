import { useState, useEffect, useCallback } from "react";
import { Search, Play, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useInView } from "react-intersection-observer";
import {
    fetchVideos,
    fetchFeaturedVideos,
    VideoItem,
    VIDEO_CATEGORIES,
    triggerSync,
} from "@/services/videoArchiveService";
import { VideoCard } from "@/components/videoArchive/VideoCard";
import { VideoPlayerModal } from "@/components/videoArchive/VideoPlayerModal";
import { MobileDownloadModal } from "@/components/videoArchive/MobileDownloadModal";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function VideoArchive() {
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [featuredVideos, setFeaturedVideos] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
    const [displayLimit, setDisplayLimit] = useState(12);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [downloadVideo, setDownloadVideo] = useState<VideoItem | null>(null);

    const loadVideos = useCallback(async () => {
        setLoading(true);
        try {
            const [allVideos, featured] = await Promise.all([
                fetchVideos(activeCategory, searchQuery),
                fetchFeaturedVideos(),
            ]);
            setVideos(allVideos);
            setFeaturedVideos(featured);
        } catch (error) {
            console.error("Error loading videos:", error);
        } finally {
            setLoading(false);
        }
    }, [activeCategory, searchQuery]);

    const handleSync = async () => {
        setIsSyncing(true);
        toast.info("Updating archive from YouTube...");

        try {
            const result = await triggerSync();
            if (result.success) {
                setLastSynced(new Date());
                await loadVideos();
                toast.success(result.message);
            } else {
                toast.error(`Sync failed: ${result.message}`);
            }
        } catch (error) {
            toast.error("An unexpected error occurred during sync");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDownload = (video: VideoItem) => {
        if (!video.r2_video_url) return;

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);

        if (isMobile) {
            // On mobile, show the download modal with instructions
            setDownloadVideo(video);
        } else {
            // On desktop, use anchor with download attribute
            const a = document.createElement("a");
            a.href = video.r2_video_url;
            a.download = `${video.title.replace(/[^a-z0-9]/gi, "_")}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

        }
    };

    useEffect(() => {
        loadVideos();
        setDisplayLimit(12); // Reset on filter change
    }, [loadVideos]);

    // Infinite scroll observer
    const { ref: loadMoreRef, inView } = useInView({
        threshold: 0,
        rootMargin: "600px",
    });

    useEffect(() => {
        if (inView && displayLimit < videos.length) {
            setDisplayLimit(prev => prev + 12);
        }
    }, [inView, displayLimit, videos.length]);

    // Close modal on escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedVideo(null);
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    return (
        <div className="pb-24 min-h-screen">
            {/* Hero Header */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent dark:from-primary/10 dark:via-primary/5" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent" />

                <div className="relative px-4 pt-16 pb-6 md:pt-8 md:pb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                            <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                                Video Archive
                            </h1>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground font-medium">
                                    The Power House International
                                </p>
                                {lastSynced && (
                                    <div className="flex items-center gap-1 text-[10px] text-green-500/80 font-bold">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>JUST UPDATED</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <p className="text-sm text-muted-foreground mt-3 max-w-lg leading-relaxed">
                            Watch sermons, worship sessions, and special events. God meets with
                            you at the points of your need and beyond. 🔥
                        </p>

                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${isSyncing
                                ? "bg-primary/20 text-primary cursor-not-allowed"
                                : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                                }`}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                            {isSyncing ? "Syncing..." : "Refresh Archive"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="sticky top-12 md:top-0 z-40 bg-background/80 backdrop-blur-xl px-4 py-3 border-b border-border/60">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search videos..."
                        className="pl-10 bg-muted/50 border-border rounded-xl focus:bg-background transition-colors"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Category Tabs */}
            <div className="px-4 py-3">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {VIDEO_CATEGORIES.map((cat) => (
                        <button
                            key={cat.value}
                            onClick={() => setActiveCategory(cat.value)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 ${activeCategory === cat.value
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted border border-border/60"
                                }`}
                        >
                            <span>{cat.emoji}</span>
                            <span>{cat.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="px-4 space-y-8 animate-pulse">
                    {/* Featured Skeleton */}
                    {activeCategory === "all" && !searchQuery && (
                        <div className="space-y-4">
                            <Skeleton className="h-6 w-32 bg-muted/30 rounded-lg" />
                            <div className="flex gap-4 overflow-hidden">
                                {[1, 2].map((i) => (
                                    <Skeleton
                                        key={i}
                                        className="min-w-[300px] md:min-w-[400px] aspect-video rounded-2xl bg-muted/30"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Grid Skeleton */}
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-40 bg-muted/30 rounded-lg" />
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                <div key={i} className="space-y-3">
                                    <Skeleton className="aspect-video rounded-xl bg-muted/30" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-full bg-muted/30" />
                                        <Skeleton className="h-3 w-2/3 bg-muted/20" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Featured Videos Carousel */}
                    {featuredVideos.length > 0 && activeCategory === "all" && !searchQuery && (
                        <div className="px-4 mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <span className="text-amber-500">⭐</span> Featured
                                </h2>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory">
                                {featuredVideos.map((video) => (
                                    <VideoCard
                                        key={video.id}
                                        video={video}
                                        layout="featured"
                                        onClick={() => setSelectedVideo(video)}
                                        onDownload={handleDownload}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* All Videos Grid */}
                    <div className="px-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-bold text-foreground">
                                {activeCategory === "all"
                                    ? "All Videos"
                                    : VIDEO_CATEGORIES.find((c) => c.value === activeCategory)
                                        ?.label || "Videos"}
                            </h2>
                            <span className="text-xs text-muted-foreground font-medium">
                                {videos.length} video{videos.length !== 1 ? "s" : ""}
                            </span>
                        </div>

                        {videos.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                                    <Play className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <p className="text-muted-foreground font-medium">
                                    No videos found
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Try a different search or category
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
                                    {videos.slice(0, displayLimit).map((video) => (
                                        <VideoCard
                                            key={video.id}
                                            video={video}
                                            onClick={() => setSelectedVideo(video)}
                                            onDownload={handleDownload}
                                        />
                                    ))}
                                </div>
                                {displayLimit < videos.length && (
                                    <div ref={loadMoreRef} className="py-10 flex justify-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Channel CTA */}
                    <div className="px-4 mt-6 mb-4">
                        <a
                            href="https://www.youtube.com/@thepowerhouseintl"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full p-4 rounded-2xl bg-gradient-to-r from-red-500/10 to-red-600/5 border border-red-500/20 hover:border-red-500/40 transition-all duration-300 group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground">
                                        The Power House International
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Subscribe on YouTube for more →
                                    </p>
                                </div>
                            </div>
                        </a>
                    </div>
                </>
            )}

            {/* Video Player Modal */}
            {selectedVideo && (
                <VideoPlayerModal
                    video={selectedVideo}
                    onClose={() => setSelectedVideo(null)}
                    onDownload={handleDownload}
                />
            )}

            {/* Mobile Download Modal */}
            {downloadVideo && downloadVideo.r2_video_url && (
                <MobileDownloadModal
                    url={downloadVideo.r2_video_url}
                    title={downloadVideo.title}
                    onClose={() => setDownloadVideo(null)}
                />
            )}
        </div>
    );
}
