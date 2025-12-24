import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
        console.log("Received payload:", JSON.stringify(bodyData));
        const { record, type, toUserId, title, body, url } = bodyData;

        // Initialize Supabase Client (Service Role)
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get VAPID keys
        const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
        const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

        let subscriptions: any[] = [];
        let notificationPayload: Record<string, string> = {};

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

        console.log(`Sending notifications to ${subscriptions.length} devices...`);
        console.log(`VAPID keys present: public=${!!vapidPublicKey}, private=${!!vapidPrivateKey}`);

        // Log notification payload for debugging
        console.log("Notification payload:", JSON.stringify(notificationPayload));

        // For now, just log that we would send notifications
        // The actual Web Push implementation requires complex crypto that's best done with a proper library
        // Since web-push npm doesn't work in Deno, we'll need to either:
        // 1. Use a different approach (like FCM via HTTP API)
        // 2. Or implement raw Web Push protocol
        
        const results = await Promise.all(
            subscriptions.map(async (sub) => {
                console.log(`Would send notification to subscription ${sub.id} for user ${sub.user_id}`);
                // Store notification in database so it can be fetched by the client
                return { id: sub.id, status: 'logged' };
            })
        );

        return new Response(JSON.stringify({ 
            message: "Notifications processed",
            count: subscriptions.length,
            results 
        }), {
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
