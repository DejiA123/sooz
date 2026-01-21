import { useState, useEffect, useRef } from "react";
import { X, Heart, MessageCircle, Share2, MoreHorizontal, Music2, ChevronLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CommentDrawer } from "./CommentDrawer";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { LazyVideo } from "./LazyVideo";
import { LazyImage } from "./LazyImage";

interface VideoFeedModalProps {
    initialPost?: any; // kept for legacy or single-post usage
    posts?: any[]; // optional external feed
    initialIndex?: number; // start index in the external feed
    onClose: () => void;
    startTime?: number;
}

export const VideoFeedModal = ({ initialPost, posts: externalPosts, initialIndex = 0, onClose, startTime = 0 }: VideoFeedModalProps) => {
    const { user } = useAuth();
    // Use external posts if provided, otherwise default to single initialPost and fetch more
    const [posts, setPosts] = useState<any[]>(externalPosts || (initialPost ? [initialPost] : []));
    const [activeIndex, setActiveIndex] = useState(externalPosts ? initialIndex : 0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showComments, setShowComments] = useState(false);
    const [activePostForComments, setActivePostForComments] = useState<string | null>(null);

    // If NO external posts were provided, we fetch random ones (legacy behavior for generic feed)
    useEffect(() => {
        if (externalPosts) return; // interactive profile feed doesn't need fetching logic

        if (!initialPost) return;

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
                .neq('id', initialPost.id)
                .limit(10);

            if (data) {
                setPosts(prev => [...prev, ...data]);
            }
        };

        fetchMoreVideos();
    }, [initialPost, externalPosts]);

    // Scroll to initial index on mount
    useEffect(() => {
        if (containerRef.current && initialIndex > 0) {
            containerRef.current.scrollTop = initialIndex * containerRef.current.clientHeight;
        }
    }, [initialIndex]);

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
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white"
            >
                {/* Modern Header / Close Button */}
                <div className="absolute top-0 left-0 right-0 z-[60] p-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
                    {/* Modern "Back" style close button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="pointer-events-auto rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 border border-white/5 w-10 h-10"
                    >
                        <ChevronLeft className="w-6 h-6 -ml-0.5" />
                    </Button>
                </div>

                {/* Main Feed Container */}
                <div
                    ref={containerRef}
                    className="w-full flex-1 overflow-y-scroll snap-y snap-mandatory no-scrollbar h-full md:max-w-[450px] md:h-full md:border-x md:border-white/10 bg-black"
                    onScroll={handleScroll}
                >
                    {posts.map((post, index) => {
                        const isActive = index === activeIndex;
                        const isLiked = user && post.likes?.some((l: any) => l.user_id === user.id);

                        return (
                            <div key={post.id} className="w-full h-full snap-start relative flex items-center justify-center bg-black">
                                {/* Media Player */}
                                <div className="absolute inset-0 bg-black flex items-center justify-center">
                                    {post.media_type === 'video' ? (
                                        <LazyVideo
                                            src={post.media_url}
                                            id={`${post.id}-modal`}
                                            startTime={index === initialIndex && initialIndex === 0 ? startTime : 0} // Only inherit start time if it's the very first one
                                            onClick={() => { }}
                                            // Ensure it plays when it becomes the active slide
                                            priority={Math.abs(index - activeIndex) <= 1}
                                        />
                                    ) : (
                                        <LazyImage
                                            src={post.media_url}
                                            alt={post.caption || "Post"}
                                            className="w-full h-full object-contain"
                                            priority={Math.abs(index - activeIndex) <= 1}
                                        />
                                    )}
                                </div>

                                {/* Overlay UI */}
                                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80 pointer-events-none" />

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
                                        <span className="text-white text-xs font-bold drop-shadow-md">{post.likes?.length || 0}</span>
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
                                        <span className="text-white text-xs font-bold drop-shadow-md">{post.comments?.[0]?.count || 0}</span>
                                    </div>

                                    <Button variant="ghost" size="icon" className="rounded-full w-12 h-12 bg-black/20 backdrop-blur-sm hover:bg-black/40 text-white">
                                        <Share2 className="w-6 h-6" />
                                    </Button>

                                    {/* Rotating Audio Disc or Avatar */}
                                    <div className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center overflow-hidden animate-spin-slow mt-2">
                                        <Avatar className="w-full h-full">
                                            <AvatarImage src={post.profiles?.avatar_url} />
                                            <AvatarFallback>U</AvatarFallback>
                                        </Avatar>
                                    </div>
                                </div>

                                {/* Bottom Info */}
                                <div className="absolute bottom-0 left-0 right-16 p-5 z-40 text-white pb-10">
                                    <div className="flex items-center gap-3 mb-3">
                                        <Avatar className="w-10 h-10 border border-white/20 cursor-pointer">
                                            <AvatarImage src={post.profiles?.avatar_url} />
                                            <AvatarFallback>{post.profiles?.username?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-semibold text-shadow-sm cursor-pointer text-lg">
                                            {post.profiles?.username || "user"}
                                        </span>
                                        <Button variant="outline" size="sm" className="h-7 px-3 bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20 hover:text-white rounded-full text-xs">
                                            Follow
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="opacity-95 line-clamp-2 text-sm leading-relaxed drop-shadow-sm">
                                            {post.caption}
                                        </p>
                                        <div className="flex items-center gap-2 opacity-80">
                                            <Music2 className="w-3 h-3" />
                                            <span className="text-xs">Original Audio</span>
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
