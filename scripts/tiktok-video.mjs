/**
 * What TikTok's public video page says about one video: like / comment / share counts, the full caption,
 * the cover picture, the video's size and the accounts it tags.
 *
 * (The daily scripts used to read this from `tiktok.com/embed/v2/{id}`, but since Nov 2026 that page is an
 * empty shell that loads its data later, so it no longer has any of it.)
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @returns {Promise<{status: "ok"|"slow"|"gone"|"none", likes?: number, comments?: number, shares?: number, caption?: string, cover?: string, width?: number, height?: number, mentions?: string[]}>} */
export async function fetchVideoInfo(id, handle, userAgent, timeoutMs = 25000) {
  const url = `https://www.tiktok.com/@${handle || "_"}/video/${id}`;
  let res;
  try { res = await fetch(url, { headers: { "user-agent": userAgent, "accept-language": "en-US,en;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) }); }
  catch { return { status: "none" }; }
  if (res.status === 429) return { status: "slow" };
  if (res.status === 404) return { status: "gone" };
  if (!res.ok) return { status: "none" };
  const html = await res.text().catch(() => "");
  if (html.length < 400 && /ratelimit|too many/i.test(html)) return { status: "slow" };

  const raw = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (raw) {
    try {
      const scope = JSON.parse(raw).__DEFAULT_SCOPE__ ?? {};
      const detail = scope["webapp.reflow.video.detail"] ?? scope["webapp.video-detail"];
      const item = detail?.itemInfo?.itemStruct;
      if (item && String(item.id) === String(id)) {
        const stats = item.stats ?? {};
        const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
        return {
          status: "ok",
          likes: num(item.statsV2?.diggCount ?? stats.diggCount),
          comments: num(item.statsV2?.commentCount ?? stats.commentCount),
          shares: num(item.statsV2?.shareCount ?? stats.shareCount),
          caption: typeof item.desc === "string" ? item.desc : undefined,
          cover: item.video?.originCover || item.video?.cover || undefined,
          width: num(item.video?.width),
          height: num(item.video?.height),
          mentions: (item.textExtra ?? []).map((t) => t?.userUniqueId).filter((u) => typeof u === "string" && u),
        };
      }
      // TikTok answered about this video but has nothing to show (deleted, private, age-restricted…).
      if (detail && Number(detail.statusCode) > 0) return { status: "gone" };
    } catch { /* not the page we expected: try the plain search below */ }
  }
  const m = html.match(new RegExp(`"id":"${id}"[\\s\\S]{0,6000}?"diggCount":(\\d+)`));
  return m ? { status: "ok", likes: Number(m[1]) } : { status: "none" };
}

export { sleep };
