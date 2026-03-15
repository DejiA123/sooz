

# Story Rail Redesign — Premium Horizontal Avatar Rail

## Current State
The StoryRail is a plain text-only ticker strip — functional but visually flat and boring. No avatars, no visual richness.

## New Design: **Glassmorphic Avatar Rail**
Bring back avatar circles but in a completely unique, premium way — not Instagram's plain circles.

### Design Details

**Layout**: Horizontal scrollable rail with frosted glass background, no visible scrollbar
- Glassmorphic container with `backdrop-blur-xl` and subtle border
- Smooth horizontal scroll with momentum

**"Your Story" button (first item)**:
- Dashed border circle with gradient, pulsing `+` icon
- If user has a story: show their avatar with a gradient ring + small "+" badge

**Story user avatars**:
- Each avatar is `w-16 h-16` with a **double-ring gradient border** (animated rotating gradient for unseen stories)
- Below: username truncated, 10px font, single line
- Avatars with stories get a **glowing ring** animation (rotating conic gradient)
- Avatars without stories (followed users) get a subtle dotted ring

**Animations**:
- Staggered fade-in on mount using framer-motion
- Active/tapped state: scale down to 0.9
- Ring gradient rotates continuously via CSS `@keyframes ring-rotate`

**Files to modify**:
1. `src/components/feed/StoryRail.tsx` — Complete redesign with avatar circles, horizontal scroll, glassmorphic container
2. `src/index.css` — Add `@keyframes ring-rotate` for the animated gradient ring

