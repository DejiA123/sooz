import { useRef } from "react";

/**
 * Grid tiles: a tap opens, a long-press (or right-click) opens the options — like TikTok. The finger
 * lifting after a long-press isn't a tap, and moving the finger (scrolling) cancels the long-press.
 */
export function useTilePress(onTap: (index: number) => void, onLong: (index: number) => void, ms = 480) {
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);
  const longFired = useRef(false);
  const cancel = () => { if (press.current) { clearTimeout(press.current.timer); press.current = null; } };
  return (index: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      longFired.current = false;
      const timer = window.setTimeout(() => { press.current = null; longFired.current = true; navigator.vibrate?.(12); onLong(index); }, ms);
      press.current = { x: e.clientX, y: e.clientY, timer };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = press.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); if (!longFired.current) { cancel(); longFired.current = true; onLong(index); } },
    onClick: () => { if (longFired.current) { longFired.current = false; return; } onTap(index); },
  });
}
