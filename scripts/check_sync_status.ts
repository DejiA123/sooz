
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase
        .from('video_archive')
        .select('youtube_id, title, r2_video_url')
        .not('r2_video_url', 'is', null);

    if (error) {
        console.error("Error:", error.message);
        return;
    }

    console.log(`✅ Found ${data.length} videos synced to R2:`);
    data.forEach(v => console.log(`- ${v.title} (${v.youtube_id})`));
}

check();
