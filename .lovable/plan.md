

# Replace Search with Messages in Bottom Nav

## Change
In `src/components/layout/BottomNav.tsx`, swap the Search/Discover icon for a Messages icon pointing to `/chat`.

**Details:**
- Replace `Search` import with `MessageCircle` from lucide-react
- Change the nav item from `{ icon: Search, path: "/discover" }` to `{ icon: MessageCircle, path: "/chat" }`
- Update `isActive` check and prefetch logic accordingly
- Both mobile and desktop bottom bars get this change

**Single file**: `src/components/layout/BottomNav.tsx`

