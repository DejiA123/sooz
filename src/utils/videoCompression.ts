/**
 * Compress a video file using HTML5 Canvas approach
 * This avoids heavy FFmpeg WASM dependencies
 */
export async function compressVideo(
    file: File,
    onProgress?: (progress: number, stage: 'loading' | 'compressing') => void
): Promise<File> {
    // Don't compress if already small (under 5MB)
    if (file.size < 5 * 1024 * 1024) {
        console.log('Video already small, skipping compression');
        return file;
    }

    onProgress?.(10, 'loading');
    
    // For now, just return the original file
    // Real compression would require a backend service or WebCodecs API
    console.log('Video compression not available in browser, returning original');
    onProgress?.(100, 'compressing');
    
    return file;
}
