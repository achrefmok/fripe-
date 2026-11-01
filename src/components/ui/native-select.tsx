import { cn } from "@/lib/utils";

// Sélecteur natif : sans JavaScript, adapté au mobile, et utilisable dans un formulaire GET.
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "field-line h-12 w-full border-input text-base outline-none disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}
