import { cn } from "@/lib/utils"

interface SkeletonProps {
  className?: string
  count?: number
}

function Skeleton({ className, count = 1, ...props }: SkeletonProps) {
  if (count > 1) {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn("animate-pulse rounded-md bg-muted", className)}
            {...props}
          />
        ))}
      </>
    )
  }

  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }