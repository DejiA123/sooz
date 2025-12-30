
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
        return Response.redirect('https://sooz.lovable.app', 302);
    }

    const title = post.profiles
        ? `Post by ${post.profiles.display_name || post.profiles.username} on SOOZ`
        : 'SOOZ - Sound Out Of Zion';

    const description = post.caption || 'Check out this post on SOOZ';

    // Logic for image/video
    let image = 'https://sooz.lovable.app/sooz-logo-v3.png'; // Default
    let videoMeta = '';

    if (post.media_url) {
        if (post.media_type === 'image') {
            image = post.media_url;
        } else if (post.media_type === 'video') {
            // For video: use thumbnail if available, fallback to logo
            if (post.thumbnail_url) {
                image = post.thumbnail_url;
            }
            // Add og:video meta tag
            videoMeta = `<meta property="og:video" content="${post.media_url}" />`;
        } else {
            // Fallback check extension
            if (!post.media_url.match(/\.(mp4|mov|avi)$/i)) {
                image = post.media_url;
            }
        }
    }

    const redirectUrl = `https://sooz.lovable.app/post/${id}`;

    // Checking User-Agent to see if it's a bot/crawler
    const userAgent = req.headers.get('user-agent') || '';
    const isBot = /facebookexternalhit|twitterbot|whatsapp|linkedinbot|pinterest|slackbot/i.test(userAgent);

    // If it's a bot/crawler, serve HTML with OG tags (no redirect)
    if (isBot) {
        const html = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <meta property="og:type" content="website" />
            <meta property="og:url" content="${redirectUrl}" />
            <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
            <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
            <meta property="og:image" content="${image}" />
            <meta property="og:image:secure_url" content="${image}" />
            <meta property="og:image:type" content="image/png" />
            <meta property="og:image:width" content="512" />
            <meta property="og:image:height" content="512" />
            ${videoMeta}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />
            <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
            <meta name="twitter:image" content="${image}" />
          </head>
          <body>
            <h1>${title}</h1>
            <p>${description}</p>
          </body>
        </html>
      `;

        return new Response(html, {
            headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        });
    }

    // If it's a real user, do a proper HTTP redirect
    return Response.redirect(redirectUrl, 302);
})
