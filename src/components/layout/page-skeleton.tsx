import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div aria-hidden="true" className="grid max-w-xl gap-4">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="mt-4 h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
