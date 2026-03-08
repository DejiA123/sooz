import { Skeleton } from "@/components/ui/skeleton";

export const PostCardSkeleton = () => {
  return (
    <article>
      <Skeleton className="w-full aspect-[4/5]" />
      <div className="px-4 py-2">
        <Skeleton className="h-3 w-full" />
      </div>
    </article>
  );
};