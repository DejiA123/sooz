export const config = {
    runtime: 'edge',
}

export default async function handler(req: Request) {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop()

    if (!id) {
        return Response.redirect('https://sooz.vercel.app', 302)
    }

    const userAgent = req.headers.get('user-agent') || ''
    const isBot = /facebookexternalhit|twitterbot|whatsapp|linkedinbot|pinterest|slackbot|telegrambot|discordbot|googlebot|ia_archiver|baiduspider|yahoo|metainspector/i.test(userAgent)

    if (isBot) {
        // Fetch OG data from supabase function
        const supabaseRes = await fetch(
            `https://xhqpojnmcibkaydidnex.supabase.co/functions/v1/share-preview?id=${id}`,
            {
                headers: {
                    'user-agent': 'whatsapp-proxy-bot', // trigger bot path in supabase
                    'apikey': process.env.SUPABASE_ANON_KEY || '',
                }
            }
        )
        const html = await supabaseRes.text()
        return new Response(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        })
    }

    // Real user: redirect to the post page in the app
    return Response.redirect(`https://sooz.vercel.app/post/${id}`, 302)
}
