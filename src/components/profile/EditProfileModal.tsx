import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ImageCropperModal } from "@/components/ui/ImageCropperModal";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  website?: string | null; // Optional to handle if missing
}

interface EditProfileModalProps {
  profile: Profile;
  onClose: () => void;
  onUpdate: () => void;
}

const EditProfileModal = ({ profile, onClose, onUpdate }: EditProfileModalProps) => {
  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  // @ts-ignore
  const [website, setWebsite] = useState(profile.website || "");
  const [coverUrl, setCoverUrl] = useState(profile.cover_url || "");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [croppingType, setCroppingType] = useState<"avatar" | "cover" | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "cover") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCroppingImage(reader.result as string);
      setCroppingType(type);
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // reset input
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!croppingType) return;

    // Close cropper immediately and show loading state
    const type = croppingType; // capture current type
    setCroppingImage(null);
    setCroppingType(null);

    if (type === 'avatar') setUploadingAvatar(true);
    else setUploadingCover(true);

    try {
      const fileExt = "jpg";
      const filePath = `${profile.id}/${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("media").getPublicUrl(filePath);

      if (type === 'avatar') {
        setAvatarUrl(data.publicUrl);
      } else {
        setCoverUrl(data.publicUrl);
      }
    } catch (error) {
      console.error(error);
      toast.error(`Failed to upload ${type}`);
    } finally {
      if (type === 'avatar') setUploadingAvatar(false);
      else setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        bio: bio || null,
        avatar_url: avatarUrl || null,
        cover_url: coverUrl || null,
        // @ts-ignore
        website: website || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated!");
      onUpdate();
      onClose();
    }

    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="glass rounded-3xl w-full max-w-md p-6 animate-scale-in max-h-[85vh] flex flex-col">
        {/* Header - Fixed Top */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-xl font-semibold">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content - Middle */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-6 pr-2">

          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-muted overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary-foreground">
                      {(displayName || profile.username).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center"
              >
                <Camera className="w-4 h-4 text-primary-foreground" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, 'avatar')}
                className="hidden"
              />
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your display name"
                className="bg-muted/50 border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                // @ts-ignore
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="bg-muted/50 border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                className="bg-muted/50 border-border/50 resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Cover Photo</Label>
              <div className="h-32 rounded-lg bg-muted overflow-hidden relative group cursor-pointer border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors" onClick={() => coverInputRef.current?.click()}>
                {coverUrl ? (
                  <img src={coverUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <span className="text-sm">Click to upload cover</span>
                  </div>
                )}
                {uploadingCover && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, 'cover')}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions - Fixed Bottom */}
        <div className="flex gap-3 mt-4 pt-4 border-t border-white/5 flex-shrink-0">
          <Button variant="glass" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:from-amber-500 hover:to-orange-600 border-none shadow-lg"
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>

      <ImageCropperModal
        open={!!croppingImage}
        imageSrc={croppingImage}
        aspect={croppingType === 'cover' ? 16 / 5 : 1} // Cover usually wider (User can zoom)
        onCancel={() => {
          setCroppingImage(null);
          setCroppingType(null);
        }}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
};

export default EditProfileModal;
