
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Names, captions and addresses are written by members: escape them before they go into the page. */
const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Only web addresses for pictures / videos. */
const webUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : '');

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  // Only a real post id (it goes into the page and its addresses).
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response('Missing id', { status: 400, headers: corsHeaders })
  }

  // Init Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const appDomain = Deno.env.get('APP_DOMAIN') || 'https://sooz.lovable.app';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch post data
  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      caption,
      media_url,
      media_type,
      thumbnail_url,
      profiles:user_id (username, display_name)
    `)
    .eq('id', id)
    .single()

  if (error || !post) {
    // Redirect to home if not found
    return Response.redirect(appDomain, 302);
  }

  const profileData = (post.profiles as unknown) as { username: string; display_name: string } | null;
  const displayName = profileData?.display_name || profileData?.username || 'someone';

  // Improved title to reach the 30-60 character "sweet spot"
  const title = `Check out this amazing post by ${displayName} on SOOZ - Sound Out Of Zion`;

  const description = post.caption || `Connect with ${displayName} and other believers on SOOZ, the faith-based social media platform.`;

  // Logic for image/video - ALWAYS absolute URLs for crawlers
  let image = `${appDomain}/sooz-logo-v3.png`;
  let isVideoPost = post?.media_type === 'video';

  if (post) {
    // Fallback: Check extension if media_type isn't explicitly video
    if (!isVideoPost && post.media_url) {
      if (post.media_url.match(/\.(mp4|mov|avi|webm)$/i)) {
        isVideoPost = true;
      }
    }

    if (post.media_url) {
      if (post.media_type === 'image') {
        const rawUrl = post.thumbnail_url || post.media_url;
        image = rawUrl.startsWith('http') ? rawUrl : `${appDomain}${rawUrl}`;
      } else if (isVideoPost) {
        if (post.thumbnail_url) {
          image = post.thumbnail_url.startsWith('http') ? post.thumbnail_url : `${appDomain}${post.thumbnail_url}`;
        }
      } else {
        if (!post.media_url.match(/\.(mp4|mov|avi|webm)$/i)) {
          const rawUrl = post.thumbnail_url || post.media_url;
          image = rawUrl.startsWith('http') ? rawUrl : `${appDomain}${rawUrl}`;
        }
      }
    }
  }

  const redirectUrl = id ? `${appDomain}/post/${id}` : appDomain;
  const shareUrl = `${supabaseUrl}/functions/v1/share-preview?id=${id}`;
  const ogType = isVideoPost ? 'video.other' : 'website';

  // Checking User-Agent to see if it's a bot/crawler
  const userAgent = req.headers.get('user-agent') || '';
  const staticMode = new URL(req.url).searchParams.get('static') === '1';
  const isBot = staticMode || /facebookexternalhit|twitterbot|whatsapp|linkedinbot|pinterest|slackbot|telegrambot|discordbot|googlebot|bingbot|applebot/i.test(userAgent);

  if (isBot) {
    // For bots, we serve the ABSOLUTE minimum: Just the <head> with tags.
    // No body, no javascript, no redirects. This ensures zero parser confusion.

    // Determine image type for better crawler support
    let imageType = 'image/jpeg';
    if (image.toLowerCase().endsWith('.png')) imageType = 'image/png';
    else if (image.toLowerCase().endsWith('.webp')) imageType = 'image/webp';
    else if (image.toLowerCase().endsWith('.gif')) imageType = 'image/gif';

    // For videos, add additional metadata
    let videoMetaTags = '';
    if (isVideoPost && post?.media_url) {
      videoMetaTags = `
        <meta property="og:video" content="${esc(webUrl(post.media_url))}" />
        <meta property="og:video:secure_url" content="${esc(webUrl(post.media_url))}" />
        <meta property="og:video:type" content="video/mp4" />
        <meta name="twitter:player" content="${esc(webUrl(post.media_url))}" />
        <meta name="twitter:player:width" content="1280" />
        <meta name="twitter:player:height" content="720" />`;
    }

    const html = `<!DOCTYPE html>
<html lang="en" prefix="og: http://ogp.me/ns#">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />

<!-- Standard Meta Tags -->
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />

<!-- Schema.org for Google+ / WhatsApp -->
<meta itemprop="name" content="${esc(title)}" />
<meta itemprop="description" content="${esc(description)}" />
<meta itemprop="image" content="${esc(image)}" />

<!-- Open Graph / Facebook / WhatsApp -->
<meta property="og:type" content="${ogType}" />
${staticMode ? '' : `<meta property="og:url" content="${esc(shareUrl)}" />`}
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:secure_url" content="${esc(image)}" />
<meta property="og:image:type" content="${imageType}" />
<meta property="og:image:alt" content="SOOZ Post Preview" />
<meta property="og:site_name" content="SOOZ" />
<meta property="og:locale" content="en_US" />
${videoMetaTags}

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />

</head>
<body style="background: #030303; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
  <div style="text-align: center;">
    <h1>SOOZ</h1>
    <p>Opening post...</p>
    <a href="${esc(redirectUrl)}" style="color:#9ab">Tap here if nothing happens</a>
    <script>location.replace(${JSON.stringify(redirectUrl).replace(/</g, '\\u003c')})</script>
    <img src="${esc(image)}" alt="Preview" style="max-width: 300px; border-radius: 12px; margin-top: 20px;" />
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=5'
      },
    });
  }

  // Real users get a clean, instant 302 redirect. 
  return Response.redirect(redirectUrl, 302);
})
