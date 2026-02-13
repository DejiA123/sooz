

## Mirror Front Camera Preview

**What**: When using the front (selfie) camera in the Create modal's Camera view, the video preview should be mirrored horizontally — matching how users expect to see themselves (like a mirror). The back camera remains unmirrored.

**Technical Details**

The fix is in `src/components/create/CameraCapture.tsx`:

1. Apply a CSS `scaleX(-1)` transform to the `<video>` element when `facingMode` is `"user"` (front camera).

2. For **photo capture**, flip the canvas horizontally before drawing the image so the saved photo matches the mirrored preview.

3. **Video recording** does not need changes — MediaRecorder captures the raw stream (unmirrored), which is standard behavior for selfie videos.

**Changes**:
- **Video element** (line ~148): Add conditional class `scale-x-[-1]` when `facingMode === "user"`
- **capturePhoto function**: When `facingMode === "user"`, apply `ctx.translate(canvas.width, 0)` and `ctx.scale(-1, 1)` before drawing, so the captured photo matches the mirrored preview

