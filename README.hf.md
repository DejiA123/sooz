---
title: Video Sync Runner
emoji: 🎬
colorFrom: blue
colorTo: gray
sdk: docker
pinned: false
---

# Video Sync Runner

This is an automated background runner that syncs YouTube videos to Cloudflare R2 and updates the Supabase archive.

## Configuration
When setting up a new Space, ensure the following **Secrets** are configured in the Settings:

- `VITE_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_R2_ENDPOINT`
- `VITE_R2_ACCESS_KEY_ID`
- `VITE_R2_SECRET_ACCESS_KEY`
- `YOUTUBE_PO_TOKEN` (Use manual extraction or `youtube-po-token-generator`)
- `YOUTUBE_VISITOR_DATA`
- `SYNC_POLLING_INTERVAL_MS` (e.g., `3600000` for 1 hour)
