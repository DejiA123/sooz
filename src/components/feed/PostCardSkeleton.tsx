import { Skeleton } from "@/components/ui/skeleton";

export const PostCardSkeleton = () => {
    return (
        <article className="mb-8">
            {/* Media */}
            <Skeleton className="w-full aspect-[4/5] rounded-2xl" />

            {/* Content */}
            <div className="px-1 pt-3 space-y-2">
                <Skeleton className="h-5 w-28" />
                <div className="flex items-center gap-2">
                    <Skeleton className="w-5 h-5 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-4 w-full" />
                <div className="flex items-center gap-3 pt-1">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                </div>
            </div>
        </article>
    );
};
