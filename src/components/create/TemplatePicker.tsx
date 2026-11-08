import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { TEMPLATES, canvasToFile, drawTemplate, loadTemplateFonts } from "./templates";

export interface TemplatePickerHandle {
  /** The finished design as a photo, ready to post. */
  toFile: () => Promise<File>;
}

/** Pick a design, type your words, see it live — for posts and stories. */
export const TemplatePicker = forwardRef<TemplatePickerHandle, { onReadyChange?: (ready: boolean) => void }>(({ onReadyChange }, ref) => {
  const { user } = useAuth();
  const handle = (user?.user_metadata?.username as string | undefined) || undefined;
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [text, setText] = useState("");
  const [extra, setExtra] = useState("");
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0];

  useEffect(() => { loadTemplateFonts().then(() => setFontsLoaded(true)); }, []);
  useEffect(() => { onReadyChange?.(text.trim().length > 0); }, [text, onReadyChange]);

  // Redraw the preview as they type (at most once per frame).
  useEffect(() => {
    const id = requestAnimationFrame(() => { if (canvasRef.current) drawTemplate(canvasRef.current, t, text, t.extra ? extra : "", handle); });
    return () => cancelAnimationFrame(id);
  }, [t, text, extra, handle, fontsLoaded]);

  useImperativeHandle(ref, () => ({
    toFile: async () => {
      await loadTemplateFonts();
      const canvas = document.createElement("canvas");
      await drawTemplate(canvas, t, text, t.extra ? extra : "", handle);
      return canvasToFile(canvas);
    },
  }), [t, text, extra, handle]);

  return (
    <div className="space-y-4">
      <div className="mx-auto w-[min(56vw,240px)] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
        <canvas ref={canvasRef} width={1080} height={1920} className="block h-auto w-full" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {TEMPLATES.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTemplateId(x.id)}
            className={cn("flex shrink-0 flex-col items-center gap-1.5", templateId === x.id ? "opacity-100" : "opacity-75")}
          >
            <span
              className={cn("flex h-14 w-14 items-center justify-center rounded-2xl text-[24px] ring-2 transition", templateId === x.id ? "ring-amber-400" : "ring-transparent")}
              style={{ background: x.swatch }}
            >
              {x.emoji}
            </span>
            <span className="w-16 truncate text-center text-[11.5px] font-medium text-white/80">{x.name}</span>
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 280))}
        placeholder={t.placeholder}
        rows={3}
        className="w-full resize-none rounded-2xl border-0 bg-white/[0.07] p-4 text-[16px] text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
      />
      {t.extra && (
        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value.slice(0, 80))}
          placeholder={t.extra}
          className="h-12 w-full rounded-2xl border-0 bg-white/[0.07] px-4 text-[16px] text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
        />
      )}
    </div>
  );
});
TemplatePicker.displayName = "TemplatePicker";
