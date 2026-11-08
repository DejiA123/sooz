/**
 * Post & story templates. Each one is drawn on a 1080×1920 canvas and posted as a normal photo,
 * so it looks the same in the feed, stories, profiles and shared links.
 */
export interface PostTemplate {
  id: string;
  name: string;
  emoji: string;
  label: string;
  placeholder: string;
  /** Optional second line (verse reference, when & where…). */
  extra?: string;
  footer?: string;
  serif?: boolean;
  align?: "center" | "left";
  ink: string;
  muted: string;
  labelBg: string;
  labelInk: string;
  /** CSS background for the little preview chip. */
  swatch: string;
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

const linear = (ctx: CanvasRenderingContext2D, w: number, h: number, stops: [number, string][], angleDeg = 165) => {
  const a = (angleDeg - 90) * (Math.PI / 180);
  const r = Math.hypot(w, h) / 2;
  const cx = w / 2, cy = h / 2;
  const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

const glow = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
};

export const TEMPLATES: PostTemplate[] = [
  {
    id: "testimony", name: "Testimony", emoji: "✨", label: "TESTIMONY", placeholder: "What has God done for you?",
    footer: "God did it! 🙌", ink: "#1a1204", muted: "rgba(26,18,4,0.65)", labelBg: "rgba(26,18,4,0.12)", labelInk: "#1a1204",
    swatch: "linear-gradient(165deg,#fde68a,#f59e0b 50%,#b45309)",
    paint: (c, w, h) => { linear(c, w, h, [[0, "#fde68a"], [0.45, "#f59e0b"], [1, "#b45309"]]); glow(c, w * 0.5, h * 0.18, w * 0.8, "rgba(255,255,255,0.35)"); },
  },
  {
    id: "prayer", name: "Prayer request", emoji: "🙏", label: "PRAYER REQUEST", placeholder: "What can we pray with you about?",
    footer: "Please pray with me 🙏", ink: "#ffffff", muted: "rgba(255,255,255,0.65)", labelBg: "rgba(255,255,255,0.12)", labelInk: "#fde68a",
    swatch: "linear-gradient(165deg,#3b1446,#120818)",
    paint: (c, w, h) => { linear(c, w, h, [[0, "#3b1446"], [1, "#120818"]]); glow(c, w * 0.5, h * 0.12, w * 0.9, "rgba(251,191,36,0.22)"); },
  },
  {
    id: "verse", name: "Scripture", emoji: "📖", label: "VERSE OF THE DAY", placeholder: "Type the verse…", extra: "Reference, e.g. Psalm 23:1",
    serif: true, ink: "#2a2117", muted: "#8a6a2f", labelBg: "rgba(138,106,47,0.12)", labelInk: "#8a6a2f",
    swatch: "linear-gradient(165deg,#fbf6ea,#efe0bd)",
    paint: (c, w, h) => {
      linear(c, w, h, [[0, "#fbf6ea"], [1, "#efe0bd"]]);
      glow(c, w / 2, h / 2, w * 1.1, "rgba(255,255,255,0.4)");
      c.strokeStyle = "rgba(180,140,60,0.55)"; c.lineWidth = 4; c.strokeRect(54, 54, w - 108, h - 108);
      c.lineWidth = 1.5; c.strokeRect(74, 74, w - 148, h - 148);
    },
  },
  {
    id: "praise", name: "Praise report", emoji: "🙌", label: "PRAISE REPORT", placeholder: "Share your good news…",
    footer: "Give God the glory!", ink: "#ffffff", muted: "rgba(255,255,255,0.75)", labelBg: "rgba(255,255,255,0.18)", labelInk: "#ffffff",
    swatch: "linear-gradient(160deg,#ff9f43,#ff5e7e 55%,#8e44ad)",
    paint: (c, w, h) => { linear(c, w, h, [[0, "#ff9f43"], [0.55, "#ff5e7e"], [1, "#8e44ad"]], 160); glow(c, w * 0.8, h * 0.1, w * 0.7, "rgba(255,255,255,0.25)"); },
  },
  {
    id: "encourage", name: "Encouragement", emoji: "💛", label: "A WORD FOR YOU", placeholder: "A word to lift someone up…",
    footer: "You are not alone 💛", ink: "#ffffff", muted: "rgba(255,255,255,0.7)", labelBg: "rgba(255,255,255,0.14)", labelInk: "#a7f3d0",
    swatch: "linear-gradient(165deg,#0f766e,#064e3b)",
    paint: (c, w, h) => { linear(c, w, h, [[0, "#0f766e"], [1, "#052e25"]]); glow(c, w * 0.3, h * 0.2, w * 0.9, "rgba(253,230,138,0.18)"); },
  },
  {
    id: "sermon", name: "Sermon notes", emoji: "📝", label: "SERMON NOTES", placeholder: "Key points from today's message…", extra: "Preacher or church (optional)",
    align: "left", ink: "#ffffff", muted: "rgba(255,255,255,0.6)", labelBg: "rgba(251,191,36,0.14)", labelInk: "#fbbf24",
    swatch: "linear-gradient(165deg,#1d2027,#0d0f13)",
    paint: (c, w, h) => {
      linear(c, w, h, [[0, "#1d2027"], [1, "#0d0f13"]]);
      c.strokeStyle = "rgba(255,255,255,0.05)"; c.lineWidth = 2;
      for (let y = 420; y < h - 260; y += 92) { c.beginPath(); c.moveTo(96, y); c.lineTo(w - 96, y); c.stroke(); }
      c.fillStyle = "#fbbf24"; c.fillRect(64, 360, 8, h - 700);
    },
  },
  {
    id: "event", name: "Event", emoji: "📅", label: "JOIN US", placeholder: "What's happening?", extra: "When & where, e.g. Sunday 10am · Main hall",
    ink: "#ffffff", muted: "#fbbf24", labelBg: "rgba(251,191,36,0.16)", labelInk: "#fbbf24",
    swatch: "linear-gradient(165deg,#1a1408,#05070b)",
    paint: (c, w, h) => {
      linear(c, w, h, [[0, "#1a1408"], [1, "#05070b"]]);
      glow(c, w / 2, h * 0.35, w, "rgba(245,158,11,0.18)");
      c.strokeStyle = "rgba(251,191,36,0.7)"; c.lineWidth = 6; c.strokeRect(60, 60, w - 120, h - 120);
    },
  },
  {
    id: "thankful", name: "Thankful", emoji: "🌅", label: "GRATEFUL FOR", placeholder: "What are you thankful for today?",
    footer: "Every good gift is from above", ink: "#3b1d0a", muted: "rgba(59,29,10,0.65)", labelBg: "rgba(59,29,10,0.1)", labelInk: "#7c2d12",
    swatch: "linear-gradient(165deg,#ffe4c4,#ffa07a)",
    paint: (c, w, h) => { linear(c, w, h, [[0, "#ffe9cc"], [1, "#ff9a76"]]); glow(c, w * 0.5, h * 0.05, w * 0.8, "rgba(255,255,255,0.5)"); },
  },
];

export const W = 1080;
export const H = 1920;

let markImage: Promise<HTMLImageElement | null> | null = null;
const loadMark = () => {
  markImage ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/brand/sooz-mark-mask.png";
  });
  return markImage;
};

let fontsReady: Promise<unknown> | null = null;
export const loadTemplateFonts = () => {
  fontsReady ??= Promise.all([
    document.fonts?.load("700 80px Outfit"),
    document.fonts?.load("800 40px Outfit"),
    document.fonts?.load('italic 400 80px "Playfair Display"'),
  ]).catch(() => {});
  return Promise.all([fontsReady, loadMark()]);
};

/** Split text into lines that fit `maxWidth` (keeps the writer's own line breaks). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) { line = next; continue; }
      if (line) lines.push(line);
      // A single word longer than the line: break it.
      let rest = word;
      while (ctx.measureText(rest).width > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

/** Draw a template with the writer's words. */
export async function drawTemplate(canvas: HTMLCanvasElement, t: PostTemplate, text: string, extra: string, handle?: string) {
  const mark = await loadMark();
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  t.paint(ctx, W, H);

  const left = t.align === "left";
  const pad = left ? 120 : 110;
  const x = left ? pad : W / 2;
  ctx.textAlign = left ? "left" : "center";
  ctx.textBaseline = "alphabetic";

  // Emoji + label pill
  ctx.font = "110px Outfit, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
  ctx.fillText(t.emoji, x, 300);
  ctx.font = "800 36px Outfit, sans-serif";
  const labelW = ctx.measureText(t.label).width + 64;
  const lx = left ? pad : W / 2 - labelW / 2;
  ctx.fillStyle = t.labelBg;
  ctx.beginPath();
  ctx.roundRect(lx, 350, labelW, 70, 35);
  ctx.fill();
  ctx.fillStyle = t.labelInk;
  ctx.fillText(t.label, left ? pad + 32 : W / 2, 398);

  // Main words: as big as fits in the middle of the card
  const body = text.trim() || t.placeholder;
  const boxTop = 500, boxBottom = extra.trim() ? 1440 : 1520;
  const maxW = W - pad * 2;
  let size = 104, lines: string[] = [], lineH = 0;
  const fontFor = (s: number) => (t.serif ? `italic 400 ${s}px "Playfair Display", Georgia, serif` : `700 ${s}px Outfit, sans-serif`);
  for (; size >= 40; size -= 4) {
    ctx.font = fontFor(size);
    lines = wrap(ctx, body, maxW);
    lineH = size * (t.serif ? 1.3 : 1.22);
    if (lines.length * lineH <= boxBottom - boxTop) break;
  }
  const maxLines = Math.floor((boxBottom - boxTop) / lineH);
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s*\S*$/, "")}…`; }
  ctx.font = fontFor(size);
  ctx.fillStyle = text.trim() ? t.ink : t.muted;
  const blockH = lines.length * lineH;
  let y = boxTop + (boxBottom - boxTop - blockH) / 2 + size;
  const quote = t.serif && text.trim();
  lines.forEach((line, i) => {
    const s = quote && i === 0 ? `“${line}` : line;
    ctx.fillText(quote && i === lines.length - 1 ? `${s}”` : s, x, y);
    y += lineH;
  });

  // Second line (reference / when & where)
  if (extra.trim()) {
    ctx.font = `${t.serif ? "700" : "600"} 46px Outfit, sans-serif`;
    ctx.fillStyle = t.muted;
    ctx.fillText(t.serif ? `— ${extra.trim()}` : extra.trim(), x, Math.min(y + 70, 1560));
  }

  // Footer
  if (t.footer) {
    ctx.font = "600 40px Outfit, sans-serif";
    ctx.fillStyle = t.muted;
    ctx.fillText(t.footer, x, 1660);
  }

  // SOOZ signature
  const sigY = 1800;
  ctx.font = "800 38px Outfit, sans-serif";
  const word = "SOOZ";
  const handleText = handle ? `  ·  @${handle}` : "";
  ctx.textAlign = "left";
  const wordW = ctx.measureText(word).width;
  ctx.font = "500 34px Outfit, sans-serif";
  const handleW = ctx.measureText(handleText).width;
  const markW = mark ? 64 * (mark.naturalWidth / mark.naturalHeight) * 0.6 : 0;
  const total = markW + (markW ? 14 : 0) + wordW + handleW;
  let sx = W / 2 - total / 2;
  if (mark) {
    const mh = 38, mw = mh * (mark.naturalWidth / mark.naturalHeight);
    const off = document.createElement("canvas");
    off.width = Math.ceil(mw); off.height = mh;
    const o = off.getContext("2d")!;
    const g = o.createLinearGradient(0, 0, 0, mh);
    g.addColorStop(0, "#fde68a"); g.addColorStop(0.5, "#fbbf24"); g.addColorStop(1, "#d97706");
    o.fillStyle = g; o.fillRect(0, 0, mw, mh);
    o.globalCompositeOperation = "destination-in";
    o.drawImage(mark, 0, 0, mw, mh);
    ctx.drawImage(off, sx, sigY - mh + 6);
    sx += mw + 14;
  }
  ctx.font = "800 38px Outfit, sans-serif";
  ctx.fillStyle = t.ink === "#ffffff" ? "#fbbf24" : t.ink;
  ctx.fillText(word, sx, sigY);
  ctx.font = "500 34px Outfit, sans-serif";
  ctx.fillStyle = t.muted;
  ctx.fillText(handleText, sx + wordW, sigY);
}

export const canvasToFile = (canvas: HTMLCanvasElement) =>
  new Promise<File>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(new File([b], `sooz-template-${Date.now()}.jpg`, { type: "image/jpeg" })) : reject(new Error("render failed"))), "image/jpeg", 0.92),
  );
