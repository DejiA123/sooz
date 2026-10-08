import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const bodyData = await req.json();
        console.log("Received payload:", JSON.stringify(bodyData));
        const { record, type, toUserId, title, body, url } = bodyData;

        // Initialize Supabase Client (Service Role)
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get VAPID keys
        const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
        const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

        if (!vapidPublicKey || !vapidPrivateKey) {
            console.log("VAPID keys not configured, skipping push notifications");
            return new Response(JSON.stringify({ message: "Push notifications not configured" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        let subscriptions: any[] = [];
        let notificationPayload = {};

        if (type === 'chat_message') {
            if (!toUserId || !title || !body) {
                return new Response(JSON.stringify({ message: "Missing chat parameters" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 400,
                });
            }

            // Fetch subscriptions for the specific recipient
            const { data: subs, error: subError } = await supabase
                .from("push_subscriptions")
                .select("*")
                .eq('user_id', toUserId);

            if (subError) throw subError;
            subscriptions = subs || [];

            notificationPayload = {
                title,
                body,
                url: url || '/chat'
            };

        } else if (record) {
            // New Post Logic - Notify followers only
            const { data: author } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', record.user_id)
                .single();

            const authorName = author?.username || "Someone";

            // Fetch followers of the post author
            const { data: followers, error: followerError } = await supabase
                .from('follows')
                .select('follower_id')
                .eq('following_id', record.user_id);

            if (followerError) throw followerError;

            // Get push subscriptions for all followers
            const followerIds = followers?.map(f => f.follower_id) || [];

            if (followerIds.length > 0) {
                const { data: subs, error: subError } = await supabase
                    .from("push_subscriptions")
                    .select("*")
                    .in('user_id', followerIds);

                if (subError) throw subError;
                subscriptions = subs || [];
            }

            notificationPayload = {
                title: "New Post on SOOZ",
                body: `${authorName} just posted something new!`,
                url: `/post/${record.id}`,
            };
        } else {
            return new Response(JSON.stringify({ message: "Invalid payload" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        console.log(`Found ${subscriptions.length} subscriptions to notify`);

        webpush.setVapidDetails("mailto:admin@sooz.app", vapidPublicKey, vapidPrivateKey);
        const payload = JSON.stringify(notificationPayload);
        let sent = 0;
        await Promise.all(subscriptions.map(async (s: any) => {
            try {
                await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: "high" });
                sent++;
            } catch (err: any) {
                console.error("Push failed", err?.statusCode, err?.body);
                if (err?.statusCode === 404 || err?.statusCode === 410 || err?.statusCode === 403) {
                    await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
                }
            }
        }));

        return new Response(JSON.stringify({ message: "Notification processed", subscriptionCount: subscriptions.length, sent }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        console.error("Push notification error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
