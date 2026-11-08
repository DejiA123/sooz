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
