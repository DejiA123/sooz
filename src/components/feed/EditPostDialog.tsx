import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditPostDialogProps {
    post: {
        id: string;
        caption: string | null;
    };
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate: (newCaption: string) => void;
}

export function EditPostDialog({ post, open, onOpenChange, onUpdate }: EditPostDialogProps) {
    const [caption, setCaption] = useState(post.caption || "");
    const [loading, setLoading] = useState(false);

    const handleUpdate = async () => {
        if (loading) return;
        setLoading(true);

        try {
            const { error } = await supabase
                .from("posts")
                .update({ caption })
                .eq("id", post.id);

            if (error) throw error;

            toast.success("Post updated");
            onUpdate(caption);
            onOpenChange(false);
        } catch (error) {
            console.error("Error updating post:", error);
            toast.error("Failed to update post");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Post</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <Textarea
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Write a caption..."
                        className="min-h-[100px] resize-none"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleUpdate} disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
