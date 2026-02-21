import { supabase } from "../supabase/client";

// Build trigger: 2026-02-21 23:35 UTC - Forcing refresh of baked-in R2 environment variables

export const getPresignedUploadUrl = async (fileName: string, fileType: string) => {
    const { data, error } = await supabase.functions.invoke('get-r2-upload-url', {
        body: { fileName, fileType }
    });

    if (error) {
        console.error('Error getting presigned URL:', error);
        throw new Error(`Failed to get upload URL: ${error.message}`);
    }

    return data as { signedUrl: string; key: string; publicUrl: string };
};

// We still keep the public R2 URL for viewing media
export const s3Config = {
    publicUrl: import.meta.env.VITE_PUBLIC_R2_URL || "https://pub-e59dafe72724404d8ae7af425d1dfbdc.r2.dev",
};
