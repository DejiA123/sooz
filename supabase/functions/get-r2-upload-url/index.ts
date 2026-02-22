// Deno-native S3 presigned URL generator — no AWS SDK dependency
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}

async function hmacSha256(key: ArrayBuffer | CryptoKey, data: string): Promise<ArrayBuffer> {
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
    const canonicalRequest = [
        'PUT',
        `/${encodedKey}`,
        sortedQuery,
        `host:${host}\n`, // canonical headers
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

        const { fileName, fileType } = await req.json()
        if (!fileName || !fileType) {
            throw new Error('Missing fileName or fileType')
        }

        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
        const ext = fileName.split('.').pop()
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
