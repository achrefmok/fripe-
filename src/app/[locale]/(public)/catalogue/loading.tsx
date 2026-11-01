import { GridSkeleton } from "@/features/catalog/components/product-card";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 md:px-6 md:pt-10">
      <div className="mb-6 h-10 w-48 animate-pulse bg-muted" />
      <div className="mb-6 h-12 w-full animate-pulse bg-muted" />
      <GridSkeleton />
    </div>
  );
}
