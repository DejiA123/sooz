import { useState, useEffect } from "react";
import { X, Send, Heart, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptimizedAvatar } from "@/components/ui/optimized-avatar";
import { CommentModalSkeleton } from "@/components/comments/CommentModalSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface CommentModalProps {
  postId: string;
  postOwnerId: string;
  isOpen: boolean;
  onClose: () => void;
  onCommentAdded: () => void;
}

const CommentModal = ({ postId, postOwnerId, isOpen, onClose, onCommentAdded }: CommentModalProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, postId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("comments")
        .select(`
          *,
          profiles:user_id (username, display_name, avatar_url)
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setComments(data as Comment[]);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user || submitting) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          content: newComment.trim(),
        });

      if (!error) {
        setNewComment("");
        fetchComments();
        onCommentAdded();
        toast.success("Comment posted!");
      } else {
        toast.error("Failed to post comment");
      }
    } catch (error) {
      console.error("Error posting comment:", error);
      toast.error("Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.id);

      if (!error) {
        fetchComments();
        onCommentAdded();
        toast.success("Comment deleted");
      } else {
        toast.error("Failed to delete comment");
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 604800)}w`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-x-4 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-md w-full max-h-[80vh] bg-card rounded-2xl border border-border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Comments</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-accent"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[50vh]">
          {loading ? (
            <CommentModalSkeleton />
          ) : comments.length > 0 ? (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <OptimizedAvatar 
                  src={comment.profiles.avatar_url || ""}
                  alt={`${comment.profiles.display_name || comment.profiles.username}'s avatar`}
                  fallback={comment.profiles.display_name?.charAt(0) || comment.profiles.username.charAt(0).toUpperCase()}
                  size="sm"
                  className="flex-shrink-0"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">
                      {comment.profiles.display_name || comment.profiles.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(comment.created_at)}
                    </span>
                  </div>
                  
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm flex-1">{comment.content}</p>
                    {user && comment.user_id === user.id && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteComment(comment.id)}
                        className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No comments yet</p>
              <p className="text-sm text-muted-foreground">Be the first to comment!</p>
            </div>
          )}
        </div>

        {/* Comment Input */}
        {user && (
          <form onSubmit={handleSubmitComment} className="p-4 border-t border-border">
            <div className="flex gap-3">
              <OptimizedAvatar 
                src={user.user_metadata?.avatar_url || ""}
                alt={`${user.user_metadata?.display_name || user.user_metadata?.username || "User"}'s avatar`}
                fallback={user.user_metadata?.display_name?.charAt(0) || user.user_metadata?.username?.charAt(0) || "U"}
                size="sm"
                className="flex-shrink-0"
              />
              
              <div className="flex-1 flex gap-2">
                <Input
                  type="text"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="bg-muted border-0 focus:ring-2 focus:ring-primary"
                  disabled={submitting}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!newComment.trim() || submitting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CommentModal;