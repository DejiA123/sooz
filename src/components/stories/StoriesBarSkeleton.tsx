import { Skeleton } from "@/components/ui/skeleton";

const StoriesBarSkeleton = () => {
  return (
    <div className="py-4 px-4 overflow-x-auto hide-scrollbar bg-surface/95 backdrop-blur-sm">
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 min-w-fit">
            <Skeleton className="w-16 h-16 rounded-full" />
            <Skeleton className="h-2 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
};

export { StoriesBarSkeleton };