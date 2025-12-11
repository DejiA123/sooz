import { Skeleton } from "@/components/ui/skeleton"

const FeedSkeleton = () => {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-card rounded-lg border border-border/50 overflow-hidden">
          {/* Header */}
          <div className="p-4 flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-8" />
          </div>
          
          {/* Media */}
          <Skeleton className="w-full h-96" />
          
          {/* Actions */}
          <div className="p-4">
            <div className="flex items-center gap-4 mb-3">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-6 w-6" />
              <div className="ml-auto">
                <Skeleton className="h-6 w-6" />
              </div>
            </div>
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default FeedSkeleton