

# Bottom Navigation — Instagram-Style Horizontal Bar

## Problem
Currently on mobile, nav is a **vertical floating pill on the right edge** + a separate floating create orb. The user wants a standard **horizontal bottom bar** like Instagram — full-width, pinned to the bottom.

## Design: Instagram-Inspired Bottom Nav

**Layout**: Full-width horizontal bar fixed to bottom, 5 equally-spaced icons:
`Home | Search/Discover | Create (+) | Activity | Profile`

Matching Instagram's exact pattern: Home, Search, Plus, Heart, Profile.

**Visual Details**:
- Clean solid background (not glassmorphic — Instagram uses opaque bg with a thin top border)
- `bg-background` with `border-t border-border/40` — subtle separator
- Safe area padding for notched phones
- Icons: 24px, thin stroke (1.5) when inactive, filled when active
- Active icon: `text-foreground` (black/white depending on theme) — no color highlights, just like Instagram
- Smooth `layoutId` animated indicator dot below active icon
- No labels — icons only, just like Instagram
- Create button: simple `+` icon in a rounded square or just the icon, matching Instagram's style

**Animations**:
- `framer-motion` layoutId for active indicator dot
- Subtle scale on tap (`whileTap={{ scale: 0.9 }}`)
- Smooth spring transitions

**Files to modify**:
1. **`src/components/layout/BottomNav.tsx`** — Replace vertical pill + floating orb with horizontal bottom bar (5 items: Home, Search, Create, Activity, Profile). Keep desktop bar as-is.
2. **`src/components/layout/MainLayout.tsx`** — Adjust bottom padding (`pb-16` instead of `pb-20`) to match new bar height.

