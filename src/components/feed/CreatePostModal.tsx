import { useState, useRef } from "react";
import { X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getPresignedUploadUrl } from "@/integrations/s3/client";
import { extractVideoThumbnail } from "@/utils/videoThumbnail";

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
    const [uploadProgress, setUploadProgress] = useState(0);
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
        if (!user) {
            toast.error("You must be logged in to post.");
            return;
        }
        if (!mediaFile && !caption.trim()) {
            toast.error("Please add a photo/video or write something");
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            console.log("Starting upload...");
            let mediaUrl = null;
            let mediaType = null;
            let thumbnailUrl = null;

            if (mediaFile) {
                // Get presigned URL for media
                const { signedUrl: mediaSignedUrl, publicUrl: mediaPublicUrl } = await getPresignedUploadUrl(mediaFile.name, mediaFile.type);
                mediaUrl = mediaPublicUrl;

                // Handle media upload
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', mediaSignedUrl, true);
                xhr.setRequestHeader('Content-Type', mediaFile.type);

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        setUploadProgress(percent);
                    }
                };

                const mediaUploadPromise = new Promise((resolve, reject) => {
                    xhr.onload = () => xhr.status === 200 ? resolve(true) : reject(new Error('Media upload failed'));
                    xhr.onerror = () => reject(new Error('Media upload failed'));
                    xhr.send(mediaFile);
                });

                await mediaUploadPromise;
                mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';

                // Generate and upload thumbnail for videos
                if (mediaType === 'video') {
                    try {
                        console.log("Generating video thumbnail...");
                        const thumbnailBlob = await extractVideoThumbnail(mediaFile);
                        const thumbnailFile = new File([thumbnailBlob], 'thumbnail.jpg', { type: 'image/jpeg' });

                        // Get presigned URL for thumbnail
                        const { signedUrl: thumbSignedUrl, publicUrl: thumbPublicUrl } = await getPresignedUploadUrl('thumbnail.jpg', 'image/jpeg');
                        thumbnailUrl = thumbPublicUrl;

                        // Handle thumbnail upload
                        const thumbXhr = new XMLHttpRequest();
                        thumbXhr.open('PUT', thumbSignedUrl, true);
                        thumbXhr.setRequestHeader('Content-Type', 'image/jpeg');

                        const thumbUploadPromise = new Promise((resolve, reject) => {
                            thumbXhr.onload = () => thumbXhr.status === 200 ? resolve(true) : reject(new Error('Thumbnail upload failed'));
                            thumbXhr.onerror = () => reject(new Error('Thumbnail upload failed'));
                            thumbXhr.send(thumbnailFile);
                        });

                        await thumbUploadPromise;
                        console.log("Thumbnail uploaded:", thumbnailUrl);
                    } catch (thumbError) {
                        console.error("Failed to generate thumbnail:", thumbError);
                    }
                }

                console.log("Inserting post into database...");
            }

            const { data: dbData, error: dbError } = await supabase
                .from('posts')
                .insert({
                    user_id: user.id,
                    caption: caption,
                    media_url: mediaUrl,
                    media_type: mediaType,
                    thumbnail_url: thumbnailUrl
                })
                .select();

            if (dbError) throw dbError;

            // Send push notification to followers (fire and forget)
            if (dbData && dbData.length > 0) {
                const postId = dbData[0].id;
                supabase.functions.invoke('push-notifications', {
                    body: {
                        record: {
                            id: postId,
                            user_id: user.id
                        }
                    }
                }).then(({ error }) => {
                    if (error) console.error("Error sending post notification:", error);
                });
            }

            toast.success("Post created successfully!");
            setCaption("");
            setMediaFile(null);
            setMediaPreview(null);
            setUploadProgress(0);
            onPostCreated();
            onClose();
        } catch (error: any) {
            console.error('Error creating post:', error);
            const errorMsg = error?.message || "Failed to create post";
            toast.error(errorMsg);
            setUploadProgress(0);
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
                            {!isUploading && (
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
                            )}
                        </div>
                    )}

                    {isUploading && mediaFile && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Uploading...</span>
                                <span className="font-medium text-primary">{uploadProgress}%</span>
                            </div>
                            <Progress value={uploadProgress} className="h-2" />
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
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
                        type="button"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading {uploadProgress}%
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
