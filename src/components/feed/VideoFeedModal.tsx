
import { useState, useEffect, useRef } from "react";
import { X, Heart, MessageCircle, Share2, MoreHorizontal, Music2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CommentDrawer } from "./CommentDrawer";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

interface VideoFeedModalProps {
    initialPost: any; // The post that was clicked
    onClose: () => void;
}

export const VideoFeedModal = ({ initialPost, onClose }: VideoFeedModalProps) => {
    const { user } = useAuth();
    const [posts, setPosts] = useState<any[]>([initialPost]);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showComments, setShowComments] = useState(false);
    const [activePostForComments, setActivePostForComments] = useState<string | null>(null);

    useEffect(() => {
        // Fetch more videos to populate the feed
        const fetchMoreVideos = async () => {
            const { data } = await supabase
                .from('posts')
                .select(`
                    *,
                    profiles (username, display_name, avatar_url),
                    likes (user_id),
                    comments (count)
                `)
                .eq('media_type', 'video')
                .neq('id', initialPost.id) // Don't fetch the same one
                .limit(10); // Fetch 10 random/recent videos

            if (data) {
                setPosts(prev => [...prev, ...data]);
            }
        };

        fetchMoreVideos();
    }, [initialPost.id]);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const index = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
        if (index !== activeIndex) {
            setActiveIndex(index);
        }
    };

    const toggleLike = async (postIndex: number) => {
        const post = posts[postIndex];
        if (!user) return;

        const isLiked = post.likes?.some((l: any) => l.user_id === user.id);

        // Optimistic update
        const newPosts = [...posts];
        if (isLiked) {
            newPosts[postIndex].likes = newPosts[postIndex].likes.filter((l: any) => l.user_id !== user.id);
            await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
        } else {
            newPosts[postIndex].likes = [...(newPosts[postIndex].likes || []), { user_id: user.id }];
            await supabase.from('likes').insert({ post_id: post.id, user_id: user.id });
        }
        setPosts(newPosts);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="fixed inset-0 z-50 bg-black flex flex-col"
            >
                {/* Header (Back button) */}
                <div className="absolute top-4 left-4 z-50">
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-black/20 text-white backdrop-blur-md hover:bg-black/40">
                        <X className="w-6 h-6" />
                    </Button>
                </div>

                {/* Main Feed Container */}
                <div
                    ref={containerRef}
                    className="flex-1 overflow-y-scroll snap-y snap-mandatory no-scrollbar h-full"
                    onScroll={handleScroll}
                >
                    {posts.map((post, index) => {
                        const isActive = index === activeIndex;
                        const isLiked = user && post.likes?.some((l: any) => l.user_id === user.id);

                        return (
                            <div key={post.id} className="w-full h-full snap-start relative flex items-center justify-center bg-zinc-900">
                                {/* Video Player */}
                                <video
                                    ref={(el) => {
                                        // Pause non-active videos
                                        if (el && !isActive) {
                                            el.pause();
                                        }
                                    }}
                                    src={post.media_url}
                                    className="w-full h-full object-cover"
                                    loop
                                    playsInline
                                    autoPlay={isActive}
                                    muted={false}
                                    preload={index === activeIndex + 1 ? "auto" : "none"} // Preload next video
                                    onClick={(e) => {
                                        e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause();
                                    }}
                                />

                                {/* Overlay UI */}
                                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 pointer-events-none" />

                                {/* Right Sidebar Actions */}
                                <div className="absolute bottom-20 right-4 flex flex-col gap-6 items-center z-40">
                                    <div className="flex flex-col items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="rounded-full w-12 h-12 bg-black/20 backdrop-blur-sm hover:bg-black/40"
                                            onClick={() => toggleLike(index)}
                                        >
                                            <Heart className={cn("w-7 h-7", isLiked ? "fill-red-500 text-red-500" : "text-white")} />
                                        </Button>
                                        <span className="text-white text-xs font-medium">{post.likes?.length || 0}</span>
                                    </div>

                                    <div className="flex flex-col items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="rounded-full w-12 h-12 bg-black/20 backdrop-blur-sm hover:bg-black/40"
                                            onClick={() => {
                                                setActivePostForComments(post.id);
                                                setShowComments(true);
                                            }}
                                        >
                                            <MessageCircle className="w-7 h-7 text-white" />
                                        </Button>
                                        <span className="text-white text-xs font-medium">{post.comments?.[0]?.count || 0}</span>
                                    </div>

                                    <Button variant="ghost" size="icon" className="rounded-full w-12 h-12 bg-black/20 backdrop-blur-sm hover:bg-black/40 text-white">
                                        <Share2 className="w-6 h-6" />
                                    </Button>

                                    <Button variant="ghost" size="icon" className="rounded-full w-12 h-12 bg-black/20 backdrop-blur-sm hover:bg-black/40 text-white">
                                        <MoreHorizontal className="w-6 h-6" />
                                    </Button>

                                    {/* Rotating Audio Disc */}
                                    <div className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center overflow-hidden animate-spin-slow">
                                        <Avatar className="w-full h-full">
                                            <AvatarImage src={post.profiles?.avatar_url} />
                                            <AvatarFallback>M</AvatarFallback>
                                        </Avatar>
                                    </div>
                                </div>

                                {/* Bottom Info */}
                                <div className="absolute bottom-0 left-0 right-16 p-6 z-40 text-white pb-10">
                                    <div className="flex items-center gap-3 mb-3">
                                        <Avatar className="w-10 h-10 border border-white/20 cursor-pointer">
                                            <AvatarImage src={post.profiles?.avatar_url} />
                                            <AvatarFallback>{post.profiles?.username?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-semibold text-shadow-sm cursor-pointer hover:underline">
                                            {post.profiles?.username || "user"}
                                        </span>
                                        <Button variant="outline" size="sm" className="h-7 px-3 bg-transparent border-white/50 text-white hover:bg-white/20 hover:text-white">
                                            Follow
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="opacity-90 line-clamp-2 text-sm leading-relaxed">
                                            {post.caption}
                                        </p>
                                        <div className="flex items-center gap-2 opacity-70">
                                            <Music2 className="w-3 h-3" />
                                            <span className="text-xs marquee">Original Audio - {post.profiles?.username}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {showComments && activePostForComments && (
                    <CommentDrawer
                        postId={activePostForComments}
                        open={showComments}
                        onOpenChange={setShowComments}
                    />
                )}
            </motion.div>
        </AnimatePresence>
    );
};
