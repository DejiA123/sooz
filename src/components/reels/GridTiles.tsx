import { useState } from "react";
import { Heart } from "lucide-react";
import { formatCount } from "./gestures";
import type { TikTokVideo } from "@/services/api/tiktok";
import { TikTokMark } from "./TikTokReel";

/** The daily link-preview card (800×420, the cover in the middle) — scaled so the cover fills the tile. */
const CARDS = "https://raw.githubusercontent.com/DejiA123/sooz/covers/tt";

/** A Christian TikTok in a grid: its cover (from SOOZ's preview cards), else its caption. */
export const TikTokTile = ({ video, showLikes = false }: { video: TikTokVideo; showLikes?: boolean }) => {
  const [noCover, setNoCover] = useState(false);
  const handle = video.author_handle || "";
  let hue = 32;
  for (const c of handle) hue = (hue * 31 + c.charCodeAt(0)) % 360;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(155deg, hsl(${hue} 42% 26%), hsl(${(hue + 40) % 360} 48% 9%))` }}>
      {!noCover && (
        <img
          src={`${CARDS}/${video.tiktok_id}.jpg`}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setNoCover(true)}
          className="absolute left-1/2 top-1/2 h-auto max-w-none -translate-x-1/2 -translate-y-1/2"
          style={{ width: "339%" }}
        />
      )}
      {noCover ? (
        <div className="absolute inset-0 flex flex-col p-3">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-white/75"><TikTokMark className="h-3.5 w-3.5" /> TikTok</span>
          <p className="mt-2 line-clamp-6 text-[13.5px] font-semibold leading-snug text-white">{video.title || "Christian TikTok"}</p>
          <span className="mt-auto flex items-center gap-2 pt-2 text-[12px] font-medium text-white/70">
            <span className="min-w-0 flex-1 truncate">{video.author_name || (handle ? `@${handle}` : "")}</span>
            {showLikes && !!video.likes && <span className="flex shrink-0 items-center gap-1 font-semibold text-white"><Heart className="h-3 w-3 fill-white" />{formatCount(video.likes)}</span>}
          </span>
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6">
          <span className="flex items-center gap-2 text-[12px] font-semibold text-white/90">
            <span className="min-w-0 flex-1 truncate">{video.author_name || (handle ? `@${handle}` : "")}</span>
            {showLikes && !!video.likes && <span className="flex shrink-0 items-center gap-1 text-white"><Heart className="h-3 w-3 fill-white" />{formatCount(video.likes)}</span>}
          </span>
        </div>
      )}
    </div>
  );
};

/** A SOOZ post with words only. */
export const TextTile = ({ text }: { text: string }) => (
  <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_90%_at_20%_0%,rgba(245,158,11,0.28),transparent_60%),linear-gradient(160deg,#1c1710,#0b0b0e)] p-4">
    <p className="line-clamp-6 text-center font-display text-[15px] font-semibold leading-snug text-white/95">{text || "…"}</p>
  </div>
);
