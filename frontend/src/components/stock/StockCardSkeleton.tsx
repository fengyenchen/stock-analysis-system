import { Skeleton } from "@/components/ui/Skeleton";

export function StockCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-4 w-12 rounded-full" />
        </div>
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="flex items-end justify-between pt-1">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-20 rounded" />
      </div>
    </div>
  );
}
