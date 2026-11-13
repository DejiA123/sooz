// Sends phone notifications (web push). Every request must come from a signed-in member, and the
// server decides what may be sent — never the caller:
//   • a message: only to someone in that chat with the sender, only right after the sender really
//     posted there, titled with the sender's real name (and the group's real name), linking to the chat
//   • a call: only fixed wording with the caller's real name
//   • a new post: only for a post the caller has just made, to their followers
//   • likes, comments, replies, follows: only the caller's own, as the database recorded them (once each)
// People who blocked the sender (or were blocked) get nothing, links always stay inside SOOZ, and each
// member can only send so many a minute.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clip = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// How many notifications one member may send a minute (a group message is one per member, and a
// ringing call repeats). Kept in memory: enough to stop a flood from one account.
const PER_MINUTE = 240;
const sentBy = new Map<string, number[]>();
function allowed(userId: string): boolean {
    const now = Date.now();
    const recent = (sentBy.get(userId) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= PER_MINUTE) { sentBy.set(userId, recent); return false; }
    recent.push(now);
    sentBy.set(userId, recent);
    if (sentBy.size > 5000) sentBy.clear();
    return true;
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return reply(405, { message: "Method not allowed" });

    try {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

        // Who is asking? (the app sends the member's sign-in token with every request)
        const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
        const { data: auth } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
        const me = auth?.user?.id;
        if (!me) return reply(401, { message: "Sign in to send notifications" });
        if (!allowed(me)) return reply(429, { message: "Too many notifications, try again in a minute" });

        const { record, type, toUserId, body, url } = await req.json().catch(() => ({}));

        const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
        const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
        if (!vapidPublicKey || !vapidPrivateKey) return reply(200, { message: "Push notifications not configured" });

        const { data: profile } = await supabase.from("profiles").select("username, display_name").eq("id", me).maybeSingle();
        const myName = clip(profile?.display_name || profile?.username || "Someone", 60);

        let recipients: string[] = [];
        let payload: { title: string; body: string; url: string };

        if (type === "activity") {
            // Likes, comments, replies and follows: the database records them (triggers), and the
            // person who did it asks for their own recent ones to be sent. Each row is claimed once.
            const { data: rows, error: claimError } = await supabase.from("notifications")
                .update({ pushed_at: new Date().toISOString() })
                .eq("actor_id", me).is("pushed_at", null).in("type", ["like", "comment", "reply", "follow"])
                .gt("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
                .select("user_id, type, reference_id, content");
            if (claimError) throw claimError;
            const handle = clip(profile?.username, 60);
            const items = (rows ?? []).slice(0, 20).map((n) => {
                const said = clip(n.content, 120);
                switch (n.type) {
                    case "like": return { to: n.user_id, title: "SOOZ", body: `${myName} liked your post`, url: `/post/${n.reference_id}` };
                    case "comment": return { to: n.user_id, title: `${myName} commented`, body: said || "on your post", url: `/post/${n.reference_id}` };
                    case "reply": return { to: n.user_id, title: `${myName} replied to your comment`, body: said || "Tap to see it", url: "/activity" };
                    default: return { to: n.user_id, title: "SOOZ", body: `${myName} started following you`, url: handle ? `/profile/${handle}` : "/activity" };
                }
            });
            if (!items.length) return reply(200, { message: "Notification processed", subscriptionCount: 0, sent: 0 });
            const { data: subs, error: subsError } = await supabase.from("push_subscriptions").select("*").in("user_id", [...new Set(items.map((i) => i.to))]);
            if (subsError) throw subsError;
            webpush.setVapidDetails("mailto:admin@sooz.app", vapidPublicKey, vapidPrivateKey);
            let sent = 0;
            // deno-lint-ignore no-explicit-any
            await Promise.all(items.flatMap((item) => (subs ?? []).filter((s: any) => s.user_id === item.to).map(async (s: any) => {
                try {
                    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                        JSON.stringify({ title: item.title, body: item.body, url: item.url }), { TTL: 86400, urgency: "normal" });
                    sent++;
                // deno-lint-ignore no-explicit-any
                } catch (err: any) {
                    if (err?.statusCode === 404 || err?.statusCode === 410 || err?.statusCode === 403) {
                        await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
                    }
                }
            })));
            return reply(200, { message: "Notification processed", subscriptionCount: subs?.length ?? 0, sent });
        } else if (type === "chat_message") {
            if (typeof toUserId !== "string" || !UUID.test(toUserId) || toUserId === me) return reply(400, { message: "Missing chat parameters" });

            // Blocked either way: nothing is sent (and the sender isn't told).
            const { data: blocks } = await supabase.from("user_blocks").select("blocker_id")
                .or(`and(blocker_id.eq.${me},blocked_id.eq.${toUserId}),and(blocker_id.eq.${toUserId},blocked_id.eq.${me})`).limit(1);
            if (blocks?.length) return reply(200, { message: "Notification processed", subscriptionCount: 0, sent: 0 });

            const text = clip(body, 200);
            const call = text.match(/(video|voice) call$/i);
            if (call && /^Incoming |is adding you to a /.test(text)) {
                // A call: the wording is ours, with the caller's real name.
                const kind = call[1].toLowerCase();
                payload = {
                    title: myName,
                    body: text.startsWith("Incoming") ? `Incoming ${kind} call` : `${myName} is adding you to a ${kind} call`,
                    url: "/chat",
                };
            } else {
                // A message: both must be in that chat, and the sender must have just posted there.
                const chatId = (typeof url === "string" ? url : "").match(/^\/chat\?c=([0-9a-f-]{36})$/i)?.[1];
                if (!chatId || !UUID.test(chatId) || !text) return reply(400, { message: "Missing chat parameters" });
                const [{ data: members }, { data: recent }, { data: chat }] = await Promise.all([
                    supabase.from("conversation_participants").select("user_id").eq("conversation_id", chatId).in("user_id", [me, toUserId]),
                    supabase.from("messages").select("id").eq("conversation_id", chatId).eq("sender_id", me)
                        .gt("created_at", new Date(Date.now() - 3 * 60_000).toISOString()).limit(1),
                    supabase.from("conversations").select("type, name").eq("id", chatId).maybeSingle(),
                ]);
                if ((members ?? []).length < 2 || !recent?.length || !chat) return reply(403, { message: "Not allowed" });
                const group = chat.type !== "direct" ? clip(chat.name || "Group", 60) : "";
                payload = { title: group ? `${myName} · ${group}` : myName, body: text, url: `/chat?c=${chatId}` };
            }
            recipients = [toUserId];
        } else if (record) {
            // A new post: only its author, only just after posting; followers are told.
            const postId = String(record.id ?? "");
            if (!UUID.test(postId)) return reply(400, { message: "Invalid payload" });
            const { data: post } = await supabase.from("posts").select("id, user_id, created_at").eq("id", postId).maybeSingle();
            if (!post || post.user_id !== me || Date.now() - Date.parse(post.created_at) > 10 * 60_000) return reply(403, { message: "Not allowed" });
            const { data: followers, error: followerError } = await supabase.from("follows").select("follower_id").eq("following_id", me);
            if (followerError) throw followerError;
            recipients = (followers ?? []).map((f) => f.follower_id);
            payload = { title: "New Post on SOOZ", body: `${clip(profile?.username, 60) || myName} just posted something new!`, url: `/post/${postId}` };
        } else {
            return reply(400, { message: "Invalid payload" });
        }

        const { data: subs, error: subError } = recipients.length
            ? await supabase.from("push_subscriptions").select("*").in("user_id", recipients)
            : { data: [], error: null };
        if (subError) throw subError;
        const subscriptions = subs ?? [];

        webpush.setVapidDetails("mailto:admin@sooz.app", vapidPublicKey, vapidPrivateKey);
        const message = JSON.stringify(payload);
        let sent = 0;
        // deno-lint-ignore no-explicit-any
        await Promise.all(subscriptions.map(async (s: any) => {
            try {
                await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 86400, urgency: "high" });
                sent++;
            // deno-lint-ignore no-explicit-any
            } catch (err: any) {
                console.error("Push failed", err?.statusCode, err?.body);
                if (err?.statusCode === 404 || err?.statusCode === 410 || err?.statusCode === 403) {
                    await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
                }
            }
        }));

        return reply(200, { message: "Notification processed", subscriptionCount: subscriptions.length, sent });
    // deno-lint-ignore no-explicit-any
    } catch (error: any) {
        console.error("Push notification error:", error);
        return reply(500, { error: "Could not send the notification" });
    }
});
