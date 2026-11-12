import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  // Only signed-in members get call relay credentials (they cost money per use).
  const auth = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const who = auth ? await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${auth}`, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
  }) : null;
  if (!who?.ok) return new Response(JSON.stringify({ error: 'Sign in to call' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const keyId = Deno.env.get('CLOUDFLARE_TURN_KEY_ID');
  const token = Deno.env.get('CLOUDFLARE_TURN_API_TOKEN');
  if (!keyId || !token) {
    return new Response(JSON.stringify({ error: 'TURN not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: 86400 }),
  });
  const body = await r.text();
  if (!r.ok) console.error(`TURN failed [${r.status}]: ${body}`);
  return new Response(body, { status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
