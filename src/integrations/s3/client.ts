import { S3Client } from "@aws-sdk/client-s3";

// TODO: USER - Replace these with your storage provider's details
// Works with: AWS S3, Cloudflare R2, Backblaze B2, DigitalOcean Spaces, etc.
export const s3Config = {
    region: "auto",
    endpoint: import.meta.env.VITE_R2_ENDPOINT || "",
    credentials: {
        accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID || "",
        secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY || "",
    },
    bucketName: import.meta.env.VITE_R2_BUCKET_NAME || "",
};

let _s3Client: S3Client | null = null;

export const getS3Client = () => {
    if (_s3Client) return _s3Client;

    if (!s3Config.endpoint || !s3Config.credentials.accessKeyId || !s3Config.credentials.secretAccessKey) {
        throw new Error("S3 Error: Missing configuration. Please check your environment variables (VITE_R2_ENDPOINT, etc).");
    }

    _s3Client = new S3Client({
        region: s3Config.region,
        endpoint: s3Config.endpoint,
        credentials: s3Config.credentials,
        forcePathStyle: true,
    });

    return _s3Client;
};
