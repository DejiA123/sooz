import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
        console.log("Received payload:", JSON.stringify(bodyData)); // Debug log
        const { record, type, toUserId, title, body, url } = bodyData;

        // Initialize Supabase Client (Service Role)
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Initialize Web Push
        const vapidSubject = "mailto:admin@sooz.app";
        const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
        const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

        webpush.setVapidDetails(
            vapidSubject,
            vapidPublicKey,
            vapidPrivateKey
        );

        let subscriptions = [];
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

            notificationPayload = JSON.stringify({
                title,
                body,
                url: url || '/chat'
            });

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

            notificationPayload = JSON.stringify({
                title: "New Post on SOOZ",
                body: `${authorName} just posted something new!`,
                url: `/post/${record.id}`,
            });
        } else {
            return new Response(JSON.stringify({ message: "Invalid payload" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        console.log(`Sending notifications to ${subscriptions.length} devices...`);

        const promises = subscriptions.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                },
            };

            try {
                await webpush.sendNotification(pushSubscription, notificationPayload);
            } catch (error: any) {
                if (error.statusCode === 410 || error.statusCode === 404) {
                    console.log(`Deleting expired subscription ${sub.id}`);
                    await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                } else {
                    console.error(`Error sending to ${sub.id}:`, error);
                }
            }
        });

        await Promise.all(promises);

        return new Response(JSON.stringify({ message: "Notifications sent" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
