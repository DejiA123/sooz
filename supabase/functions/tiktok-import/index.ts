// Imports Christian TikTok videos into the SOOZ feed.
//
// TikTok has no public API that lists videos by topic, so SOOZ curates links:
//   POST { action: "import", urls: string[], force?: boolean }   (signed-in users)
//   POST { action: "refresh", ids: string[] }                     (anyone; refreshes expiring thumbnails)
//
// Every link is verified against TikTok's official oEmbed endpoint, so the caption and creator
// we store and filter on are TikTok's own — a client cannot fake them. Then:
//   * explicit/NSFW content is rejected outright,
//   * anti-faith / occult signals always go to manual review,
//   * curators' links and trusted creators' links with faith signals are approved,
//   * everyone else's links with faith signals wait for a curator,
//   * links with no faith signal are refused (curators may override with force).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ── Faith filter ─────────────────────────────────────────────────────
const FAITH_WORDS = new Set([
  "jesus", "christ", "christian", "christians", "christianity", "god", "lord", "bible", "biblical",
  "scripture", "scriptures", "gospel", "worship", "worshipping", "praise", "prayer", "prayers", "pray",
  "praying", "prayed", "church", "faith", "sermon", "pastor", "ministry", "psalm", "psalms", "proverbs",
  "amen", "hallelujah", "halleluyah", "alleluia", "savior", "saviour", "salvation", "resurrection", "risen",
  "heaven", "grace", "blessed", "devotional", "devotion", "verse", "yahweh", "jehovah", "messiah",
  "emmanuel", "immanuel", "testimony", "apostle", "disciple", "discipleship", "revival", "zion", "holy",
  "crucified", "calvary", "baptism", "baptized", "communion", "evangelist", "evangelism", "prophet",
  "prophetic", "righteous", "righteousness", "repent", "repentance", "forgiven", "redeemed", "redemption",
  "deliverance", "anointing", "anointed", "intercession", "fellowship", "kingdom",
]);
const FAITH_PHRASES = [
  "holy spirit", "holy ghost", "born again", "word of god", "son of god", "lamb of god", "body of christ",
  "good news", "praise and worship", "bible verse", "bible study", "daily devotion", "the lord", "king of kings",
];
// Hashtags are matched on how they start or end (#jesuslovesyou, #ilovejesus, #prayerworks).
const FAITH_TAG_STEMS = [
  "jesus", "christian", "bible", "gospel", "worship", "scripture", "holyspirit", "sermon", "psalm", "faith",
  "pray", "church", "godis", "godsword", "godslove", "godsgrace", "godfirst", "hallelujah", "amen",
  "devotion", "testimony", "salvation", "yahweh", "pastor", "ministry", "revival", "prophetic", "christ", "praise",
];
const SCRIPTURE_REF = new RegExp(
  "\\b(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalms?|proverbs|ecclesiastes|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)\\s+\\d{1,3}(:\\d{1,3})?",
  "i",
);
const NSFW_TERMS = ["nsfw", "porn", "onlyfans", "nude", "nudes", "naked", "sexy", "thirsttrap", "thirst trap", "xxx", "twerk", "stripper", "hookup", "18+"];
const REVIEW_TERMS = [
  "atheist", "atheism", "exchristian", "ex-christian", "deconstruction", "deconstructing", "deconverted",
  "satanic", "satanism", "witchtok", "witchcraft", "tarot", "occult", "spellwork", "manifestation",
  "manifesting", "astrology", "horoscope", "zodiac", "paganism", "wicca", "wiccan", "luciferian",
  "religionisalie", "godisnotreal", "christianmemes", "religiousmemes",
];

function analyzeFaith(text: string) {
  const lower = ` ${text.toLowerCase()} `.replace(/oh my god|omg|my god!/g, " ");
  const tags = [...lower.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]);
  const words = lower.replace(/#[\p{L}\p{N}_]+/gu, " ").split(/[^\p{L}\p{N}'+-]+/u).filter(Boolean);

  const signals = new Set<string>();
  for (const w of words) {
    const bare = w.replace(/'s$/, "");
    if (FAITH_WORDS.has(bare)) signals.add(bare);
  }
  for (const p of FAITH_PHRASES) if (lower.includes(p)) signals.add(p);
  for (const tag of tags) {
    if (tag.startsWith("christmas")) continue; // often secular
    if (FAITH_TAG_STEMS.some((s) => tag.startsWith(s) || tag.endsWith(s))) signals.add(`#${tag}`);
  }
  const ref = lower.match(SCRIPTURE_REF);
  if (ref) signals.add(ref[0].trim());

  const hits = (terms: string[]) =>
    terms.filter((t) => (t.includes(" ") || t.includes("+") ? lower.includes(t) : words.includes(t) || tags.some((tag) => tag.includes(t))));

  return { signals: [...signals].slice(0, 12), nsfw: hits(NSFW_TERMS), review: hits(REVIEW_TERMS) };
}

// ── TikTok link handling ─────────────────────────────────────────────
function normalizeUrl(raw: string): URL | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!/(^|\.)tiktok\.com$/i.test(u.hostname)) return null;
    u.protocol = "https:";
    return u;
  } catch {
    return null;
  }
}

const videoIdFrom = (s: string) => s.match(/\/(?:video|v|embed(?:\/v2)?|player\/v1)\/(\d{8,25})/)?.[1] ?? null;

async function resolveShortLink(u: URL): Promise<URL> {
  let current = u;
  for (let hop = 0; hop < 4; hop++) {
    const isShort = /^(vm|vt)\.tiktok\.com$/i.test(current.hostname) || current.pathname.startsWith("/t/");
    if (!isShort) break;
    const res = await fetch(current.toString(), { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (compatible; SOOZ link check)" } });
    const loc = res.headers.get("location");
    await res.body?.cancel();
    if (!loc) break;
    current = new URL(loc, current);
  }
  current.search = "";
  return current;
}

type OEmbed = {
  title?: string;
  author_name?: string;
  author_url?: string;
  author_unique_id?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  embed_product_id?: string;
  html?: string;
};

async function fetchOEmbed(videoUrl: string): Promise<{ ok: true; data: OEmbed } | { ok: false; status: number }> {
  const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    await res.body?.cancel();
    return { ok: false, status: res.status };
  }
  try {
    const data = (await res.json()) as OEmbed & { status_msg?: string; code?: number };
    if (!data || (!data.html && !data.embed_product_id)) return { ok: false, status: 404 };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 502 };
  }
}

function metadataFrom(o: OEmbed, fallbackId: string | null) {
  const id = o.embed_product_id || o.html?.match(/data-video-id="(\d+)"/)?.[1] || fallbackId;
  const handle = (o.author_unique_id || o.author_url?.match(/tiktok\.com\/@([^/?#]+)/)?.[1] || "").toLowerCase() || null;
  return {
    tiktok_id: id,
    author_name: o.author_name ?? null,
    author_handle: handle,
    author_url: o.author_url ?? (handle ? `https://www.tiktok.com/@${handle}` : null),
    title: o.title ?? null,
    thumbnail_url: o.thumbnail_url ?? null,
    thumbnail_width: o.thumbnail_width ?? null,
    thumbnail_height: o.thumbnail_height ?? null,
  };
}

// ── Handler ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let body: { action?: string; urls?: unknown; ids?: unknown; force?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    if (body.action === "refresh") {
      const ids = (Array.isArray(body.ids) ? body.ids : []).filter((v): v is string => typeof v === "string").slice(0, 20);
      if (!ids.length) return json({ refreshed: 0 });
      const staleBefore = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: rows } = await admin
        .from("tiktok_videos")
        .select("id, url, tiktok_id")
        .in("id", ids)
        .eq("status", "approved")
        .lt("metadata_refreshed_at", staleBefore);

      let refreshed = 0;
      for (const row of rows || []) {
        const o = await fetchOEmbed(row.url);
        if (o.ok) {
          const meta = metadataFrom(o.data, row.tiktok_id);
          await admin.from("tiktok_videos").update({
            title: meta.title, author_name: meta.author_name, thumbnail_url: meta.thumbnail_url,
            thumbnail_width: meta.thumbnail_width, thumbnail_height: meta.thumbnail_height,
            metadata_refreshed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq("id", row.id);
          refreshed++;
        } else if (o.status === 400 || o.status === 404) {
          // Deleted or made private on TikTok — take it out of the feed.
          await admin.from("tiktok_videos").update({
            status: "rejected", review_note: "No longer available on TikTok",
            metadata_refreshed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq("id", row.id);
        }
      }
      return json({ refreshed });
    }

    if (body.action !== "import") return json({ error: "Unknown action" }, 400);

    // Importing needs a signed-in user.
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await admin.auth.getUser(token);
    const user = auth?.user;
    if (!user) return json({ error: "Please sign in to add TikTok videos." }, 401);

    const { data: curatorRow } = await admin.from("tiktok_curators").select("user_id").eq("user_id", user.id).maybeSingle();
    const isCurator = !!curatorRow;
    const force = isCurator && body.force === true;

    const rawUrls = (Array.isArray(body.urls) ? body.urls : []).filter((v): v is string => typeof v === "string");
    const limit = isCurator ? 25 : 10;
    const urls = [...new Set(rawUrls.map((u) => u.trim()).filter(Boolean))].slice(0, limit);
    if (!urls.length) return json({ error: "Paste at least one TikTok link." }, 400);

    if (!isCurator) {
      const { count } = await admin.from("tiktok_videos").select("id", { count: "exact", head: true })
        .eq("submitted_by", user.id).eq("status", "pending");
      if ((count ?? 0) >= 50) return json({ error: "You have 50 suggestions waiting for review. Please wait for a curator." }, 429);
    }

    const { data: trustedRows } = await admin.from("tiktok_trusted_creators").select("handle");
    const trusted = new Set((trustedRows || []).map((r) => r.handle));

    const results = [];
    for (const original of urls) {
      try {
        const parsed = normalizeUrl(original);
        if (!parsed) { results.push({ url: original, status: "error", message: "That is not a TikTok link." }); continue; }

        const resolved = await resolveShortLink(parsed);
        const idFromUrl = videoIdFrom(resolved.pathname);
        if (resolved.pathname.includes("/photo/")) {
          results.push({ url: original, status: "error", message: "Photo posts can't be embedded — please use a video link." });
          continue;
        }

        let o = await fetchOEmbed(resolved.toString());
        if (!o.ok && idFromUrl) o = await fetchOEmbed(`https://www.tiktok.com/@_/video/${idFromUrl}`);
        if (!o.ok) {
          results.push({ url: original, status: "error", message: o.status === 400 || o.status === 404 ? "TikTok says this video doesn't exist or is private." : "Couldn't reach TikTok — please try again." });
          continue;
        }

        const meta = metadataFrom(o.data, idFromUrl);
        if (!meta.tiktok_id) { results.push({ url: original, status: "error", message: "Couldn't read the video ID from TikTok." }); continue; }

        const { signals, nsfw, review } = analyzeFaith(`${meta.title || ""} ${meta.author_name || ""} ${meta.author_handle || ""}`);
        const base = { url: original, tiktok_id: meta.tiktok_id, title: meta.title, author: meta.author_handle || meta.author_name };

        const { data: existing } = await admin.from("tiktok_videos").select("id, status").eq("tiktok_id", meta.tiktok_id).maybeSingle();
        if (existing) {
          if (isCurator && existing.status !== "approved" && nsfw.length === 0 && (signals.length || force)) {
            await admin.from("tiktok_videos").update({ status: "approved", reviewed_by: user.id, updated_at: new Date().toISOString() }).eq("id", existing.id);
            results.push({ ...base, status: "approved", message: "Already suggested — now approved." });
          } else {
            results.push({ ...base, status: "duplicate", message: existing.status === "approved" ? "Already in the feed." : `Already added (${existing.status}).` });
          }
          continue;
        }

        let status: "approved" | "pending" | "rejected";
        let message: string;
        let note: string | null = null;

        if (nsfw.length) {
          status = "rejected"; note = `Blocked terms: ${nsfw.join(", ")}`;
          message = "Not allowed — this video contains explicit content signals.";
        } else if (!signals.length && !force) {
          if (isCurator) {
            results.push({ ...base, status: "needs_override", message: "No Christian words or hashtags found in the caption. Add it anyway?" });
          } else {
            results.push({ ...base, status: "rejected", message: "This doesn't look like Christian content (no faith words or hashtags in the caption)." });
          }
          continue;
        } else if (review.length && !force) {
          status = "pending"; note = `Check: ${review.join(", ")}`;
          message = "Sent for review — the caption mentions topics a curator should check.";
        } else if (isCurator || (meta.author_handle && trusted.has(meta.author_handle))) {
          status = "approved";
          message = "Added to the feed.";
        } else {
          status = "pending";
          message = "Thanks! A curator will review it before it appears.";
        }

        const { error } = await admin.from("tiktok_videos").insert({
          ...meta,
          url: `https://www.tiktok.com/@${meta.author_handle || "_"}/video/${meta.tiktok_id}`,
          faith_tags: signals,
          status,
          review_note: note,
          submitted_by: user.id,
          reviewed_by: status === "approved" && isCurator ? user.id : null,
        });
        if (error) throw error;
        results.push({ ...base, status, message });
      } catch (err) {
        console.error("tiktok import failed", original, err);
        results.push({ url: original, status: "error", message: "Something went wrong with this link." });
      }
    }

    return json({ results, isCurator });
  } catch (err) {
    console.error("tiktok-import error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
