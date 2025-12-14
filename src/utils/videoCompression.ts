import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isLoading = false;

/**
 * Load FFmpeg WASM (single-threaded version - no special headers needed)
 */
async function loadFFmpeg(): Promise<FFmpeg> {
    if (ffmpeg && ffmpeg.loaded) {
        return ffmpeg;
    }

    if (isLoading) {
        // Wait for existing load to complete
        while (isLoading) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (ffmpeg && ffmpeg.loaded) {
            return ffmpeg;
        }
    }

    isLoading = true;
    ffmpeg = new FFmpeg();

    try {
        // Use single-threaded core (doesn't require SharedArrayBuffer/COOP/COEP headers)
        const baseURL = 'https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/esm';

        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        console.log('FFmpeg loaded successfully');
    } catch (error) {
        console.error('Failed to load FFmpeg:', error);
        ffmpeg = null;
        throw error;
    } finally {
        isLoading = false;
    }

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
        onProgress?.(5, 'loading');
        console.log('Loading FFmpeg...');

        const ff = await loadFFmpeg();

        onProgress?.(15, 'compressing');
        console.log('FFmpeg loaded, starting compression...');

        // Set up progress handler
        ff.on('progress', ({ progress }) => {
            const percent = Math.round(15 + progress * 80);
            onProgress?.(Math.min(percent, 95), 'compressing');
        });

        const inputName = 'input' + getExtension(file.name);
        const outputName = 'output.mp4';

        // Write input file to ffmpeg virtual filesystem
        console.log('Writing input file...');
        await ff.writeFile(inputName, await fetchFile(file));

        // Compress video with simpler settings for compatibility
        console.log('Compressing video...');
        await ff.exec([
            '-i', inputName,
            '-vcodec', 'libx264',
            '-crf', '28',
            '-preset', 'ultrafast', // Faster compression
            '-vf', 'scale=720:-2',
            '-acodec', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            outputName
        ]);

        onProgress?.(95, 'compressing');
        console.log('Compression complete, reading output...');

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
        onProgress?.(100, 'compressing');
        return file;
    }
}

function getExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? `.${ext}` : '.mp4';
}
