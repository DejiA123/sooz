

# Unique Mobile UI Overhaul — Move Away from Instagram

## Problem
The current mobile UI closely resembles Instagram with its circular story avatars, standard post card layout, floating pill nav bar, and familiar icon set. The user wants a distinctive, premium feel.

## Design Direction
Shift toward a **Twitter/Threads meets Arc Browser** aesthetic — text-forward, editorial, with unique interaction patterns that don't mirror any single social app.

## Changes

### 1. Bottom Navigation — Segmented Pill Bar
Replace the current floating dock (which looks like every iOS social app) with a **segmented control** style nav:
- Remove text labels entirely — icons only, larger (24px)
- Replace the raised Create button with an inline glowing accent button (same height, no float)
- Use a **sliding highlight background** (animated pill that moves behind the active item) instead of a dot indicator
- Rounded rectangle shape with subtle inner shadow, no outer border
- Icons: Replace `House` with `Compass`, `Heart` with `Bell`, keep `MessageCircle`, `User`, `Sparkles`

### 2. Post Card — Editorial / Magazine Layout
Redesign to feel like a **news/editorial card** rather than an Instagram post:
- Remove floating avatar/username badge overlay on media — move user info **below** media in a clean row
- Add a subtle **left accent bar** (2px primary-colored vertical line) on the content section
- Caption gets more prominence: larger text (15px), max 3 lines
- Action bar: Replace individual pill buttons with **icon-only row** with counts underneath (vertical stacking like Twitter), no background pills
- Remove the rounded-[20px] card wrapper — use **flat cards with subtle dividers** between posts instead of floating cards with shadows
- Double-tap to like animation stays

### 3. Stories Rail — Rectangular Thumbnails
Replace circular Instagram-style avatars with **small rectangular preview cards** (like Snapchat/BeReal):
- 56x80px rounded-xl thumbnails showing actual story content preview
- Username below in small caps
- "Your Story" becomes a "+" card with dashed border
- Gradient ring replaced with a subtle bottom-edge glow for unseen stories

### 4. Feed Container
- Remove `space-y-6` gaps between cards — use thin `border-b border-border/30` dividers instead
- Full-bleed media (no horizontal margins on mobile)
- Tighter vertical rhythm

### 5. TopBar Refinement
- Slightly reduce height
- Make the "Discover" button more subtle (ghost style, no border/bg)

## Technical Details

**Files to modify:**
- `src/components/layout/BottomNav.tsx` — Segmented pill with sliding highlight
- `src/components/feed/PostCard.tsx` — Editorial flat card layout
- `src/components/feed/StoriesBar.tsx` — Rectangular story thumbnails
- `src/components/feed/StoryRail.tsx` — Match rectangular thumbnail style
- `src/components/feed/Feed.tsx` — Remove card spacing, add dividers
- `src/components/layout/TopBar.tsx` — Subtle Discover button

**BottomNav sliding highlight approach:**
```tsx
// Track active index, animate a background pill with layoutId
<motion.div layoutId="nav-highlight" className="absolute inset-y-1 rounded-xl bg-primary/10" />
```

**PostCard structure change:**
```
┌────────────────────────┐
│ [Full-bleed media]     │
│                        │
├────────────────────────┤
│ ▌ @username · 2h       │  ← left accent bar
│ ▌ Caption text here... │
│                         │
│  ♡ 12   💬 3   ↗   ⋯  │  ← icon row, no pills
└────────────────────────┘
--- thin divider ---
```

**StoriesBar rectangular cards:**
```
[ + ] [thumb] [thumb] [thumb] [thumb]
 Add   Grace   David   Faith   Josh
```
Each thumb is a 56x80 rounded-xl with object-cover image.

