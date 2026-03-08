

## Enhance Discover Page with Video Archive and Download Feature

### What We're Building

1. **Add Video Archive content to the Discover page** -- mix video archive videos alongside user posts for a richer discovery experience
2. **Add a Download button** so users can save videos to their phone

### Current State

- The Discover page only shows user-created posts (from the `posts` table)
- You have 1,904 videos in `video_archive` (20 synced to R2 with direct video files)
- The Video Archive page (`/archive`) exists separately but isn't integrated into Discover

---

### Changes

#### 1. Discover Page -- Add Video Archive Section

Add a "Videos" section to the Discover page that shows video archive thumbnails in a horizontal scrollable rail at the top (above user posts), plus a mixed grid below. Tapping a video opens the `VideoPlayerModal`.

- Import `fetchVideos`, `VideoItem`, and `VideoPlayerModal` into `src/pages/Discover.tsx`
- Fetch video archive data alongside posts
- Show a horizontal "Videos" rail near the top with thumbnails
- Tapping opens the video player modal

#### 2. Download Button in VideoPlayerModal

Add a download button to `src/components/videoArchive/VideoPlayerModal.tsx`:

- For **R2-synced videos** (`r2_video_url` exists): Use a direct download link (`<a href="..." download>`)
- For **non-synced videos**: Link to YouTube (since we can't force-download YouTube embeds from the browser)
- Show a Download icon button in the modal's video info section

#### 3. Download Button on VideoCard

Add a small download icon on each `VideoCard` so users can download directly from the grid without opening the modal.

---

### Technical Details

**Files to modify:**

1. **`src/pages/Discover.tsx`**
   - Add state for `archiveVideos` and `selectedVideo`
   - Fetch from `fetchVideos()` in `fetchData()`
   - Render a horizontal scrollable rail of video thumbnails above the posts grid
   - Render `VideoPlayerModal` when a video is selected

2. **`src/components/videoArchive/VideoPlayerModal.tsx`**
   - Add a `Download` lucide icon button next to the "Watch on YouTube" link
   - For R2 videos: `<a href={video.r2_video_url} download>` triggers native download
   - For YouTube-only videos: open YouTube link (with a tooltip explaining it's YouTube-only)

3. **`src/components/videoArchive/VideoCard.tsx`**
   - Add an optional `onDownload` callback prop
   - Show a small download icon overlay on hover/tap

**No database changes needed** -- all data already exists in `video_archive`.

