import { Skeleton } from "@/components/ui/skeleton"

const ProfileSkeleton = () => {
  return (
    <div className="bg-card">
      {/* Cover Image */}
      <Skeleton className="w-full h-48 md:h-64" />
      
      {/* Profile Info */}
      <div className="px-4 pb-4">
        <div className="flex items-start justify-between -mt-16 mb-4">
          <Skeleton className="w-32 h-32 rounded-full border-4 border-card" />
          <div className="mt-20 flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        
        <div className="mb-6">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        
        <div className="flex gap-6 mb-6">
          <div>
            <Skeleton className="h-5 w-16 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div>
            <Skeleton className="h-5 w-16 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div>
            <Skeleton className="h-5 w-16 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
        
        <div className="flex justify-around py-4 border-t border-border/50">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-6 w-6" />
        </div>
      </div>
      
      {/* Posts Grid */}
      <div className="grid grid-cols-3 gap-1 px-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    </div>
  )
}

export { ProfileSkeleton };

export default ProfileSkeleton