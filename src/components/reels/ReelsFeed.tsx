import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { FeedItem } from "@/services/api/feed";
import { PostReel } from "./PostReel";
import { TikTokReel } from "./TikTokReel";
import { Spinner } from "./gestures";

interface ReelsFeedProps {
  items: FeedItem[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  endSlide?: ReactNode;
}

/** How many slides either side keep their content rendered (the rest are empty, cheap shells). */
const RENDER_WINDOW = 2;

/**
 * Full-screen vertical pager: one post per screen, swipe to move, with only the slides
 * next to the current one holding real media so memory stays low and scrolling stays smooth.
 */
export const ReelsFeed = ({ items, hasMore, loadingMore, loadMore, initialIndex = 0, onIndexChange, endSlide }: ReelsFeedProps) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(initialIndex);
  const activeRef = useRef(initialIndex);
  const direction = useRef(1); // which way the viewer is moving (for skipping unplayable videos)
  const [pageVisible, setPageVisible] = useState(() => typeof document === "undefined" || !document.hidden);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el && initialIndex > 0) el.scrollTop = initialIndex * el.clientHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveIndex = useCallback((i: number) => {
    if (i === activeRef.current) return;
    direction.current = i > activeRef.current ? 1 : -1;
    activeRef.current = i;
    setActive(i);
    onIndexChange?.(i);
  }, [onIndexChange]);

  // Work out the current slide from the scroll position (one rAF per frame at most).
  const raf = useRef(0);
  const onScroll = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = scrollerRef.current;
      if (!el || !el.clientHeight) return;
      setActiveIndex(Math.round(el.scrollTop / el.clientHeight));
    });
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const total = items.length + (loadingMore || !hasMore ? 1 : 0);
  const go = useCallback((i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(i, total - 1));
    el.scrollTo({ top: target * el.clientHeight, behavior: "smooth" });
  }, [total]);

  // Keep the slide aligned when the screen size changes (rotation, desktop resize).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { el.scrollTop = activeRef.current * el.clientHeight; });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load the next page a few slides before the end.
  useEffect(() => {
    if (hasMore && !loadingMore && active >= items.length - 4) loadMore();
  }, [active, items.length, hasMore, loadingMore, loadMore]);

  // Keyboard: ↑/↓, j/k, PageUp/PageDown.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector("[role=dialog]")) return;
      if (["ArrowDown", "PageDown", "j"].includes(e.key)) { e.preventDefault(); go(activeRef.current + 1); }
      if (["ArrowUp", "PageUp", "k"].includes(e.key)) { e.preventDefault(); go(activeRef.current - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Re-tapping Home jumps back to the top; "Next" on a TikTok slide moves on.
  useEffect(() => {
    const toTop = () => go(0);
    const next = () => go(activeRef.current + 1);
    // A TikTok that can't play here: carry on in the direction they were going.
    const skip = () => go(activeRef.current + (activeRef.current === 0 ? 1 : direction.current));
    window.addEventListener("sooz:feed-top", toTop);
    window.addEventListener("sooz:feed-next", next);
    window.addEventListener("sooz:feed-skip", skip);
    return () => {
      window.removeEventListener("sooz:feed-top", toTop);
      window.removeEventListener("sooz:feed-next", next);
      window.removeEventListener("sooz:feed-skip", skip);
    };
  }, [go]);

  // Pause everything while the app is in the background.
  useEffect(() => {
    const onVis = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div className="relative h-full w-full">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="reels-scroller hide-scrollbar h-full w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
        aria-label="Feed"
      >
        {items.map((item, i) => {
          const distance = Math.abs(i - active);
          const isActive = i === active && pageVisible;
          return (
            <section key={item.key} className="reel-slide" data-kind={item.kind} aria-roledescription="slide" aria-label={`${i + 1} of ${items.length}`}>
              {distance <= RENDER_WINDOW &&
                (item.kind === "post" ? (
                  <PostReel post={item.post} active={isActive} mounted={distance <= 1} />
                ) : (
                  <TikTokReel video={item.video} active={isActive} near={distance <= 1} />
                ))}
            </section>
          );
        })}
        {loadingMore && (
          <section className="reel-slide flex items-center justify-center"><Spinner /></section>
        )}
        {!hasMore && !loadingMore && items.length > 0 && <section className="reel-slide">{endSlide}</section>}
      </div>

      {/* Desktop: up/down buttons, like TikTok on the web */}
      <div className="pointer-events-none absolute right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 md:flex">
        <button type="button" aria-label="Previous" onClick={() => go(active - 1)} disabled={active === 0} className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-30">
          <ChevronUp className="h-6 w-6" />
        </button>
        <button type="button" aria-label="Next" onClick={() => go(active + 1)} disabled={active >= total - 1} className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-30">
          <ChevronDown className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};
