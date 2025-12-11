import { Skeleton } from "@/components/ui/skeleton"

const ChatListSkeleton = () => {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="text-right">
            <Skeleton className="h-3 w-12 mb-2" />
            <div className="w-5 h-5 rounded-full bg-primary ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default ChatListSkeleton