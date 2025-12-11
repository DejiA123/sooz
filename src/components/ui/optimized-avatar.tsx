import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { OptimizedImage } from "./optimized-image";
import { cn } from "@/lib/utils";

interface OptimizedAvatarProps {
  src?: string;
  alt?: string;
  fallback: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  loading?: "lazy" | "eager";
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16"
};

export const OptimizedAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  OptimizedAvatarProps
>(({ src, alt = "", fallback, className, size = "md", loading = "lazy", ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex shrink-0 overflow-hidden rounded-full",
      sizeClasses[size],
      className
    )}
    {...props}
  >
    {src ? (
      <OptimizedImage
        src={src}
        alt={alt}
        className="aspect-square h-full w-full"
        loading={loading}
      />
    ) : (
      <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center rounded-full bg-muted">
        {fallback}
      </AvatarPrimitive.Fallback>
    )}
  </AvatarPrimitive.Root>
));
OptimizedAvatar.displayName = "OptimizedAvatar";