import { Skeleton } from "@/components/ui/skeleton"

const ActivitySkeleton = () => {
  return (
    <div className="space-y-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-4 hover:bg-accent/50 transition-colors">
          <Skeleton className="w-6 h-6 mt-1" />
          
          <div className="flex-1">
            <div className="flex items-start gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              
              <div className="flex-1 min-w-0">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
          
          <Skeleton className="w-12 h-12 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export default ActivitySkeleton