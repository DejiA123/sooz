

# Fix Build Errors and Improve Video Archive Sync

## Problem
There are 5 build errors preventing the app from running, plus the sync edge function only fetches the 10 most recent videos. The user wants all new videos to be synced.

## Plan

### 1. Fix build errors (4 files)

**`supabase/functions/get-r2-upload-url/index.ts`** (line 83):
- The `hmacSha256` function accepts `ArrayBuffer | CryptoKey` but gets passed a `Uint8Array`. Fix by changing the function signature to accept `ArrayBuffer | CryptoKey | Uint8Array`, or convert `Uint8Array` to `ArrayBuffer` using `.buffer`. Simplest fix: update `hmacSha256` to accept `BufferSource | CryptoKey` and handle accordingly.

**`src/components/chat/ChatWindow.tsx`**:
- Missing imports for `ScrollArea` and `Skeleton`, and missing `isLoading` state. Add imports for `ScrollArea` from `@/components/ui/scroll-area` and `Skeleton` from `@/components/ui/skeleton`. Add an `isLoading` state variable (defaulting to `false`, or wired to the existing message loading logic).

**`src/components/feed/StoryRail.tsx`** (lines 186-206):
- Framer Motion `Variants` type errors: `ease: [0.22, 1, 0.36, 1]` needs to be typed as a tuple, and `type: "spring"` needs `as const`. Fix by adding `as const` assertions to the variant objects.

**`src/components/live/LivePlayer.tsx`** (line 229):
- `handleWaiting` is referenced in the cleanup function but is defined inside a scope that the cleanup can't access. Move the `handleWaiting` declaration or its reference so it's accessible in the cleanup block (likely hoist it or store in a ref).

### 2. Enhance sync edge function to fetch ALL videos

**`supabase/functions/sync-youtube-archive/index.ts`**:
- Change from fetching only 10 videos to paginating through ALL uploads using `nextPageToken`. Increase `maxResults` to 50 per page and loop until no more pages remain.
- This ensures every new video on the channel gets synced to the database.

### Technical Details

**Edge function pagination change:**
```
// Current: maxResults=10, single page
// New: maxResults=50, loop with nextPageToken until exhausted
let nextPageToken = '';
do {
    const url = `...&maxResults=50${nextPageToken ? '&pageToken=' + nextPageToken : ''}&key=...`;
    // fetch and accumulate items
    nextPageToken = data.nextPageToken || '';
} while (nextPageToken);
```

**Framer Motion fix (StoryRail):**
Add `as const` to variant objects to narrow string literals to their exact types.

**ChatWindow fix:**
Add missing imports at the top of the file:
```typescript
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
```
Add `isLoading` state for messages loading.

**LivePlayer fix:**
Hoist `handleWaiting` variable declaration before the MSE block so it's accessible in cleanup.

**hmacSha256 fix:**
Change parameter type from `ArrayBuffer | CryptoKey` to `BufferSource | CryptoKey` so `Uint8Array` is accepted.

