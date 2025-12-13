
import { useState, useRef } from "react";
import { X, Image as ImageIcon, Loader2, Video } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface CreatePostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPostCreated: () => void;
}

export default function CreatePostModal({ isOpen, onClose, onPostCreated }: CreatePostModalProps) {
    const { user } = useAuth();
    const [caption, setCaption] = useState("");
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setMediaFile(file);
            const url = URL.createObjectURL(file);
            setMediaPreview(url);
        }
    };

    const handlePost = async () => {
        if (!user) return;
        if (!mediaFile && !caption.trim()) {
            toast.error("Please add a photo/video or write something");
            return;
        }

        setIsUploading(true);

        try {
            let mediaUrl = null;
            let mediaType = null;

            if (mediaFile) {
                const fileExt = mediaFile.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('posts')
                    .upload(filePath, mediaFile);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('posts')
                    .getPublicUrl(filePath);

                mediaUrl = data.publicUrl;
                mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';
            }

            const { error: dbError } = await supabase
                .from('posts')
                .insert({
                    user_id: user.id,
                    caption: caption,
                    media_url: mediaUrl,
                    media_type: mediaType
                });

            if (dbError) throw dbError;

            toast.success("Post created successfully!");
            setCaption("");
            setMediaFile(null);
            setMediaPreview(null);
            onPostCreated();
            onClose();
        } catch (error) {
            console.error('Error creating post:', error);
            toast.error("Failed to create post");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-card border-white/10">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Create Post</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <Textarea
                        placeholder="What's on your mind?"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="min-h-[100px] bg-muted/50 border-none resize-none focus-visible:ring-1 focus-visible:ring-primary"
                    />

                    {mediaPreview && (
                        <div className="relative rounded-xl overflow-hidden bg-muted aspect-video">
                            {mediaFile?.type.startsWith('video/') ? (
                                <video src={mediaPreview} controls className="w-full h-full object-cover" />
                            ) : (
                                <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                            )}
                            <Button
                                size="icon"
                                variant="destructive"
                                className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-80 hover:opacity-100"
                                onClick={() => {
                                    setMediaFile(null);
                                    setMediaPreview(null);
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <ImageIcon className="h-5 w-5 mr-2" />
                            Photo/Video
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*,video/*"
                            onChange={handleFileSelect}
                        />
                    </div>

                    <Button
                        className="w-full font-bold"
                        onClick={handlePost}
                        disabled={isUploading || (!caption.trim() && !mediaFile)}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Posting...
                            </>
                        ) : (
                            "Post"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
