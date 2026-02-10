import { Play, Clock, Eye, Cloud } from "lucide-react";
import { VideoItem, formatViewCount, formatPublishedDate } from "@/services/videoArchiveService";

interface VideoCardProps {
    video: VideoItem;
    onClick: () => void;
    layout?: "grid" | "featured";
}

export const VideoCard = ({ video, onClick, layout = "grid" }: VideoCardProps) => {
    const thumbnailUrl =
        video.thumbnail_url ||
        `https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`;

    if (layout === "featured") {
        return (
            <div
                onClick={onClick}
                className="relative group cursor-pointer rounded-2xl overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 border border-white/5 hover:border-primary/30 transition-all duration-500 hover:shadow-xl hover:shadow-primary/5 min-w-[300px] md:min-w-[400px] snap-start"
            >
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden">
                    <img
                        src={thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Play Button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                            <Play className="w-7 h-7 text-white ml-1" fill="white" />
                        </div>
                    </div>

                    {/* Duration Badge */}
                    {video.duration && (
                        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {video.duration}
                        </div>
                    )}

                    {/* Featured Badge */}
                    <div className="absolute top-3 left-3 flex gap-2">
                        <div className="px-2.5 py-1 rounded-full bg-amber-500/90 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider">
                            ⭐ Featured
                        </div>
                        {video.r2_video_url && (
                            <div className="px-2.5 py-1 rounded-full bg-blue-500/90 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <Cloud className="w-3 h-3" />
                                Synced
                            </div>
                        )}
                    </div>

                    {/* Title on overlay */}
                    <div className="absolute bottom-3 left-3 right-16">
                        <h3 className="text-white font-semibold text-sm md:text-base line-clamp-2 drop-shadow-lg">
                            {video.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5 text-white/70 text-xs">
                            <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {formatViewCount(video.view_count)}
                            </span>
                            <span>{formatPublishedDate(video.published_at)}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className="group cursor-pointer rounded-xl overflow-hidden bg-card/50 border border-white/5 hover:border-primary/20 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
        >
            {/* Thumbnail */}
            <div className="relative aspect-video overflow-hidden bg-muted">
                <img
                    src={thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                />

                {/* Play Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100 border border-white/30">
                        <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                    </div>
                </div>

                {/* Duration Badge */}
                {video.duration && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-white text-[10px] font-medium">
                        {video.duration}
                    </div>
                )}

                {/* Category Badge */}
                <div className="absolute top-2 left-2 flex gap-1.5">
                    <div className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium capitalize">
                        {video.category}
                    </div>
                    {video.r2_video_url && (
                        <div className="px-2 py-0.5 rounded-full bg-blue-500/80 backdrop-blur-sm text-white text-[10px] font-bold flex items-center gap-1 shadow-lg">
                            <Cloud className="w-2.5 h-2.5 fill-white/20" />
                            Synced
                        </div>
                    )}
                </div>
            </div>

            {/* Info */}
            <div className="p-3 space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                    {video.title}
                </h3>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {formatViewCount(video.view_count)}
                    </span>
                    <span>{formatPublishedDate(video.published_at)}</span>
                </div>
            </div>
        </div>
    );
};
