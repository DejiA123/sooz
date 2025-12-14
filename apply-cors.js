
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
const s3Client = new S3Client({
    region: "auto",
    endpoint: "https://fd8da334e22fd77aac270568eec810bc.r2.cloudflarestorage.com",
    credentials: {
        accessKeyId: "3851b5941982dec1bc062a3263fa6ca9",
        secretAccessKey: "4df66b23041431b6daac8bee1959febc7323d65590cb360b8de9b4225ada2e3f"
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
