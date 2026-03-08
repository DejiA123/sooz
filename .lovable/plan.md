

# Total UI Redesign — Unique, Non-Instagram Identity

## Design Philosophy
Move from "social media clone" to a **"premium content magazine + messaging app" hybrid** inspired by Arc Browser, Linear, and Apple Music — not Instagram, TikTok, or Threads.

**Core principles:**
- Neomorphic depth with layered surfaces instead of flat cards
- Asymmetric layouts that break the feed monotony
- Typography-driven hierarchy (large bold headlines, not icon-driven)
- Warm, organic color accents instead of generic blue/purple
- Haptic-feeling micro-interactions

## Changes Overview

### 1. Bottom Navigation — Glass Morphic Tab Bar (BottomNav.tsx)
- **Kill the segmented pill** — replace with a **transparent glass bar** that sits flush at the bottom (no floating, no rounded corners on sides)
- Icons become **thicker, custom-styled** — use filled variants for active state with a subtle color shift
- Create button: Instead of a glowing box, make it a **rotating "+" that morphs into "x"** when modal opens — same size as other icons, no special elevation
- Active indicator: **Thin 2px line above the icon** (not below, not a highlight background) with spring animation
- Remove all labels — pure icon bar

### 2. Post Card — Newspaper Column Layout (PostCard.tsx)
- **Remove all card borders, shadows, and backgrounds** — posts are separated only by generous whitespace (32px gap)
- Media: Full-width with **rounded-2xl corners** and subtle shadow
- Below media: **Large username as a bold link** (16px, font-weight 800) on its own line — no avatar inline with username
- Avatar: **Small 20px circle** placed to the left of the timestamp, not next to username
- Caption: **Serif font** (use Playfair Display from existing imports) for editorial feel, 17px, relaxed line-height
- Actions: **Minimal text links** — "Like · Reply · Share" as small text, not icons. Show heart icon only when liked (filled red). No bookmark icon (move to dropdown).
- Remove the left accent bar
- Double-tap like animation stays

### 3. Stories Rail — Horizontal Card Carousel (StoryRail.tsx)
- Replace rectangles with **rounded-2xl cards that are 72x96px** with a **soft inner shadow**
- No ring indicator — instead, unseen stories have a **subtle animated shimmer border** (CSS gradient animation)
- Seen stories get **60% opacity** overlay
- "Add" card: Solid primary-tinted card with a centered "+" icon and no dashed border
- Remove uppercase text labels — use regular case, 11px

### 4. Feed Container (Index.tsx)
- Replace `space-y-4` with `space-y-8` for generous breathing room
- Add a **"Good morning, {name}"** greeting header above stories with current date
- Suggested users rail: Style as horizontal **name chips** (pill badges) instead of avatar cards

### 5. TopBar — Minimal Transparent Header (TopBar.tsx)
- Make fully transparent with no border — just floating elements
- Logo on left, single **hamburger/menu icon** on right
- Remove "Discover" link from header (it's accessible via nav or menu)
- Reduce height to 48px

### 6. Profile Page (Profile.tsx)
- Cover: Replace gradient with **solid muted background** and a **large centered avatar** (no cover image unless uploaded)
- Stats (followers/following): Display as **large stacked numbers** with small labels below, arranged horizontally
- Bio: Left-aligned with serif font
- Post grid: **2-column masonry** instead of 3-column square grid — taller cards with rounded corners and 4px gaps
- Tab bar: Replace underline tabs with **pill toggle buttons**

### 7. Activity Page (Activity.tsx)
- Remove grouped sections header styling
- Each activity item: **Horizontal card** with rounded-2xl, subtle bg-card, and more padding
- Type indicator: Replace small colored dot with a **text label** ("liked", "followed") in a colored pill

### 8. Settings Page (Settings.tsx)
- Group sections in **large rounded cards** with inner padding
- Theme selector: Show as **color dots in a row** instead of list items
- Toggle switches: Use proper Switch components instead of custom divs

### 9. Auth Page (Auth.tsx)
- Center the form tighter, reduce max-width to 380px
- Use **larger, pill-shaped input fields** (rounded-full, h-14)
- Submit button: **Full-width pill** with bold text
- Remove background decorative blobs — use clean white/dark bg

### 10. Global CSS & Theme (index.css, tailwind.config.ts)
- Add `font-serif` mapping to "Playfair Display" in tailwind config
- Add shimmer keyframe animation for story borders
- Increase base `--radius` to `1rem`

## Files to Modify (11 files)
1. `src/components/layout/BottomNav.tsx` — Glass tab bar with top-line indicator
2. `src/components/feed/PostCard.tsx` — Newspaper editorial layout
3. `src/components/feed/StoryRail.tsx` — Shimmer-bordered card carousel
4. `src/components/feed/StoriesBar.tsx` — Match new style
5. `src/pages/Index.tsx` — Greeting header, wider spacing
6. `src/components/layout/TopBar.tsx` — Transparent minimal header
7. `src/pages/Profile.tsx` — 2-col masonry, centered avatar, pill tabs
8. `src/pages/Activity.tsx` — Card-based activity items
9. `src/pages/Settings.tsx` — Grouped card sections
10. `src/pages/Auth.tsx` — Pill inputs, cleaner layout
11. `src/components/feed/PostCardSkeleton.tsx` — Match new card layout
12. `tailwind.config.ts` — Add font-serif
13. `src/index.css` — Add shimmer keyframe

## Technical Details

**PostCard new structure:**
```
[  rounded-2xl media image/video  ]

Username                        
⏺ 20px avatar · 2h ago

"Caption text in serif font that
 feels editorial and premium..."

Like · Reply · Share
```

**BottomNav indicator:**
```tsx
{isActive && (
  <motion.div
    layoutId="nav-line"
    className="absolute -top-0.5 left-3 right-3 h-[2px] rounded-full bg-foreground"
  />
)}
```

**Story shimmer CSS:**
```css
@keyframes shimmer-border {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
.story-unseen {
  background: linear-gradient(90deg, hsl(var(--primary)), hsl(var(--destructive)), hsl(var(--primary)));
  background-size: 200% 100%;
  animation: shimmer-border 2s linear infinite;
}
```

