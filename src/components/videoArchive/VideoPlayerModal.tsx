import { X, ExternalLink, Clock, Eye, Calendar } from "lucide-react";
import { VideoItem, getYouTubeEmbedUrl, getYouTubeWatchUrl, formatViewCount, formatPublishedDate } from "@/services/videoArchiveService";

interface VideoPlayerModalProps {
    video: VideoItem;
    onClose: () => void;
}

export const VideoPlayerModal = ({ video, onClose }: VideoPlayerModalProps) => {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-5xl mx-4 max-h-[95vh] overflow-y-auto rounded-2xl bg-background/95 backdrop-blur-xl border border-white/10 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all duration-200 hover:scale-110"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Video Player */}
                <div className="relative w-full aspect-video bg-black rounded-t-2xl overflow-hidden">
                    {video.r2_video_url ? (
                        <video
                            src={video.r2_video_url}
                            controls
                            autoPlay
                            className="w-full h-full object-contain"
                            playsInline
                        />
                    ) : (
                        <iframe
                            src={getYouTubeEmbedUrl(video.youtube_id)}
                            title={video.title}
                            className="w-full h-full"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        />
                    )}
                </div>

                {/* Video Info */}
                <div className="p-5 md:p-6 space-y-4">
                    <h2 className="text-lg md:text-xl font-bold text-foreground leading-tight">
                        {video.title}
                    </h2>

                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {video.duration && (
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                <span>{video.duration}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5">
                            <Eye className="w-4 h-4" />
                            <span>{formatViewCount(video.view_count)} views</span>
                        </div>
                        {video.published_at && (
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                <span>{formatPublishedDate(video.published_at)}</span>
                            </div>
                        )}
                    </div>

                    {/* Category Badge */}
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                            {video.category}
                        </span>
                        {video.is_featured && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
                                ⭐ Featured
                            </span>
                        )}
                    </div>

                    {/* Description */}
                    {video.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {video.description}
                        </p>
                    )}

                    {/* Watch on YouTube Link */}
                    <a
                        href={getYouTubeWatchUrl(video.youtube_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-400 transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Watch on YouTube
                    </a>
                </div>
            </div>
        </div>
    );
};
