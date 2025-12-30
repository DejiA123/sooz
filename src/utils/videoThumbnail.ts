import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

/**
 * Initialize FFmpeg instance (loads WebAssembly module)
 */
async function getFFmpeg(): Promise<FFmpeg> {
    if (ffmpeg) return ffmpeg;

    ffmpeg = new FFmpeg();

    // Load FFmpeg from CDN
    await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
    });

    return ffmpeg;
}

/**
 * Extract a thumbnail from a video file
 * @param videoFile - The video file to extract thumbnail from
 * @param timeInSeconds - Time position to extract frame (default: 1 second)
 * @returns Blob of the extracted thumbnail as JPEG
 */
export async function extractVideoThumbnail(
    videoFile: File,
    timeInSeconds: number = 1
): Promise<Blob> {
    const ffmpegInstance = await getFFmpeg();

    // Write video file to FFmpeg's virtual file system
    await ffmpegInstance.writeFile('input.mp4', await fetchFile(videoFile));

    // Extract frame at specified time
    await ffmpegInstance.exec([
        '-i', 'input.mp4',
        '-ss', timeInSeconds.toString(),
        '-vframes', '1',
        '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease',
        '-q:v', '2',
        'thumbnail.jpg'
    ]);

    // Read the output thumbnail
    const data = await ffmpegInstance.readFile('thumbnail.jpg');

    // Clean up
    await ffmpegInstance.deleteFile('input.mp4');
    await ffmpegInstance.deleteFile('thumbnail.jpg');

    // Convert Uint8Array to Blob - use Array.from to satisfy TypeScript
    return new Blob([new Uint8Array(Array.from(data as Uint8Array))], { type: 'image/jpeg' });
}
