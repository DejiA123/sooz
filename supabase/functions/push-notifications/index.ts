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
        const { record } = await req.json(); // Data from database trigger (new post) OR direct call

        // Validate inputs
        if (!record) {
            return new Response(JSON.stringify({ message: "No record provided" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

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

        // Fetch all subscriptions (In production, filter by followers!)
        // For now, we notify everyone (Demo/MVP) or specific user if targeted.
        // If triggered by new post, notify followers.

        // Fetch author details
        const { data: author } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', record.user_id)
            .single();

        const authorName = author?.username || "Someone";

        // Demo: Fetch ALL subscriptions (Warning: Broad)
        // Better: Fetch followers of record.user_id
        const { data: subscriptions, error: subError } = await supabase
            .from("push_subscriptions")
            .select("*");

        if (subError) throw subError;

        console.log(`Sending notifications to ${subscriptions?.length} devices...`);

        const payload = JSON.stringify({
            title: "New Post on SOOZ",
            body: `${authorName} just posted a new video!`,
            url: `/post/${record.id}`, // Deep link
        });

        const promises = subscriptions?.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                },
            };

            try {
                await webpush.sendNotification(pushSubscription, payload);
                // Update last_used?
            } catch (error: any) {
                if (error.statusCode === 410 || error.statusCode === 404) {
                    // Subscription expired/gone, delete it
                    console.log(`Deleting expired subscription ${sub.id}`);
                    await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                } else {
                    console.error(`Error sending to ${sub.id}:`, error);
                }
            }
        });

        await Promise.all(promises || []);

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
