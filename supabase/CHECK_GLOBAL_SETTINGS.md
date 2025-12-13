# Check Global Storage Settings

The bucket-level limit is correct (2GB), but the upload is still blocked. This usually means the **Global Upload Limit** in your Supabase project settings is lower than the bucket limit.

1. Go to your **Supabase Dashboard**.
2. Navigate to **Storage** in the sidebar.
3. Click on **Configuration** (or **Settings**).
4. Look for **Global Upload Limit**.
5. Ensure this value is also set to **2GB** (or higher/unlimited). The default might be 1GB or 50MB.

## Alternative: Tenant/Plan Limit
If you are on the **Free Tier**, verify if you have exceeded your **total project storage** quota (default 500MB). A 413 error usually refers to the *request body* size, but sometimes quotas manifest oddly.
- Check your **Dashboard Home** -> **Project Usage** -> **Storage**.
