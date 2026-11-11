import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { usernameTaken } from "@/lib/authProviders";
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
  const [username, setUsername] = useState(profile.username || "");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
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
    // Username: letters, numbers and underscores, and not already someone else's.
    const newUsername = username.trim().toLowerCase();
    const changedUsername = newUsername !== profile.username;
    if (changedUsername) {
      if (!/^[a-z0-9_]{3,30}$/.test(newUsername)) { setUsernameError("3–30 letters, numbers or underscores"); return; }
      setIsLoading(true);
      if (await usernameTaken(newUsername)) { setUsernameError("That username is taken — try another"); setIsLoading(false); return; }
    }
    setUsernameError(null);
    setIsLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        ...(changedUsername && { username: newUsername }),
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
      toast.error(/duplicate|unique/i.test(error.message) ? "That username is taken — try another" : "Failed to update profile");
    } else {
      toast.success("Profile updated!");
      // The profile's address uses the username: follow it if it changed.
      if (changedUsername && location.pathname === `/profile/${profile.username}`) navigate(`/profile/${newUsername}`, { replace: true });
      onUpdate();
      onClose();
    }

    setIsLoading(false);
  };

  // The page behind stays still while this is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const field = "h-12 rounded-xl border-border/40 bg-secondary/60 text-[16px]";

  // A full-screen page (like TikTok's Edit profile), put straight on <body> so nothing on the
  // profile page (the bottom bar, transforms) can sit over it or stop it scrolling.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground animate-in fade-in slide-in-from-bottom-4 duration-200" role="dialog" aria-modal="true" aria-label="Edit profile">
      <div className="flex shrink-0 items-center gap-2 border-b border-border/20 px-2 pb-2 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
        <button type="button" onClick={onClose} className="h-10 rounded-full px-3 text-[15px] font-medium text-muted-foreground active:bg-secondary">Cancel</button>
        <h2 className="flex-1 text-center text-[17px] font-bold">Edit profile</h2>
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || uploadingAvatar || uploadingCover}
          className="flex h-10 min-w-[64px] items-center justify-center rounded-full px-3 text-[15px] font-bold text-amber-400 active:bg-secondary disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom,0px)+32px)]">
        {/* Cover (same shape it's cut to) with the photo over it, like the profile */}
        <button type="button" onClick={() => coverInputRef.current?.click()} className="relative block aspect-[16/5] w-full overflow-hidden bg-secondary" aria-label="Change cover photo">
          {coverUrl
            ? <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            : <span className="flex h-full items-start justify-center pt-4 text-[13px] text-muted-foreground">Add a cover photo</span>}
          <span className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[12.5px] font-semibold text-white backdrop-blur">
            <Camera className="h-3.5 w-3.5" /> {coverUrl ? "Change cover" : "Add cover"}
          </span>
          {uploadingCover && <span className="absolute inset-0 flex items-center justify-center bg-background/50"><Loader2 className="h-6 w-6 animate-spin" /></span>}
        </button>
        <input ref={coverInputRef} type="file" accept="image/*" onChange={(e) => handleFileSelect(e, "cover")} className="hidden" />

        <div className="-mt-12 flex flex-col items-center">
          <button type="button" onClick={() => avatarInputRef.current?.click()} className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-muted" aria-label="Change profile photo">
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              : <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-400 to-amber-700 text-2xl font-bold text-white">{(displayName || profile.username).charAt(0).toUpperCase()}</span>}
            <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/55 py-1"><Camera className="h-4 w-4 text-white" /></span>
            {uploadingAvatar && <span className="absolute inset-0 flex items-center justify-center bg-background/50"><Loader2 className="h-6 w-6 animate-spin" /></span>}
          </button>
          <button type="button" onClick={() => avatarInputRef.current?.click()} className="mt-2 text-[14px] font-semibold text-amber-400">Change photo</button>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={(e) => handleFileSelect(e, "avatar")} className="hidden" />
        </div>

        <div className="mx-auto max-w-md space-y-5 px-4 pt-5">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
              <Input
                id="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setUsernameError(null); }}
                placeholder="yourname"
                autoCapitalize="none"
                autoCorrect="off"
                maxLength={30}
                className={`${field} pl-8`}
              />
            </div>
            {usernameError && <p className="text-[12px] text-destructive">{usernameError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Name</Label>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className={field} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people about yourself…"
              className="resize-none rounded-xl border-border/40 bg-secondary/60 text-[16px]"
              rows={3}
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
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              className={field}
            />
          </div>
        </div>
      </div>

      <ImageCropperModal
        open={!!croppingImage}
        imageSrc={croppingImage}
        aspect={croppingType === "cover" ? 16 / 5 : 1}
        onCancel={() => {
          setCroppingImage(null);
          setCroppingType(null);
        }}
        onCropComplete={handleCropComplete}
      />
    </div>,
    document.body,
  );
};

export default EditProfileModal;
