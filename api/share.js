import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    const { id } = req.query;

    if (!id) {
        return res.redirect('/');
    }

    // Init Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL; // Fallback for diff env naming
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase env vars');
        return res.redirect(`/post/${id}`);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch post data
    const { data: post } = await supabase
        .from('posts')
        .select(`
      caption,
      media_url,
      profiles:user_id (username, display_name)
    `)
        .eq('id', id)
        .single();

    const title = post?.profiles
        ? `Post by ${post.profiles.display_name || post.profiles.username} on SOOZ`
        : 'SOOZ - Sound Out Of Zion';

    const description = post?.caption || 'Check out this post on SOOZ';
    const image = post?.media_url || 'https://sooz.app/sooz-logo-v3.png'; // Fallback to v3 logo
    const redirectUrl = `/post/${id}`; // Client-side route

    const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <meta property="og:type" content="website" />
        <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
        <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
        <meta property="og:image" content="${image}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />
        <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
        <meta name="twitter:image" content="${image}" />
        
        <script>
          window.location.href = "${redirectUrl}";
        </script>
      </head>
      <body>
        <p>Redirecting to post...</p>
      </body>
    </html>
  `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
}
