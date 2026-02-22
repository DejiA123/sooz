/**
 * Extract a thumbnail from a video file using HTML5 Canvas
 * This avoids heavy FFmpeg WASM dependencies and SharedArrayBuffer requirements
 * @param videoFile - The video file to extract thumbnail from
 * @param timeInSeconds - Time position to extract frame (default: 1 second)
 * @returns Blob of the extracted thumbnail as JPEG
 */
export async function extractVideoThumbnail(
    videoFile: File,
    timeInSeconds: number = 1
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = URL.createObjectURL(videoFile);
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous'; // Good practice

        const cleanup = () => {
            URL.revokeObjectURL(video.src);
            video.remove();
        };

        video.onloadedmetadata = () => {
            // Seek to the desired timestamp
            // Ensure we don't seek past the end
            if (timeInSeconds > video.duration) {
                video.currentTime = 0;
            } else {
                video.currentTime = timeInSeconds;
            }
        };

        video.onseeked = () => {
            try {
                const maxDimension = 600;
                let width = video.videoWidth;
                let height = video.videoHeight;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    cleanup();
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                ctx.drawImage(video, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        cleanup();
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Canvas to Blob failed'));
                        }
                    },
                    'image/jpeg',
                    0.6 // Quality optimized for smaller size
                );
            } catch (error) {
                cleanup();
                reject(error);
            }
        };

        video.onerror = () => {
            cleanup();
            reject(new Error('Error loading video file'));
        };
    });
}
