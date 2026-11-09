
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ReportSheet } from "@/components/safety/ReportSheet";
import { useSafeFilter } from "@/components/safety/useSafeFilter";

interface Comment {
    id: string;
    user_id?: string;
    content: string;
    created_at: string;
    user: {
        username: string;
        avatar_url: string | null;
    };
}

interface CommentDrawerProps {
    postId: string;
    postOwnerUsername?: string; // Made optional to avoid strict req in VideoFeed
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export const CommentDrawer = ({ postId, postOwnerUsername, trigger, open: controlledOpen, onOpenChange: setControlledOpen }: CommentDrawerProps) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [internalOpen, setInternalOpen] = useState(false);

    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setIsOpen = setControlledOpen || setInternalOpen;
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const { allowed, refresh } = useSafeFilter();
    const [reporting, setReporting] = useState<Comment | null>(null);
    const shown = comments.filter((c) => c.user_id === user?.id || allowed("comment", c.id, c.content));

    useEffect(() => {
        if (isOpen) {
            fetchComments();
        }
    }, [isOpen]);

    const fetchComments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("comments")
            .select(`
        id,
        user_id,
        content,
        created_at,
        user:user_id(username, avatar_url)
      `)
            .eq("post_id", postId)
            .order("created_at", { ascending: false });

        if (!error && data) {
            // @ts-ignore
            setComments(data);
        }
        setLoading(false);
    };

    const handlePostComment = async () => {
        if (!newComment.trim()) return;
        if (!user) {
            toast.error("Please login to comment");
            navigate("/auth");
            return;
        }

        setSubmitting(true);
        const { error } = await supabase
            .from("comments")
            .insert({
                content: newComment,
                post_id: postId,
                user_id: user.id
            });

        if (error) {
            toast.error("Failed to post comment");
        } else {
            setNewComment("");
            fetchComments(); // Refresh
            toast.success("Comment posted");
        }
        setSubmitting(false);
    };

    return (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
            <DrawerTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="icon" className="hover:text-primary hover:bg-primary/10 transition-colors">
                        <MessageCircle className="w-6 h-6" />
                    </Button>
                )}
            </DrawerTrigger>
            <DrawerContent className="h-[80vh] flex flex-col bg-background/95 backdrop-blur-xl border-t border-white/10">
                <DrawerHeader className="border-b border-white/5">
                    <DrawerTitle className="text-center font-display">Comments</DrawerTitle>
                </DrawerHeader>

                <ScrollArea className="flex-1 p-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : shown.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10">
                            <p>No comments yet.</p>
                            <p className="text-sm">Be the first to comment!</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {shown.map((comment) => (
                                <div key={comment.id} className="flex gap-3 animate-fade-in">
                                    <Avatar className="w-8 h-8 flex-shrink-0">
                                        <AvatarImage src={comment.user.avatar_url || ""} />
                                        <AvatarFallback>{comment.user.username[0].toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <p className="text-sm">
                                            <span className="font-semibold mr-2">{comment.user.username}</span>
                                            {comment.content}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                            {comment.user_id !== user?.id && (
                                                <button type="button" className="ml-3 font-semibold" onClick={() => setReporting(comment)}>Report</button>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className="p-4 border-t border-white/10 bg-background/50 backdrop-blur-md pb-safe">
                    <div className="flex gap-2">
                        <Avatar className="w-9 h-9 flex-shrink-0">
                            <AvatarFallback>ME</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 relative">
                            <Input
                                placeholder={postOwnerUsername ? `Add a comment for ${postOwnerUsername}...` : "Add a comment..."}
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
                                className="pr-10 rounded-full bg-muted/50 border-white/5"
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                className="absolute right-0 top-0 h-full w-10 hover:bg-transparent text-primary disabled:opacity-50"
                                onClick={handlePostComment}
                                disabled={!newComment.trim() || submitting}
                            >
                                {submitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DrawerContent>
            {reporting && (
                <ReportSheet
                    target={{ type: "comment", id: reporting.id, owner: reporting.user_id, snapshot: `${reporting.user.username} on post ${postId}: ${reporting.content}` }}
                    open={!!reporting}
                    onOpenChange={(o) => { if (!o) setReporting(null); }}
                    onReported={refresh}
                />
            )}
        </Drawer>
    );
};
