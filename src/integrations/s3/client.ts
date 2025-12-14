import { S3Client } from "@aws-sdk/client-s3";

// TODO: USER - Replace these with your storage provider's details
// Works with: AWS S3, Cloudflare R2, Backblaze B2, DigitalOcean Spaces, etc.
export const s3Config = {
    region: "auto",
    endpoint: import.meta.env.VITE_R2_ENDPOINT,
    credentials: {
        accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
    },
    bucketName: import.meta.env.VITE_R2_BUCKET_NAME,
    // Optional: Set strict CORS in your provider settings to allow this domain
};

export const s3Client = new S3Client({
    region: s3Config.region,
    endpoint: s3Config.endpoint,
    credentials: s3Config.credentials,
    forcePathStyle: true, // Required for Cloudflare R2
});
