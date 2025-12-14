import { Skeleton } from "@/components/ui/skeleton";

export const PostCardSkeleton = () => {
    return (
        <article className="mb-4 border-b border-white/5 pb-4 last:border-0 sm:border sm:rounded-lg sm:bg-card">
            {/* Header */}
            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
            </div>

            {/* Media */}
            <Skeleton className="w-full aspect-square" />

            {/* Action Bar */}
            <div className="px-3 pt-3 pb-1">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                        <Skeleton className="w-6 h-6 rounded-full" />
                        <Skeleton className="w-6 h-6 rounded-full" />
                        <Skeleton className="w-6 h-6 rounded-full" />
                    </div>
                    <Skeleton className="w-6 h-6 rounded-full" />
                </div>

                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-3 w-16" />
            </div>
        </article>
    );
};
