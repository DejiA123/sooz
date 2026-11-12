// Keys come from the environment (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) — never write them in this public repo.

import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
const s3Client = new S3Client({
    region: "auto",
    endpoint: "https://fd8da334e22fd77aac270568eec810bc.r2.cloudflarestorage.com",
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    },
});

const run = async () => {
    try {
        console.log("Applying CORS policy...");
        const response = await s3Client.send(new PutBucketCorsCommand({
            Bucket: "media",
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ["*"],
                        AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
                        AllowedOrigins: ["*"],
                        ExposeHeaders: ["ETag"],
                        MaxAgeSeconds: 3000
                    }
                ]
            }
        }));
        console.log("Success! CORS Policy applied.", response);
    } catch (err) {
        console.error("Error applying CORS:", err);
    }
};

run();
