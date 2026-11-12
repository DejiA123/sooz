import { format, isToday, isYesterday, isThisWeek, isThisYear } from "date-fns";

/** Photos are sent as a link to the uploaded image. */
export const isImageMessage = (content: string) =>
  content.startsWith("http") && (content.includes("/chat-images/") || /\.(jpe?g|png|gif|webp|heic)(\?|$)/i.test(content));

/** What a message looks like in the chat list ("📷 Photo" instead of a long link). */
export function messagePreview(content: string | null | undefined): string {
  if (!content) return "";
  if (isImageMessage(content)) return "📷 Photo";
  if (/^https?:\/\/\S+\.(mp4|mov|webm)(\?|$)/i.test(content)) return "🎥 Video";
  if (/^https?:\/\/\S+\.(m4a|mp3|ogg|wav|aac)(\?|$)/i.test(content)) return "🎤 Voice message";
  if (/^https?:\/\/\S*supabase\.co\/storage\//i.test(content)) return "📎 Attachment";
  return content.replace(/\s+/g, " ");
}

/** Short time for the chat list: "14:05", "Yesterday", "Mon", "12 Mar", "12/03/24". */
export function shortChatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return format(d, "EEE");
  if (isThisYear(d)) return format(d, "d MMM");
  return format(d, "dd/MM/yy");
}

/** "online" / "last seen today at 14:05" / "last seen yesterday at 09:12" / "last seen 12 Mar at 18:30". */
export function lastSeenLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const t = format(d, "HH:mm");
  if (isToday(d)) return `last seen today at ${t}`;
  if (isYesterday(d)) return `last seen yesterday at ${t}`;
  if (isThisWeek(d)) return `last seen ${format(d, "EEEE")} at ${t}`;
  if (isThisYear(d)) return `last seen ${format(d, "d MMM")} at ${t}`;
  return `last seen ${format(d, "d MMM yyyy")}`;
}

/** The date chip between days in a chat: "Today", "Yesterday", "Monday", "12 March", "12 March 2024". */
export function dayChipLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return format(d, "EEEE");
  if (isThisYear(d)) return format(d, "EEE d MMMM");
  return format(d, "d MMMM yyyy");
}

export const bubbleTime = (iso: string) => format(new Date(iso), "HH:mm");

export function formatDuration(seconds: number | undefined | null): string {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(n: number | undefined | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Stable colour for a member's name in group chats. */
export function nameColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 65% 38%)`;
}

export const DISAPPEAR_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: "Off", seconds: null },
  { label: "24 hours", seconds: 86400 },
  { label: "7 days", seconds: 604800 },
  { label: "90 days", seconds: 7776000 },
];
export const disappearLabel = (s: number | null | undefined) => DISAPPEAR_OPTIONS.find((o) => o.seconds === (s ?? null))?.label ?? "On";

/** Attachment addresses come from the message (another person's phone), so only web addresses are
 *  ever used as links — a "javascript:" one would run in SOOZ and could take over the account. */
export const safeUrl = (url: unknown): string | undefined => {
  if (typeof url !== "string") return undefined;
  try { const u = new URL(url, window.location.origin); return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "blob:" ? u.href : undefined; }
  catch { return undefined; }
};
