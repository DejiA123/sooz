import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isLoading = false;

/**
 * Load FFmpeg WASM (single-threaded version)
 */
async function loadFFmpeg(): Promise<FFmpeg> {
    if (ffmpeg && ffmpeg.loaded) {
        return ffmpeg;
    }

    if (isLoading) {
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
        // Use jsdelivr CDN with single-threaded core
        const coreURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.12.6/dist/esm/ffmpeg-core.js';
        const wasmURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.12.6/dist/esm/ffmpeg-core.wasm';

        console.log('Loading FFmpeg from jsdelivr...');

        await ffmpeg.load({
            coreURL,
            wasmURL,
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

        ff.on('progress', ({ progress }) => {
            const percent = Math.round(15 + progress * 80);
            onProgress?.(Math.min(percent, 95), 'compressing');
        });

        const inputName = 'input' + getExtension(file.name);
        const outputName = 'output.mp4';

        console.log('Writing input file...');
        await ff.writeFile(inputName, await fetchFile(file));

        console.log('Compressing video...');
        await ff.exec([
            '-i', inputName,
            '-vcodec', 'libx264',
            '-crf', '28',
            '-preset', 'ultrafast',
            '-vf', 'scale=720:-2',
            '-acodec', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            outputName
        ]);

        onProgress?.(95, 'compressing');
        console.log('Compression complete, reading output...');

        const data = await ff.readFile(outputName);

        await ff.deleteFile(inputName);
        await ff.deleteFile(outputName);

        onProgress?.(100, 'compressing');

        // Convert FileData to a proper format for Blob
        // ffmpeg readFile returns Uint8Array | string, we need to handle both
        let blobData: BlobPart;
        if (typeof data === 'string') {
            blobData = data;
        } else {
            // Create a new Uint8Array with its own ArrayBuffer to avoid SharedArrayBuffer issues
            blobData = new Uint8Array(data).buffer;
        }
        const compressedBlob = new Blob([blobData], { type: 'video/mp4' });
        const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '.mp4'), {
            type: 'video/mp4',
        });

        const savings = ((file.size - compressedFile.size) / file.size * 100).toFixed(1);
        console.log(`Compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB (${savings}% smaller)`);

        return compressedFile;
    } catch (error) {
        console.error('Video compression failed:', error);
        onProgress?.(100, 'compressing');
        return file;
    }
}

function getExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? `.${ext}` : '.mp4';
}
