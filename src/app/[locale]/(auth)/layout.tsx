import { BrandLink } from "@/components/layout/brand";
import { LocaleSwitch, ThemeToggle } from "@/components/layout/header-controls";

// Le formulaire est une étiquette accrochée au portant, sur fond harissa.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col overflow-x-clip bg-harissa text-harissa-ink">
      <header className="flex h-14 items-center gap-1 px-4 pt-[env(safe-area-inset-top)] md:px-6">
        <BrandLink className="me-auto" />
        <LocaleSwitch />
        <ThemeToggle />
      </header>
      <div className="rail text-ink dark:text-paper" aria-hidden="true" />
      <main id="contenu" className="flex-1 px-4 pb-10 text-ink dark:text-paper">
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
