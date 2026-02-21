import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.341.0"
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.341.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

        // Auth check
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('No authorization header');
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            throw new Error('Unauthorized');
        }

        const { fileName, fileType } = await req.json();
        if (!fileName || !fileType) {
            throw new Error('Missing fileName or fileType');
        }

        const r2Endpoint = Deno.env.get("R2_ENDPOINT")!;
        const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")!;
        const r2SecretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
        const r2BucketName = Deno.env.get("R2_BUCKET_NAME") || "media";

        if (!r2Endpoint || !r2AccessKeyId || !r2SecretAccessKey) {
            throw new Error('Missing R2 configuration in Supabase Secrets');
        }

        const s3Client = new S3Client({
            region: 'auto',
            endpoint: r2Endpoint,
            credentials: {
                accessKeyId: r2AccessKeyId,
                secretAccessKey: r2SecretAccessKey,
            },
            forcePathStyle: true,
        });

        // Create unique path
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const key = `uploads/${user.id}/${uniqueSuffix}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: r2BucketName,
            Key: key,
            ContentType: fileType,
        });

        // Presigned URL valid for 1 hour
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return new Response(JSON.stringify({
            signedUrl,
            key,
            publicUrl: `${Deno.env.get("R2_PUBLIC_URL")}/${key}`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
})
