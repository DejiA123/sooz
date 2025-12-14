import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

/**
 * Load FFmpeg WASM - only loads once
 */
async function loadFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
    if (ffmpeg && ffmpeg.loaded) {
        return ffmpeg;
    }

    ffmpeg = new FFmpeg();

    // Load ffmpeg core from CDN
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    return ffmpeg;
}

/**
 * Compress a video file
 * @param file - The video file to compress
 * @param onProgress - Progress callback (0-100)
 * @returns The compressed video as a File object
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

    try {
        onProgress?.(0, 'loading');
        const ff = await loadFFmpeg();

        onProgress?.(10, 'compressing');

        // Set up progress handler
        ff.on('progress', ({ progress }) => {
            // Progress is 0-1, convert to 10-90 range (leaving room for load/finish)
            const percent = Math.round(10 + progress * 80);
            onProgress?.(percent, 'compressing');
        });

        const inputName = 'input' + getExtension(file.name);
        const outputName = 'output.mp4';

        // Write input file to ffmpeg virtual filesystem
        await ff.writeFile(inputName, await fetchFile(file));

        // Compress video:
        // -i input: input file
        // -vcodec libx264: Use H.264 codec (widely compatible)
        // -crf 28: Quality (23 is default, higher = smaller file, 28-32 is good for web)
        // -preset fast: Encoding speed (faster = larger file, but quicker)
        // -vf scale=720:-2: Scale to 720p width, maintain aspect ratio
        // -acodec aac: Audio codec
        // -b:a 128k: Audio bitrate
        // -movflags +faststart: Optimize for web streaming
        await ff.exec([
            '-i', inputName,
            '-vcodec', 'libx264',
            '-crf', '28',
            '-preset', 'fast',
            '-vf', 'scale=720:-2',
            '-acodec', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            outputName
        ]);

        onProgress?.(95, 'compressing');

        // Read the output file
        const data = await ff.readFile(outputName);

        // Clean up
        await ff.deleteFile(inputName);
        await ff.deleteFile(outputName);

        onProgress?.(100, 'compressing');

        // Create new File object
        const compressedBlob = new Blob([data], { type: 'video/mp4' });
        const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '.mp4'), {
            type: 'video/mp4',
        });

        const savings = ((file.size - compressedFile.size) / file.size * 100).toFixed(1);
        console.log(`Compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB (${savings}% smaller)`);

        return compressedFile;
    } catch (error) {
        console.error('Video compression failed:', error);
        // Return original file if compression fails
        return file;
    }
}

function getExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? `.${ext}` : '.mp4';
}
