import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Image, Film, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreatePostModalProps {
  onClose: () => void;
  onPostCreated: () => void;
}

const CreatePostModal = ({ onClose, onPostCreated }: CreatePostModalProps) => {
  const { user } = useAuth();
  const [caption, setCaption] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      toast.error("Please select an image or video file");
      return;
    }

    setMediaFile(file);
    setMediaType(isImage ? "image" : "video");
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
    
    setIsLoading(true);

    try {
      let mediaUrl = null;

      // Upload media if present
      if (mediaFile) {
        const fileExt = mediaFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(fileName, mediaFile);

        if (uploadError) {
          toast.error("Failed to upload media");
          setIsLoading(false);
          return;
        }

        const { data } = supabase.storage.from("media").getPublicUrl(fileName);
        mediaUrl = data.publicUrl;
      }

      // Create post
      const { error: postError } = await supabase.from("posts").insert({
        user_id: user.id,
        caption: caption || null,
        media_url: mediaUrl,
        media_type: mediaType,
      });

      if (postError) {
        toast.error("Failed to create post");
      } else {
        toast.success("Post created!");
        onPostCreated();
        onClose();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="glass rounded-3xl w-full max-w-lg p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Create Post</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Upload */}
        {!mediaPreview ? (
          <div
            className={cn(
              "border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer",
              isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">
              Drag and drop or click to upload
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Image className="w-4 h-4" /> Images
              </span>
              <span className="flex items-center gap-1">
                <Film className="w-4 h-4" /> Videos
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
        ) : (
          <div className="relative rounded-2xl overflow-hidden mb-4">
            {mediaType === "image" ? (
              <img
                src={mediaPreview}
                alt="Preview"
                className="w-full max-h-80 object-contain bg-muted"
              />
            ) : (
              <video
                src={mediaPreview}
                controls
                className="w-full max-h-80 object-contain bg-muted"
              />
            )}
            <button
              onClick={() => {
                setMediaFile(null);
                setMediaPreview(null);
                setMediaType(null);
              }}
              className="absolute top-2 right-2 p-2 rounded-full bg-background/80 hover:bg-background transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Caption */}
        <div className="mt-4">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption..."
            className="bg-muted/50 border-border/50 resize-none min-h-[100px]"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button variant="glass" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="gold"
            className="flex-1"
            onClick={handleSubmit}
            disabled={isLoading || (!caption && !mediaFile)}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreatePostModal;
