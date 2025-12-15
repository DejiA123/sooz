import { useState, useRef } from "react";
import { X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { s3Client, s3Config } from "@/integrations/s3/client";
import { Upload } from "@aws-sdk/lib-storage";

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

            if (mediaFile) {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const fileExtension = mediaFile.name.split('.').pop();
                const fileName = `${uniqueSuffix}.${fileExtension}`;

                const upload = new Upload({
                    client: s3Client,
                    params: {
                        Bucket: s3Config.bucketName,
                        Key: fileName,
                        Body: mediaFile,
                        ContentType: mediaFile.type,
                    },
                });

                upload.on("httpUploadProgress", (progress) => {
                    if (progress.loaded && progress.total) {
                        const percent = Math.round((progress.loaded / progress.total) * 100);
                        setUploadProgress(percent);
                    }
                });

                await upload.done();

                mediaUrl = `${import.meta.env.VITE_PUBLIC_R2_URL}/${fileName}`;
                mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';
                console.log("Upload complete:", mediaUrl);
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
