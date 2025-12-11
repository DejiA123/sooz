import { cn } from "@/lib/utils"
import { CSSProperties } from "react"

interface SkeletonProps {
  className?: string
  count?: number
  style?: CSSProperties
  "data-sidebar"?: string
}

function Skeleton({ className, count = 1, style, ...props }: SkeletonProps) {
  if (count > 1) {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn("animate-pulse rounded-md bg-muted", className)}
            style={style}
            {...props}
          />
        ))}
      </>
    )
  }

  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      style={style}
      {...props}
    />
  )
}

export { Skeleton }