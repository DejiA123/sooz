import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, AtSign, Hash, Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { getPresignedUploadUrl } from "@/integrations/s3/client";
import { extractVideoThumbnail, extractImageThumbnail } from "@/utils/videoThumbnail";
import { CameraCapture, DEFAULT_MODE, MODES, type CameraMode } from "./CameraCapture";
import { LiveStudio } from "../live/LiveStudio";
import { TemplatePicker, type TemplatePickerHandle } from "./TemplatePicker";
import { useDarkCover } from "@/lib/statusBar";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

type Tab = "story" | "post" | "templates" | "live";
const TABS: { key: Tab; label: string }[] = [
  { key: "story", label: "STORY" },
  { key: "post", label: "POST" },
  { key: "templates", label: "TEMPLATES" },
  { key: "live", label: "LIVE" },
];

interface Media { file: File; url: string; type: "image" | "video" }

/** Puts a file on R2 with progress; resolves with its public address. */
const uploadFile = async (file: File, onProgress?: (pct: number) => void) => {
  const { signedUrl, publicUrl } = await getPresignedUploadUrl(file.name, file.type);
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl, true);
    xhr.setRequestHeader("Content-Type", file.type);
    if (onProgress) xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error("Upload failed")));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
  return publicUrl;
};

/** Tells the Home feed to pause (and not count the time) while Create covers it. */
const coverFeed = (on: boolean) => {
  document.body.classList.toggle("sooz-feed-covered", on);
  window.dispatchEvent(new CustomEvent("sooz:feed-cover", { detail: on }));
};

/**
 * Create, like TikTok: a full-screen camera (STORY / POST), TEMPLATES and LIVE along the bottom,
 * then a post screen with the caption and "Your Story" / "Post".
 */
export const CreateModal = ({ isOpen, onClose, onPostCreated }: CreateModalProps) => {
  useDarkCover(isOpen); // the camera is full-screen black: the status bar goes black too
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("post");
  const [mode, setMode] = useState<CameraMode>(DEFAULT_MODE.post);
  const [text, setText] = useState("");
  const [stage, setStage] = useState<"capture" | "compose">("capture");
  const [media, setMedia] = useState<Media | null>(null);
  const [caption, setCaption] = useState("");
  const [sharing, setSharing] = useState<"post" | "story" | null>(null);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [templateReady, setTemplateReady] = useState(false);
  const [makingTemplate, setMakingTemplate] = useState(false);
  const templateRef = useRef<TemplatePickerHandle>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  // Full screen: no page scroll behind, Home's video paused.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    coverFeed(true);
    return () => { document.body.style.overflow = prev; coverFeed(false); };
  }, [isOpen]);

  useEffect(() => () => { if (media) URL.revokeObjectURL(media.url); }, [media]);

  const close = useCallback(() => {
    if (sharing) return;
    if (live && !window.confirm("End your live?")) return;
    onClose();
  }, [sharing, live, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (preview) setPreview(false); else if (stage === "compose") back(); else close(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [close, preview, stage]);

  const chooseTab = (t: Tab) => {
    if (cameraBusy || live || t === tab) return;
    setTab(t);
    if (t === "post" || t === "story") {
      if (!MODES[t].includes(mode)) setMode(DEFAULT_MODE[t]);
    }
  };

  const takeFile = (file: File, kind?: "image" | "video") => {
    const isVideo = kind ? kind === "video" : file.type.startsWith("video/") || /\.(mp4|mov|m4v|avi|webm)$/i.test(file.name);
    setMedia({ file, url: URL.createObjectURL(file), type: isVideo ? "video" : "image" });
    setStage("compose");
  };

  const back = () => {
    if (sharing) return;
    setMedia(null);
    setPreview(false);
    setStage("capture");
  };

  const nextFromTemplate = async () => {
    if (!templateRef.current || makingTemplate) return;
    setMakingTemplate(true);
    try { takeFile(await templateRef.current.toFile(), "image"); }
    catch { toast.error("Couldn't create your design — please try again"); }
    finally { setMakingTemplate(false); }
  };

  const nextFromText = () => {
    setMedia(null);
    setCaption(text.trim());
    setStage("compose");
  };

  const share = async (target: "post" | "story") => {
    if (!user || sharing) return;
    const file = media?.file ?? null;
    const mediaType = media?.type ?? null;
    if (target === "story" && !file) { toast.error("Add a photo or video for your story"); return; }
    if (target === "post" && !file && !caption.trim()) { toast.error("Write something to post"); return; }

    setSharing(target);
    setProgress(0);
    try {
      let mediaUrl: string | null = null;
      let thumbnailUrl: string | null = null;
      if (file) {
        mediaUrl = await uploadFile(file, setProgress);
        if (target === "post") {
          try {
            const blob = mediaType === "video" ? await extractVideoThumbnail(file) : await extractImageThumbnail(file);
            thumbnailUrl = await uploadFile(new File([blob], "thumbnail.jpg", { type: "image/jpeg" }));
          } catch (err) {
            console.error("Failed to generate thumbnail:", err);
          }
        }
      }

      if (target === "post") {
        const { error } = await supabase.from("posts").insert({
          user_id: user.id,
          media_url: mediaUrl,
          media_type: mediaType, // null for a text post
          thumbnail_url: thumbnailUrl,
          caption: caption.trim() || null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stories").insert({
          user_id: user.id,
          media_type: mediaType || "image",
          media_url: mediaUrl!,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });
        if (error) throw error;
      }

      toast.success(target === "story" ? "Added to your story" : "Posted 🙌");
      onPostCreated?.();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(target === "story" ? "Couldn't add to your story — please try again" : "Couldn't post — please try again");
    } finally {
      setSharing(null);
      setProgress(0);
    }
  };

  // Hashtag / mention chips: add the sign where the cursor is and keep typing there.
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = captionRef.current;
    if (caret.current === null || !el) return;
    el.focus();
    el.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [caption]);
  const insert = (ch: string) => {
    const el = captionRef.current;
    const at = el && document.activeElement === el ? el.selectionStart : caption.length;
    const before = caption.slice(0, at);
    const after = caption.slice(at);
    const pad = before && !/\s$/.test(before) ? " " : "";
    const gap = after && !/^\s/.test(after) ? " " : "";
    el?.focus();
    caret.current = (before + pad + ch).length;
    setCaption((before + pad + ch + gap + after).slice(0, 2200));
  };

  if (!isOpen) return null;

  const camera = tab === "post" || tab === "story";
  const primary: "post" | "story" = tab === "story" ? "story" : "post";
  const showTabs = stage === "capture" && !cameraBusy && !live;

  return (
    <div className="fixed inset-0 z-[60] bg-black text-white animate-in fade-in duration-150" role="dialog" aria-modal="true" aria-label="Create">
      <div className="relative mx-auto h-full w-full max-w-[480px] overflow-hidden">
        {/* ---- Camera (Story / Post) ---- */}
        {stage === "capture" && camera && (
          <CameraCapture
            target={tab as "post" | "story"}
            mode={mode}
            onModeChange={setMode}
            text={text}
            onTextChange={setText}
            onMedia={(f) => takeFile(f)}
            onText={nextFromText}
            onClose={close}
            onBusyChange={setCameraBusy}
          />
        )}

        {/* ---- Templates (kept while on the post screen so going back keeps their words) ---- */}
        {tab === "templates" && (
          <div className={cn("absolute inset-0 flex flex-col bg-[#0b0d12]", stage !== "capture" && "hidden")}>
            <Header title="Templates" onClose={close} />
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
              <TemplatePicker ref={templateRef} onReadyChange={setTemplateReady} />
            </div>
            <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+60px)] pt-2">
              <button
                type="button"
                onClick={nextFromTemplate}
                disabled={!templateReady || makingTemplate}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-[17px] font-bold text-black active:scale-[0.98] disabled:opacity-40"
              >
                {makingTemplate ? <Loader2 className="h-5 w-5 animate-spin" /> : "Next"}
              </button>
            </div>
          </div>
        )}

        {/* ---- Go Live ---- */}
        {tab === "live" && stage === "capture" && (
          <div className="absolute inset-0 flex flex-col bg-[#0b0d12]">
            <Header title="Go LIVE" onClose={close} />
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+64px)] pt-2">
              <LiveStudio onLiveChange={setLive} />
            </div>
          </div>
        )}

        {/* ---- Bottom tabs, like TikTok ---- */}
        {showTabs && (
          <nav className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-6 bg-black/80 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur" aria-label="Create">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => chooseTab(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={cn("relative h-12 text-[13.5px] font-bold tracking-wide transition-colors", tab === t.key ? "text-white" : "text-white/55")}
              >
                {t.label}
                {tab === t.key && <span className="absolute bottom-2 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-white" />}
              </button>
            ))}
          </nav>
        )}

        {/* ---- Post screen ---- */}
        {stage === "compose" && (
          <div className="absolute inset-0 z-40 flex flex-col bg-[#0b0d12]">
            <div className="flex items-center gap-2 px-2 pb-2 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
              <button type="button" aria-label="Back" onClick={back} disabled={!!sharing} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
                <ArrowLeft className="h-6 w-6" />
              </button>
              <h2 className="flex-1 text-center text-[17px] font-bold">{media ? "New post" : "Text post"}</h2>
              <span className="h-10 w-10" />
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="flex gap-3 px-4 pt-2">
                <textarea
                  ref={captionRef}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 2200))}
                  placeholder={media ? "Add a caption… Share what God is doing 🙌" : "What's on your heart?"}
                  rows={media ? 6 : 8}
                  className="min-h-[150px] flex-1 resize-none border-0 bg-transparent text-[16px] leading-snug text-white placeholder:text-white/40 focus:outline-none"
                />
                {media && (
                  <button type="button" onClick={() => setPreview(true)} aria-label="Preview" className="relative h-[136px] w-[102px] shrink-0 overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
                    {media.type === "image"
                      ? <img src={media.url} alt="" className="h-full w-full object-cover" />
                      : <video src={media.url} muted playsInline autoPlay loop className="h-full w-full object-cover" />}
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[11.5px] font-semibold">
                      {media.type === "video" && <Play className="h-3 w-3 fill-current" />} Preview
                    </span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 px-4 pb-3 pt-2">
                <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => insert("#")} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold active:scale-95"><Hash className="h-3.5 w-3.5" /> Hashtags</button>
                <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => insert("@")} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold active:scale-95"><AtSign className="h-3.5 w-3.5" /> Mention</button>
                <span className="ml-auto text-[12px] tabular-nums text-white/40">{caption.length}/2200</span>
              </div>
              <div className="mx-4 border-t border-white/10 py-3 text-[13px] leading-snug text-white/50">
                {media
                  ? "Post shares it on your profile and in everyone's feed. Your Story shows it for 24 hours (captions are for posts)."
                  : "Your words go on your profile and in everyone's feed."}
              </div>
            </div>

            {sharing && (
              <div className="px-4 pb-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-amber-400 transition-[width]" style={{ width: `${media ? progress : 100}%` }} /></div>
              </div>
            )}
            <div className={cn("grid gap-3 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-2", media ? "grid-cols-2" : "grid-cols-1")}>
              {media && (
                <ShareButton primary={primary === "story"} busy={sharing === "story"} disabled={!!sharing} progress={progress} onClick={() => share("story")}>
                  <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 p-[2px]"><span className="h-full w-full rounded-full bg-[#0b0d12]" /></span>
                  Your Story
                </ShareButton>
              )}
              <ShareButton primary={primary === "post" || !media} busy={sharing === "post"} disabled={!!sharing || (!media && !caption.trim())} progress={progress} onClick={() => share("post")}>
                Post
              </ShareButton>
            </div>

            {preview && media && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
                {media.type === "image"
                  ? <img src={media.url} alt="Preview" className="max-h-full max-w-full object-contain" />
                  : <video src={media.url} controls autoPlay playsInline className="max-h-full max-w-full object-contain" />}
                <button type="button" aria-label="Close preview" onClick={() => setPreview(false)} className="absolute left-3 top-[calc(env(safe-area-inset-top,0px)+12px)] flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
                  <X className="h-6 w-6" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Header = ({ title, onClose }: { title: string; onClose: () => void }) => (
  <div className="flex items-center gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+14px)]">
    <button type="button" aria-label="Close" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10"><X className="h-7 w-7" /></button>
    <h2 className="flex-1 text-center text-[17px] font-bold">{title}</h2>
    <span className="h-10 w-10" />
  </div>
);

const ShareButton = ({ primary, busy, disabled, progress, onClick, children }: { primary: boolean; busy: boolean; disabled: boolean; progress: number; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex h-[52px] items-center justify-center gap-2 rounded-xl text-[16px] font-bold transition active:scale-[0.98]",
      disabled && !busy && "opacity-50",
      primary ? "bg-amber-400 text-black" : "bg-white/[0.12] text-white",
    )}
  >
    {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> {progress > 0 && progress < 100 ? `${progress}%` : progress >= 100 ? "Finishing…" : "Sharing…"}</> : children}
  </button>
);
