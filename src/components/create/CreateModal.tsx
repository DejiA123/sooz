import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Image, Film, Loader2, Upload as UploadIcon, Plus, Camera as CameraIcon, Radio, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { getPresignedUploadUrl } from "@/integrations/s3/client";
import { extractVideoThumbnail } from "@/utils/videoThumbnail";
import { CameraCapture } from "./CameraCapture";

interface CreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPostCreated?: () => void;
}

export const CreateModal = ({ isOpen, onClose, onPostCreated }: CreateModalProps) => {
    const { user } = useAuth();
    const [caption, setCaption] = useState("");
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [activeTab, setActiveTab] = useState<"post" | "story" | "live">("post");
    const [captureMode, setCaptureMode] = useState<"upload" | "camera">("upload");
    const [cameraMediaType, setCameraMediaType] = useState<"photo" | "video">("photo");
    const [streamConfig, setStreamConfig] = useState<{ id?: string; playback_url: string; status: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchStreamConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('live_stream_config')
                .select('id, playback_url, status')
                .limit(1)
                .maybeSingle();

            if (data) {
                setStreamConfig(data);
            } else {
                // Initialize empty config if none exists
                setStreamConfig({ playback_url: "", status: "offline" });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleToggleLive = async (isLive: boolean) => {
        setIsLoading(true);
        try {
            const newStatus = isLive ? 'live' : 'offline';
            const updates = {
                status: newStatus,
                playback_url: streamConfig?.playback_url,
                updated_at: new Date().toISOString(),
                // Ensure other fields are not null if inserting new
            };

            let error;

            if (streamConfig?.id) {
                const { error: updateError } = await supabase
                    .from('live_stream_config')
                    .update(updates)
                    .eq('id', streamConfig.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('live_stream_config')
                    .insert([updates]);
                error = insertError;
                // Re-fetch to get ID
                fetchStreamConfig();
            }

            if (error) throw error;

            setStreamConfig(prev => ({ ...prev!, status: newStatus }));
            toast.success(isLive ? "You are LIVE!" : "Stream Ended");

        } catch (e) {
            console.error(e);
            toast.error("Failed to update stream status");
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch config when Live tab is selected
    if (activeTab === "live" && !streamConfig) {
        fetchStreamConfig();
    }

    const resetForm = () => {
        setCaption("");
        setMediaFile(null);
        setMediaPreview(null);
        setMediaType(null);
        setIsLoading(false);
        setUploadProgress(0);
        setCaptureMode("upload");
        setCameraMediaType("photo");
    };

    const handleFileSelect = (file: File) => {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/") || file.name.match(/\.(mp4|mov|avi|webm)$/i);
        setMediaFile(file);
        setMediaType(isVideo ? "video" : "image");
        setMediaPreview(URL.createObjectURL(file));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    const handleSubmit = async () => {
        if (!user) return;
        if (!mediaFile && activeTab === "story") {
            toast.error("Story must have media");
            return;
        }

        setIsLoading(true);
        setUploadProgress(0);

        try {
            let mediaUrl = null;
            let thumbnailUrl = null;

            // Upload media if present
            if (mediaFile) {
                // Get presigned URL from Edge Function
                const { signedUrl, publicUrl } = await getPresignedUploadUrl(mediaFile.name, mediaFile.type);
                mediaUrl = publicUrl;

                // Handle media upload
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', signedUrl, true);
                xhr.setRequestHeader('Content-Type', mediaFile.type);

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        setUploadProgress(percent);
                    }
                };

                const uploadPromise = new Promise((resolve, reject) => {
                    xhr.onload = () => {
                        if (xhr.status === 200) resolve(true);
                        else reject(new Error('Upload failed'));
                    };
                    xhr.onerror = () => reject(new Error('Upload failed'));
                    xhr.send(mediaFile);
                });

                await uploadPromise;

                // Thumbnail generation for video posts
                if (mediaType === "video" && activeTab === "post") {
                    try {
                        const thumbnailBlob = await extractVideoThumbnail(mediaFile);
                        const thumbnailFile = new File([thumbnailBlob], "thumbnail.jpg", { type: "image/jpeg" });

                        const { signedUrl: thumbSignedUrl, publicUrl: thumbPublicUrl } = await getPresignedUploadUrl("thumbnail.jpg", "image/jpeg");

                        const thumbXhr = new XMLHttpRequest();
                        thumbXhr.open("PUT", thumbSignedUrl, true);
                        thumbXhr.setRequestHeader("Content-Type", "image/jpeg");

                        const thumbUploadPromise = new Promise((resolve, reject) => {
                            thumbXhr.onload = () => (thumbXhr.status === 200 ? resolve(true) : reject(new Error("Thumb failed")));
                            thumbXhr.onerror = () => reject(new Error("Thumb failed"));
                            thumbXhr.send(thumbnailFile);
                        });

                        await thumbUploadPromise;
                        thumbnailUrl = thumbPublicUrl;
                    } catch (err) {
                        console.error("Failed to generate thumbnail:", err);
                    }
                }
            }

            const commonData = {
                user_id: user.id,
                media_url: mediaUrl,
                media_type: mediaType || (mediaFile ? "image" : null),
                thumbnail_url: thumbnailUrl || null
            };

            if (activeTab === "post") {
                const { error: postError } = await supabase.from("posts").insert({
                    ...commonData,
                    caption: caption || null,
                    media_type: mediaType // If null (text only), it stays null
                });

                if (postError) throw postError;
            } else {
                // Story
                // Expires in 24 hours
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

                const { error: storyError } = await supabase.from("stories").insert({
                    ...commonData,
                    media_url: mediaUrl!, // Enforced check above
                    expires_at: expiresAt
                });

                if (storyError) throw storyError;
            }

            onPostCreated?.();
            resetForm();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Failed to create " + activeTab);
        } finally {
            setIsLoading(false);
            setUploadProgress(0); // Reset progress on completion/error
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-background/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "post" | "story" | "live")} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-6 bg-black/5 dark:bg-white/5 rounded-2xl p-1 h-auto">
                            <TabsTrigger
                                value="post"
                                className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all text-xs sm:text-sm font-medium"
                            >
                                Post
                            </TabsTrigger>
                            <TabsTrigger
                                value="story"
                                className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all text-xs sm:text-sm font-medium"
                            >
                                Story
                            </TabsTrigger>
                            <TabsTrigger
                                value="live"
                                className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all text-xs sm:text-sm font-medium"
                            >
                                Go Live
                            </TabsTrigger>
                        </TabsList>

                        <div className="space-y-6">
                            {/* Live Stream Tab Content */}
                            {activeTab === "live" ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="bg-primary/5 rounded-2xl p-6 text-center border border-primary/10">
                                        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                                            {/* We can use Youtube icon if available, or Radio */}
                                            <Radio className="w-8 h-8 text-red-600 animate-pulse" />
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">YouTube Live</h3>
                                        <p className="text-sm text-muted-foreground mb-6">
                                            Paste your YouTube Live link here to start streaming to the app.
                                        </p>

                                        <div className="space-y-4 text-left">
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">YouTube URL</label>
                                                <input
                                                    type="text"
                                                    placeholder="https://youtu.be/..."
                                                    className="w-full p-3 rounded-xl bg-black/5 dark:bg-white/5 border-none focus:ring-1 focus:ring-primary/50 text-sm font-mono"
                                                    value={streamConfig?.playback_url || ""}
                                                    onChange={(e) => setStreamConfig(prev => ({ ...prev!, playback_url: e.target.value }))}
                                                />
                                            </div>

                                            <div className="pt-2">
                                                {streamConfig?.status === 'live' ? (
                                                    <Button
                                                        onClick={() => handleToggleLive(false)}
                                                        className="w-full h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-500/20"
                                                        disabled={isLoading}
                                                    >
                                                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "End Live Stream"}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        onClick={() => handleToggleLive(true)}
                                                        className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-500/20"
                                                        disabled={isLoading || !streamConfig?.playback_url}
                                                    >
                                                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Go Live Now"}
                                                    </Button>
                                                )}
                                            </div>

                                            {streamConfig?.status === 'live' && (
                                                <p className="text-xs text-center text-green-600 font-medium animate-pulse">
                                                    ● You are currently LIVE in the app
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Media Upload/Camera Mode Toggle */}
                                    {!mediaPreview && (
                                        <div className="flex gap-2 mb-4">
                                            <Button
                                                type="button"
                                                variant={captureMode === "upload" ? "default" : "outline"}
                                                className={cn(
                                                    "flex-1 h-12 rounded-xl transition-all",
                                                    captureMode === "upload" && "shadow-md"
                                                )}
                                                onClick={() => setCaptureMode("upload")}
                                            >
                                                <UploadIcon className="w-4 h-4 mr-2" />
                                                Upload
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={captureMode === "camera" ? "default" : "outline"}
                                                className={cn(
                                                    "flex-1 h-12 rounded-xl transition-all",
                                                    captureMode === "camera" && "shadow-md"
                                                )}
                                                onClick={() => setCaptureMode("camera")}
                                            >
                                                <CameraIcon className="w-4 h-4 mr-2" />
                                                Camera
                                            </Button>
                                        </div>
                                    )}

                                    {/* Media Upload/Camera Area */}
                                    {!mediaPreview ? (
                                        captureMode === "camera" ? (
                                            <>
                                                {/* Photo/Video Mode Selector (for Posts) */}
                                                {activeTab === "post" && (
                                                    <div className="flex gap-2 mb-4">
                                                        <Button
                                                            type="button"
                                                            variant={cameraMediaType === "photo" ? "default" : "outline"}
                                                            size="sm"
                                                            className={cn(
                                                                "flex-1 h-10 rounded-xl transition-all",
                                                                cameraMediaType === "photo" && "shadow-md"
                                                            )}
                                                            onClick={() => setCameraMediaType("photo")}
                                                        >
                                                            <CameraIcon className="w-4 h-4 mr-2" />
                                                            Photo
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={cameraMediaType === "video" ? "default" : "outline"}
                                                            size="sm"
                                                            className={cn(
                                                                "flex-1 h-10 rounded-xl transition-all",
                                                                cameraMediaType === "video" && "shadow-md"
                                                            )}
                                                            onClick={() => setCameraMediaType("video")}
                                                        >
                                                            <Film className="w-4 h-4 mr-2" />
                                                            Video
                                                        </Button>
                                                    </div>
                                                )}
                                                <CameraCapture
                                                    mode={activeTab === "story" ? "video" : cameraMediaType}
                                                    onCapture={handleFileSelect}
                                                    onClose={() => setCaptureMode("upload")}
                                                />
                                            </>
                                        ) : (
                                            <div
                                                className={cn(
                                                    "border-2 border-dashed rounded-3xl h-[300px] flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer group",
                                                    isDragging
                                                        ? "border-primary bg-primary/10 scale-[0.98]"
                                                        : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30"
                                                )}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    setIsDragging(true);
                                                }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={handleDrop}
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                                    <UploadIcon className="w-10 h-10 text-primary" />
                                                </div>
                                                <p className="text-lg font-semibold mb-2">
                                                    {activeTab === 'story' ? 'Upload Story' : 'Upload Request'}
                                                </p>
                                                <p className="text-sm text-muted-foreground max-w-[200px] mx-auto mb-6">
                                                    Drag and drop or click to upload
                                                </p>
                                                <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground bg-black/5 dark:bg-white/5 px-4 py-2 rounded-full">
                                                    <span className="flex items-center gap-1.5">
                                                        <Image className="w-3.5 h-3.5" /> Photos
                                                    </span>
                                                    <span className="w-1 h-1 rounded-full bg-current opacity-30" />
                                                    <span className="flex items-center gap-1.5">
                                                        <Film className="w-3.5 h-3.5" /> Videos
                                                    </span>
                                                </div>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*,video/*"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleFileSelect(file);
                                                    }}
                                                    className="hidden"
                                                />
                                            </div>
                                        )
                                    ) : (
                                        <div className="relative rounded-3xl overflow-hidden bg-black aspect-[4/5] shadow-inner group">
                                            {mediaType === "image" ? (
                                                <img
                                                    src={mediaPreview}
                                                    alt="Preview"
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <video
                                                    src={mediaPreview}
                                                    controls
                                                    className="w-full h-full object-contain"
                                                />
                                            )}
                                            <button
                                                onClick={() => {
                                                    setMediaFile(null);
                                                    setMediaPreview(null);
                                                    setMediaType(null);
                                                }}
                                                className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Caption Input (Only for Post) */}
                                    {activeTab === "post" && (
                                        <div className="relative">
                                            <Textarea
                                                value={caption}
                                                onChange={(e) => setCaption(e.target.value)}
                                                placeholder="Write a caption..."
                                                className="min-h-[100px] p-4 rounded-2xl bg-muted/30 border-none focus:ring-1 focus:ring-primary/50 resize-none text-base transition-all placeholder:text-muted-foreground/50"
                                            />
                                            <div className="absolute bottom-3 right-3 text-xs text-muted-foreground/50 font-medium">
                                                {caption.length}/2200
                                            </div>
                                        </div>
                                    )}

                                    {/* Progress Bar Area */}
                                    {isLoading && mediaFile && (
                                        <div className="space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                                                <span>Uploading...</span>
                                                <span>{uploadProgress}%</span>
                                            </div>
                                            <Progress value={uploadProgress} className="h-2 w-full" />
                                        </div>
                                    )}

                                    {/* Submit Button */}
                                    <Button
                                        size="lg"
                                        className="w-full h-14 rounded-2xl text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                                        onClick={handleSubmit}
                                        disabled={isLoading || (activeTab === "story" && !mediaFile) || (activeTab === "post" && !caption && !mediaFile)}
                                    >
                                        {isLoading ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                <span>
                                                    {uploadProgress < 100 ? `Uploading ${uploadProgress}%` : 'Finalizing...'}
                                                </span>
                                            </div>
                                        ) : (
                                            <span>{activeTab === "story" ? "Share to Story" : "Share Post"}</span>
                                        )}
                                    </Button>
                                </>
                            )}
                        </div>
                    </Tabs>
                </div>
            </div>
        </div>
    );
};

