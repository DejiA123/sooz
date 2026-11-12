/**
 * Where shared links point. sooz.vercel.app serves rich link previews for them (api/preview.ts:
 * the TikTok's cover / the post's picture, the creator and the caption) and sends people on to the
 * app — so links shared from any copy of SOOZ show a proper preview in WhatsApp.
 */
export const SHARE_ORIGIN = (import.meta.env.VITE_SHARE_ORIGIN as string | undefined) || "https://sooz.vercel.app";
export const tiktokShareUrl = (tiktokId: string, handle?: string | null) =>
  `${SHARE_ORIGIN}/t/${encodeURIComponent(tiktokId)}${handle ? `?by=${encodeURIComponent(handle)}` : ""}`;
export const postShareUrl = (postId: string) => `${SHARE_ORIGIN}/p/${postId}`;

/** A post's share link. (It used to upload an HTML copy to the media store; uploads are photos,
 *  videos and sound only now, so it's the same /p/ link as everywhere else.) */
export async function getShareLink(postId: string): Promise<string> {
  return postShareUrl(postId);
}

