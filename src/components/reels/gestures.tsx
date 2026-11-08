import { useCallback, useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";

export const formatCount = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
};

type Point = { x: number; y: number };

/**
 * TikTok-style taps: one tap runs `onSingle` (after a short wait), two quick taps run `onDouble`.
 * `onFirstTap` runs immediately inside the tap itself — browsers only allow turning sound on there.
 * Return true from it to consume the tap (no single-tap action follows).
 */
export function useTapGesture({
  onSingle,
  onDouble,
  onFirstTap,
}: {
  onSingle: () => void;
  onDouble?: (p: Point) => void;
  onFirstTap?: () => boolean;
}) {
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consumed = useRef(false);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const now = Date.now();
      if (onDouble && now - last.current < 280) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        last.current = 0;
        onDouble(p);
        return;
      }
      last.current = now;
      consumed.current = onFirstTap?.() ?? false;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        if (!consumed.current) onSingle();
      }, onDouble ? 280 : 0);
    },
    [onSingle, onDouble, onFirstTap]
  );
}

/** Hearts that pop where the user double-tapped. */
export function useHeartBursts() {
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; r: number }[]>([]);
  const add = useCallback((p: Point) => {
    const id = Date.now() + Math.random();
    setBursts((b) => [...b.slice(-4), { id, x: p.x, y: p.y, r: Math.round(Math.random() * 30 - 15) }]);
    setTimeout(() => setBursts((b) => b.filter((h) => h.id !== id)), 900);
  }, []);
  const node = (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden>
      {bursts.map((h) => (
        <Heart
          key={h.id}
          className="heart-burst absolute h-24 w-24 fill-[#ff2d55] text-[#ff2d55] drop-shadow-[0_6px_18px_rgba(255,45,85,0.55)]"
          style={{ left: h.x - 48, top: h.y - 60, ["--r" as string]: `${h.r}deg` }}
        />
      ))}
    </div>
  );
  return { add, node };
}

export const Spinner = ({ className = "" }: { className?: string }) => (
  <div className={`h-9 w-9 animate-spin rounded-full border-[3px] border-white/20 border-t-white ${className}`} />
);
