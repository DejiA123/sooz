import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Image, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { OptimizedImage } from "@/components/ui/optimized-image";

const CreateStory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "video/mp4", "video/quicktime"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a valid image or video file");
      return;
    }

    // Validate file size (max 50MB for videos, 10MB for images)
    const maxSize = file.type.startsWith("video/") ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(file.type.startsWith("video/") ? "Video must be less than 50MB" : "Image must be less than 10MB");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);
    try {
      // Generate unique file name
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
      const filePath = `stories/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, selectedFile);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        toast.error("Failed to upload file");
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("media")
        .getPublicUrl(filePath);

      // Create story in database
      const { error: storyError } = await supabase
        .from("stories")
        .insert({
          user_id: user.id,
          media_url: publicUrl,
          media_type: selectedFile.type.startsWith("video/") ? "video" : "image",
          caption: caption.trim() || null,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        });

      if (storyError) {
        console.error("Story creation error:", storyError);
        toast.error("Failed to create story");
        return;
      }

      toast.success("Story posted successfully!");
      navigate("/");
    } catch (error) {
      console.error("Error creating story:", error);
      toast.error("Failed to create story");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <X className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Create Story</h1>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        {!selectedFile ? (
          <div className="space-y-6">
            {/* Upload Options */}
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Create a Story</h2>
                <p className="text-muted-foreground">
                  Share a moment that disappears after 24 hours
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-3 p-6 h-auto"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Image className="w-8 h-8 text-primary" />
                  <div className="text-center">
                    <p className="font-medium">Photo</p>
                    <p className="text-xs text-muted-foreground">Upload from gallery</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-3 p-6 h-auto"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-8 h-8 text-primary" />
                  <div className="text-center">
                    <p className="font-medium">Camera</p>
                    <p className="text-xs text-muted-foreground">Take a photo</p>
                  </div>
                </Button>
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Supported formats: JPG, PNG, GIF, MP4, MOV
                </p>
                <p className="text-xs text-muted-foreground">
                  Max size: 10MB for images, 50MB for videos
                </p>
              </div>
            </div>

            {/* Recent Stories Preview */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Recent Stories</h3>
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No recent stories</p>
                <p className="text-sm text-muted-foreground">Be the first to post!</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Preview */}
            <div className="relative bg-muted rounded-xl overflow-hidden">
              {selectedFile.type.startsWith("video/") ? (
                <video
                  src={preview}
                  className="w-full h-96 object-cover"
                  controls
                />
              ) : (
                <OptimizedImage
                  src={preview}
                  alt="Story preview"
                  className="w-full h-96 object-cover"
                  width={800}
                  height={600}
                />
              )}
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemoveFile}
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <label htmlFor="caption" className="text-sm font-medium">
                Caption (optional)
              </label>
              <Textarea
                id="caption"
                placeholder="Add a caption to your story..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="resize-none"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {caption.length}/500 characters
              </p>
            </div>

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full"
              size="lg"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Share Story
                </>
              )}
            </Button>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default CreateStory;