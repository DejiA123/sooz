import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useDarkCover } from "@/lib/statusBar";
import { ChevronLeft } from "lucide-react";
import type { FeedItem } from "@/services/api/feed";
import { ReelsFeed } from "./ReelsFeed";
import { SoundToggle } from "./FeedChrome";

const noop = () => {};

/**
 * The home feed's full-screen player for a fixed list (e.g. a profile's Posts / Reposts grid):
 * opens on the tapped video and swipes up / down through the rest, exactly like Home.
 */
export const ReelsViewer = ({ items, startIndex, title, onClose }: {
  items: FeedItem[];
  startIndex: number;
  title?: string;
  onClose: () => void;
}) => {
  useDarkCover(); // videos are full-screen black: the status bar goes black too
  useEffect(() => {
    document.body.classList.add("reels-viewer-open");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector("[role=dialog]")) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("reels-viewer-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="reels-viewer fixed inset-0 z-[60] h-[100dvh] overflow-hidden bg-black text-white" role="region" aria-label={title || "Videos"}>
      <ReelsFeed
        items={items}
        hasMore={false}
        loadingMore={false}
        loadMore={noop}
        initialIndex={Math.max(0, Math.min(startIndex, items.length - 1))}
        endSlide={
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <p className="font-display text-xl font-bold">That's everything here</p>
            <button type="button" onClick={onClose} className="mt-6 rounded-full bg-white/10 px-8 py-3 font-semibold active:bg-white/20">Back</button>
          </div>
        }
      />
      <div className="reels-viewer-top">
        {title && <span className="max-w-[55%] truncate text-[16px] font-bold">{title}</span>}
      </div>
      <button type="button" aria-label="Back" onClick={onClose} className="reels-viewer-back flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-md active:scale-95">
        <ChevronLeft className="h-7 w-7" strokeWidth={2.2} />
      </button>
      <SoundToggle />
    </div>,
    document.body,
  );
};
