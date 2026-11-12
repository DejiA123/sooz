// Use Cloudflare API (not S3 API) to set CORS on R2 bucket
const ACCOUNT_ID = "fd8da334e22fd77aac270568eec810bc";
const BUCKET_NAME = "media";
// Cloudflare API token from the environment — never write it in this public repo.
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

const corsPolicy = [
    {
        AllowedOrigins: ["*"],
        AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
        AllowedHeaders: ["*"],
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 3000
    }
];

async function setCors() {
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET_NAME}/cors`;

    console.log("Setting CORS policy via Cloudflare API...");
    console.log("URL:", url);

    try {
        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${API_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ rules: corsPolicy })
        });

        const data = await response.json();
        console.log("Response status:", response.status);
        console.log("Response:", JSON.stringify(data, null, 2));

        if (data.success) {
            console.log("✅ CORS policy set successfully!");
        } else {
            console.log("❌ Failed to set CORS:", data.errors);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

setCors();
