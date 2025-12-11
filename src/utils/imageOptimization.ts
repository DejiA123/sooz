interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'jpg' | 'png';
  crop?: 'fill' | 'fit' | 'scale' | 'thumb';
}

/**
 * Optimize image URLs for different CDN services
 */
export function optimizeImageUrl(url: string, options: ImageOptimizationOptions = {}): string {
  if (!url) return '/placeholder-optimized.svg';
  
  const { width, height, quality = 80, format = 'auto', crop = 'fill' } = options;
  
  try {
    const urlObj = new URL(url);
    
    // Cloudinary optimization
    if (urlObj.hostname.includes('cloudinary.com')) {
      const transformations = [];
      
      if (width) transformations.push(`w_${width}`);
      if (height) transformations.push(`h_${height}`);
      if (crop) transformations.push(`c_${crop}`);
      if (quality) transformations.push(`q_${quality}`);
      if (format === 'auto') transformations.push('f_auto');
      
      const transformationString = transformations.join(',');
      const parts = urlObj.pathname.split('/');
      const uploadIndex = parts.indexOf('upload');
      
      if (uploadIndex !== -1) {
        parts.splice(uploadIndex + 1, 0, transformationString);
        urlObj.pathname = parts.join('/');
      }
      
      return urlObj.toString();
    }
    
    // Imgix optimization
    if (urlObj.hostname.includes('imgix.net')) {
      if (width) urlObj.searchParams.set('w', width.toString());
      if (height) urlObj.searchParams.set('h', height.toString());
      if (quality) urlObj.searchParams.set('q', quality.toString());
      if (format === 'auto') urlObj.searchParams.set('auto', 'format');
      
      return urlObj.toString();
    }
    
    // AWS S3 with CloudFront optimization (custom implementation)
    if (urlObj.hostname.includes('cloudfront.net') || urlObj.hostname.includes('s3')) {
      if (width) urlObj.searchParams.set('w', width.toString());
      if (height) urlObj.searchParams.set('h', height.toString());
      if (quality) urlObj.searchParams.set('q', quality.toString());
      
      return urlObj.toString();
    }
    
    // Default: return original URL
    return url;
    
  } catch (error) {
    console.warn('Failed to optimize image URL:', error);
    return url;
  }
}

/**
 * Get responsive image sizes for different breakpoints
 */
export function getResponsiveImageSizes(breakpoint: 'sm' | 'md' | 'lg' | 'xl'): number {
  const sizes = {
    sm: 320,   // Mobile
    md: 480,   // Tablet
    lg: 768,   // Desktop
    xl: 1200   // Large desktop
  };
  
  return sizes[breakpoint];
}

/**
 * Preload critical images
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to preload image: ${src}`));
    img.src = src;
  });
}

/**
 * Batch preload multiple images
 */
export async function preloadImages(sources: string[]): Promise<void> {
  const promises = sources.map(src => preloadImage(src));
  await Promise.allSettled(promises);
}

/**
 * Generate blur data URL for placeholder
 */
export function generateBlurDataUrl(width: number = 64, height: number = 64): string {
  const w = Math.min(width, 64);
  const h = Math.min(height, 64);
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <rect x="10%" y="10%" width="80%" height="80%" fill="#e0e0e0" rx="4"/>
    </svg>
  `)}`;
}