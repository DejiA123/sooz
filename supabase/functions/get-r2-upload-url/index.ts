// Deno-native S3 presigned URL generator — no AWS SDK dependency
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

/** The signed-in member making the request (checked with Supabase Auth), or null. */
async function signedInUser(req: Request): Promise<string | null> {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return null
    const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
    })
    if (!r.ok) return null
    const user = await r.json().catch(() => null)
    return typeof user?.id === 'string' ? user.id : null
}

/** Only photos, videos and sound can be uploaded — never web pages or scripts (they'd run on the
 *  public media address). The file name's ending comes from the type, not from what the caller says. */
const ALLOWED: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif', 'image/avif': 'avif',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v', 'video/3gpp': '3gp',
    'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'weba', 'audio/ogg': 'ogg', 'audio/wav': 'wav',
}

function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

async function hmacSha256(key: BufferSource | CryptoKey, data: string): Promise<ArrayBuffer> {
    const cryptoKey = key instanceof CryptoKey ? key : await crypto.subtle.importKey(
        'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
}

async function sha256Hex(data: string): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
    return toHex(hash)
}

async function getSignedUploadUrl(
    endpoint: string,
    accessKeyId: string,
    secretAccessKey: string,
    bucket: string,
    key: string,
    contentType: string,
    region = 'auto',
    expiresIn = 3600
): Promise<string> {
    // Extract host from endpoint
    const endpointUrl = new URL(endpoint)
    const host = endpointUrl.host

    const now = new Date()
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
    const amzDateTime = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z' // YYYYMMDDTHHmmssZ

    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
    const credential = `${accessKeyId}/${credentialScope}`

    const signedHeaders = 'host'
    const queryParams = new URLSearchParams({
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': credential,
        'X-Amz-Date': amzDateTime,
        'X-Amz-Expires': String(expiresIn),
        'X-Amz-SignedHeaders': signedHeaders,
    })
    // Sort query params alphabetically (required for SigV4)
    const sortedQuery = Array.from(queryParams.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')

    const encodedKey = key.split('/').map(p => encodeURIComponent(p)).join('/')
    // For path-style S3: canonical URI must include bucket AND key
    const canonicalUri = `/${bucket}/${encodedKey}`
    const canonicalRequest = [
        'PUT',
        canonicalUri,
        sortedQuery,
        `host:${host}\n`, // canonical headers (must end with \n)
        signedHeaders,    // signed headers
        'UNSIGNED-PAYLOAD',
    ].join('\n')

    const canonical_request_hash = await sha256Hex(canonicalRequest)
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDateTime,
        credentialScope,
        canonical_request_hash,
    ].join('\n')

    // Derive signing key
    const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp)
    const kRegion = await hmacSha256(kDate, region)
    const kService = await hmacSha256(kRegion, 's3')
    const kSigning = await hmacSha256(kService, 'aws4_request')
    const signingKey = await crypto.subtle.importKey(
        'raw', kSigning, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const signature = toHex(await hmacSha256(signingKey, stringToSign))

    return `${endpoint}/${bucket}/${encodedKey}?${sortedQuery}&X-Amz-Signature=${signature}`
}

Deno.serve(async (req: Request) => {
    console.log(`[get-r2-upload-url] ${req.method}`)

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    try {
        const r2Endpoint = Deno.env.get('R2_ENDPOINT')!
        const r2AccessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')!
        const r2SecretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')!
        const r2BucketName = Deno.env.get('R2_BUCKET_NAME') || 'media'
        const r2PublicUrl = Deno.env.get('R2_PUBLIC_URL')!

        if (!r2Endpoint || !r2AccessKeyId || !r2SecretAccessKey) {
            throw new Error('Missing R2 configuration in Supabase Secrets')
        }

        const me = await signedInUser(req)
        if (!me) {
            return new Response(JSON.stringify({ error: 'Sign in to upload' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { fileName, fileType } = await req.json()
        if (!fileName || typeof fileType !== 'string') {
            throw new Error('Missing fileName or fileType')
        }
        const ext = ALLOWED[fileType.split(';')[0].trim().toLowerCase()]
        if (!ext) {
            return new Response(JSON.stringify({ error: 'Only photos, videos and sound can be uploaded' }), { status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`
        const key = `uploads/${uniqueSuffix}.${ext}`

        const signedUrl = await getSignedUploadUrl(
            r2Endpoint,
            r2AccessKeyId,
            r2SecretAccessKey,
            r2BucketName,
            key,
            fileType,
        )

        return new Response(
            JSON.stringify({ signedUrl, key, publicUrl: `${r2PublicUrl}/${key}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (err: any) {
        console.error('[get-r2-upload-url] Error:', err.message)
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
