import { Skeleton } from "@/components/ui/skeleton";

const DiscoverSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Search Bar Skeleton */}
      <div className="px-4 pt-4">
        <Skeleton className="h-10 w-full" />
      </div>
      
      {/* Trending Section */}
      <div className="px-4">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
      
      {/* Suggested Users */}
      <div className="px-4">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export { DiscoverSkeleton };