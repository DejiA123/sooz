import { S3Client } from "@aws-sdk/client-s3";

// TODO: USER - Replace these with your storage provider's details
// Works with: AWS S3, Cloudflare R2, Backblaze B2, DigitalOcean Spaces, etc.
export const s3Config = {
    region: "auto", // or 'us-east-1' etc.
    endpoint: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com", // Example for R2
    credentials: {
        accessKeyId: "YOUR_ACCESS_KEY_ID",
        secretAccessKey: "YOUR_SECRET_ACCESS_KEY",
    },
    bucketName: "YOUR_BUCKET_NAME",
    // Optional: Set strict CORS in your provider settings to allow this domain
};

export const s3Client = new S3Client({
    region: s3Config.region,
    endpoint: s3Config.endpoint,
    credentials: s3Config.credentials,
});
