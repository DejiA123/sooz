import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BarChart3, Camera, ChevronLeft, FileText, Image as ImageIcon, Lock, MapPin, Mic, Pencil, Plus, Reply, Send, Smile, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/chat";
import { messageSummary, type ChatMessage } from "@/services/api/chat";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

export interface ComposerProps {
  disabled?: { text: string; action?: { label: string; run: () => void } } | null;
  replyTo: { msg: ChatMessage; senderName: string } | null;
  editing: ChatMessage | null;
  draftKey: string;
  mentionables: { username: string; name: string; avatar: string | null }[] | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSendText: (text: string) => void;
  onSaveEdit: (text: string) => void;
  onSendFiles: (files: File[], caption: string) => void;
  onSendDocument: (file: File) => void;
  onSendVoice: (blob: Blob, seconds: number) => void;
  onLocation: () => void;
  onContact: () => void;
  onPoll: () => void;
  onTyping: (kind: "typing" | "recording" | "stop") => void;
}

const drafts = new Map<string, string>(); // unsent text per chat, like WhatsApp
/** The unsent text typed in a chat (shown as "Draft:" in the chat list). */
export const chatDraft = (chatId: string) => drafts.get(chatId)?.trim() || "";

export const Composer = (p: ComposerProps) => {
  const [text, setText] = useState(() => drafts.get(p.draftKey) ?? "");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [preview, setPreview] = useState<File[] | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setText(drafts.get(p.draftKey) ?? ""); }, [p.draftKey]);
  useEffect(() => { drafts.set(p.draftKey, text); }, [p.draftKey, text]);
  useEffect(() => {
    if (p.editing) { setText(p.editing.content); requestAnimationFrame(() => { inputRef.current?.focus(); grow(); }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.editing?.id]);
  useEffect(() => { if (p.replyTo) inputRef.current?.focus(); }, [p.replyTo]);

  const grow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  // @mentions (groups)
  const [caret, setCaret] = useState(0);
  const mentionQuery = p.mentionables ? text.slice(0, caret).match(/(^|\s)@([\w.]*)$/)?.[2] ?? null : null;
  const suggestions = mentionQuery !== null && p.mentionables
    ? p.mentionables.filter((m) => {
        const q = mentionQuery.toLowerCase();
        return m.username.toLowerCase().startsWith(q) || m.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q));
      }).slice(0, 6)
    : [];
  const pickMention = (username: string) => {
    const before = text.slice(0, caret).replace(/@([\w.]*)$/, `@${username} `);
    const next = before + text.slice(caret);
    setText(next);
    requestAnimationFrame(() => { const el = inputRef.current; if (el) { el.focus(); el.setSelectionRange(before.length, before.length); setCaret(before.length); } });
  };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    if (p.editing) p.onSaveEdit(t); else p.onSendText(t);
    setText("");
    p.onTyping("stop");
    requestAnimationFrame(() => { grow(); inputRef.current?.focus(); });
  };

  // ── Voice notes: hold to record, slide left to cancel, slide up to lock ──
  const [rec, setRec] = useState<"idle" | "holding" | "locked">("idle");
  const [recSecs, setRecSecs] = useState(0);
  const [slide, setSlide] = useState({ x: 0, y: 0 });
  const recorder = useRef<{ mr: MediaRecorder; stream: MediaStream; chunks: Blob[]; startedAt: number; timer: number } | null>(null);
  const press = useRef<{ x: number; y: number; at: number } | null>(null);
  const recRef = useRef(rec);
  recRef.current = rec;

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!press.current && recRef.current !== "locked") { stream.getTracks().forEach((t) => t.stop()); setRec("idle"); return; } // let go while asking permission
      const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m));
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.start(250);
      const startedAt = Date.now();
      const timer = window.setInterval(() => setRecSecs(Math.floor((Date.now() - startedAt) / 1000)), 250);
      recorder.current = { mr, stream, chunks, startedAt, timer };
      setRecSecs(0);
      p.onTyping("recording");
      navigator.vibrate?.(15);
    } catch {
      toast.error("Allow microphone access to send voice messages");
      setRec("idle");
    }
  };
  const stopRec = (keep: boolean) => {
    const r = recorder.current;
    recorder.current = null;
    setRec("idle");
    setSlide({ x: 0, y: 0 });
    p.onTyping("stop");
    if (!r) return;
    clearInterval(r.timer);
    const seconds = (Date.now() - r.startedAt) / 1000;
    r.mr.onstop = () => {
      r.stream.getTracks().forEach((t) => t.stop());
      if (!keep) return;
      if (seconds < 0.8) { toast("Hold to record, release to send"); return; }
      p.onSendVoice(new Blob(r.chunks, { type: r.mr.mimeType || "audio/mp4" }), seconds);
    };
    try { r.mr.stop(); } catch { r.stream.getTracks().forEach((t) => t.stop()); }
  };
  const micDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (typeof MediaRecorder === "undefined") { toast.error("Voice messages aren't supported on this browser"); return; }
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { x: e.clientX, y: e.clientY, at: Date.now() };
    setRec("holding");
    startRec();
  };
  const micMove = (e: React.PointerEvent) => {
    if (!press.current || rec !== "holding") return;
    const x = Math.min(0, e.clientX - press.current.x), y = Math.min(0, e.clientY - press.current.y);
    setSlide({ x, y });
    if (x < -110) { press.current = null; stopRec(false); navigator.vibrate?.(30); }
    else if (y < -70) { press.current = null; setRec("locked"); setSlide({ x: 0, y: 0 }); navigator.vibrate?.(15); }
  };
  const micUp = () => {
    if (!press.current) return;
    const quick = Date.now() - press.current.at < 350;
    press.current = null;
    if (rec === "holding") {
      if (quick && !recorder.current) { setRec("idle"); toast("Hold to record, release to send"); return; }
      stopRec(true);
    }
  };
  useEffect(() => () => { const r = recorder.current; if (r) { clearInterval(r.timer); r.stream.getTracks().forEach((t) => t.stop()); } }, []);

  const pickMedia = (files: FileList | null) => {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/")).slice(0, 10);
    if (list.length) setPreview(list);
  };

  if (p.disabled) {
    return (
      <footer className="chat-composer shrink-0 border-t border-white/[0.06] bg-[#05070b] px-4 pt-3 text-center text-[14px] text-white/55">
        {p.disabled.text}
        {p.disabled.action && <button type="button" onClick={p.disabled.action.run} className="ml-1.5 font-semibold text-amber-300">{p.disabled.action.label}</button>}
      </footer>
    );
  }

  const hasText = !!text.trim();
  const recording = rec !== "idle";

  return (
    <footer className="chat-composer relative shrink-0 border-t border-white/[0.06] bg-[#05070b] px-2 pt-2">
      {/* @mention suggestions */}
      {suggestions.length > 0 && (
        <div className="absolute inset-x-2 bottom-full mb-1 overflow-hidden rounded-2xl border border-white/10 bg-[#171a21] shadow-2xl">
          {suggestions.map((m) => (
            <button key={m.username} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickMention(m.username)} className="flex w-full items-center gap-3 px-3 py-2 text-left active:bg-white/10">
              <Avatar className="h-8 w-8"><AvatarImage src={m.avatar || ""} className="object-cover" /><AvatarFallback className="bg-white/10 text-[12px]">{m.name[0]?.toUpperCase()}</AvatarFallback></Avatar>
              <span className="min-w-0"><span className="block truncate text-[14.5px] font-semibold">{m.name}</span><span className="block truncate text-[12.5px] text-white/50">@{m.username}</span></span>
            </button>
          ))}
        </div>
      )}

      {/* Replying to / editing */}
      {(p.replyTo || p.editing) && !recording && (
        <div className="mx-1 mb-2 flex items-center gap-2 overflow-hidden rounded-xl bg-white/[0.06] pr-1">
          <span className="w-1 self-stretch bg-amber-400" />
          {p.editing ? <Pencil className="h-4 w-4 shrink-0 text-amber-300" /> : <Reply className="h-4 w-4 shrink-0 text-amber-300" />}
          <span className="min-w-0 flex-1 py-1.5">
            <span className="block truncate text-[13px] font-semibold text-amber-300">{p.editing ? "Edit message" : p.replyTo!.senderName}</span>
            <span className="block truncate text-[13px] text-white/60">{messageSummary(p.editing ?? p.replyTo!.msg)}</span>
          </span>
          <button type="button" aria-label="Cancel" onClick={() => { if (p.editing) { p.onCancelEdit(); setText(""); } else p.onCancelReply(); }} className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 active:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="mx-auto flex max-w-4xl items-end gap-1.5">
        {recording ? (
          <div className="flex min-h-[46px] flex-1 items-center gap-3 rounded-[23px] bg-white/[0.08] px-3">
            {rec === "locked" ? (
              <button type="button" aria-label="Delete recording" onClick={() => stopRec(false)} className="flex h-9 w-9 items-center justify-center rounded-full text-red-400 active:bg-white/10"><Trash2 className="h-5 w-5" /></button>
            ) : <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />}
            <span className="text-[15px] tabular-nums text-white">{formatDuration(recSecs)}</span>
            {rec === "holding" ? (
              <span className="flex flex-1 items-center justify-center gap-1 text-[14px] text-white/50" style={{ transform: `translateX(${slide.x * 0.6}px)`, opacity: 1 + slide.x / 160 }}>
                <ChevronLeft className="h-4 w-4" /> Slide to cancel
              </span>
            ) : <span className="flex-1 text-[14px] text-white/50">Recording…</span>}
          </div>
        ) : (
          <>
            <button type="button" aria-label="Attach" onClick={() => { setAttachOpen((v) => !v); setEmojiOpen(false); }}
              className={cn("mb-[3px] flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/75 transition-transform active:bg-white/10", attachOpen && "rotate-45 text-amber-300")}>
              <Plus className="h-6 w-6" />
            </button>
            <div className="flex min-h-[46px] flex-1 items-end rounded-[23px] bg-white/[0.08] pl-1">
              <button type="button" aria-label="Emoji" onClick={() => { setEmojiOpen((v) => !v); setAttachOpen(false); }} className="mb-[3px] flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/55 active:bg-white/10">
                <Smile className="h-[22px] w-[22px]" />
              </button>
              <textarea
                ref={inputRef}
                value={text}
                rows={1}
                placeholder="Message"
                onChange={(e) => { setText(e.target.value); setCaret(e.target.selectionStart ?? e.target.value.length); grow(); p.onTyping(e.target.value.trim() ? "typing" : "stop"); }}
                onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
                onBlur={() => p.onTyping("stop")}
                onFocus={() => { setEmojiOpen(false); setAttachOpen(false); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); if (suggestions.length) pickMention(suggestions[0].username); else send(); }
                  if (e.key === "Escape" && p.editing) { p.onCancelEdit(); setText(""); }
                }}
                className="max-h-[140px] min-h-[46px] flex-1 resize-none border-0 bg-transparent py-[12px] pr-1 text-[16px] leading-[22px] text-white placeholder:text-white/40 focus:outline-none focus:ring-0"
              />
              {!hasText && (
                <button type="button" aria-label="Camera" onClick={() => cameraRef.current?.click()} className="mb-[3px] mr-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/60 active:bg-white/10">
                  <Camera className="h-[21px] w-[21px]" />
                </button>
              )}
            </div>
          </>
        )}

        {hasText || p.editing ? (
          <button type="button" aria-label={p.editing ? "Save" : "Send"} onClick={send} className="mb-[1px] flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[#1a1204] active:scale-95">
            <Send className="h-5 w-5" />
          </button>
        ) : rec === "locked" ? (
          <button type="button" aria-label="Send voice message" onClick={() => stopRec(true)} className="mb-[1px] flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[#1a1204] active:scale-95">
            <Send className="h-5 w-5" />
          </button>
        ) : (
          <div className="relative mb-[1px] shrink-0">
            {rec === "holding" && (
              <span className="absolute bottom-14 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 rounded-full bg-[#1f232b] px-2 py-3 text-white/70 shadow-xl" style={{ transform: `translate(-50%, ${slide.y * 0.5}px)` }}>
                <Lock className="h-4 w-4" />
                <ChevronLeft className="h-4 w-4 rotate-90" />
              </span>
            )}
            <button type="button" aria-label="Hold to record a voice message"
              onPointerDown={micDown} onPointerMove={micMove} onPointerUp={micUp} onPointerCancel={micUp} onContextMenu={(e) => e.preventDefault()}
              style={{ touchAction: "none", transform: rec === "holding" ? `translate(${slide.x * 0.25}px, ${slide.y * 0.25}px) scale(1.35)` : undefined }}
              className={cn("flex h-11 w-11 items-center justify-center rounded-full transition-[background-color] select-none", rec === "holding" ? "bg-red-500 text-white" : "bg-amber-400 text-[#1a1204]")}>
              <Mic className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Emoji keyboard */}
      {emojiOpen && (
        <div className="mt-2 overflow-hidden rounded-2xl">
          <Suspense fallback={<div className="h-[300px] animate-pulse bg-white/5" />}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <EmojiPicker theme={"dark" as any} width="100%" height={300} previewConfig={{ showPreview: false }} onEmojiClick={(e) => { setText((v) => v + e.emoji); p.onTyping("typing"); }} />
          </Suspense>
        </div>
      )}

      {/* Attach menu */}
      {attachOpen && (
        <div className="mt-2 grid grid-cols-3 gap-y-4 rounded-2xl bg-[#14171d] px-2 py-4">
          {[
            { label: "Photos & videos", icon: ImageIcon, color: "from-sky-400 to-blue-600", run: () => mediaRef.current?.click() },
            { label: "Camera", icon: Camera, color: "from-rose-400 to-pink-600", run: () => cameraRef.current?.click() },
            { label: "Document", icon: FileText, color: "from-violet-400 to-indigo-600", run: () => docRef.current?.click() },
            { label: "Location", icon: MapPin, color: "from-emerald-400 to-green-600", run: p.onLocation },
            { label: "Contact", icon: UserRound, color: "from-cyan-400 to-sky-600", run: p.onContact },
            { label: "Poll", icon: BarChart3, color: "from-amber-300 to-amber-600", run: p.onPoll },
          ].map(({ label, icon: Icon, color, run }) => (
            <button key={label} type="button" onClick={() => { setAttachOpen(false); run(); }} className="flex flex-col items-center gap-1.5">
              <span className={cn("flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br text-white", color)}><Icon className="h-6 w-6" /></span>
              <span className="text-[12.5px] text-white/75">{label}</span>
            </button>
          ))}
        </div>
      )}

      <input ref={mediaRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { pickMedia(e.target.files); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(e) => { pickMedia(e.target.files); e.target.value = ""; }} />
      <input ref={docRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onSendDocument(f); e.target.value = ""; }} />

      {preview && <MediaPreview files={preview} onClose={() => setPreview(null)} onSend={(caption) => { p.onSendFiles(preview, caption); setPreview(null); }} />}
    </footer>
  );
};

/** Photos / videos picked to send: a look at them first, with a caption (like WhatsApp). */
const MediaPreview = ({ files, onClose, onSend }: { files: File[]; onClose: () => void; onSend: (caption: string) => void }) => {
  const [i, setI] = useState(0);
  const [caption, setCaption] = useState("");
  const [urls] = useState(() => files.map((f) => URL.createObjectURL(f)));
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const f = files[i];
  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-black text-white" role="dialog" aria-label="Send photos">
      <div className="flex items-center px-2 pt-[calc(env(safe-area-inset-top)+6px)]">
        <button type="button" aria-label="Cancel" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10"><X className="h-6 w-6" /></button>
        <p className="flex-1 text-center text-[15px] font-semibold">{files.length > 1 ? `${i + 1} of ${files.length}` : f.type.startsWith("video/") ? "Video" : "Photo"}</p>
        <span className="w-10" />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-2">
        {f.type.startsWith("video/")
          ? <video src={urls[i]} controls playsInline className="max-h-full max-w-full" />
          : <img src={urls[i]} alt="" className="max-h-full max-w-full object-contain" />}
      </div>
      {files.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-3 pb-2 hide-scrollbar">
          {files.map((file, j) => (
            <button key={j} type="button" onClick={() => setI(j)} className={cn("h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2", j === i ? "border-amber-400" : "border-transparent opacity-70")}>
              {file.type.startsWith("video/") ? <video src={urls[j]} className="h-full w-full object-cover" /> : <img src={urls[j]} alt="" className="h-full w-full object-cover" />}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-1">
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption…" className="h-12 min-w-0 flex-1 rounded-full bg-white/[0.1] px-4 text-[16px] outline-none placeholder:text-white/45"
          onKeyDown={(e) => { if (e.key === "Enter") onSend(caption.trim()); }} />
        <button type="button" aria-label="Send" onClick={() => onSend(caption.trim())} className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-[#1a1204] active:scale-95">
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

