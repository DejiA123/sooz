import { getPresignedUploadUrl } from "@/integrations/s3/client";

const FN = "https://xhqpojnmcibkaydidnex.supabase.co/functions/v1/share-preview";
const CACHE_KEY = "sooz-share-links";

/**
 * WhatsApp needs a page served as text/html to show a thumbnail.
 * The backend function can only send text/plain, so we host a copy of the
 * preview page on the media storage (which serves real HTML) and share that.
 */
export async function getShareLink(postId: string): Promise<string> {
  const fallback = `${FN}?id=${postId}`;
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    if (cache[postId]) return cache[postId];

    const res = await fetch(`${FN}?id=${postId}&static=1`);
    if (!res.ok) return fallback;
    const html = await res.text();

    // Short key keeps the shared URL clean: pub-…r2.dev/s/Ab12Cd34.html
    const shortId = postId.replace(/-/g, "").slice(0, 8);
    const { signedUrl, publicUrl } = await getPresignedUploadUrl(`s/${shortId}.html`, "text/html");
    const put = await fetch(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: html,
    });
    if (!put.ok) return fallback;

    cache[postId] = publicUrl;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    return publicUrl;
  } catch (e) {
    console.warn("share link fallback", e);
    return fallback;
  }
}

