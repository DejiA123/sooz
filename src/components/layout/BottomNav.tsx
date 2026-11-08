import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type SVGProps } from "react";
import { MessageCircle, PlusSquare, Search, CircleUserRound, type LucideIcon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { animate, motion, useMotionValue, useTransform, useVelocity } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// The create flow is heavy (camera, uploads, live studio) — only download it when opened.
const CreateModal = lazy(() => import("@/components/create/CreateModal").then((m) => ({ default: m.CreateModal })));

/** Outline house matching lucide's stroke style. */
const HomeOutline = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3.5 10.4a2 2 0 0 1 .7-1.5l6.5-5.6a2 2 0 0 1 2.6 0l6.5 5.6a2 2 0 0 1 .7 1.5V19a2 2 0 0 1-2 2h-3.5v-5.5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1V21H5.5a2 2 0 0 1-2-2z" />
  </svg>
);
/** Filled house with the door cut out, like the active Home tab in iOS apps. */
const HomeFilled = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M10.7 2.55a2 2 0 0 1 2.6 0l6.9 5.95c.5.43.8 1.06.8 1.72V19a2.5 2.5 0 0 1-2.5 2.5h-3.6v-6a1 1 0 0 0-1-1H10.1a1 1 0 0 0-1 1v6H5.5A2.5 2.5 0 0 1 3 19v-8.78c0-.66.29-1.29.8-1.72z" />
  </svg>
);

type Tab = {
  key: string;
  label: string;
  path?: string;
  icon: LucideIcon | ((p: SVGProps<SVGSVGElement>) => JSX.Element);
  activeIcon?: (p: SVGProps<SVGSVGElement>) => JSX.Element;
  fillWhenActive?: boolean;
  match?: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  { key: "home", label: "Home", path: "/", icon: HomeOutline, activeIcon: HomeFilled, match: (p) => p === "/" || p === "/index" },
  { key: "discover", label: "Discover", path: "/discover", icon: Search, match: (p) => p.startsWith("/discover") || p.startsWith("/archive") },
  { key: "create", label: "Create", icon: PlusSquare },
  { key: "inbox", label: "Inbox", path: "/chat", icon: MessageCircle, fillWhenActive: true, match: (p) => p.startsWith("/chat") },
  { key: "you", label: "You", path: "/profile/me", icon: CircleUserRound, match: (p) => p.startsWith("/profile/me") || p.startsWith("/settings") },
];

const LENS_INSET = 4; // gap between the glass lens and the edge of its tab
const SPRING = { type: "spring" as const, stiffness: 520, damping: 40, mass: 0.7 };

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const isFeed = location.pathname === "/" || location.pathname === "/index";

  const { data: me } = useQuery({
    queryKey: ["nav-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("avatar_url, username").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });

  // Own profile counts as "You" whether reached via /profile/me or /profile/<my username>.
  const activeIndex = TABS.findIndex((t) =>
    t.match?.(location.pathname) || (t.key === "you" && !!me?.username && location.pathname === `/profile/${me.username}`)
  );

  // ── Glass lens geometry ────────────────────────────────────────────
  const rowRef = useRef<HTMLDivElement>(null);
  const [colWidth, setColWidth] = useState(0);
  const x = useMotionValue(0);
  const velocity = useVelocity(x);
  // Stretch the lens a little while it moves, like liquid glass.
  const scaleX = useTransform(velocity, [-2400, 0, 2400], [1.22, 1, 1.22], { clamp: true });
  const [dragging, setDragging] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragRef = useRef<{ id: number; startX: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => setColWidth(row.clientWidth / TABS.length);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, []);

  const targetX = useCallback((i: number) => i * colWidth + LENS_INSET, [colWidth]);

  // Jump into place on first measure, glide on every change after that.
  const placed = useRef(false);
  useEffect(() => {
    if (!colWidth || activeIndex < 0 || dragging) return;
    if (!placed.current) { x.set(targetX(activeIndex)); placed.current = true; return; }
    const controls = animate(x, targetX(activeIndex), SPRING);
    return () => controls.stop();
  }, [activeIndex, colWidth, dragging, targetX, x]);

  const openCreate = useCallback(() => {
    if (!user) { navigate("/auth"); return; }
    setShowCreate((v) => !v);
  }, [user, navigate]);

  const select = (i: number) => {
    const tab = TABS[i];
    if (tab.key === "create") {
      openCreate();
      if (activeIndex >= 0) animate(x, targetX(activeIndex), SPRING);
      return;
    }
    if (i === activeIndex) animate(x, targetX(i), SPRING);
    if (tab.path) navigate(tab.path);
  };

  const indexAt = (clientX: number) => {
    const rect = rowRef.current!.getBoundingClientRect();
    const local = Math.min(Math.max(clientX - rect.left - colWidth / 2, 0), colWidth * (TABS.length - 1));
    return { local, index: Math.round(local / colWidth) };
  };

  // Press and slide across the bar to move the lens, release to pick a tab.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = { id: e.pointerId, startX: e.clientX, active: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId || !colWidth) return;
    if (!d.active) {
      if (Math.abs(e.clientX - d.startX) < 8) return;
      d.active = true;
      setDragging(true);
      rowRef.current?.setPointerCapture(e.pointerId);
    }
    const { local, index } = indexAt(e.clientX);
    x.set(local + LENS_INSET);
    setHoverIndex(index);
  };
  const endDrag = (e: React.PointerEvent, commit: boolean) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d?.active) return;
    setDragging(false);
    setHoverIndex(null);
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    if (commit) select(indexAt(e.clientX).index);
    else if (activeIndex >= 0) animate(x, targetX(activeIndex), SPRING);
  };

  const highlighted = dragging && hoverIndex !== null ? hoverIndex : activeIndex;
  const showLens = colWidth > 0 && (activeIndex >= 0 || dragging);

  return (
    <>
      <nav aria-label="Main navigation" className="mobile-bottom-nav md:hidden" data-immersive={isFeed ? "true" : undefined}>
        <div
          ref={rowRef}
          className="glass-tabbar"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, true)}
          onPointerCancel={(e) => endDrag(e, false)}
          onClickCapture={(e) => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); } }}
        >
          {showLens && (
            <motion.span
              aria-hidden
              className={cn("glass-tabbar__lens", dragging && "glass-tabbar__lens--lifted")}
              style={{ x, scaleX, width: Math.max(colWidth - LENS_INSET * 2, 0) }}
              animate={{ scale: dragging ? 1.14 : 1, opacity: 1 }}
              initial={false}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
            />
          )}

          {TABS.map((tab, i) => {
            const active = i === highlighted;
            const isCreate = tab.key === "create";
            const isYou = tab.key === "you";
            const Icon = (active && tab.activeIcon) || tab.icon;
            const icon = isYou && me?.avatar_url ? (
              <img
                src={me.avatar_url}
                alt=""
                draggable={false}
                className={cn("h-[26px] w-[26px] rounded-full object-cover ring-2 transition-[box-shadow]", active ? "ring-current" : "ring-transparent")}
                decoding="async"
              />
            ) : (
              <Icon
                className={cn("h-[25px] w-[25px] transition-transform duration-200", isCreate && showCreate && "rotate-45")}
                strokeWidth={active ? 2.3 : 1.9}
                fill={active && tab.fillWhenActive ? "currentColor" : "none"}
              />
            );
            const content = (
              <>
                <span className="relative flex h-[27px] items-center justify-center">{icon}</span>
                <span className="glass-tabbar__label">{tab.label}</span>
              </>
            );
            const cls = cn("glass-tabbar__tab", active && "glass-tabbar__tab--active");

            if (isCreate) {
              return (
                <button key={tab.key} type="button" onClick={openCreate} aria-label="Create post" aria-expanded={showCreate} className={cn(cls, showCreate && "glass-tabbar__tab--active")}>
                  {content}
                </button>
              );
            }
            return (
              <Link
                key={tab.key}
                to={tab.path!}
                draggable={false}
                aria-label={tab.label}
                aria-current={i === activeIndex ? "page" : undefined}
                className={cls}
                onClick={(e) => {
                  // Re-tapping Home scrolls the feed back to the top instead of doing nothing.
                  if (i === activeIndex && tab.key === "home") { e.preventDefault(); window.dispatchEvent(new CustomEvent("sooz:feed-top")); }
                }}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>

      {showCreate && (
        <Suspense fallback={null}>
          <CreateModal
            isOpen
            onClose={() => setShowCreate(false)}
            onPostCreated={() => {
              setShowCreate(false);
              queryClient.invalidateQueries();
              navigate("/");
            }}
          />
        </Suspense>
      )}
    </>
  );
};
