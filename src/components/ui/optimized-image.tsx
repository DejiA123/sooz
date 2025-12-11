import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { optimizeImageUrl, generateBlurDataUrl } from "@/utils/imageOptimization";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  sizes?: string;
  onError?: () => void;
  onLoad?: () => void;
}

export const OptimizedImage = ({
  src,
  alt,
  className,
  width,
  height,
  loading = "lazy",
  sizes,
  onError,
  onLoad
}: OptimizedImageProps) => {
  const [imageSrc, setImageSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [blurDataUrl] = useState(() => generateBlurDataUrl(width, height));

  useEffect(() => {
    setImageSrc(src);
    setIsLoading(true);
    setHasError(false);
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
    // Fallback to placeholder image
    setImageSrc("/placeholder-optimized.svg");
    onError?.();
  };

  // Optimize image URL for different sizes (if using a service like Cloudinary)
  const getOptimizedSrc = (originalSrc: string, width?: number) => {
    return optimizeImageUrl(originalSrc, { width, quality: 80, format: 'auto' });
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      <img
        src={getOptimizedSrc(imageSrc, width)}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        sizes={sizes}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          hasError ? "filter grayscale" : "",
          className
        )}
      />
      
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-xs text-muted-foreground">Image failed to load</span>
        </div>
      )}
    </div>
  );
};