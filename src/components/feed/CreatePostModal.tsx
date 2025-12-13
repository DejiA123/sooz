import { useState, useRef } from "react";
import { X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import * as tus from "tus-js-client";

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

    const uploadWithProgress = async (file: File, filePath: string): Promise<void> => {
        // Get the session token for authenticated upload
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            throw new Error("Not authenticated");
        }

        return new Promise((resolve, reject) => {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

            const xhr = new XMLHttpRequest();
            const url = `${supabaseUrl}/storage/v1/object/posts/${filePath}`;

            xhr.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable) {
                    const progress = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(progress);
                }
            });

            xhr.addEventListener("load", () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            });

            xhr.addEventListener("error", () => {
                reject(new Error("Upload failed"));
            });

            xhr.open("POST", url);
            xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
            xhr.setRequestHeader("x-upsert", "false");
            xhr.send(file);
        });
    };

    const handlePost = async () => {
        if (!user) return;
        if (!mediaFile && !caption.trim()) {
            toast.error("Please add a photo/video or write something");
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            let mediaUrl = null;
            let mediaType = null;

            if (mediaFile) {
                // Local Server supports 10GB
                if (mediaFile.size > 10 * 1024 * 1024 * 1024) {
                    toast.error("File size too large (max 10GB)");
                    setIsUploading(false);
                    return;
                }

                // Upload to Local Node.js Server
                const formData = new FormData();
                formData.append('file', mediaFile);

                try {
                    const response = await fetch('http://localhost:3000/upload', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        throw new Error(`Server error: ${response.statusText}`);
                    }

                    const data = await response.json();
                    mediaUrl = data.url;
                    mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';

                    setUploadProgress(100);

                } catch (uploadErr) {
                    console.error("Local Upload Error:", uploadErr);
                    throw new Error("Failed to upload to local server. Make sure 'npm run dev' is running.");
                }
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

                    {/* Upload Progress Bar */}
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
                            variant="ghost"
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
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {uploadProgress > 0 ? `Uploading ${uploadProgress}%` : "Posting..."}
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

