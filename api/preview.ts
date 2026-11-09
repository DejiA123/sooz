/**
 * Link previews for shared SOOZ links (WhatsApp, iMessage, Facebook, Telegram…).
 *   /t/{tiktokId}?by={handle}  → the TikTok's cover, creator and caption
 *   /p/{postId}                → the SOOZ post's picture, author and caption
 * Link-preview robots get a page with Open Graph tags; people are sent straight on to the app
 * (`/?tiktok=…` opens that TikTok first, `/post/…` opens the post). Routed by vercel.json.
 */
export const config = { runtime: "edge" };

const SITE = "https://sooz.vercel.app";
const SUPABASE_URL = "https://xhqpojnmcibkaydidnex.supabase.co";
// The public (anon) key — the same one shipped in the app.
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocXBvam5tY2lia2F5ZGlkbmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMjAzNTcsImV4cCI6MjA4MDg5NjM1N30.DkKg7S_xOEyGR2R9TtjBKzqoDACzZUYkA8BcFw6qylw";
const DEFAULT_IMAGE = `${SITE}/og-image.jpg`;
const BROWSER_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ROBOT_RE = /bot|crawl|spider|preview|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|linkedin|skype|embedly|pinterest|vkshare|viber|snapchat|google|bing|yandex|duckduck|applebot|iframely|redditbot|tumblr|bitly|nuzzel|mastodon|signal/i;

type Preview = { title: string; description: string; image: string; video?: boolean };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : s);

async function getText(url: string, headers: Record<string, string> = {}, ms = 3500): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": BROWSER_UA, ...headers } });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A JSON string value found by a regex (with escapes like & decoded). */
function jsonString(text: string, re: RegExp): string {
  const m = text.match(re);
  if (!m) return "";
  try { return JSON.parse(`"${m[1]}"`) as string; } catch { return ""; }
}

async function tiktokPreview(id: string, handle: string | null): Promise<Preview> {
  const [embed, oembed] = await Promise.all([
    getText(`https://www.tiktok.com/embed/v2/${id}`),
    getText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/@${handle || "_"}/video/${id}`)}`),
  ]);
  let caption = "";
  let name = "";
  let image = "";
  if (oembed) {
    try { const o = JSON.parse(oembed) as { title?: string; author_name?: string }; caption = o.title || ""; name = o.author_name || ""; } catch { /* not JSON */ }
  }
  if (embed) {
    const at = embed.indexOf(`"id":"${id}"`);
    const item = at >= 0 ? embed.slice(at, at + 30000) : embed;
    if (!caption) caption = jsonString(item, /"text":"((?:[^"\\]|\\.)*)"/);
    if (!name) name = jsonString(item, /"authorName":"((?:[^"\\]|\\.)*)"/) || jsonString(item, /"nickName":"((?:[^"\\]|\\.)*)"/);
    // The cover picture: TikTok lists a few copies; a .jpeg one works everywhere.
    const covers = item.match(/"covers":\[([^\]]*)\]/)?.[1] ?? "";
    const urls = [...covers.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => { try { return JSON.parse(`"${m[1]}"`) as string; } catch { return ""; } }).filter(Boolean);
    image = urls.find((u) => /\.jpe?g\?/i.test(u)) || urls[0] || "";
  }
  const who = name || (handle ? `@${handle}` : "a Christian creator");
  return {
    title: `${who} on SOOZ`,
    description: clip(oneLine(caption), 200) || "Watch this Christian video on SOOZ — Sound Out Of Zion.",
    image: image || DEFAULT_IMAGE,
    video: true,
  };
}

async function postPreview(id: string): Promise<Preview | null> {
  const text = await getText(
    `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(id)}&select=caption,media_url,media_type,thumbnail_url,profiles:user_id(username,display_name)`,
    { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  );
  if (!text) return null;
  let post: { caption: string | null; media_url: string | null; media_type: string | null; thumbnail_url: string | null; profiles: { username: string; display_name: string | null } | null } | undefined;
  try { post = (JSON.parse(text) as typeof post[])[0]; } catch { return null; }
  if (!post) return null;
  const name = (post.profiles?.display_name || post.profiles?.username || "Someone").trim();
  const isVideo = post.media_type === "video" || /\.(mp4|mov|webm)(\?|$)/i.test(post.media_url || "");
  const image = post.thumbnail_url || (!isVideo && post.media_url) || DEFAULT_IMAGE;
  return {
    title: `${name} on SOOZ`,
    description: clip(oneLine(post.caption || ""), 200) || `See ${name}'s post on SOOZ — Sound Out Of Zion.`,
    image,
    video: isVideo,
  };
}

function page(p: Preview, shareUrl: string, appUrl: string): string {
  const t = esc(p.title), d = esc(p.description), img = esc(p.image), app = esc(appUrl);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${esc(shareUrl)}" />
<meta property="og:site_name" content="SOOZ" />
<meta property="og:type" content="${p.video ? "video.other" : "article"}" />
<meta property="og:url" content="${esc(shareUrl)}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${img}" />
<meta property="og:image:secure_url" content="${img}" />
<meta property="og:image:alt" content="${t}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />
<meta http-equiv="refresh" content="0;url=${app}" />
</head><body style="background:#05070b;color:#fff;font-family:sans-serif;text-align:center;padding:40px">
<p><a href="${app}" style="color:#fbbf24">Open in SOOZ</a></p>
<script>location.replace(${JSON.stringify(appUrl)})</script>
</body></html>`;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const tiktok = url.searchParams.get("tiktok")?.match(/^\d{5,25}$/)?.[0] ?? null;
  const handle = url.searchParams.get("by")?.match(/^[\w.]{1,40}$/)?.[0] ?? null;
  const post = url.searchParams.get("post")?.match(/^[0-9a-f-]{36}$/i)?.[0] ?? null;

  const appUrl = tiktok
    ? `${SITE}/?tiktok=${tiktok}${handle ? `&by=${handle}` : ""}`
    : post ? `${SITE}/post/${post}` : SITE;
  const shareUrl = tiktok
    ? `${SITE}/t/${tiktok}${handle ? `?by=${handle}` : ""}`
    : post ? `${SITE}/p/${post}` : SITE;

  // People go straight to the app (never cached, so robots always get the preview page).
  if (!ROBOT_RE.test(request.headers.get("user-agent") || "")) {
    return new Response(null, { status: 302, headers: { location: appUrl, "cache-control": "no-store" } });
  }

  const preview = (tiktok ? await tiktokPreview(tiktok, handle) : post ? await postPreview(post) : null)
    ?? { title: "SOOZ — Sound Out Of Zion", description: "Worship, sermons & Christian videos — together.", image: DEFAULT_IMAGE };
  return new Response(page(preview, shareUrl, appUrl), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=21600" },
  });
}
