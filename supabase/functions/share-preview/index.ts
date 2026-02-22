
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return new Response('Missing id', { status: 400, headers: corsHeaders })
  }

  // Init Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const appDomain = Deno.env.get('APP_DOMAIN') || 'https://sooz.vercel.app';
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
  const shareUrl = id ? `${appDomain}/share/${id}` : appDomain;
  const ogType = isVideoPost ? 'video.other' : 'website';

  // Checking User-Agent to see if it's a bot/crawler
  const userAgent = req.headers.get('user-agent') || '';
  const isBot = /facebookexternalhit|twitterbot|whatsapp|linkedinbot|pinterest|slackbot|telegrambot|discordbot|googlebot|bingbot|applebot/i.test(userAgent);

  if (isBot) {
    // For videos, add additional metadata
    let videoMetaTags = '';
    if (isVideoPost && post?.media_url) {
      videoMetaTags = `
        <meta property="og:video" content="${post.media_url}" />
        <meta property="og:video:secure_url" content="${post.media_url}" />
        <meta property="og:video:type" content="video/mp4" />
        <meta name="twitter:player" content="${post.media_url}" />
        <meta name="twitter:player:width" content="1280" />
        <meta name="twitter:player:height" content="720" />`;
    }

    const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <!-- Meta Verification -->
        <meta property="fb:app_id" content="123456789" />

        <!-- Mobile-First Social Head (WhatsApp Priority) -->
        <meta property="og:url" content="${shareUrl}" />
        <meta property="og:image" content="${image}" />
        <meta property="og:image:secure_url" content="${image}" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/jpeg" />
        
        <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
        <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
        <meta property="og:type" content="${ogType}" />
        <meta property="og:site_name" content="SOOZ" />
        <meta property="og:locale" content="en_US" />
        
        ${videoMetaTags}

        <!-- Twitter Card -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />
        <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
        <meta name="twitter:image" content="${image}" />

        <title>${title}</title>
      </head>
      <body style="background: #030303; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
         <p>Redirecting to SOOZ...</p>
      </body>
    </html>
    `;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
      },
    });
  }

  // Real users get a clean 302 redirect
  return Response.redirect(redirectUrl, 302);
})
